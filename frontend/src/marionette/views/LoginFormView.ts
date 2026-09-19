import {html, nothing} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {useDebounceFn} from '@vueuse/core'
import {validatePassword} from '@/helpers/validatePasswort'

export interface LoginFormViewOptions {
	t: (key: string) => string
	localAuthEnabled: boolean
	ldapAuthEnabled: boolean
	registrationEnabled: boolean
	openidEnabled: boolean
	openidProviders: ReadonlyArray<{key: string; label: string}>
	needsTotpPasscode: boolean
	loading: boolean
	errorMessage: string
	confirmedEmailSuccess: boolean
	onSubmit: (credentials: {username: string; password: string; longToken: boolean; totpPasscode?: string}) => Promise<void>
	onForgotPassword: () => void
	onRegister: () => void
	onOpenIdProviderClick: (providerKey: string) => void
}

interface TemplateData {
	t: (key: string) => string
	localAuthEnabled: boolean
	ldapAuthEnabled: boolean
	registrationEnabled: boolean
	openidEnabled: boolean
	openidProviders: ReadonlyArray<{key: string; label: string}>
	loading: boolean
	LABEL_USERNAME: string
	PLACEHOLDER_USERNAME: string
	ERROR_USERNAME_REQUIRED: string
	LABEL_PASSWORD: string
	PLACEHOLDER_PASSWORD: string
	LABEL_TOTP: string
	PLACEHOLDER_TOTP: string
	LABEL_REMEMBER: string
	BUTTON_LOGIN: string
	NO_ACCOUNT_YET: string
	CREATE_ACCOUNT: string
	CONFIRM_EMAIL_SUCCESS: string
	SHOW_PASSWORD: string
	HIDE_PASSWORD: string
}

interface LoginFormViewContext extends ViewInstance {
	_form: HTMLFormElement | null
	_usernameInput: HTMLInputElement | null
	_passwordInput: HTMLInputElement | null
	_passwordToggle: HTMLButtonElement | null
	_totpInput: HTMLInputElement | null
	_totpField: HTMLElement | null
	_rememberCheckbox: HTMLInputElement | null
	_submitButton: HTMLButtonElement | null
	_submitLabel: HTMLElement | null
	_submitSpinner: HTMLElement | null
	_usernameHelp: HTMLElement | null
	_passwordHelp: HTMLElement | null
	_successMessage: HTMLElement | null
	_successText: HTMLElement | null
	_errorMessageEl: HTMLElement | null
	_errorText: HTMLElement | null
	_passwordFieldType: 'password' | 'text'
	_passwordValue: string
	_passwordValid: boolean | string
	_usernameValid: boolean
	_validateAfterFirst: boolean
	_loading: boolean
	_needsTotpPasscode: boolean
	_errorMessage: string
	_usernameValidateFn: ReturnType<typeof useDebounceFn> | null
	_passwordValidateFn: ReturnType<typeof useDebounceFn> | null
	_options(): LoginFormViewOptions
	_validateUsername(): void
	_validatePassword(): void
	_applyUsernameValidity(): void
	_applyPasswordValidity(): void
	_applyLoading(): void
	_applyTotpVisibility(): void
	_applyPasswordToggle(): void
	_togglePasswordVisibility(): void
	_handleSubmit(event: Event): void
	_handleUsernameKeyDown(event: KeyboardEvent): void
	_handlePasswordKeyDown(event: KeyboardEvent): void
	_handleTotpKeyDown(event: KeyboardEvent): void
	_handlePasswordInput(event: Event): void
	_handleForgotPassword(event: Event): void
	_handleRegister(event: Event): void
	_handleOpenIdProviderClick(event: Event): void
	setLoading(loading: boolean): void
	setErrorMessage(message: string): void
	setNeedsTotpPasscode(needs: boolean): void
	setConfirmedEmailSuccess(success: boolean): void
	focus(): void
}

const LABEL_USERNAME = 'user.auth.usernameEmail'
const PLACEHOLDER_USERNAME = 'user.auth.usernamePlaceholder'
const ERROR_USERNAME_REQUIRED = 'user.auth.usernameRequired'
const LABEL_PASSWORD = 'user.auth.password'
const PLACEHOLDER_PASSWORD = 'user.auth.passwordPlaceholder'
const LABEL_TOTP = 'user.auth.totpTitle'
const PLACEHOLDER_TOTP = 'user.auth.totpPlaceholder'
const LABEL_REMEMBER = 'user.auth.remember'
const BUTTON_LOGIN = 'user.auth.login'
const NO_ACCOUNT_YET = 'user.auth.noAccountYet'
const CREATE_ACCOUNT = 'user.auth.createAccount'
const CONFIRM_EMAIL_SUCCESS = 'user.auth.confirmEmailSuccess'
const SHOW_PASSWORD = 'user.auth.showPassword'
const HIDE_PASSWORD = 'user.auth.hidePassword'

export const LoginFormView = View.extend({
	className: 'login-form',

	_form: null as HTMLFormElement | null,
	_usernameInput: null as HTMLInputElement | null,
	_passwordInput: null as HTMLInputElement | null,
	_passwordToggle: null as HTMLButtonElement | null,
	_totpInput: null as HTMLInputElement | null,
	_totpField: null as HTMLElement | null,
	_rememberCheckbox: null as HTMLInputElement | null,
	_submitButton: null as HTMLButtonElement | null,
	_submitLabel: null as HTMLElement | null,
	_submitSpinner: null as HTMLElement | null,
	_usernameHelp: null as HTMLElement | null,
	_passwordHelp: null as HTMLElement | null,
	_successMessage: null as HTMLElement | null,
	_successText: null as HTMLElement | null,
	_errorMessageEl: null as HTMLElement | null,
	_errorText: null as HTMLElement | null,
	_passwordFieldType: 'password' as 'password' | 'text',
	_passwordValue: '',
	_passwordValid: true as boolean | string,
	_usernameValid: true,
	_validateAfterFirst: false,
	_loading: false,
	_needsTotpPasscode: false,
	_errorMessage: '',
	_usernameValidateFn: null as ReturnType<typeof useDebounceFn> | null,
	_passwordValidateFn: null as ReturnType<typeof useDebounceFn> | null,

	events: {
		'submit #loginform': '_handleSubmit',
		'click [data-role="forgot-password"]': '_handleForgotPassword',
		'click [data-role="register"]': '_handleRegister',
		'click [data-role="openid-provider"]': '_handleOpenIdProviderClick',
		'keydown #username': '_handleUsernameKeyDown',
		'focusout #username': '_validateUsername',
		'keydown #password': '_handlePasswordKeyDown',
		'focusout #password': '_validatePassword',
		'keyup #password': '_validatePassword',
		'input #password': '_handlePasswordInput',
		'click [data-role="password-toggle"]': '_togglePasswordVisibility',
		'keydown #totpPasscode': '_handleTotpKeyDown',
	},

	templateContext(this: LoginFormViewContext): TemplateData {
		const opts = this._options()
		return {
			t: opts.t,
			localAuthEnabled: opts.localAuthEnabled,
			ldapAuthEnabled: opts.ldapAuthEnabled,
			registrationEnabled: opts.registrationEnabled,
			openidEnabled: opts.openidEnabled,
			openidProviders: opts.openidProviders,
			loading: opts.loading,
			LABEL_USERNAME,
			PLACEHOLDER_USERNAME,
			ERROR_USERNAME_REQUIRED,
			LABEL_PASSWORD,
			PLACEHOLDER_PASSWORD,
			LABEL_TOTP,
			PLACEHOLDER_TOTP,
			LABEL_REMEMBER,
			BUTTON_LOGIN,
			NO_ACCOUNT_YET,
			CREATE_ACCOUNT,
			CONFIRM_EMAIL_SUCCESS,
			SHOW_PASSWORD,
			HIDE_PASSWORD,
		}
	},

	template(data: TemplateData) {
		const {
			t, localAuthEnabled, ldapAuthEnabled, registrationEnabled, openidEnabled, openidProviders,
			loading,
			LABEL_USERNAME, PLACEHOLDER_USERNAME, ERROR_USERNAME_REQUIRED,
			LABEL_PASSWORD, PLACEHOLDER_PASSWORD,
			LABEL_TOTP, PLACEHOLDER_TOTP,
			LABEL_REMEMBER, BUTTON_LOGIN,
			NO_ACCOUNT_YET, CREATE_ACCOUNT,
			CONFIRM_EMAIL_SUCCESS, SHOW_PASSWORD, HIDE_PASSWORD,
		} = data

		const showLocalForm = localAuthEnabled || ldapAuthEnabled
		const hasOpenIdProviders = openidEnabled && openidProviders.length > 0

		return html`
			<div class="message-wrapper mbe-4" data-role="success-message" hidden>
				<div class="message success has-text-centered" role="status" data-role="success-text">
					${t(CONFIRM_EMAIL_SUCCESS)}
				</div>
			</div>

			<div class="message-wrapper mbe-4" data-role="error-message" hidden>
				<div class="message danger" role="alert" data-role="error-text"></div>
			</div>

			<form id="loginform" ?hidden="${!showLocalForm}">
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
							aria-invalid="false"
						>
					</div>
					<p class="help is-danger" data-role="username-help" hidden>${t(ERROR_USERNAME_REQUIRED)}</p>
				</div>

				<div class="field">
					<div class="label-with-link">
						<label class="label" for="password">${t(LABEL_PASSWORD)}</label>
						${localAuthEnabled ? html`
							<a
								href="#"
								class="reset-password-link"
								data-role="forgot-password"
							>
								${t('user.auth.forgotPassword')}
							</a>
						` : nothing}
					</div>
					<div class="password-field">
						<input
							id="password"
							class="input"
							name="password"
							type="password"
							autocomplete="current-password"
							placeholder="${t(PLACEHOLDER_PASSWORD)}"
							required
							?disabled="${loading}"
							aria-invalid="false"
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
					<p class="help is-danger" role="alert" data-role="password-help" hidden></p>
				</div>

				<div class="field" data-role="totp-field" hidden>
					<label class="label" for="totpPasscode">${t(LABEL_TOTP)}</label>
					<div class="control">
						<input
							id="totpPasscode"
							class="input"
							name="totpPasscode"
							type="text"
							inputmode="numeric"
							autocomplete="one-time-code"
							placeholder="${t(PLACEHOLDER_TOTP)}"
							required
							?disabled="${loading}"
						>
					</div>
				</div>

				<div class="field">
					<div class="control">
						<label class="checkbox">
							<input
								type="checkbox"
								name="rememberMe"
								?disabled="${loading}"
							>
							${t(LABEL_REMEMBER)}
						</label>
					</div>
				</div>

				<button
					type="submit"
					class="button is-primary is-fullwidth"
					data-role="submit"
					?disabled="${loading}"
				>
					<span data-role="submit-spinner" hidden>
						<span class="icon is-small"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>
						${t('user.auth.authenticating')}
					</span>
					<span data-role="submit-label">${t(BUTTON_LOGIN)}</span>
				</button>

				${registrationEnabled ? html`
					<p class="mbs-2 has-text-centered">
						${t(NO_ACCOUNT_YET)}
						<a
							href="#"
							class="inline-link"
							data-role="register"
						>
							${t(CREATE_ACCOUNT)}
						</a>
					</p>
				` : nothing}
			</form>

			${hasOpenIdProviders && showLocalForm ? html`
				<div class="mbs-4">
					${openidProviders.map(provider => html`
						<button
							type="button"
							class="button is-outlined is-fullwidth mbs-2"
							data-role="openid-provider"
							data-provider-key="${provider.key}"
							?disabled="${loading}"
						>
							${provider.label}
						</button>
					`)}
				</div>
			` : nothing}
		`
	},

	initialize(this: LoginFormViewContext) {
		this._usernameValidateFn = useDebounceFn(() => {
			this._usernameValid = (this._usernameInput?.value ?? '') !== ''
			this._applyUsernameValidity()
		}, 100)

		this._passwordValidateFn = useDebounceFn(() => {
			const valid = validatePassword(this._passwordValue, false)
			this._passwordValid = valid === true ? true : valid
			this._applyPasswordValidity()
		}, 100)
	},

	onRender(this: LoginFormViewContext) {
		const opts = this._options()
		this._loading = Boolean(opts.loading)
		this._form = this.el.querySelector('#loginform')
		this._usernameInput = this.el.querySelector('#username')
		this._passwordInput = this.el.querySelector('#password')
		this._passwordToggle = this.el.querySelector('[data-role="password-toggle"]')
		this._totpInput = this.el.querySelector('#totpPasscode')
		this._totpField = this.el.querySelector('[data-role="totp-field"]')
		this._rememberCheckbox = this.el.querySelector('input[name="rememberMe"]')
		this._submitButton = this.el.querySelector('[data-role="submit"]')
		this._submitLabel = this.el.querySelector('[data-role="submit-label"]')
		this._submitSpinner = this.el.querySelector('[data-role="submit-spinner"]')
		this._usernameHelp = this.el.querySelector('[data-role="username-help"]')
		this._passwordHelp = this.el.querySelector('[data-role="password-help"]')
		this._successMessage = this.el.querySelector('[data-role="success-message"]')
		this._successText = this.el.querySelector('[data-role="success-text"]')
		this._errorMessageEl = this.el.querySelector('[data-role="error-message"]')
		this._errorText = this.el.querySelector('[data-role="error-text"]')

		this.setLoading(this._loading)
		this.setErrorMessage(opts.errorMessage)
		this.setConfirmedEmailSuccess(opts.confirmedEmailSuccess)
		this.setNeedsTotpPasscode(opts.needsTotpPasscode)

		if (this._usernameInput) {
			this._usernameInput.focus()
		}
	},

	onBeforeDestroy(this: LoginFormViewContext) {
		this._form = null
		this._usernameInput = null
		this._passwordInput = null
		this._passwordToggle = null
		this._totpInput = null
		this._totpField = null
		this._rememberCheckbox = null
		this._submitButton = null
		this._submitLabel = null
		this._submitSpinner = null
		this._usernameHelp = null
		this._passwordHelp = null
		this._successMessage = null
		this._successText = null
		this._errorMessageEl = null
		this._errorText = null
	},

	_options(this: LoginFormViewContext): LoginFormViewOptions {
		return this.options as LoginFormViewOptions
	},

	_applyUsernameValidity(this: LoginFormViewContext): void {
		if (!this._usernameInput) {
			return
		}
		this._usernameInput.classList.toggle('is-danger', !this._usernameValid)
		this._usernameInput.setAttribute('aria-invalid', String(!this._usernameValid))
		this._usernameHelp?.toggleAttribute('hidden', this._usernameValid)
	},

	_applyPasswordValidity(this: LoginFormViewContext): void {
		const invalid = this._passwordValid !== true
		if (this._passwordInput) {
			this._passwordInput.classList.toggle('is-danger', invalid)
			this._passwordInput.setAttribute('aria-invalid', String(invalid))
		}
		if (this._passwordHelp) {
			if (invalid && typeof this._passwordValid === 'string') {
				this._passwordHelp.textContent = this._options().t(this._passwordValid)
				this._passwordHelp.removeAttribute('hidden')
			} else {
				this._passwordHelp.setAttribute('hidden', '')
			}
		}
	},

	_applyLoading(this: LoginFormViewContext): void {
		const disabledElements = [
			this._usernameInput,
			this._passwordInput,
			this._passwordToggle,
			this._totpInput,
			this._rememberCheckbox,
			this._submitButton,
			...Array.from(this.el.querySelectorAll('[data-role="openid-provider"]')),
		]
		for (const el of disabledElements) {
			if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
				el.disabled = this._loading
			}
		}
		this._submitLabel?.toggleAttribute('hidden', this._loading)
		this._submitSpinner?.toggleAttribute('hidden', !this._loading)
	},



	_applyTotpVisibility(this: LoginFormViewContext): void {
		this._totpField?.toggleAttribute('hidden', !this._needsTotpPasscode)
	},



	_validateUsername(this: LoginFormViewContext) {
		this._usernameValidateFn?.()
	},

	_validatePassword(this: LoginFormViewContext) {
		if (this._validateAfterFirst) {
			this._passwordValidateFn?.()
		} else {
			this._validateAfterFirst = true
		}
	},

	_togglePasswordVisibility(this: LoginFormViewContext) {
		this._passwordFieldType = this._passwordFieldType === 'password' ? 'text' : 'password'
		if (this._passwordInput) {
			this._passwordInput.type = this._passwordFieldType
		}
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

	_handlePasswordInput(this: LoginFormViewContext, event: Event) {
		const target = event.target as HTMLInputElement
		this._passwordValue = target.value
	},

	_handleSubmit(this: LoginFormViewContext, event: Event) {
		event.preventDefault()
		if (this._loading) {
			return
		}

		const username = this._usernameInput?.value ?? ''
		const password = this._passwordValue
		const longToken = this._rememberCheckbox?.checked ?? false

		if (username === '' || password === '') {
			this._validateUsername()
			this._validatePassword()
			this._validateAfterFirst = true
			this._passwordValidateFn?.()
			return
		}

		const credentials: {username: string; password: string; longToken: boolean; totpPasscode?: string} = {
			username,
			password,
			longToken,
		}

		if (this._needsTotpPasscode) {
			credentials.totpPasscode = this._totpInput?.value ?? ''
		}

		void this._options().onSubmit(credentials)
	},

	_handleUsernameKeyDown(this: LoginFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handlePasswordKeyDown(this: LoginFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handleTotpKeyDown(this: LoginFormViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this._handleSubmit(event)
		}
	},

	_handleForgotPassword(this: LoginFormViewContext, event: Event) {
		event.preventDefault()
		this._options().onForgotPassword()
	},

	_handleRegister(this: LoginFormViewContext, event: Event) {
		event.preventDefault()
		this._options().onRegister()
	},

	_handleOpenIdProviderClick(this: LoginFormViewContext, event: Event) {
		const button = (event.target as Element).closest('[data-role="openid-provider"]') as HTMLButtonElement | null
		if (button) {
			const providerKey = button.getAttribute('data-provider-key')
			if (providerKey) {
				this._options().onOpenIdProviderClick(providerKey)
			}
		}
	},

	setLoading(this: LoginFormViewContext, loading: boolean): void {
		this._loading = loading
		this._applyLoading()
	},

	setErrorMessage(this: LoginFormViewContext, message: string): void {
		this._errorMessage = message
		if (this._errorMessageEl && this._errorText) {
			this._errorText.textContent = message
			this._errorMessageEl.toggleAttribute('hidden', message === '')
		}
	},

	setNeedsTotpPasscode(this: LoginFormViewContext, needs: boolean): void {
		this._needsTotpPasscode = needs
		this._applyTotpVisibility()
		if (needs) {
			this._totpInput?.focus()
		}
	},

	setConfirmedEmailSuccess(this: LoginFormViewContext, success: boolean): void {
		if (this._successMessage) {
			this._successMessage.toggleAttribute('hidden', !success)
		}
	},

	focus(this: LoginFormViewContext): void {
		if (this._totpInput && this._needsTotpPasscode) {
			this._totpInput.focus()
		} else if (this._usernameInput) {
			this._usernameInput.focus()
		}
	},
}) as new (options: LoginFormViewOptions) => LoginFormViewContext & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setNeedsTotpPasscode: (needs: boolean) => void
	setConfirmedEmailSuccess: (success: boolean) => void
	focus: () => void
}

export type LoginFormViewInstance = ViewInstance & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setNeedsTotpPasscode: (needs: boolean) => void
	setConfirmedEmailSuccess: (success: boolean) => void
	focus: () => void
}
