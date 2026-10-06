import { Application, View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import type { SessionApplication } from '../../app/session'
import type { Route } from '../../app/routes'
import { t } from '../../shared/i18n'
import { errorText } from '../../shared/notifications'
import { openIdProviders } from './openid-config'
import { redirectToProvider } from '@/helpers/redirectToProvider'
const pendingKey = (provider: string) => `openid_pending_totp_${provider}`
export const OpenIdApplication = Application.extend({
	initialize(options: {
		session: InstanceType<typeof SessionApplication>;
		authenticated: () => void;
	}) {
		void options
	},
	createState() {
		return {
			route: undefined as Route | undefined,
			request: undefined as AbortController | undefined,
		}
	},
	onBeforeStart(_app: unknown, route: Route) {
		this.getState().route = route
	},
	onStart() {
		const route = this.getState().route!,
			provider = route.params.provider
		const view = this.setView(
			new OpenIdView({
				restart: (passcode: string) => this.restartProvider(passcode),
			}),
		)
		this.showView()
		if (route.query.error !== undefined) {
			sessionStorage.removeItem(pendingKey(provider))
			view.feedback(
				String(route.query.message ?? t('user.auth.openIdGeneralError')),
				String(route.query.error),
			)
			return
		}
		if (
			typeof route.query.state !== 'string' ||
			route.query.state !== localStorage.getItem('state')
		) {
			sessionStorage.removeItem(pendingKey(provider))
			view.feedback(t('user.auth.openIdStateError'))
			return
		}
		const passcode = sessionStorage.getItem(pendingKey(provider)) ?? undefined
		sessionStorage.removeItem(pendingKey(provider))
		void this.authenticate(
			provider,
			String(route.query.code ?? ''),
			passcode,
			view,
		)
	},
	async authenticate(
		provider: string,
		code: string,
		passcode: string | undefined,
		view: InstanceType<typeof OpenIdView>,
	) {
		const state = this.getState(),
			request = new AbortController()
		state.request = request
		try {
			await this.options.session.openId(
				provider,
				code,
				passcode,
				request.signal,
			)
			request.signal.throwIfAborted()
			if (this.isRunning() && state.request === request)
				this.options.authenticated()
		} catch (error) {
			if (
				request.signal.aborted ||
				!this.isRunning() ||
				state.request !== request ||
				view.isDestroyed()
			)
				return
			if (
				(error as { response?: { data?: { code?: number } } }).response?.data
					?.code === 1017
			)
				view.requireTotp()
			else view.feedback(errorText(error))
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !view.isDestroyed())
				view.setLoading(false)
		}
	},
	restartProvider(passcode: string) {
		if (!passcode || !this.isRunning()) return
		const provider = openIdProviders(
			this.options.session.getState().get('config'),
		).find((p) => p.key === this.getState().route!.params.provider)
		const view = this.getView() as InstanceType<typeof OpenIdView>
		if (!provider) {
			view.feedback(t('user.auth.openIdGeneralError'))
			return
		}
		sessionStorage.setItem(pendingKey(provider.key), passcode)
		view.setLoading(true)
		redirectToProvider(provider)
	},
	onBeforeStop() {
		this.getState().request?.abort()
		this.getState().request = undefined
	},
})
const OpenIdView = View.extend({
	initialize(options: { restart: (passcode: string) => void }) {
		void options
	},
	ui: {
		loading: '[data-loading]',
		error: '[data-error]',
		queryError: '[data-query-error]',
		form: 'form',
		passcode: '#openIdTotpPasscode',
		submit: 'button',
	},
	createState() {
		return { busy: true }
	},
	template: () =>
		html`<div>
			<div class="message danger" data-error role="alert" hidden></div>
			<div class="message danger mbs-2" data-query-error role="alert" hidden></div>
			<div class="message" data-loading role="status">
				${t('user.auth.authenticating')}
			</div>
			<form hidden>
				<div class="message mbe-2">${t('user.auth.openIdTotpRequired')}</div>
				<div class="field">
					<label class="label" for="openIdTotpPasscode"
						>${t('user.auth.totpTitle')}</label
					><input
						id="openIdTotpPasscode"
						class="input"
						type="text"
						autocomplete="one-time-code"
						inputmode="numeric"
						placeholder=${t('user.auth.totpPlaceholder')}
						required
					/>
				</div>
				<button
					type="submit"
					class="base-button base-button--type-button button mbs-2"
					disabled
				>
					${t('user.auth.openIdTotpSubmit')}
				</button>
			</form>
		</div>`,
	events: {
		'submit @ui.form': 'submit',
		'input @ui.passcode': 'refreshSubmit',
	},
	submit(event: SubmitEvent) {
		event.preventDefault()
		if (!this.getState().busy)
			this.options.restart(
				(this.getUI('passcode')![0] as HTMLInputElement).value,
			)
	},
	refreshSubmit() {
		(this.getUI('submit')![0] as HTMLButtonElement).disabled =
			this.getState().busy ||
			!(this.getUI('passcode')![0] as HTMLInputElement).value
	},
	setLoading(busy: boolean) {
		this.getState().busy = busy;
		(this.getUI('loading')![0] as HTMLElement).hidden =
			!busy || !(this.getUI('form')![0] as HTMLElement).hidden;
		(this.getUI('submit')![0] as HTMLElement).classList.toggle(
			'is-loading',
			busy,
		)
		this.refreshSubmit()
	},
	feedback(error: string, queryError = '') {
		for (const [key, text] of [
			['error', error],
			['queryError', queryError],
		]) {
			const node = this.getUI(key)![0] as HTMLElement
			node.textContent = text
			node.hidden = !text
		}
		this.setLoading(false)
	},
	requireTotp() {
		(this.getUI('form')![0] as HTMLElement).hidden = false
		this.setLoading(false);
		(this.getUI('passcode')![0] as HTMLInputElement).focus()
	},
}).setDomApi(LitDomApi)
