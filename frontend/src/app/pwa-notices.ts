import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing} from 'lit-html'
import {t} from '../shared/i18n'
import {listIcon, button} from '@/shared/task-list/list-ui'
import './pwa-notices.scss'
interface Options {worker?: ServiceWorkerContainer, standalone?: MediaQueryList, reload?: () => void}
export const PwaNoticesView = View.extend({
	initialize(options: Options) { void options },
	attributes: {style: 'display:contents'},
	createState() { return {life: new AbortController(), worker: this.options.worker ?? navigator.serviceWorker, standalone: this.options.standalone ?? window.matchMedia('(display-mode: standalone)'), hidden: localStorage.getItem('hideAddToHomeScreenMessage') === 'true', registration: undefined as ServiceWorkerRegistration | undefined, available: false, refreshing: false} },
	templateContext() { const state = this.getState(); return {install: !state.hidden && !state.standalone.matches, update: state.available} },
	template: ({install, update}: {install: boolean, update: boolean}) => html`${install ? html`<div class="add-to-home-screen ${update ? 'has-update-available' : ''}"><span class="add-icon">${listIcon('arrow-up-from-bracket')}</span><p>${t('home.addToHomeScreen')}</p><button type="button" class="base-button base-button--type-button hide-button" aria-label=${t('misc.closeBanner')} data-dismiss-install>${listIcon('x')}</button></div>` : nothing}${update ? html`<div class="update-notification"><p class="update-notification__message">${t('update.available')}</p>${button(t('update.do'), () => {}, 'primary')}</div>` : nothing}`,
	events: {'click [data-dismiss-install]': 'dismiss', 'click .update-notification button': 'refresh'},
	dismiss() { this.getState().hidden = true; localStorage.setItem('hideAddToHomeScreenMessage', 'true'); this.render() },
	showUpdate(registration: ServiceWorkerRegistration) { const state = this.getState(); if (state.life.signal.aborted) return; state.registration = registration; state.available = true; this.render() },
	refresh() {
		const state = this.getState(); state.available = false; this.render()
		const waiting = state.registration?.waiting; if (!waiting) return
		state.refreshing = true; waiting.postMessage('skipWaiting')
	},
	onAttach() {
		const state = this.getState(), signal = state.life.signal
		document.addEventListener('swUpdated', event => this.showUpdate((event as CustomEvent<ServiceWorkerRegistration>).detail), {once: true, signal})
		state.worker?.addEventListener('controllerchange', () => {if (!state.refreshing) return; state.refreshing = false; (this.options.reload ?? (() => location.reload()))()}, {signal})
		window.addEventListener('storage', event => {if (event.key === 'hideAddToHomeScreenMessage' || event.key === null) {state.hidden = localStorage.getItem('hideAddToHomeScreenMessage') === 'true'; this.render()}}, {signal})
		state.standalone.addEventListener('change', () => this.render(), {signal})
		// Install listeners before registration can announce an update.
		if (import.meta.env.PROD && state.worker) void import('@/registerServiceWorker').then(({registerServiceWorker}) => {
			if (!signal.aborted) void registerServiceWorker(state.worker!, signal)
		}).catch(error => {if (!signal.aborted) console.error('Error loading service worker registration:', error)})
		if (state.worker?.controller) void state.worker.getRegistration().then((registration: ServiceWorkerRegistration | undefined) => {if (!signal.aborted && !state.registration && registration?.waiting) this.showUpdate(registration)}).catch(() => {})
	},
	onBeforeDestroy() { this.getState().life.abort() },
}).setDomApi(LitDomApi)
