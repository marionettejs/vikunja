import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {NoticeView} from './notice-view'
import {success} from './notifications'
let region: InstanceType<typeof Region> | undefined
function setup(){
 const home=document.createElement('div');document.body.append(home);region=new Region({el:home})
 const view=new NoticeView();region.show(view)
 return {view,home,host:view.el.querySelector('[data-notices]')!,entries:()=>Array.from(document.querySelectorAll('.vue-notification'))}
}
function modal(){const dialog=document.createElement('dialog');dialog.setAttribute('open','');const button=document.createElement('button');dialog.append(button);document.body.append(dialog);button.focus();return {dialog,button}}
afterEach(()=>{region?.destroy();region=undefined;vi.useRealTimers();document.body.replaceChildren()})
it('dismisses one queued entry while keeping the remaining notice reachable in its modal',()=>{
 const state=setup(),active=modal();success('first');success('second')
 expect(state.host.parentElement).toBe(active.dialog)
 ;(state.entries()[0] as HTMLElement).click()
 expect(state.entries()).toHaveLength(1);expect(state.entries()[0].textContent).toContain('second')
 expect(state.host.parentElement).toBe(active.dialog)
 ;(state.entries()[0] as HTMLElement).click()
 expect(state.host.parentElement).toBe(state.view.el)
})
it('follows focus into nested dialogs and restores remaining dialog then original owner',()=>{
 const state=setup(),first=modal();success('nested notice')
 expect(state.host.parentElement).toBe(first.dialog)
 const second=modal();expect(state.host.parentElement).toBe(second.dialog)
 second.dialog.removeAttribute('open');second.dialog.dispatchEvent(new Event('close'))
 expect(state.host.parentElement).toBe(first.dialog)
 first.dialog.removeAttribute('open');first.dialog.dispatchEvent(new Event('close'))
 expect(state.host.parentElement).toBe(state.view.el)
})
it('duplicate count leaves the original expiry deadline unchanged',()=>{
 vi.useFakeTimers();const state=setup();success('duplicate')
 vi.advanceTimersByTime(3500);success('duplicate')
 expect(state.entries()).toHaveLength(1);expect(state.entries()[0].textContent).toContain('×2')
 vi.advanceTimersByTime(100);expect(state.entries()).toHaveLength(0)
})
it('an older timer removes only its entry and leaves newer modal notice live',()=>{
 vi.useFakeTimers();const state=setup(),active=modal();success('older')
 vi.advanceTimersByTime(1500);success('newer');vi.advanceTimersByTime(2100)
 expect(state.entries()).toHaveLength(1);expect(state.entries()[0].textContent).toContain('newer')
 expect(state.host.parentElement).toBe(active.dialog)
 vi.advanceTimersByTime(1500);expect(state.entries()).toHaveLength(0);expect(state.host.parentElement).toBe(state.view.el)
})
it('undo may synchronously publish another notice without dismissing that new notice',()=>{
 const state=setup();success('undo original',()=>success('undo accepted'));success('other queued')
 expect(document.querySelector('.undo')).toMatchObject({className:expect.stringContaining('is-outlined has-no-shadow')})
 expect(document.querySelector('.undo > span')?.textContent).toBe('Undo')
 ;(document.querySelector('.undo') as HTMLButtonElement).click()
 expect(state.entries()).toHaveLength(2)
 expect(state.entries().map(el=>el.textContent)).toEqual([expect.stringContaining('other queued'),expect.stringContaining('undo accepted')])
})
it('Region teardown removes adopted modal contents, all timers and subscription',()=>{
 vi.useFakeTimers();const state=setup(),active=modal();success('destroy first');success('destroy second')
 expect(state.host.parentElement).toBe(active.dialog)
 region!.destroy();region=undefined
 expect(active.dialog.querySelector('[data-notices]')).toBeNull();expect(state.host.isConnected).toBe(false)
 success('after destruction');active.button.focus();active.dialog.dispatchEvent(new Event('close'));vi.runAllTimers()
 expect(document.querySelector('.vue-notification')).toBeNull()
 expect(vi.getTimerCount()).toBe(0)
})
