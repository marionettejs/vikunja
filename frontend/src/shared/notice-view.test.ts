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
function finishAnimations(state: {entries: () => Element[]}){for (const row of state.entries()) for (const animation of row.getAnimations()) if (animation.playState === 'running') animation.finish()}
function modal(){const dialog=document.createElement('dialog');dialog.setAttribute('open','');const button=document.createElement('button');dialog.append(button);document.body.append(dialog);button.focus();return {dialog,button}}
afterEach(()=>{region?.destroy();region=undefined;vi.useRealTimers();document.body.replaceChildren()})
it('dismisses one queued entry while keeping the remaining notice reachable in its modal',()=>{
 const state=setup(),active=modal();success('first');success('second')
 expect(state.host.parentElement).toBe(active.dialog)
 ;(state.entries()[0] as HTMLElement).click()
 finishAnimations(state)
 expect(state.entries()).toHaveLength(1);expect(state.entries()[0].textContent).toContain('second')
 expect(state.host.parentElement).toBe(active.dialog)
 ;(state.entries()[0] as HTMLElement).click()
 finishAnimations(state)
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
 vi.advanceTimersByTime(100);finishAnimations(state);expect(state.entries()).toHaveLength(0)
})
it('an older timer removes only its entry and leaves newer modal notice live',()=>{
 vi.useFakeTimers();const state=setup(),active=modal();success('older')
 vi.advanceTimersByTime(1500);success('newer');vi.advanceTimersByTime(2100);finishAnimations(state)
 expect(state.entries()).toHaveLength(1);expect(state.entries()[0].textContent).toContain('newer')
 expect(state.host.parentElement).toBe(active.dialog)
 vi.advanceTimersByTime(1500);finishAnimations(state);expect(state.entries()).toHaveLength(0);expect(state.host.parentElement).toBe(state.view.el)
})
it('undo may synchronously publish another notice without dismissing that new notice',()=>{
 const state=setup();success('undo original',()=>success('undo accepted'));success('other queued')
 expect(document.querySelector('.undo')).toMatchObject({className:expect.stringContaining('is-outlined has-no-shadow')})
 expect(document.querySelector('.undo > span')?.textContent).toBe('Undo')
 ;(document.querySelector('.undo') as HTMLButtonElement).click()
 finishAnimations(state)
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

const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
function animationControls() {
 const animations: {cancel: ReturnType<typeof vi.fn>, onfinish: (() => void) | null}[] = []
 Object.defineProperty(HTMLElement.prototype, 'animate', {configurable: true, value: vi.fn(() => {
  const animation = {cancel: vi.fn(), finished: Promise.resolve(), onfinish: null as (() => void) | null}
  animations.push(animation)
  return animation
 })})
 return animations
}
afterEach(() => {
 if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate)
 else Reflect.deleteProperty(HTMLElement.prototype, 'animate')
})
it('keeps fading rows in the modal while allowing the same message to be published again', () => {
 vi.useFakeTimers();const animations = animationControls(), state = setup(), active = modal()
 success('repeated message');expect(animations).toHaveLength(1)
 animations[0].onfinish?.()
 ;(state.entries()[0] as HTMLElement).click()
 expect(animations).toHaveLength(2)
 expect(state.entries()).toHaveLength(1);expect(state.host.parentElement).toBe(active.dialog)
 success('repeated message')
 expect(state.entries()).toHaveLength(2)
 expect(state.entries()[1].querySelector('span')!.hidden).toBe(true)
 animations[1].onfinish?.()
 expect(state.entries()).toHaveLength(1);expect(state.host.parentElement).toBe(active.dialog)
 ;(state.entries()[0] as HTMLElement).click()
 animations.at(-1)!.onfinish?.()
 expect(state.entries()).toHaveLength(0);expect(state.host.parentElement).toBe(state.view.el)
})
it('Region destruction cancels both entering and departing rows without scheduling another leave', () => {
 vi.useFakeTimers();const animations = animationControls(), state = setup(), active = modal()
 success('first animation');success('second animation')
 ;(state.entries()[0] as HTMLElement).click()
 expect(animations).toHaveLength(3)
 expect(animations[0].cancel).toHaveBeenCalledOnce()
 region!.destroy();region = undefined
 expect(animations).toHaveLength(3)
 expect(animations[1].cancel).toHaveBeenCalledOnce();expect(animations[2].cancel).toHaveBeenCalledOnce()
 expect(animations[1].onfinish).toBeNull();expect(animations[2].onfinish).toBeNull()
 expect(active.dialog.querySelector('[data-notices]')).toBeNull()
 expect(vi.getTimerCount()).toBe(0)
 success('after animation owner destruction');vi.runAllTimers()
 expect(state.entries()).toHaveLength(0)
})
it('Undo remains single-use while its dismissed, expired or evicted row is fading', () => {
 vi.useFakeTimers();animationControls();const state = setup(), undo = vi.fn()
 success('single-use Undo', undo)
 const button = document.querySelector('.undo') as HTMLButtonElement
 button.click();button.click()
 expect(undo).toHaveBeenCalledOnce()
 success('expired Undo', undo)
 const expired = state.entries().find(row => row.textContent?.includes('expired Undo'))!.querySelector('button')!
 vi.advanceTimersByTime(3600);expired.click()
 expect(undo).toHaveBeenCalledOnce()
 success('evicted Undo', undo)
 const evicted = state.entries().find(row => row.textContent?.includes('evicted Undo'))!.querySelector('button')!
 success('new first');success('new second');evicted.click()
 expect(undo).toHaveBeenCalledOnce()
})
