import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {ProjectApplication} from './application'
import {ProjectListResultsApplication} from './project-list-results'
import {ProjectGanttResultsApplication} from './project-gantt-results'
import {ProjectTableView} from './project-table'
import {ProjectGanttView} from './project-gantt'
import {parseRoute} from '@/app/routes'
import ProjectModel from '@/models/project'
import ProjectViewModel from '@/models/projectView'
import TaskModel from '@/models/task'

const transport = vi.hoisted(() => ({project: vi.fn(), tasks: vi.fn()}))
vi.mock('@/services/project', () => ({default: class {get = transport.project}}))
vi.mock('@/services/taskCollection', async importOriginal => ({
	...await importOriginal<typeof import('@/services/taskCollection')>(),
	default: class {totalPages = 1; getAll = transport.tasks; getTasks = transport.tasks},
}))
let app: InstanceType<typeof ProjectApplication> | undefined
let region: InstanceType<typeof Region> | undefined
afterEach(() => {
	app?.destroy()
	region?.destroy()
	transport.project.mockReset()
	transport.tasks.mockReset()
	localStorage.clear()
})

async function pendingHost(kind: 'table' | 'gantt') {
	const project = new ProjectModel({id: 1, views: [new ProjectViewModel({id: 3, viewKind: kind})]})
	transport.project.mockResolvedValue(project)
	let resolve!: (tasks: TaskModel[]) => void, reject!: (error: Error) => void
	transport.tasks.mockImplementationOnce(() => new Promise<TaskModel[]>((done, fail) => {resolve = done; reject = fail}))
	const reportError = vi.fn()
	region = new Region({el: document.createElement('div')})
	app = new ProjectApplication({region, kanban: {setTaskDragging: vi.fn()} as never,
		taskPorts: {} as never, widgets: {} as never, commitProject: vi.fn(),
		timezone: () => 'UTC', navigateQuery: vi.fn(), reportError})
	const route = parseRoute(new URL('http://fixture/projects/1/3'))
	expect(await app.start(route)).toBe(true)
	expect(transport.tasks).toHaveBeenCalledOnce()
	const results = app.getChildApp(kind === 'gantt' ? 'ganttResults' : 'results')! as InstanceType<typeof ProjectListResultsApplication> | InstanceType<typeof ProjectGanttResultsApplication>
	const readiness = results.loadRoute({route, project})!
	const host = app.getView()! as InstanceType<typeof ProjectTableView> | InstanceType<typeof ProjectGanttView>
	const publish = vi.spyOn(host, 'publish')
	const loading = vi.spyOn(results.options, 'loading')
	const signal = transport.tasks.mock.calls[0][3] as AbortSignal
	return {host, results, readiness, signal, publish, reportError, loading, resolve, reject}
}

for (const kind of ['table', 'gantt'] as const) {
	it(`${kind} keeps its real results host and publishes normally while owned`, async () => {
		const {resolve, readiness, publish, signal, reportError} = await pendingHost(kind)
		resolve([new TaskModel({id: 1})])
		expect(await readiness).toBe(true)
		expect(signal.aborted).toBe(false)
		expect(publish).toHaveBeenCalledOnce()
		expect(reportError).not.toHaveBeenCalled()
	})
	it(`${kind} replaces its root on restart and publishes only the replacement results`, async () => {
		const first = await pendingHost(kind)
		transport.tasks.mockResolvedValueOnce([new TaskModel({id: 2})])
		expect(await app!.restart(parseRoute(new URL('http://fixture/projects/1/3')))).toBe(true)
		const replacement = app!.getView()! as InstanceType<typeof ProjectTableView> | InstanceType<typeof ProjectGanttView>
		expect(replacement).not.toBe(first.host)
		expect(first.host.isDestroyed()).toBe(true)
		expect(first.signal.aborted).toBe(true)
		expect(await first.readiness).toBe(false)
		first.resolve([new TaskModel({id: 1})])
		await vi.waitFor(() => expect(replacement.getState().tasks.map(task => task.id)).toEqual([2]))
		expect(first.publish).not.toHaveBeenCalled()
		expect(first.reportError).not.toHaveBeenCalled()
	})
	for (const loss of ['view-destroy', 'region-empty'] as const) {
		it(`${kind} cancels pending results when its real host is independently lost through ${loss}`, async () => {
			const {host, resolve, readiness, publish, signal, results, reportError, loading} = await pendingHost(kind)
			if (loss === 'view-destroy') host.destroy()
			else region!.empty()
			const abortedOnLoss = signal.aborted
			resolve([new TaskModel({id: 1})])
			const ready = await readiness.catch((error: unknown) => error)
			expect(host.isDestroyed()).toBe(true)
			expect(app!.getView()).toBeUndefined()
			expect.soft(abortedOnLoss).toBe(true)
			expect.soft(ready).toBe(false)
			expect(results.isRunning()).toBe(false)
			expect(publish).not.toHaveBeenCalled()
			expect(loading).not.toHaveBeenCalled()
			expect(reportError).not.toHaveBeenCalled()
		})
	}
	it(`${kind} suppresses an obsolete transport failure after independent Region destruction`, async () => {
		const {host, reject, readiness, signal, reportError} = await pendingHost(kind)
		region!.destroy()
		const abortedOnLoss = signal.aborted
		reject(new Error('Response after results host loss'))
		const ready = await readiness.catch((error: unknown) => error)
		expect.soft(ready).toBe(false)
		expect(host.isDestroyed()).toBe(true)
		expect(abortedOnLoss).toBe(true)
		expect(reportError).not.toHaveBeenCalled()
	})
}
