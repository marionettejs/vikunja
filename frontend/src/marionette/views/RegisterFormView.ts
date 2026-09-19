import {html, nothing} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {useDebounceFn} from '@vueuse/core'
import {validatePassword} from '@/helpers/validatePasswort'
import {isEmail} from '@/helpers/isEmail'

export interface RegisterFormViewOptions {
	t: (key: string) => string
	registrationEnabled: boolean
	demoModeEnabled: boolean
	loading: boolean
	errorMessage: string
	confirmEmailMessage: string
	fieldErrors: Partial<Record<string, string>>
	onSubmit: (credentials: {username: string; email: string; password: string}) => Promise<void>
	onLogin: () => void
}

interface TemplateData {
	t: (key: string) => string
	registrationEnabled: boolean
	demoModeEnabled: boolean
	loading: boolean
	LABEL_USERNAME: string
	PLACEHOLDER_USERNAME: string
	ERROR_USERNAME_REQUIRED: string
	LABEL_EMAIL: string
	PLACEHOLDER_EMAIL: string
	ERROR_EMAIL_INVALID: string
	LABEL_PASSWORD: string
	PLACEHOLDER_PASSWORD: string
	BUTTON_CREATE_ACCOUNT: string
	BUTTON_AUTHENTICATING: string
	DEMO_TITLE: string
	DEMO_ACCOUNT_WILL_BE_DELETED: string
	DEMO_EVERYTHING_WILL_BE_DELETED: string
	ALREADY_HAVE_ACCOUNT: string
	LOGIN: string
	SHOW_PASSWORD: string
}

interface RegisterFormViewContext extends ViewInstance {
	_form: HTMLFormElement | null
	_usernameInput: HTMLInputElement | null
	_emailInput: HTMLInputElement | null
	_passwordInput: HTMLInputElement | null
	_passwordToggle: HTMLButtonElement | null
	_submitButton: HTMLButtonElement | null
	_submitLabel: HTMLElement | null
	_submitSpinner: HTMLElement | null
	_usernameHelp: HTMLElement | null
	_emailHelp: HTMLElement | null
	_passwordHelp: HTMLElement | null
	_errorMessageEl: HTMLElement | null
	_errorText: HTMLElement | null
	_successMessage: HTMLElement | null
	_successText: HTMLElement | null
	_demoWarning: HTMLElement | null
	_passwordFieldType: 'password' | 'text'
	_passwordValue: string
	_passwordValid: boolean | string
	_usernameValid: boolean | string
	_emailValid: boolean
	_validateUsernameAfterFirst: boolean
	_validateEmailAfterFirst: boolean
	_validatePasswordAfterFirst: boolean
	_loading: boolean
	_errorMessage: string
	_confirmEmailMessage: string
	_fieldErrors: Partial<Record<string, string>>
	_usernameValidateFn: ReturnType<typeof useDebounceFn> | null
	_emailValidateFn: ReturnType<typeof useDebounceFn> | null
	_passwordValidateFn: ReturnType<typeof useDebounceFn> | null
	_options(): RegisterFormViewOptions
	_validateUsername(): void
	_validateEmail(): void
	_validatePassword(): void
	_validateUsernameSync(): boolean
	_validateEmailSync(): boolean
	_validatePasswordSync(): boolean
	_applyUsernameValidity(): void
	_applyEmailValidity(): void
	_applyPasswordValidity(): void
	_applyLoading(): void
	_applyPasswordToggle(): void
	_togglePasswordVisibility(): void
	_handleSubmit(event: Event): void
	_handleUsernameKeyDown(event: KeyboardEvent): void
	_handleEmailKeyDown(event: KeyboardEvent): void
	_handlePasswordKeyDown(event: KeyboardEvent): void
	_handleUsernameKeyup(): void
	_handleEmailKeyup(): void
	_handlePasswordKeyup(): void
	_handlePasswordInput(event: Event): void
	_handleLogin(event: Event): void
	setLoading(loading: boolean): void
	setErrorMessage(message: string): void
	setConfirmEmailMessage(message: string): void
	setFieldErrors(errors: Partial<Record<string, string>>): void
	focus(): void
}

const LABEL_USERNAME = 'user.auth.username'
const PLACEHOLDER_USERNAME = 'user.auth.usernamePlaceholder'
const ERROR_USERNAME_REQUIRED = 'user.auth.usernameRequired'
const ERROR_USERNAME_SPACE = 'user.auth.usernameMustNotContainSpace'
const ERROR_USERNAME_URL = 'user.auth.usernameMustNotLookLikeUrl'
const LABEL_EMAIL = 'user.auth.email'
const PLACEHOLDER_EMAIL = 'user.auth.emailPlaceholder'
const ERROR_EMAIL_INVALID = 'user.auth.emailInvalid'
const LABEL_PASSWORD = 'user.auth.password'
const PLACEHOLDER_PASSWORD = 'user.auth.passwordPlaceholder'
const BUTTON_CREATE_ACCOUNT = 'user.auth.createAccount'
const BUTTON_AUTHENTICATING = 'user.auth.authenticating'
const DEMO_TITLE = 'demo.title'
const DEMO_ACCOUNT_WILL_BE_DELETED = 'demo.accountWillBeDeleted'
const DEMO_EVERYTHING_WILL_BE_DELETED = 'demo.everythingWillBeDeleted'
const ALREADY_HAVE_ACCOUNT = 'user.auth.alreadyHaveAnAccount'
const LOGIN = 'user.auth.login'
const SHOW_PASSWORD = 'user.auth.showPassword'
const HIDE_PASSWORD = 'user.auth.hidePassword'

const DEBOUNCE_TIME = 100

export const RegisterFormView = View.extend({
	className: 'register-form',

	_form: null as HTMLFormElement | null,
	_usernameInput: null as HTMLInputElement | null,
	_emailInput: null as HTMLInputElement | null,
	_passwordInput: null as HTMLInputElement | null,
	_passwordToggle: null as HTMLButtonElement | null,
	_submitButton: null as HTMLButtonElement | null,
	_submitLabel: null as HTMLElement | null,
	_submitSpinner: null as HTMLElement | null,
	_usernameHelp: null as HTMLElement | null,
	_emailHelp: null as HTMLElement | null,
	_passwordHelp: null as HTMLElement | null,
	_errorMessageEl: null as HTMLElement | null,
	_errorText: null as HTMLElement | null,
	_successMessage: null as HTMLElement | null,
	_successText: null as HTMLElement | null,
	_demoWarning: null as HTMLElement | null,
	_passwordFieldType: 'password' as 'password' | 'text',
	_passwordValue: '',
	_passwordValid: true as boolean | string,
	_usernameValid: true as boolean | string,
	_emailValid: true,
	_validateUsernameAfterFirst: false,
	_validateEmailAfterFirst: false,
	_validatePasswordAfterFirst: false,
	_loading: false,
	_errorMessage: '',
	_confirmEmailMessage: '',
	_fieldErrors: {} as Partial<Record<string, string>>,
	_usernameValidateFn: null as ReturnType<typeof useDebounceFn> | null,
	_emailValidateFn: null as ReturnType<typeof useDebounceFn> | null,
	_passwordValidateFn: null as ReturnType<typeof useDebounceFn> | null,

	events: {
		'submit #registerform': '_handleSubmit',
		'click [data-role="login"]': '_handleLogin',
		'keydown #username': '_handleUsernameKeyDown',
		'focusout #username': '_validateUsername',
		'keyup #username': '_handleUsernameKeyup',
		'keydown #email': '_handleEmailKeyDown',
		'focusout #email': '_validateEmail',
		'keyup #email': '_handleEmailKeyup',
		'keydown #password': '_handlePasswordKeyDown',
		'focusout #password': '_validatePassword',
		'keyup #password': '_handlePasswordKeyup',
		'input #password': '_handlePasswordInput',
		'click [data-role="password-toggle"]': '_togglePasswordVisibility',
	},

	templateContext(this: RegisterFormViewContext): TemplateData {
		const opts = this._options()
		return {
			t: opts.t,
			registrationEnabled: opts.registrationEnabled,
			demoModeEnabled: opts.demoModeEnabled,
			loading: opts.loading,
			LABEL_USERNAME,
			PLACEHOLDER_USERNAME,
			ERROR_USERNAME_REQUIRED,
			LABEL_EMAIL,
			PLACEHOLDER_EMAIL,
			ERROR_EMAIL_INVALID,
			LABEL_PASSWORD,
			PLACEHOLDER_PASSWORD,
			BUTTON_CREATE_ACCOUNT,
			BUTTON_AUTHENTICATING,
			DEMO_TITLE,
			DEMO_ACCOUNT_WILL_BE_DELETED,
			DEMO_EVERYTHING_WILL_BE_DELETED,
			ALREADY_HAVE_ACCOUNT,
			LOGIN,
			SHOW_PASSWORD,
		}
	},

	template(data: TemplateData) {
		const {
			t, registrationEnabled, demoModeEnabled, loading,
			LABEL_USERNAME, PLACEHOLDER_USERNAME, ERROR_USERNAME_REQUIRED,
			LABEL_EMAIL, PLACEHOLDER_EMAIL, ERROR_EMAIL_INVALID,
			LABEL_PASSWORD, PLACEHOLDER_PASSWORD,
			BUTTON_CREATE_ACCOUNT, BUTTON_AUTHENTICATING,
			DEMO_TITLE, DEMO_ACCOUNT_WILL_BE_DELETED, DEMO_EVERYTHING_WILL_BE_DELETED,
			ALREADY_HAVE_ACCOUNT, LOGIN,
			SHOW_PASSWORD,
		} = data

		return html`
			<div class="message-wrapper mbe-4" data-role="error-message" hidden>
				<div class="message danger" role="alert" data-role="error-text"></div>
			</div>

			<div class="message-wrapper mbe-4" data-role="success-message" hidden>
				<div class="message success has-text-centered" role="status" data-role="success-text"></div>
			</div>

			<form id="registerform" ?hidden="${!registrationEnabled}">
				<div class="field">
					<label class="label" for="username">${t(LABEL_USERNAME)}</label>
					<div class="control">
						<input
							id="username"
							class="input"
							name="username"
							type="text"
							autocomplete="username"
							placeholder="${t(PLACEHOLDER_USERNAME)}"
							required
							?disabled="${loading}"
						>
					</div>
					<p class="help is-danger" id="username-error" data-role="username-help" hidden>${t(ERROR_USERNAME_REQUIRED)}</p>
				</div>

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
					<p class="help is-danger" id="email-error" data-role="email-help" hidden>${t(ERROR_EMAIL_INVALID)}</p>
				</div>

				<div class="field">
					<label class="label" for="password">${t(LABEL_PASSWORD)}</label>
					<div class="password-field">
						<input
							id="password"
							class="input"
							name="password"
							type="password"
							autocomplete="new-password"
							placeholder="${t(PLACEHOLDER_PASSWORD)}"
							required
							?disabled="${loading}"
						>
						<button
							type="button"
							class="button password-field-type-toggle"
							data-role="password-toggle"
							aria-label="${t(SHOW_PASSWORD)}"
							?disabled="${loading}"
						>
							<span class="icon is-small">
								<i class="fas fa-eye" aria-hidden="true"></i>
							</span>
						</button>
					</div>
					<p class="help is-danger" role="alert" id="password-error" data-role="password-help" hidden></p>
				</div>

				<button
					type="submit"
					id="register-submit"
					class="button is-primary is-fullwidth"
					data-role="submit"
					?disabled="${loading}"
				>
					<span data-role="submit-spinner" hidden>
						<span class="icon is-small"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>
						${t(BUTTON_AUTHENTICATING)}
					</span>
					<span data-role="submit-label">${t(BUTTON_CREATE_ACCOUNT)}</span>
				</button>

				${demoModeEnabled ? html`
					<div class="message warning mbs-4" data-role="demo-warning" role="alert">
						${t(DEMO_TITLE)}<br>
						${t(DEMO_ACCOUNT_WILL_BE_DELETED)}<br>
						<strong class="is-uppercase">${t(DEMO_EVERYTHING_WILL_BE_DELETED)}</strong>
					</div>
				` : nothing}

				<p class="mbs-2 has-text-centered">
					${t(ALREADY_HAVE_ACCOUNT)}
					<a
						href="#"
						class="inline-link"
						data-role="login"
					>
						${t(LOGIN)}
					</a>
				</p>
			</form>

			${!registrationEnabled ? html`
				<div class="message warning" role="alert">
					${t('user.auth.registrationDisabled')}
				</div>
			` : nothing}
		`
	},

	initialize(this: RegisterFormViewContext) {
		this._usernameValidateFn = useDebounceFn(() => {
			this._validateUsernameSync()
		}, DEBOUNCE_TIME)

		this._emailValidateFn = useDebounceFn(() => {
			this._validateEmailSync()
		}, DEBOUNCE_TIME)

		this._passwordValidateFn = useDebounceFn(() => {
			this._validatePasswordSync()
		}, DEBOUNCE_TIME)
	},

	onRender(this: RegisterFormViewContext) {
		const opts = this._options()
		this._loading = Boolean(opts.loading)
		this._form = this.el.querySelector('#registerform')
		this._usernameInput = this.el.querySelector('#username')
		this._emailInput = this.el.querySelector('#email')
		this._passwordInput = this.el.querySelector('#password')
		this._passwordToggle = this.el.querySelector('[data-role="password-toggle"]')
		this._submitButton = this.el.querySelector('[data-role="submit"]')
		this._submitLabel = this.el.querySelector('[data-role="submit-label"]')
		this._submitSpinner = this.el.querySelector('[data-role="submit-spinner"]')
		this._usernameHelp = this.el.querySelector('[data-role="username-help"]')
		this._emailHelp = this.el.querySelector('[data-role="email-help"]')
		this._passwordHelp = this.el.querySelector('[data-role="password-help"]')
		this._errorMessageEl = this.el.querySelector('[data-role="error-message"]')
		this._errorText = this.el.querySelector('[data-role="error-text"]')
		this._successMessage = this.el.querySelector('[data-role="success-message"]')
		this._successText = this.el.querySelector('[data-role="success-text"]')
		this._demoWarning = this.el.querySelector('[data-role="demo-warning"]')

		this.setLoading(this._loading)
		this.setErrorMessage(opts.errorMessage)
		this.setConfirmEmailMessage(opts.confirmEmailMessage)
		this.setFieldErrors(opts.fieldErrors ?? {})

		if (this._usernameInput) {
			this._usernameInput.focus()
		}
	},

	onBeforeDestroy(this: RegisterFormViewContext) {
		this._form = null
		this._usernameInput = null
		this._emailInput = null
		this._passwordInput = null
		this._passwordToggle = null
		this._submitButton = null
		this._submitLabel = null
		this._submitSpinner = null
		this._usernameHelp = null
		this._emailHelp = null
		this._passwordHelp = null
		this._errorMessageEl = null
		this._errorText = null
		this._successMessage = null
		this._successText = null
		this._demoWarning = null
	},

	_options(this: RegisterFormViewContext): RegisterFormViewOptions {
		return this.options as RegisterFormViewOptions
	},

	_applyUsernameValidity(this: RegisterFormViewContext): void {
		if (!this._usernameInput || !this._usernameHelp) {
			return
		}
		const clientInvalid = this._usernameValid !== true
		const serverMessage = this._fieldErrors.username
		const invalid = clientInvalid || typeof serverMessage === 'string'
		this._usernameInput.classList.toggle('is-danger', invalid)
		if (invalid) {
			this._usernameInput.setAttribute('aria-invalid', 'true')
			this._usernameInput.setAttribute('aria-describedby', 'username-error')
		} else {
			this._usernameInput.removeAttribute('aria-invalid')
			this._usernameInput.removeAttribute('aria-describedby')
		}
		if (clientInvalid && typeof this._usernameValid === 'string') {
			this._usernameHelp.textContent = this._usernameValid
			this._usernameHelp.removeAttribute('hidden')
		} else if (!clientInvalid && typeof serverMessage === 'string') {
			this._usernameHelp.textContent = serverMessage
			this._usernameHelp.removeAttribute('hidden')
		} else {
			this._usernameHelp.setAttribute('hidden', '')
		}
	},

	_applyEmailValidity(this: RegisterFormViewContext): void {
		if (!this._emailInput || !this._emailHelp) {
			return
		}
		const serverMessage = this._fieldErrors.email
		const invalid = !this._emailValid || typeof serverMessage === 'string'
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
		} else if (typeof serverMessage === 'string') {
			this._emailHelp.textContent = serverMessage
			this._emailHelp.removeAttribute('hidden')
		} else {
			this._emailHelp.setAttribute('hidden', '')
		}
	},

	_applyPasswordValidity(this: RegisterFormViewContext): void {
		const clientInvalid = this._passwordValid !== true
		const serverMessage = this._fieldErrors.password
		const invalid = clientInvalid || typeof serverMessage === 'string'
		if (this._passwordInput) {
			this._passwordInput.classList.toggle('is-danger', invalid)
			if (invalid) {
				this._passwordInput.setAttribute('aria-invalid', 'true')
				this._passwordInput.setAttribute('aria-describedby', 'password-error')
			} else {
				this._passwordInput.removeAttribute('aria-invalid')
				this._passwordInput.removeAttribute('aria-describedby')
			}
		}
		if (this._passwordHelp) {
			if (clientInvalid && typeof this._passwordValid === 'string') {
				this._passwordHelp.textContent = this._passwordValid
				this._passwordHelp.removeAttribute('hidden')
			} else if (!clientInvalid && typeof serverMessage === 'string') {
				this._passwordHelp.textContent = serverMessage
				this._passwordHelp.removeAttribute('hidden')
			} else {
				this._passwordHelp.setAttribute('hidden', '')
			}
		}
	},

	_applyLoading(this: RegisterFormViewContext): void {
		const disabledElements = [
			this._usernameInput,
			this._emailInput,
			this._passwordInput,
			this._passwordToggle,
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

	_applyPasswordToggle(this: RegisterFormViewContext): void {
		const toggle = this._passwordToggle
		if (toggle) {
			const icon = toggle.querySelector('i')
			if (icon) {
				icon.classList.toggle('fa-eye', this._passwordFieldType === 'password')
				icon.classList.toggle('fa-eye-slash', this._passwordFieldType !== 'password')
			}
			toggle.setAttribute('aria-label', this._options().t(this._passwordFieldType === 'password' ? SHOW_PASSWORD : HIDE_PASSWORD))
		}
	},

	_validateUsername(this: RegisterFormViewContext) {
		this._usernameValidateFn?.()
		this._validateUsernameAfterFirst = true
	},

	_validateEmail(this: RegisterFormViewContext) {
		this._emailValidateFn?.()
		this._validateEmailAfterFirst = true
	},

	_validatePassword(this: RegisterFormViewContext) {
		this._passwordValidateFn?.()
		this._validatePasswordAfterFirst = true
	},

	_validateUsernameSync(this: RegisterFormViewContext): boolean {
		const username = this._usernameInput?.value ?? ''
		if (username === '') {
			this._usernameValid = this._options().t(ERROR_USERNAME_REQUIRED)
		} else if (username.indexOf(' ') !== -1) {
			this._usernameValid = this._options().t(ERROR_USERNAME_SPACE)
		} else if (username.indexOf('://') !== -1 || username.indexOf('.') !== -1) {
			this._usernameValid = this._options().t(ERROR_USERNAME_URL)
		} else {
			this._usernameValid = true
		}
		this._applyUsernameValidity()
		return this._usernameValid === true
	},

	_validateEmailSync(this: RegisterFormViewContext): boolean {
		this._emailValid = isEmail(this._emailInput?.value ?? '')
		this._applyEmailValidity()
		return this._emailValid
	},

	_validatePasswordSync(this: RegisterFormViewContext): boolean {
		const password = this._passwordInput?.value ?? this._passwordValue
		this._passwordValue = password
		const valid = validatePassword(password, true)
		this._passwordValid = valid === true ? true : this._options().t(valid)
		this._applyPasswordValidity()
		return this._passwordValid === true
	},

	_handleUsernameKeyup(this: RegisterFormViewContext) {
		delete this._fieldErrors.username
		if (this._validateUsernameAfterFirst) {
			this._usernameValidateFn?.()
		} else {
			this._applyUsernameValidity()
		}
	},

	_handleEmailKeyup(this: RegisterFormViewContext) {
		delete this._fieldErrors.email
		if (this._validateEmailAfterFirst) {
			this._emailValidateFn?.()
		} else {
			this._applyEmailValidity()
		}
	},

	_handlePasswordKeyup(this: RegisterFormViewContext) {
		if (this._validatePasswordAfterFirst) {
			this._passwordValidateFn?.()
		}
	},

	_togglePasswordVisibility(this: RegisterFormViewContext) {
		this._passwordFieldType = this._passwordFieldType === 'password' ? 'text' : 'password'
		if (this._passwordInput) {
			this._passwordInput.type = this._passwordFieldType
		}
		this._applyPasswordToggle()
	},

	_handlePasswordInput(this: RegisterFormViewContext, event: Event) {
		const target = event.target as HTMLInputElement
		this._passwordValue = target.value
		delete this._fieldErrors.password
		this._applyPasswordValidity()
	},

	_handleSubmit(this: RegisterFormViewContext, event: Event) {
		event.preventDefault()
		if (this._loading) {
			return
		}

		this.setErrorMessage('')
		this.setFieldErrors({})

		const username = this._usernameInput?.value ?? ''
		const email = this._emailInput?.value ?? ''
		const password = this._passwordInput?.value ?? this._passwordValue
		this._passwordValue = password

		this._validateUsernameAfterFirst = true
		this._validateEmailAfterFirst = true
		this._validatePasswordAfterFirst = true

		const usernameValid = this._validateUsernameSync()
		const emailValid = this._validateEmailSync()
		const passwordValid = this._validatePasswordSync()

		if (username === '' || email === '' || !usernameValid || !emailValid || !passwordValid) {
			return
		}

		void this._options().onSubmit({username, email, password})
	},

	_handleUsernameKeyDown(this: RegisterFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handleEmailKeyDown(this: RegisterFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handlePasswordKeyDown(this: RegisterFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handleLogin(this: RegisterFormViewContext, event: Event) {
		event.preventDefault()
		const link = (event.target as Element).closest('[data-role="login"]')
		if (!link) {
			return
		}
		this._options().onLogin()
	},

	setLoading(this: RegisterFormViewContext, loading: boolean): void {
		this._loading = loading
		this._applyLoading()
	},

	setErrorMessage(this: RegisterFormViewContext, message: string): void {
		this._errorMessage = message
		if (this._errorMessageEl && this._errorText) {
			this._errorText.textContent = message
			this._errorMessageEl.toggleAttribute('hidden', message === '')
		}
	},

	setConfirmEmailMessage(this: RegisterFormViewContext, message: string): void {
		this._confirmEmailMessage = message
		if (this._successMessage && this._successText) {
			this._successText.textContent = message
			this._successMessage.toggleAttribute('hidden', message === '')
		}
	},

	setFieldErrors(this: RegisterFormViewContext, fieldErrors: Partial<Record<string, string>>): void {
		this._fieldErrors = {...fieldErrors}
		this._applyUsernameValidity()
		this._applyEmailValidity()
		this._applyPasswordValidity()
	},

	focus(this: RegisterFormViewContext): void {
		if (this._usernameInput) {
			this._usernameInput.focus()
		}
	},
}) as new (options: RegisterFormViewOptions) => RegisterFormViewContext & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setConfirmEmailMessage: (message: string) => void
	setFieldErrors: (errors: Partial<Record<string, string>>) => void
	focus: () => void
}

export type RegisterFormViewInstance = ViewInstance & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setConfirmEmailMessage: (message: string) => void
	setFieldErrors: (errors: Partial<Record<string, string>>) => void
	focus: () => void
}