import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import type {SortableEvent} from 'sortablejs'
import {ProjectApplication} from './application'
import {ProjectGanttView} from './project-gantt'
import {ProjectGanttResultsApplication} from './project-gantt-results'
import {parseRoute} from '@/app/routes'
import ProjectModel from '@/models/project'
import ProjectViewModel from '@/models/projectView'
import TaskModel from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'
const transport = vi.hoisted(() => ({project: vi.fn(), tasks: vi.fn(), update: vi.fn(), create: vi.fn(), position: vi.fn()}))
vi.mock('@/services/project', () => ({default: class {get = transport.project}}))
vi.mock('@/services/taskPosition', () => ({default: class {update = transport.position}}))
vi.mock('@/services/task', () => ({default: class {update = transport.update; create = transport.create}}))
vi.mock('@/services/taskCollection', async importOriginal => ({
	...await importOriginal<typeof import('@/services/taskCollection')>(),
	default: class {totalPages = 1; getAll = transport.tasks; getTasks = transport.tasks},
}))
let app: InstanceType<typeof ProjectApplication> | undefined
let region: InstanceType<typeof Region> | undefined
afterEach(() => {app?.destroy(); region?.destroy(); Object.values(transport).forEach(mock => mock.mockReset()); localStorage.clear()})
async function setup(kind: 'save' | 'create', submit: false | 'shared' | 'after-save' = false) {
	const project = new ProjectModel({id: 1, maxPermission: 2, views: [new ProjectViewModel({id: 3, viewKind: 'gantt'})]})
	transport.project.mockResolvedValue(project)
	transport.tasks.mockResolvedValue([])
	region = new Region({el: document.createElement('div')})
	app = new ProjectApplication({region, kanban: {setTaskDragging: vi.fn(), dropProject: () => undefined} as never,
		taskPorts: {} as never, widgets: {context: {t: (key: string) => key}} as never, commitProject: vi.fn(),
		timezone: () => 'UTC', navigateQuery: vi.fn(), reportError: vi.fn()})
	const route = parseRoute(new URL('http://fixture/projects/1/3'))
	expect(await app.start(route)).toBe(true)
	await (app.getChildApp('ganttResults') as InstanceType<typeof ProjectGanttResultsApplication>).loadRoute({route, project})
	const host = app.getView()! as InstanceType<typeof ProjectGanttView>
	// Keep the real surface callback and parent-owned TaskRecordSession; only
	// callback-only controls suppress drawing; submission cases use the real body.
	const published = vi.spyOn(host, 'taskUpdated')
	if (!submit) published.mockImplementation(() => {})
	let finish!: (task: TaskModel) => void
	const write = kind === 'save' ? transport.update : transport.create
	write.mockImplementationOnce(() => new Promise<TaskModel>(resolve => {finish = resolve}))
	const original = new TaskModel({id: 7, projectId: 1, title: 'original'})
	app.getState().tasks = [original]
	let pending: Promise<unknown>
	if (submit) {
		// Exercise the real root/frame/body submission with the same published array,
		// rather than detaching Application state and calling only its callback.
		host.publish(app.getState().tasks, host.getState().query)
		host.onAttach()
		if (submit === 'after-save') app.taskUpdated(new TaskModel({...original, title: 'saved before creation'}))
		const body = host.body()!
		const input = body.el.querySelector<HTMLInputElement>('[data-title]')!
		input.hidden = false; input.value = 'created'
		pending = body.createSubmitted()
	} else pending = (kind === 'save' ? host.options.save(original, {title: 'saved'}) : host.options.create('created')).catch((error: unknown) => error)
	await vi.waitFor(() => expect(write).toHaveBeenCalledOnce())
	return {host, published, pending, signal: write.mock.calls[0][1] as AbortSignal, finish, route}
}
for (const kind of ['save', 'create'] as const) {
	it(`Gantt ${kind} publishes normally while its real host is owned`, async () => {
		const {published, pending, signal, finish} = await setup(kind)
		finish(new TaskModel({id: kind === 'save' ? 7 : 8, projectId: 1, title: 'accepted'}))
		expect(await pending).toMatchObject({title: 'accepted'})
		expect(signal.aborted).toBe(false)
		expect(app!.getState().tasks.map(task => task.title)).toEqual(kind === 'save' ? ['accepted'] : ['original', 'accepted'])
		expect(published).toHaveBeenCalledTimes(kind === 'save' ? 1 : 0)
	})
	for (const loss of ['view-destroy', 'region-empty', 'restart'] as const) {
		it(`Gantt ${kind} cannot publish after its real host is lost through ${loss}`, async () => {
			const {host, published, pending, signal, finish, route} = await setup(kind)
			if (loss === 'view-destroy') host.destroy()
			else if (loss === 'region-empty') region!.empty()
			else {
				expect(await app!.restart(route)).toBe(true)
				await vi.waitFor(() => expect(app!.getState().tasks).toEqual([]))
			}
			const tasksBeforeCompletion = [...app!.getState().tasks]
			expect.soft(signal.aborted).toBe(true)
			finish(new TaskModel({id: kind === 'save' ? 7 : 8, projectId: 1, title: 'obsolete'}))
			const result = await pending
			expect.soft(result instanceof DOMException ? result.name : undefined).toBe('AbortError')
			expect(app!.getState().tasks).toEqual(tasksBeforeCompletion)
			expect(published).not.toHaveBeenCalled()
			expect(app!.options.reportError).not.toHaveBeenCalled()
			if (loss === 'restart') {
				// Retained Application supplies a fresh write owner to its replacement.
				const replacement = app!.getView()! as InstanceType<typeof ProjectGanttView>
				vi.spyOn(replacement, 'taskUpdated').mockImplementation(() => {})
				transport.update.mockResolvedValueOnce(new TaskModel({id: 9, title: 'new owner'}))
				await expect(replacement.options.save(new TaskModel({id: 9}), {title: 'new owner'})).resolves.toMatchObject({title: 'new owner'})
			}
		})
	}
}

for (const lost of [false, true]) {
	it(`project position write ${lost ? 'is cancelled on Region host loss' : 'publishes while owned'}`, async () => {
		const {pending, finish} = await setup('create')
		finish(new TaskModel({id: 8, projectId: 1}))
		await pending
		const container = document.createElement('div'), item = document.createElement('div')
		item.dataset.taskId = '7'
		container.append(item)
		let accept!: () => void
		transport.position.mockImplementationOnce(() => new Promise<void>(resolve => {accept = resolve}))
		app!.getState().tasks[0] = {...app!.getState().tasks[0], position: 10}
		const write = app!.dragFinished({item, from: container, to: container, originalEvent: new MouseEvent('mouseup')} as unknown as SortableEvent)
		const signal = transport.position.mock.calls[0][1] as AbortSignal
		const before = [...app!.getState().tasks]
		if (lost) region!.empty()
		expect(signal.aborted).toBe(lost)
		accept()
		await write
		if (lost) expect(app!.getState().tasks).toEqual(before)
		else expect(app!.getState().tasks[0].position).not.toBe(before[0].position)
		expect(app!.options.reportError).not.toHaveBeenCalled()
	})
}

for (const publication of ['shared', 'after-save'] as const) it(`Gantt body submission publishes a created task exactly once after ${publication} publication`, async () => {
 const {host, pending, finish} = await setup('create', publication)
 finish(new TaskModel({id: 8, projectId: 1, title: 'accepted'}))
 await pending
 expect(transport.create).toHaveBeenCalledOnce()
 expect(app!.getState().tasks.map(task => task.id)).toEqual([7, 8])
 expect(host.getState().tasks.map(task => task.id)).toEqual([7, 8])
 expect(host.body()!.getState().tasks.map((task: ITask) => task.id)).toEqual([7, 8])
 expect(host.body()!.el.querySelector<HTMLInputElement>('[data-title]')!.hidden).toBe(true)
 expect(app!.options.reportError).not.toHaveBeenCalled()
})
