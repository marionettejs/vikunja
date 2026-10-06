import {afterEach, expect, it, vi} from 'vitest'
import type {Route} from '@/app/routes'
import ProjectModel from '@/models/project'
import TaskModel from '@/models/task'
import {ProjectListResultsApplication} from './project-list-results'

const getAll = vi.hoisted(() => vi.fn())
vi.mock('@/services/taskCollection', async importOriginal => ({...await importOriginal<typeof import('@/services/taskCollection')>(), default: class {totalPages = 1; getAll = getAll}}))
let app: InstanceType<typeof ProjectListResultsApplication> | undefined
afterEach(() => { app?.destroy(); getAll.mockReset() })
const destination = {project: new ProjectModel({id: 1}), route: {params: {viewId: '1'}, query: {}} as unknown as Route}
function setup() {
	const publish = vi.fn(), reportError = vi.fn()
	app = new ProjectListResultsApplication({timezone: () => 'UTC', getStoredQuery: () => ({}), setStoredQuery: vi.fn(), navigateQuery: vi.fn(), pending: vi.fn(), loading: vi.fn(), publish, reportError})
	return {publish, reportError}
}
it('returns observed readiness and retries a failed query at the identical URL', async () => {
	const {publish, reportError} = setup()
	const failure = new Error('Fixture list failure')
	getAll.mockRejectedValueOnce(failure).mockResolvedValueOnce([new TaskModel({id: 1})])
	expect(await app!.loadRoute(destination)).toBe(false)
	expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
	expect(await app!.loadRoute(destination)).toBe(true)
	expect(publish).toHaveBeenCalledTimes(1)
	expect(getAll).toHaveBeenCalledTimes(2)
})
it('stopping readiness rejects a late failure without changing the current loading/error surface', async () => {
	const {publish, reportError} = setup()
	let reject!: (error: Error) => void
	getAll.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
	const pending = app!.loadRoute(destination)
	app!.stop()
	reject(new Error('Obsolete list failure'))
	expect(await pending).toBe(false)
	expect(reportError).not.toHaveBeenCalled()
	expect(publish).not.toHaveBeenCalled()
})

it('same-query callers join the observed readiness result when it fails', async () => {
	const {reportError} = setup()
	let reject!: (error: Error) => void
	getAll.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
	const first = app!.loadRoute(destination)
	const second = app!.loadRoute(destination)
	expect(second).toBe(first)
	reject(new Error('Shared failure'))
	expect(await first).toBe(false)
	expect(await second).toBe(false)
	expect(reportError).toHaveBeenCalledTimes(1)
})
