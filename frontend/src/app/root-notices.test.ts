import {afterEach,expect,it,vi} from 'vitest'
import {View} from 'marionette'
import {VikunjaApplication} from './application'
import {reportError,success} from '../shared/notifications'
let app:InstanceType<typeof VikunjaApplication>|undefined
function finishAnimations(state){for (const row of state.notices()) for (const animation of row.getAnimations()) if (animation.playState === 'running') animation.finish()}
async function setup(){
 const host=document.createElement('div');document.body.append(host)
 app=new VikunjaApplication({region:{el:host}})
 vi.spyOn(app,'prepareStart').mockResolvedValue(undefined);vi.spyOn(app,'dispatch').mockResolvedValue(undefined);vi.spyOn(app,'navigate').mockImplementation(()=>{})
 await app.start()
 return {root:app.getView()! as InstanceType<typeof View>,host,notices:()=>Array.from(host.querySelectorAll('.vue-notification'))}
}
afterEach(()=>{app?.destroy();app=undefined;vi.restoreAllMocks();vi.useRealTimers();document.body.replaceChildren()})
it('ready root retains two notices and duplicate count across a session layout replacement',async()=>{
 const state=await setup();success('accepted public mutation');reportError(new Error('public retry unavailable'))
 expect(state.notices()).toHaveLength(2);const notice=state.notices()[0]
 app!.getChildApp('session')!.trigger('signed:out');state.root.showChildView('workspace',new View({template:()=>'<div>Anonymous layout</div>'}))
 expect(state.notices()[0]).toBe(notice)
 success('accepted public mutation');expect(state.notices()).toHaveLength(2);expect(notice.textContent).toContain('×2')
 success('third public mutation');finishAnimations(state);expect(state.notices().map(el=>el.textContent)).toEqual([expect.stringContaining('public retry unavailable'),expect.stringContaining('third public mutation')])
})
it('root notice expiry and actual App destruction remove subscription and pending timers',async()=>{
 vi.useFakeTimers();const state=await setup();success('bounded public notification');expect(state.notices()).toHaveLength(1)
 vi.advanceTimersByTime(4000);finishAnimations(state);expect(state.notices()).toHaveLength(0)
 success('active on teardown');const notice=state.notices()[0];app!.destroy();app=undefined
 success('after teardown');vi.runAllTimers();expect(notice.isConnected).toBe(false);expect(state.host.querySelector('.vue-notification')).toBeNull()
})
it('going offline destroys current notices and reconnecting creates one fresh live owner',async()=>{
 const state=await setup();success('before offline');expect(state.notices()).toHaveLength(1)
 app!.connectionChanged(false);expect(state.notices()).toHaveLength(0);success('offline publication');expect(state.notices()).toHaveLength(0)
 app!.connectionChanged(true);success('accepted after reconnect');expect(state.notices()).toHaveLength(1);expect(state.notices()[0].textContent).toContain('accepted after reconnect')
})
