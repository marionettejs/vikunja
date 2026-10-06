import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {PwaNoticesView} from './pwa-notices'
let region: InstanceType<typeof Region> | undefined
const host = document.createElement('div'); document.body.append(host)
afterEach(() => {region?.destroy(); localStorage.clear()})
function setup() {
	const worker = new EventTarget(), standalone = Object.assign(new EventTarget(), {matches: false}), reload = vi.fn(), postMessage = vi.fn()
	const registration = {waiting: {postMessage}} as unknown as ServiceWorkerRegistration
	const view = new PwaNoticesView({worker: worker as ServiceWorkerContainer, standalone: standalone as MediaQueryList, reload})
	region = new Region({el: host}); region.show(view)
	return {view, worker, standalone, reload, registration, postMessage}
}
it('does not reload on first claim, and reloads once only after accepting an update', () => {
	const state = setup(); state.worker.dispatchEvent(new Event('controllerchange')); expect(state.reload).not.toHaveBeenCalled()
	document.dispatchEvent(new CustomEvent('swUpdated', {detail: state.registration})); expect(state.view.el.querySelector('.update-notification')).not.toBeNull()
	state.view.refresh(); expect(state.postMessage).toHaveBeenCalledWith('skipWaiting'); expect(state.reload).not.toHaveBeenCalled()
	state.worker.dispatchEvent(new Event('controllerchange')); state.worker.dispatchEvent(new Event('controllerchange')); expect(state.reload).toHaveBeenCalledTimes(1)
})
it('owns worker and document listeners and does not publish after destruction', () => {
	const state = setup(); region!.destroy()
	document.dispatchEvent(new CustomEvent('swUpdated', {detail: state.registration})); state.worker.dispatchEvent(new Event('controllerchange'))
	expect(state.view.getState().registration).toBeUndefined(); expect(state.reload).not.toHaveBeenCalled()
})
it('persists install dismissal, follows cross-tab storage and display mode changes', () => {
	const state = setup(); expect(state.view.el.querySelector('.add-to-home-screen')).not.toBeNull()
	state.view.dismiss(); expect(localStorage.getItem('hideAddToHomeScreenMessage')).toBe('true'); expect(state.view.el.querySelector('.add-to-home-screen')).toBeNull()
	localStorage.removeItem('hideAddToHomeScreenMessage'); window.dispatchEvent(new StorageEvent('storage', {key: 'hideAddToHomeScreenMessage'})); expect(state.view.el.querySelector('.add-to-home-screen')).not.toBeNull()
	state.standalone.matches = true; state.standalone.dispatchEvent(new Event('change')); expect(state.view.el.querySelector('.add-to-home-screen')).toBeNull()
})
it('a notification with no waiting worker hides without refreshing or reloading', () => {
	const state = setup(); state.view.showUpdate({waiting: null} as ServiceWorkerRegistration); state.view.refresh(); state.worker.dispatchEvent(new Event('controllerchange'))
	expect(state.reload).not.toHaveBeenCalled(); expect(state.postMessage).not.toHaveBeenCalled()
})
