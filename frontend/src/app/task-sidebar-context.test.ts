import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {WorkspaceApplication} from './workspace'
import {SessionApplication} from './session'
import {NavigationView} from './navigation'
import {ShellView} from './shell-view'
import type {QuickActionsApplication} from '../features/quick-actions/application'
import {parseRoute} from './routes'
import ProjectModel from '@/models/project'
import ProjectViewModel from '@/models/projectView'
import TaskModel from '@/models/task'
import UserModel from '@/models/user'

const transport = vi.hoisted(() => ({projects: vi.fn(), project: vi.fn(), task: vi.fn(), bulk: vi.fn(), projectCreate: vi.fn()}))
vi.mock('@/services/project', () => ({default: class {totalPages = 1; getAll = transport.projects; get = transport.project; create = transport.projectCreate}}))
vi.mock('@/services/task', () => ({default: class {get = transport.task; bulkCreate = transport.bulk}}))
vi.mock('@/services/notification', () => ({default: class {getAll = async () => []}}))
vi.mock('@/services/taskCollection', async original => ({...await original<typeof import('@/services/taskCollection')>(), default: class {totalPages = 1; getAll = async () => []}}))
vi.mock('../features/labels/label-transport', () => ({loadLabels: async () => [], createLabel: vi.fn()}))
let workspace: InstanceType<typeof WorkspaceApplication>, session: InstanceType<typeof SessionApplication>, region: InstanceType<typeof Region>
afterEach(() => {workspace?.destroy(); session?.destroy(); region?.destroy(); vi.clearAllMocks(); localStorage.clear(); history.replaceState({}, '', '/')})
async function setup() {
	const projects = [1, 2, 3].map(id => new ProjectModel({id, title: `Project ${id}`, maxPermission: 2, views: [new ProjectViewModel({id: id * 10, viewKind: 'table'})]}))
	transport.projects.mockResolvedValue(projects); transport.project.mockImplementation(async (value: ProjectModel) => projects.find(project => project.id === value.id))
	transport.task.mockImplementation(async (value: TaskModel) => new TaskModel({id: value.id, title: `Task ${value.id}`, projectId: value.id === 1 ? 2 : 3, maxPermission: 2}))
	const user = new UserModel({id: 1}); user.settings.defaultProjectId = 1
	transport.bulk.mockImplementation(async (tasks: TaskModel[]) => ({tasks: tasks.map(task => new TaskModel({...task, id: 80}))}))
	transport.projectCreate.mockImplementation(async (project: ProjectModel) => new ProjectModel({...project, id: 90}))
	session = new SessionApplication(); session.getState().set({status: 'authenticated', user, config: {}})
	region = new Region({el: document.createElement('div')})
	workspace = new WorkspaceApplication({session, region, navigate: vi.fn()})
	await workspace.start(); await vi.waitFor(() => expect(workspace.getState().projects.length).toBe(3))
	const navigation = (workspace.shell().getView() as InstanceType<typeof ShellView>).getChildView('navigation') as InstanceType<typeof NavigationView>
	const enter = (path: string) => workspace.showRoute(parseRoute(new URL(path, 'http://fixture')))
	const selected = () => Array.from(navigation.el.querySelectorAll<HTMLAnchorElement>('.list-menu-link.router-link-exact-active')).map(link => link.getAttribute('href'))
	return {navigation, enter, selected}
}
it('fresh direct task and a second task retain an empty sidebar context', async () => {
	const {enter, selected} = await setup()
	await enter('/tasks/1'); expect(selected()).toEqual([]); expect(workspace.getState().taskProjectId).toBe(2)
	await enter('/tasks/2'); expect(selected()).toEqual([]); expect(workspace.getState().taskProjectId).toBe(3)
})
it('entering a cross-project task retains the project sidebar context', async () => {
	const {enter, selected} = await setup()
	await enter('/projects/1/10'); expect(selected()).toEqual(['/projects/1'])
	await enter('/tasks/1'); expect(selected()).toEqual(['/projects/1']); expect(workspace.getState().taskProjectId).toBe(2)
	const accepted = workspace.taskPorts(workspace.widgets().context).accepted
	accepted(new TaskModel({id: 1, projectId: 2, title: 'Renamed', maxPermission: 2}))
	expect(selected()).toEqual(['/projects/1'])
})
it('an accepted explicit project move updates sidebar context and task ownership', async () => {
	const {enter, selected} = await setup()
	await enter('/projects/1/10'); await enter('/tasks/1')
	workspace.taskPorts(workspace.widgets().context).accepted(new TaskModel({id: 1, projectId: 3, maxPermission: 2}))
	expect(selected()).toEqual(['/projects/3']); expect(workspace.getState().taskProjectId).toBe(3)
	expect(workspace.getState().backgroundProjectId).toBe(3); expect(workspace.getState().headerProjectId).toBe(3)
})

it('a task modal retains its backdrop project sidebar context', async () => {
	const {enter, selected} = await setup()
	await enter('/projects/1/10')
	history.replaceState({backdropView: '/projects/1/10', modal: true}, '', '/tasks/2')
	await enter('/tasks/2')
	expect(selected()).toEqual(['/projects/1']); expect(workspace.getState().taskProjectId).toBe(3)
})


for (const context of ['fresh-task', 'prior-project', 'moved-task'] as const) {
	it(`quick creation uses the current project context after ${context}`, async () => {
		const {enter} = await setup()
		if (context !== 'fresh-task') await enter('/projects/1/10')
		await enter('/tasks/1')
		if (context === 'moved-task') workspace.taskPorts(workspace.widgets().context).accepted(new TaskModel({id: 1, projectId: 3, maxPermission: 2}))
		const quick = workspace.shell().getChildApp('quickActions') as InstanceType<typeof QuickActionsApplication>
		const caller = new AbortController()
		expect(await quick.create('newTask', 'Created task', caller.signal)).toBe('/tasks/80')
		expect(transport.bulk.mock.calls[0][0][0].projectId).toBe(context === 'moved-task' ? 3 : 1)
		expect(await quick.create('newProject', 'Created project', caller.signal)).toBe('/projects/90')
		expect(transport.projectCreate.mock.calls[0][0].parentProjectId).toBe(context === 'fresh-task' ? 0 : context === 'moved-task' ? 3 : 1)
		expect(workspace.getState().taskProjectId).toBe(context === 'moved-task' ? 3 : 2)
	})
}

it('quick creation excludes a retained saved-filter project context', async () => {
	const {enter} = await setup()
	workspace.getState().projects.add({id: -5, project: new ProjectModel({id: -5, title: 'Saved filter'})})
	workspace.shell().routeChanged(parseRoute(new URL('http://fixture/projects/-5/50')), -5)
	await enter('/tasks/1')
	const quick = workspace.shell().getChildApp('quickActions') as InstanceType<typeof QuickActionsApplication>
	expect(quick.options.currentProject()).toBeUndefined()
	await quick.create('newTask', 'Filtered context task', new AbortController().signal)
	expect(transport.bulk.mock.calls[0][0][0].projectId).toBe(1)
	await quick.create('newProject', 'Top-level project', new AbortController().signal)
	expect(transport.projectCreate.mock.calls[0][0].parentProjectId).toBe(0)
})
