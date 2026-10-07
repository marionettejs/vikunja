import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {VikunjaApplication} from './application'
import {SessionApplication} from './session'
import {ProjectApplication} from '../features/projects/application'
import {parseRoute} from './routes'
import UserModel from '@/models/user'
const owners: Array<{destroy: () => unknown}> = []
afterEach(() => {owners.splice(0).forEach(owner => owner.destroy()); vi.restoreAllMocks(); document.body.replaceChildren()})
async function root() {
 const host = document.createElement('div'); document.body.append(host)
 const app = new VikunjaApplication({region: {el: host}}); owners.push(app)
 vi.spyOn(app, 'prepareStart').mockResolvedValue(undefined)
 vi.spyOn(app, 'onStart').mockImplementation(() => {})
 await app.start()
 const session = app.getChildApp('session') as InstanceType<typeof SessionApplication>
 session.getState().set({status: 'authenticated', user: new UserModel({id: 1, type: 1})})
 history.replaceState({}, '', '/projects/1/1')
 return {app, session}
}
it('stopping root before its Workspace module resolves cannot create or mount the routed owner', async () => {
 const {app} = await root()
 expect(app.getChildApp('workspace')).toBeUndefined()
 const pending = app.dispatch(); app.stop(); await pending
 expect(app.getChildApp('workspace')).toBeUndefined()
 expect(document.querySelector('.app-container')).toBeNull()
})
it('a later anonymous destination wins over pending Workspace loading', async () => {
 const {app, session} = await root()
 const pending = app.dispatch()
 session.getState().set({status: 'anonymous', user: null})
 history.replaceState({}, '', '/login')
 const login = app.getChildApp('authentication')!
 const start = vi.spyOn(login, 'start').mockResolvedValue(true)
 await app.dispatch(); await pending
 expect(app.getChildApp('workspace')).toBeUndefined()
 expect(start).toHaveBeenCalledTimes(1)
 expect(start.mock.calls[0][0]).toMatchObject({path: '/login'})
 expect(app.getState().destination).toBe('authentication')
})
for (const end of ['close', 'stop'] as const) it(`${end} during task module loading cannot create a late modal owner`, async () => {
 const app = new ProjectApplication({kanban: {setTaskDragging: vi.fn()} as never, taskPorts: {} as never, widgets: {} as never, commitProject: vi.fn(), timezone: () => 'UTC', navigateQuery: vi.fn(), reportError: vi.fn()}); owners.push(app)
 vi.spyOn(app, 'prepareStart').mockResolvedValue({} as never)
 vi.spyOn(app, 'onStart').mockImplementation(() => {})
 await app.start(parseRoute(new URL('http://fixture/projects/1/1')))
 const host = document.createElement('div'); document.body.append(host)
 const region = new Region({el: host}); owners.push(region)
 const pending = app.showTask(parseRoute(new URL('http://fixture/tasks/1')), region)
 if (end === 'close') app.closeTask(); else app.stop()
 await pending
 expect(app.getChildApp('task')).toBeUndefined()
 expect(region.hasView()).toBe(false)
 expect(app.options.reportError).not.toHaveBeenCalled()
})
