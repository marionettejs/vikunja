import {afterEach, expect, it, vi} from 'vitest'
import {VikunjaApplication} from './application'
import {View} from 'marionette'
import {Model} from '@mnjs/data'
import {ShareShellView} from './share-shell'
import {reportError, success} from '../shared/notifications'
let app: InstanceType<typeof VikunjaApplication> | undefined
function finishAnimations(state){for (const row of state.notices()) for (const animation of row.getAnimations()) if (animation.playState === 'running') animation.finish()}
async function setup() {
 const host = document.createElement('div'); document.body.append(host)
 app = new VikunjaApplication({region:{el:host}})
 vi.spyOn(app,'prepareStart').mockResolvedValue(undefined);vi.spyOn(app,'dispatch').mockResolvedValue(undefined);vi.spyOn(app,'navigate').mockImplementation(()=>{})
 await app.start()
 const view = new ShareShellView({session:new Model(),logoVisible:false,hash:'fixture-share',navigate:vi.fn(),retry:vi.fn()})
 ;(app.getView()! as InstanceType<typeof View>).showChildView('workspace',view)
 return {view,host,notices:() => Array.from(host.querySelectorAll('.vue-notification'))}
}
afterEach(() => {app?.destroy(); app=undefined; vi.restoreAllMocks(); vi.useRealTimers(); document.body.replaceChildren()})
it('public shell uses the sole root notice owner for two messages, duplicates and eviction', async () => {
 const state=await setup()
 success('accepted public mutation'); reportError(new Error('public retry unavailable'))
 expect(state.notices()).toHaveLength(2);expect(state.view.el.querySelector('[data-notices]')).toBeNull()
 success('accepted public mutation')
 expect(state.notices()).toHaveLength(2)
 expect(state.notices()[0].textContent).toContain('×2')
 success('third public mutation')
 finishAnimations(state)
 expect(state.notices()).toHaveLength(2)
 expect(state.notices().map(el=>el.textContent)).toEqual([expect.stringContaining('public retry unavailable'),expect.stringContaining('third public mutation')])
})
it('public shell teardown retains original notice expiry while root destruction removes subscription', async () => {
 vi.useFakeTimers(); const state=await setup()
 success('bounded public notification')
 expect(state.notices()).toHaveLength(1)
 ;(app!.getView()! as InstanceType<typeof View>).getRegion('workspace')!.empty();expect(state.view.isDestroyed()).toBe(true);expect(state.notices()).toHaveLength(1)
 vi.advanceTimersByTime(4000)
 finishAnimations(state)
 expect(state.notices()).toHaveLength(0)
 success('active on teardown'); expect(state.notices()).toHaveLength(1)
 const notices=state.notices()[0];app!.destroy();app=undefined
 success('after teardown');vi.runAllTimers()
 expect(notices.isConnected).toBe(false)
 expect(state.host.querySelector('.vue-notification')).toBeNull()
})
