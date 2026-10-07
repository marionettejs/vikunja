import {afterEach, expect, it, vi} from 'vitest'
import {ProjectApplication} from './application'
import {parseRoute} from '../../app/routes'
import ProjectModel from '@/models/project'
const get = vi.hoisted(() => vi.fn())
vi.mock('@/services/project', () => ({default: class {get = get}}))
let app: InstanceType<typeof ProjectApplication> | undefined
afterEach(() => { app?.destroy(); get.mockReset() })
it('project metadata stopped during preparation cannot commit an obsolete project', async () => {
	let resolve!: (project: ProjectModel) => void
	let signal!: AbortSignal
	get.mockImplementation((_model, _params, ownerSignal) => { signal = ownerSignal; return new Promise(done => { resolve = done }) })
	const commitProject = vi.fn()
	app = new ProjectApplication({kanban: {setTaskDragging: vi.fn()} as never, taskPorts: {} as never, widgets: {} as never, commitProject, timezone: () => 'UTC', navigateQuery: vi.fn(), reportError: vi.fn()})
	const preparation = app.start(parseRoute(new URL('http://fixture/projects/1/3')))
	app.stop(); expect(signal.aborted).toBe(true); resolve(new ProjectModel({id: 1}))
	expect(await preparation).toBe(false); expect(commitProject).not.toHaveBeenCalled()
})
