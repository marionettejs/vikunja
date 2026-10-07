import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import TotpService from '@/services/totp'
import TotpModel from '@/models/totp'
import type { ITotp } from '@/modelTypes/ITotp'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
interface Options {
	totp: ITotp;
	current: () => boolean;
	logout: () => Promise<void>;
}
export const TotpSettingsView = View.extend({
	initialize(options: Options) {
		void options
	},
	ui: {
		error: '[data-error]',
		qr: '[data-qr]',
		passcode: '#totpConfirmPasscode',
		password: '#currentPassword',
		disableForm: '[data-disable-form]',
		buttons: 'button',
		enroll: '[data-enroll]',
		confirm: '[data-confirm-form]',
		showDisable: '[data-show-disable]',
		cancel: '[data-cancel]',
	},
	events: {
		'click @ui.enroll': 'enroll',
		'submit @ui.confirm': 'confirm',
		'click @ui.showDisable': 'showDisable',
		'click @ui.cancel': 'cancelDisable',
		'submit @ui.disableForm': 'disable',
	},
	createState() {
		return {
			totp: this.options.totp as ITotp,
			write: undefined as AbortController | undefined,
			qrRequest: undefined as AbortController | undefined,
			url: '',
			showDisable: false,
		}
	},
	templateContext() {
		return this.getState()
	},
	template({ totp, showDisable }: { totp: ITotp; showDisable: boolean }) {
		return html`<div
				data-error
				class="message danger"
				role="alert"
				hidden
			></div>
			${!totp.enabled && !totp.secret
		? html`<button data-enroll type="button" class="button is-primary">
						${t('user.settings.totp.enroll')}
					</button>`
		: !totp.enabled
			? html`<p>
								${t('user.settings.totp.finishSetupPart1')}
								<strong>${totp.secret}</strong><br />${t(
	'user.settings.totp.finishSetupPart2',
)}
							</p>
							<p>
								${t('user.settings.totp.scanQR')}<br /><img data-qr alt="" />
							</p>
							<p>${t('user.settings.totp.confirmNotice')}</p>
							<form data-confirm-form>
								<div class="field">
									<label class="label" for="totpConfirmPasscode"
										>${t('user.settings.totp.passcode')}</label
									><input
										id="totpConfirmPasscode"
										class="input"
										autocomplete="one-time-code"
										inputmode="numeric"
										placeholder=${t('user.settings.totp.passcodePlaceholder')}
									/>
								</div>
								<button type="submit" class="button is-primary">
									${t('misc.confirm')}
								</button>
							</form>`
			: html`<p>${t('user.settings.totp.setupSuccess')}</p>
							<p ?hidden=${showDisable}>
								<button
									data-show-disable
									type="button"
									class="button is-danger"
								>
									${t('misc.disable')}
								</button>
							</p>
							<form data-disable-form ?hidden=${!showDisable}>
								<div class="field">
									<label class="label" for="currentPassword"
										>${t('user.settings.totp.enterPassword')}</label
									><input
										id="currentPassword"
										class="input"
										type="password"
										autocomplete="current-password"
										placeholder=${t('user.settings.currentPasswordPlaceholder')}
									/>
								</div>
								<button type="submit" class="button is-danger">
									${t('user.settings.totp.disable')}</button
								><button type="button" data-cancel class="button is-text mis-2">
									${t('misc.cancel')}
								</button>
							</form>`}`
	},
	onAttach() {
		if (!this.getState().totp.enabled && this.getState().totp.secret)
			void this.loadQR()
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = errorText(error)
		el.hidden = false
	},
	async loadQR() {
		const state = this.getState()
		state.qrRequest?.abort()
		const request = (state.qrRequest = new AbortController())
		try {
			const blob = await new TotpService().qrcode(request.signal)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || !this.options.current()) return
			if (state.url) URL.revokeObjectURL(state.url)
			state.url = URL.createObjectURL(blob);
			(this.getUI('qr')![0] as HTMLImageElement).src = state.url
		} catch (error) {
			if (!request.signal.aborted && !this.isDestroyed() && this.options.current()) this.feedback(error)
		}
	},
	enroll() {
		void this.write('enroll')
	},
	confirm(event: Event) {
		event.preventDefault()
		void this.write(
			'confirm',
			(this.getUI('passcode')![0] as HTMLInputElement).value,
		)
	},
	disable(event: Event) {
		event.preventDefault()
		void this.write(
			'disable',
			(this.getUI('password')![0] as HTMLInputElement).value,
		)
	},
	showDisable() {
		this.getState().showDisable = true
		this.render();
		(this.getUI('password')![0] as HTMLInputElement).focus()
	},
	cancelDisable() {
		this.getState().showDisable = false
		this.render()
	},
	async write(kind: string, value = '') {
		const state = this.getState()
		if (state.write) return
		const request = (state.write = new AbortController())
		this.el.setAttribute('aria-busy', 'true')
		for (const button of Array.from(
			this.getUI('buttons') ?? [],
		) as HTMLButtonElement[])
			button.disabled = true
		try {
			const service = new TotpService()
			if (kind === 'enroll') {
				const result = await service.enroll(request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current()) return
				state.totp = result
				this.render()
				void this.loadQR()
			} else if (kind === 'confirm') {
				await service.enable({ passcode: value }, request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current()) return
				success(t('user.settings.totp.confirmSuccess'))
				await this.options.logout()
			} else {
				await service.disable({ password: value }, request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current()) return
				state.totp = new TotpModel()
				state.showDisable = false
				this.render()
				success(t('user.settings.totp.disableSuccess'))
			}
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			)
				this.feedback(error)
		} finally {
			if (state.write === request) state.write = undefined
			if (!this.isDestroyed() && !request.signal.aborted) {
				this.el.setAttribute('aria-busy', 'false')
				for (const button of Array.from(
					this.getUI('buttons') ?? [],
				) as HTMLButtonElement[])
					button.disabled = false
			}
		}
	},
	onBeforeDestroy() {
		const state = this.getState()
		state.write?.abort()
		state.qrRequest?.abort()
		if (state.url) URL.revokeObjectURL(state.url)
	},
}).setDomApi(LitDomApi)
