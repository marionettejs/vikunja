import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {useDebounceFn} from '@vueuse/core'
import {isEmail} from '@/helpers/isEmail'

export interface RequestPasswordResetFormViewOptions {
	t: (key: string) => string
	loading: boolean
	errorMessage: string
	isSuccess: boolean
	onSubmit: (email: string) => Promise<void>
	onLogin: () => void
	onEmailChange?: () => void
}

interface TemplateData {
	t: (key: string) => string
	loading: boolean
	LABEL_EMAIL: string
	PLACEHOLDER_EMAIL: string
	ERROR_EMAIL_INVALID: string
	BUTTON_RESET_PASSWORD: string
	RESET_PASSWORD_SUCCESS: string
	LOGIN: string
}

interface RequestPasswordResetFormViewContext extends ViewInstance {
	_form: HTMLFormElement | null
	_emailInput: HTMLInputElement | null
	_submitButton: HTMLButtonElement | null
	_submitLabel: HTMLElement | null
	_submitSpinner: HTMLElement | null
	_emailHelp: HTMLElement | null
	_errorMessageEl: HTMLElement | null
	_errorText: HTMLElement | null
	_successMessage: HTMLElement | null
	_successText: HTMLElement | null
	_loginLink: HTMLAnchorElement | null
	_emailValid: boolean
	_validateAfterFirst: boolean
	_loading: boolean
	_errorMessage: string
	_isSuccess: boolean
	_emailValidateFn: ReturnType<typeof useDebounceFn> | null
	_options(): RequestPasswordResetFormViewOptions
	_validateEmail(): void
	_validateEmailSync(): boolean
	_applyEmailValidity(): void
	_applyLoading(): void
	_applySuccessState(): void
	_handleSubmit(event: Event): void
	_handleEmailKeyDown(event: KeyboardEvent): void
	_handleLogin(event: Event): void
	setLoading(loading: boolean): void
	setErrorMessage(message: string): void
	setSuccess(success: boolean): void
	focus(): void
}

const LABEL_EMAIL = 'user.auth.email'
const PLACEHOLDER_EMAIL = 'user.auth.emailPlaceholder'
const ERROR_EMAIL_INVALID = 'user.auth.emailInvalid'
const BUTTON_RESET_PASSWORD = 'user.auth.resetPasswordAction'
const RESET_PASSWORD_SUCCESS = 'user.auth.resetPasswordSuccess'
const LOGIN = 'user.auth.login'

export const RequestPasswordResetFormView = View.extend({
	className: 'request-password-reset-form',

	_form: null as HTMLFormElement | null,
	_emailInput: null as HTMLInputElement | null,
	_submitButton: null as HTMLButtonElement | null,
	_submitLabel: null as HTMLElement | null,
	_submitSpinner: null as HTMLElement | null,
	_emailHelp: null as HTMLElement | null,
	_errorMessageEl: null as HTMLElement | null,
	_errorText: null as HTMLElement | null,
	_successMessage: null as HTMLElement | null,
	_successText: null as HTMLElement | null,
	_loginLink: null as HTMLAnchorElement | null,
	_emailValid: true,
	_validateAfterFirst: false,
	_loading: false,
	_errorMessage: '',
	_isSuccess: false,
	_emailValidateFn: null as ReturnType<typeof useDebounceFn> | null,

	events: {
		'submit #request-password-reset-form': '_handleSubmit',
		'click [data-role="login"]': '_handleLogin',
		'keydown #email': '_handleEmailKeyDown',
		'focusout #email': '_validateEmail',
		'keyup #email': '_handleEmailKeyup',
	},

	templateContext(this: RequestPasswordResetFormViewContext): TemplateData {
		const opts = this._options()
		return {
			t: opts.t,
			loading: opts.loading,
			LABEL_EMAIL,
			PLACEHOLDER_EMAIL,
			ERROR_EMAIL_INVALID,
			BUTTON_RESET_PASSWORD,
			RESET_PASSWORD_SUCCESS,
			LOGIN,
		}
	},

	template(data: TemplateData) {
		const {
			t, loading,
			LABEL_EMAIL, PLACEHOLDER_EMAIL, ERROR_EMAIL_INVALID,
			BUTTON_RESET_PASSWORD, RESET_PASSWORD_SUCCESS, LOGIN,
		} = data

		return html`
			<div class="message-wrapper mbe-4" data-role="error-message" hidden>
				<div class="message danger" role="alert" data-role="error-text"></div>
			</div>

			<div class="message-wrapper mbe-4" data-role="success-message" hidden>
				<div class="message success has-text-centered" role="status" data-role="success-text">
					${t(RESET_PASSWORD_SUCCESS)}
				</div>
				<a
					href="#"
					class="button is-primary mbs-4"
					data-role="login"
				>
					${t(LOGIN)}
				</a>
			</div>

			<form id="request-password-reset-form" novalidate>
				<div class="field">
					<label class="label" for="email">${t(LABEL_EMAIL)}</label>
					<div class="control">
						<input
							id="email"
							class="input"
							name="email"
							type="email"
							autocomplete="email"
							placeholder="${t(PLACEHOLDER_EMAIL)}"
							required
							?disabled="${loading}"
						>
					</div>
					<p class="help is-danger" id="email-error" data-role="email-help" role="alert" hidden>${t(ERROR_EMAIL_INVALID)}</p>
				</div>

				<div class="is-flex">
					<button
						type="submit"
						class="button is-primary"
						data-role="submit"
						?disabled="${loading}"
					>
						<span data-role="submit-spinner" hidden>
							<span class="icon is-small"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>
							${t('user.auth.authenticating')}
						</span>
						<span data-role="submit-label">${t(BUTTON_RESET_PASSWORD)}</span>
					</button>
					<a
						href="#"
						class="button is-outlined"
						data-role="login"
					>
						${t(LOGIN)}
					</a>
				</div>
			</form>
		`
	},

	initialize(this: RequestPasswordResetFormViewContext) {
		this._emailValidateFn = useDebounceFn(() => {
			this._validateEmailSync()
		}, 100)
	},

	onRender(this: RequestPasswordResetFormViewContext) {
		const opts = this._options()
		this._loading = Boolean(opts.loading)
		this._isSuccess = Boolean(opts.isSuccess)
		this._form = this.el.querySelector('#request-password-reset-form')
		this._emailInput = this.el.querySelector('#email')
		this._submitButton = this.el.querySelector('[data-role="submit"]')
		this._submitLabel = this.el.querySelector('[data-role="submit-label"]')
		this._submitSpinner = this.el.querySelector('[data-role="submit-spinner"]')
		this._emailHelp = this.el.querySelector('[data-role="email-help"]')
		this._errorMessageEl = this.el.querySelector('[data-role="error-message"]')
		this._errorText = this.el.querySelector('[data-role="error-text"]')
		this._successMessage = this.el.querySelector('[data-role="success-message"]')
		this._successText = this.el.querySelector('[data-role="success-text"]')
		this._loginLink = this.el.querySelector('[data-role="login"]')

		this.setLoading(this._loading)
		this.setErrorMessage(opts.errorMessage)
		this.setSuccess(this._isSuccess)

		if (!this._isSuccess && this._emailInput) {
			this._emailInput.focus()
		}
	},

	onBeforeDestroy(this: RequestPasswordResetFormViewContext) {
		this._form = null
		this._emailInput = null
		this._submitButton = null
		this._submitLabel = null
		this._submitSpinner = null
		this._emailHelp = null
		this._errorMessageEl = null
		this._errorText = null
		this._successMessage = null
		this._successText = null
		this._loginLink = null
	},

	_options(this: RequestPasswordResetFormViewContext): RequestPasswordResetFormViewOptions {
		return this.options as RequestPasswordResetFormViewOptions
	},

	_applyEmailValidity(this: RequestPasswordResetFormViewContext): void {
		if (!this._emailInput || !this._emailHelp) {
			return
		}
		const invalid = !this._emailValid
		this._emailInput.classList.toggle('is-danger', invalid)
		if (invalid) {
			this._emailInput.setAttribute('aria-invalid', 'true')
			this._emailInput.setAttribute('aria-describedby', 'email-error')
		} else {
			this._emailInput.removeAttribute('aria-invalid')
			this._emailInput.removeAttribute('aria-describedby')
		}
		if (!this._emailValid) {
			this._emailHelp.textContent = this._options().t(ERROR_EMAIL_INVALID)
			this._emailHelp.removeAttribute('hidden')
		} else {
			this._emailHelp.setAttribute('hidden', '')
		}
	},

	_applyLoading(this: RequestPasswordResetFormViewContext): void {
		const disabledElements = [
			this._emailInput,
			this._submitButton,
		]
		for (const el of disabledElements) {
			if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
				el.disabled = this._loading
			}
		}
		this._submitLabel?.toggleAttribute('hidden', this._loading)
		this._submitSpinner?.toggleAttribute('hidden', !this._loading)
	},

	_applySuccessState(this: RequestPasswordResetFormViewContext): void {
		this._form?.toggleAttribute('hidden', this._isSuccess)
		this._successMessage?.toggleAttribute('hidden', !this._isSuccess)
		if (this._isSuccess && this._loginLink) {
			this._loginLink.focus()
		}
	},

	_validateEmail(this: RequestPasswordResetFormViewContext) {
		this._emailValidateFn?.()
		this._validateAfterFirst = true
	},

	_handleEmailKeyup(this: RequestPasswordResetFormViewContext) {
		this._options().onEmailChange?.()
		if (this._validateAfterFirst) {
			this._emailValidateFn?.()
		} else {
			this._applyEmailValidity()
		}
	},

	_validateEmailSync(this: RequestPasswordResetFormViewContext): boolean {
		const email = this._emailInput?.value ?? ''
		const nativeValid = this._emailInput?.checkValidity() ?? true
		this._emailValid = isEmail(email) && nativeValid
		this._applyEmailValidity()
		return this._emailValid
	},

	_handleSubmit(this: RequestPasswordResetFormViewContext, event: Event) {
		event.preventDefault()
		if (this._loading) {
			return
		}

		const email = this._emailInput?.value ?? ''

		this._validateAfterFirst = true
		const emailValid = this._validateEmailSync()

		if (email === '' || !emailValid) {
			return
		}

		void this._options().onSubmit(email)
	},

	_handleEmailKeyDown(this: RequestPasswordResetFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handleLogin(this: RequestPasswordResetFormViewContext, event: Event) {
		event.preventDefault()
		const link = (event.target as Element).closest('[data-role="login"]')
		if (!link) {
			return
		}
		this._options().onLogin()
	},

	setLoading(this: RequestPasswordResetFormViewContext, loading: boolean): void {
		this._loading = loading
		this._applyLoading()
	},

	setErrorMessage(this: RequestPasswordResetFormViewContext, message: string): void {
		this._errorMessage = message
		if (this._errorMessageEl && this._errorText) {
			this._errorText.textContent = message
			this._errorMessageEl.toggleAttribute('hidden', message === '')
		}
	},

	setSuccess(this: RequestPasswordResetFormViewContext, success: boolean): void {
		this._isSuccess = success
		this._applySuccessState()
	},

	focus(this: RequestPasswordResetFormViewContext): void {
		if (!this._isSuccess && this._emailInput) {
			this._emailInput.focus()
		}
	},
}) as new (options: RequestPasswordResetFormViewOptions) => RequestPasswordResetFormViewContext & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setSuccess: (success: boolean) => void
	focus: () => void
}

export type RequestPasswordResetFormViewInstance = ViewInstance & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setSuccess: (success: boolean) => void
	focus: () => void
}