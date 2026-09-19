import {html, nothing} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface LinkSharingPasswordViewOptions {
	t: (key: string) => string
	onSubmit: (password: string) => void
	loading: boolean
	errorMessage: string
}

interface TemplateData {
	t: (key: string) => string
	loading: boolean
	errorMessage: string
	LABEL_PASSWORD: string
	PLACEHOLDER_PASSWORD: string
	BUTTON_LOGIN: string
}

interface LinkSharingPasswordViewContext extends ViewInstance {
	_passwordInput: HTMLInputElement | null
	_submitButton: HTMLButtonElement | null
	_options(): LinkSharingPasswordViewOptions
	_handleSubmit(): void
	_handleKeyDown(event: KeyboardEvent): void
	setLoading(loading: boolean): void
	setErrorMessage(message: string): void
	focus(): void
}

const LABEL_PASSWORD = 'user.auth.password'
const PLACEHOLDER_PASSWORD = 'user.auth.passwordPlaceholder'
const BUTTON_LOGIN = 'user.auth.login'

export const LinkSharingPasswordView = View.extend({
	className: 'link-share-password-form',

	_passwordInput: null as HTMLInputElement | null,
	_submitButton: null as HTMLButtonElement | null,

	template(data: TemplateData) {
		const {t, loading, errorMessage, LABEL_PASSWORD, PLACEHOLDER_PASSWORD, BUTTON_LOGIN} = data
		return html`
			<p class="pbe-2">
				${t('sharing.passwordRequired')}
			</p>
			<div class="field">
				<label class="label" for="linkSharePassword">${t(LABEL_PASSWORD)}</label>
				<div class="control">
					<input
						id="linkSharePassword"
						class="input"
						type="password"
						autocomplete="off"
						placeholder="${t(PLACEHOLDER_PASSWORD)}"
						?disabled="${loading}"
					>
				</div>
			</div>
			<button
				class="button is-primary"
				data-role="submit"
				?disabled="${loading}"
			>
				${loading ? html`<span class="icon is-small"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>${t(BUTTON_LOGIN)}` : t(BUTTON_LOGIN)}
			</button>
			${errorMessage ? html`
				<div class="notification is-danger mbs-4" role="alert">
					${errorMessage}
				</div>
			` : nothing}
		`
	},

	templateContext(this: LinkSharingPasswordViewContext): TemplateData {
		const opts = this._options()
		return {
			t: opts.t,
			loading: opts.loading,
			errorMessage: opts.errorMessage,
			LABEL_PASSWORD,
			PLACEHOLDER_PASSWORD,
			BUTTON_LOGIN,
		}
	},

	events: {
		'click [data-role="submit"]': '_handleSubmit',
		'keydown #linkSharePassword': '_handleKeyDown',
	},

	onRender(this: LinkSharingPasswordViewContext) {
		this._passwordInput = this.el.querySelector('#linkSharePassword')
		this._submitButton = this.el.querySelector('[data-role="submit"]') as HTMLButtonElement | null
		if (this._passwordInput) {
			this._passwordInput.focus()
		}
	},

	onBeforeDestroy(this: LinkSharingPasswordViewContext) {
		this._passwordInput = null
		this._submitButton = null
	},

	_options(this: LinkSharingPasswordViewContext): LinkSharingPasswordViewOptions {
		return this.options as LinkSharingPasswordViewOptions
	},

	_handleSubmit(this: LinkSharingPasswordViewContext) {
		const opts = this._options()
		if (opts.loading) {
			return
		}
		if (this._passwordInput) {
			opts.onSubmit(this._passwordInput.value)
		}
	},

	_handleKeyDown(this: LinkSharingPasswordViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit()
		}
	},

	setLoading(this: LinkSharingPasswordViewContext, loading: boolean): void {
		const opts = this._options()
		opts.loading = loading
		if (this._passwordInput) {
			this._passwordInput.disabled = loading
		}
		if (this._submitButton) {
			this._submitButton.disabled = loading
		}
		this.render()
	},

	setErrorMessage(this: LinkSharingPasswordViewContext, message: string): void {
		const opts = this._options()
		opts.errorMessage = message
		this.render()
	},

	focus(this: LinkSharingPasswordViewContext): void {
		this._passwordInput?.focus()
	},
}) as new (options: LinkSharingPasswordViewOptions) => LinkSharingPasswordViewContext & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	focus: () => void
}

export type LinkSharingPasswordViewInstance = ViewInstance & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	focus: () => void
}