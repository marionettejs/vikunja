import {afterEach, expect, it, vi} from 'vitest'
import type {Route} from '@/app/routes'
import ProjectModel from '@/models/project'
import TaskModel from '@/models/task'
import {ProjectGanttResultsApplication} from './project-gantt-results'
const getTasks = vi.hoisted(() => vi.fn())
vi.mock('@/services/taskCollection', async importOriginal => ({...await importOriginal<typeof import('@/services/taskCollection')>(), default: class {totalPages = 2; getTasks = getTasks}}))
let app: InstanceType<typeof ProjectGanttResultsApplication> | undefined
afterEach(() => {app?.destroy(); getTasks.mockReset()})
const destination = {project: new ProjectModel({id: 1}), route: {params: {viewId: '2'}, query: {dateFrom: '2026-10-01', dateTo: '2026-10-20'}} as unknown as Route}
function setup() {
	const publish = vi.fn(), reportError = vi.fn()
	app = new ProjectGanttResultsApplication({getStoredQuery: () => ({}), setStoredQuery: vi.fn(), navigateQuery: vi.fn(), pending: vi.fn(), loading: vi.fn(), publish, reportError})
	return {publish, reportError}
}
it('publishes one complete result after fetching every page', async () => {
	const {publish} = setup()
	getTasks.mockResolvedValueOnce([new TaskModel({id: 1})]).mockResolvedValueOnce([new TaskModel({id: 2})])
	expect(await app!.loadRoute(destination)).toBe(true)
	expect(getTasks.mock.calls.map(call => call[2])).toEqual([1, 2])
	expect(publish.mock.calls[0][0].map((task: TaskModel) => task.id)).toEqual([1, 2])
	expect(publish).toHaveBeenCalledOnce()
})
it('stopping mid-pagination aborts transport and prevents partial publication', async () => {
	const {publish, reportError} = setup()
	let release!: (tasks: TaskModel[]) => void
	getTasks.mockResolvedValueOnce([new TaskModel({id: 1})]).mockImplementationOnce(() => new Promise(resolve => {release = resolve}))
	const pending = app!.loadRoute(destination)
	await vi.waitFor(() => expect(getTasks).toHaveBeenCalledTimes(2))
	const signal = getTasks.mock.calls[1][3] as AbortSignal
	app!.stop(); expect(signal.aborted).toBe(true)
	release([new TaskModel({id: 2})]); expect(await pending).toBe(false)
	expect(publish).not.toHaveBeenCalled(); expect(reportError).not.toHaveBeenCalled()
})
it('identical URL retries after observed failure and obsolete errors stay silent', async () => {
	const {publish, reportError} = setup()
	getTasks.mockRejectedValueOnce(new Error('Fixture Gantt failure'))
	expect(await app!.loadRoute(destination)).toBe(false)
	getTasks.mockResolvedValueOnce([new TaskModel({id: 1})]).mockResolvedValueOnce([])
	expect(await app!.loadRoute(destination)).toBe(true)
	expect(reportError).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenCalledOnce()
})
