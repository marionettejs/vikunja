import {HTTPFactory} from '@/helpers/fetcher'
import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing} from 'lit-html'
import {parseURL} from 'ufo'
import {configureApiClient} from '@/client/http'
import {clearTaskCache} from '@/helpers/taskCache'
import {t} from '../shared/i18n'
import {success} from '../shared/notifications'
import type {AuthConfig} from '../features/auth/account-forms'

export function apiCandidates(value: string): string[] {
	if (!value) throw new Error(t('apiConfig.urlRequired'))
	if (value.startsWith('/')) value = location.host + value
	if (!/^https?:\/\//.test(value)) value = `${location.protocol}//${value}`
	const url = new URL(value), originalPath = url.pathname, candidates = new Set<string>()
	const add = () => candidates.add(url.toString().replace(/\/$/, ''))
	const append = () => {if (!url.pathname.replace(/\/$/, '').endsWith('/api/v1')) url.pathname = url.pathname.replace(/\/$/, '') + '/api/v1'}
	add(); append(); add()
	url.port = '3456'; add()
	url.pathname = originalPath; append(); add()
	return [...candidates]
}

export async function discoverApi(value: string, signal: AbortSignal): Promise<{url: string, config: AuthConfig}> {
	let failure: unknown
	for (const url of apiCandidates(value)) {
		signal.throwIfAborted()
		try {
			const {data: config} = await HTTPFactory().get<AuthConfig>(`${url}/info`, {signal, withCredentials: true})
			signal.throwIfAborted()
			if (!config || typeof config !== 'object' || !config.auth) throw new Error('Invalid API configuration')
			return {url, config}
		} catch (error) {signal.throwIfAborted(); failure = error}
	}
	throw failure
}

interface ApiOptions {canChange: () => boolean, busy: (busy: boolean) => void, accepted: (config: AuthConfig) => void, configureOpen?: boolean}
export const ApiConfigView = View.extend({
	initialize(options: ApiOptions) {void options},
	className: 'api-config',
	ui: {url: '#api-url', submit: 'button[type=submit]'},
	createState() {return {url: window.API_URL, editing: this.options.configureOpen ?? false, error: '', request: undefined as AbortController | undefined}},
	events: {'click [data-change]': 'edit', 'submit form': 'submit', 'input @ui.url': 'input'},
	templateContext() {const state = this.getState(); return {...state, domain: parseURL(state.url, 'http://').host || location.host}},
	template: ({url, domain, editing, error}: {url: string, domain: string, editing: boolean, error: string}) => html`${editing ? html`<form novalidate><label class="label" for="api-url">${t('apiConfig.url')}</label><div class="field has-addons"><div class="control is-expanded"><input class="input" id="api-url" required type="url" .value=${url} placeholder=${t('apiConfig.urlPlaceholder')}></div><div class="control"><button class="base-button base-button--type-button button is-primary" type="submit" ?disabled=${!url}>${t('apiConfig.change')}</button></div></div></form>` : html`<div class="api-url-info">${t('apiConfig.use', [domain]).split(domain)[0]}<span class="url" title=${url}>${domain}</span>${t('apiConfig.use', [domain]).split(domain).slice(1).join(domain)}<br><button class="base-button base-button--type-button button-link api-config__change-button" type="button" data-change>${t('apiConfig.change')}</button></div>`}${error ? html`<div class="message danger mbs-2" role="alert">${error}</div>` : nothing}`,
	edit() {if (!this.options.canChange()) return; this.getState().editing = true; this.render(); if (window.innerWidth > 769) (this.getUI('url')![0] as HTMLInputElement).focus()},
	input() {const button = this.getUI('submit')![0] as HTMLButtonElement; button.disabled = Boolean(this.getState().request) || !(this.getUI('url')![0] as HTMLInputElement).value},
	onRender() {if (!this.getState().editing) return; this.input(); (this.getUI('submit')![0] as HTMLElement).classList.toggle('is-loading', Boolean(this.getState().request))},
	async submit(event: SubmitEvent) {
		event.preventDefault()
		const state = this.getState()
		if (state.request || !this.options.canChange()) return
		const request = new AbortController(); state.request = request
		state.url = (this.getUI('url')![0] as HTMLInputElement).value
		const submitted = state.url
		this.options.busy(true); this.input(); (this.getUI('submit')![0] as HTMLElement).classList.add('is-loading')
		try {
			const result = await discoverApi(state.url, request.signal)
			request.signal.throwIfAborted()
			if (this.isDestroyed()) return
			const changed = window.API_URL !== result.url
			window.API_URL = result.url; localStorage.setItem('API_URL', result.url)
			if (changed) {configureApiClient(); clearTaskCache()}
			const draft = (this.getUI('url')![0] as HTMLInputElement).value
			state.url = draft === submitted ? result.url : draft; state.error = ''; state.editing = draft !== submitted
			this.options.accepted(result.config)
			success(t('apiConfig.success', {domain: parseURL(result.url).host || location.host}))
		} catch (_error) {
			if (request.signal.aborted || this.isDestroyed()) return
			state.url = (this.getUI('url')![0] as HTMLInputElement).value
			state.error = !state.url ? t('apiConfig.urlRequired') : t('apiConfig.error', {domain: parseURL(state.url, 'http://').host || location.host})
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {const focused = this.el.contains(document.activeElement); this.options.busy(false); this.render(); if (state.editing && focused) (this.getUI('url')![0] as HTMLInputElement).focus()}
		}
	},
	onBeforeDestroy() {this.getState().request?.abort()},
}).setDomApi(LitDomApi)
