import {Application, View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {LogoView} from '@/shared/logo'
import type {Model} from '@mnjs/data'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import {getLastVisited, clearLastVisited} from '@/helpers/saveLastVisited'
import type {Route} from '../../app/routes'
import {queryHref} from '../../app/routes'
import {t} from '../../shared/i18n'
import type {SessionApplication} from '../../app/session'
import './sharing.scss'
interface Options {session: InstanceType<typeof SessionApplication>, navigate: (href: string, replace?: boolean) => void}
const ShareAuthenticationView = View.extend({
	regions: {logo: '[data-logo]'},
	onRender() {this.showChildView('logo',new LogoView({model:this.options.session}))},
	ui: {form: 'form', challenge: '[data-challenge]', password: '#linkSharePassword', submit: 'button[type=submit]', loading: '[data-loading]', error: '[data-error]'},
	initialize(options: {session: Model, authenticate: (password: string) => Promise<void>}) {void options},
	className: 'no-auth-wrapper native-list-surface native-share-auth',
	template: () => html`<div class="logo" data-logo></div><div class="noauth-container"><section class="image"><h2 class="image-title">${t('misc.welcomeBack')}</h2></section><main id="main-content" tabindex="-1" class="content"><h2 class="title">${t('sharing.authenticating')}</h2><div><div class="message" data-loading>${t('sharing.authenticating')}</div><div class="card" data-challenge hidden><div class="card-content"><p class="pbe-2">${t('sharing.passwordRequired')}</p><form><div class="field"><label class="label" for="linkSharePassword">${t('user.auth.password')}</label><input id="linkSharePassword" class="input" type="password" autocomplete="off" placeholder=${t('user.auth.passwordPlaceholder')}></div><button type="submit" class="base-button base-button--type-button button">${t('user.auth.login')}</button></form></div></div><div class="message danger mbs-4" data-error role="alert" hidden></div></div></main></div>`,
	events: {'submit @ui.form': 'submit'},
	createState() {return {busy: false}},
	submit(event: SubmitEvent) {event.preventDefault(); if (!this.getState().busy) void this.options.authenticate((this.getUI('password')![0] as HTMLInputElement).value)},
	setLoading(value: boolean) {this.getState().busy = value; (this.getUI('loading')![0] as HTMLElement).hidden = !value; const button = this.getUI('submit')![0] as HTMLButtonElement; button.disabled = value; button.classList.toggle('is-loading', value); if (value) (this.getUI('error')![0] as HTMLElement).hidden = true},
	showFailure(error: unknown) {
		const data = (error as {response?: {status?: number, data?: {code?: number, message?: string}}})?.response
		const code = data?.data?.code
		const needsPassword = code === 13001 || code === 13002
		;(this.getUI('challenge')![0] as HTMLElement).hidden = !needsPassword
		const message = this.getUI('error')![0] as HTMLElement
		message.hidden = code === 13001
		message.textContent = code === 13002 ? t('sharing.invalidPassword') : data?.status === 403 && !code ? t('sharing.accessDenied') : !data || Number(data.status) >= 500 ? t('sharing.serverError') : data.data?.message ?? t('sharing.error')
		if (needsPassword) (this.getUI('password')![0] as HTMLInputElement).focus()
	},
}).setDomApi(LitDomApi)
export const ShareAuthenticationApplication = Application.extend({
	initialize(options: Options) {void options},
	createState() {return {route: undefined as Route | undefined, request: undefined as AbortController | undefined}},
	onBeforeStart(_app: unknown, route: Route) {this.getState().route = route},
	onStart() {this.setView(new ShareAuthenticationView({session:this.options.session.getState(),authenticate: password => this.authenticate(password)})); this.showView(); void this.authenticate('')},
	async authenticate(password: string) {
		const state = this.getState()
		if (state.request || !this.isRunning()) return
		const request = new AbortController(), route = state.route!
		state.request = request
		const view = this.getView() as InstanceType<typeof ShareAuthenticationView>
		view.setLoading(true)
		try {
			const {projectId} = await this.options.session.authenticateShare(route.params.share, password, !route.query.logoVisible || route.query.logoVisible === 'true', request.signal)
			request.signal.throwIfAborted()
			const last = getLastVisited()
			let href: string
			if (last?.name === 'task.detail') href = queryHref(`/tasks/${last.params.id}`, last.query)
			else if (last?.name === 'project.view') href = queryHref(`/projects/${last.params.projectId}/${last.params.viewId}`, last.query)
			else {
				const project = await new ProjectService().get(new ProjectModel({id: projectId}), {}, request.signal)
				request.signal.throwIfAborted()
				const viewId = typeof route.query.view === 'string' ? route.query.view : project.views[0]?.id
				href = `/projects/${projectId}/${viewId}`
			}
			clearLastVisited()
			this.options.navigate(href + `#share-auth-token=${encodeURIComponent(route.params.share)}`, true)
		} catch (error) {if (!request.signal.aborted && state.request === request && this.isRunning()) view.showFailure(error)}
		finally {if (state.request === request) state.request = undefined; if (!request.signal.aborted && !view.isDestroyed()) view.setLoading(false)}
	},
	onBeforeStop() {this.getState().request?.abort(); this.getState().request = undefined; this.getState().route = undefined},
})
