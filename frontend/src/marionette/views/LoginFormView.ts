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
	needsTotpPasscode: boolean
	loading: boolean
	errorMessage: string
	confirmedEmailSuccess: boolean
	usernameValid: boolean
	passwordValid: boolean | string
	passwordFieldType: 'password' | 'text'
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
	_rememberCheckbox: HTMLInputElement | null
	_submitButton: HTMLButtonElement | null
	_passwordFieldType: 'password' | 'text'
	_passwordValue: string
	_passwordValid: boolean | string
	_validateAfterFirst: boolean
	_usernameValidateFn: ReturnType<typeof useDebounceFn>
	_passwordValidateFn: ReturnType<typeof useDebounceFn>
	_options(): LoginFormViewOptions
	_validateUsername(): void
	_validatePassword(): void
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
	_rememberCheckbox: null as HTMLInputElement | null,
	_submitButton: null as HTMLButtonElement | null,
	_passwordFieldType: 'password' as 'password' | 'text',
	_passwordValue: '',
	_passwordValid: true as boolean | string,
	_validateAfterFirst: false,
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
			needsTotpPasscode: opts.needsTotpPasscode,
			loading: opts.loading,
			errorMessage: opts.errorMessage,
			confirmedEmailSuccess: opts.confirmedEmailSuccess,
			usernameValid: (this._usernameInput?.value ?? '') !== '',
			passwordValid: this._passwordValid,
			passwordFieldType: this._passwordFieldType,
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
			needsTotpPasscode, loading, errorMessage, confirmedEmailSuccess,
			usernameValid, passwordValid, passwordFieldType,
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
			${confirmedEmailSuccess ? html`
				<div class="notification is-success is-light mbe-4 has-text-centered" role="status">
					${t(CONFIRM_EMAIL_SUCCESS)}
				</div>
			` : nothing}

			${errorMessage ? html`
				<div class="notification is-danger is-light mbe-4" role="alert">
					${errorMessage}
				</div>
			` : nothing}

			<form id="loginform" ?hidden="${!showLocalForm}">
				<div class="field">
					<label class="label" for="username">${t(LABEL_USERNAME)}</label>
					<div class="control">
<input
							id="username"
							class="input ${!usernameValid ? 'is-danger' : ''}"
							name="username"
							type="text"
							autocomplete="username"
							placeholder="${t(PLACEHOLDER_USERNAME)}"
							required
							?disabled="${loading}"
							aria-invalid="${!usernameValid ? 'true' : 'false'}"
						>
					</div>
					${!usernameValid ? html`
						<p class="help is-danger">${t(ERROR_USERNAME_REQUIRED)}</p>
					` : nothing}
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
							class="input ${passwordValid !== true ? 'is-danger' : ''}"
							name="password"
							type="${passwordFieldType}"
							autocomplete="current-password"
							placeholder="${t(PLACEHOLDER_PASSWORD)}"
							required
							?disabled="${loading}"
							aria-invalid="${passwordValid !== true ? 'true' : 'false'}"
						>
						<button
							type="button"
							class="button password-field-type-toggle"
							data-role="password-toggle"
							aria-label="${passwordFieldType === 'password' ? t(SHOW_PASSWORD) : t(HIDE_PASSWORD)}"
							?disabled="${loading}"
						>
							<span class="icon is-small">
								<i class="fas ${passwordFieldType === 'password' ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i>
							</span>
						</button>
					</div>
					${passwordValid !== true ? html`
						<p class="help is-danger" role="alert">${typeof passwordValid === 'string' ? t(passwordValid) : ''}</p>
					` : nothing}
				</div>

				${needsTotpPasscode ? html`
					<div class="field">
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
				` : nothing}

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
					${loading ? html`
						<span class="icon is-small"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>
						${t('user.auth.authenticating')}
					` : t(BUTTON_LOGIN)}
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
			this.render()
		}, 100)

		this._passwordValidateFn = useDebounceFn(() => {
			const valid = validatePassword(this._passwordValue, false)
			this._passwordValid = valid === true ? true : valid
			this.render()
		}, 100)
	},

	onRender(this: LoginFormViewContext) {
		this._form = this.el.querySelector('#loginform')
		this._usernameInput = this.el.querySelector('#username')
		this._passwordInput = this.el.querySelector('#password')
		this._passwordToggle = this.el.querySelector('[data-role="password-toggle"]')
		this._totpInput = this.el.querySelector('#totpPasscode')
		this._rememberCheckbox = this.el.querySelector('input[name="rememberMe"]')
		this._submitButton = this.el.querySelector('[data-role="submit"]')

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
		this._rememberCheckbox = null
		this._submitButton = null
	},

	_options(this: LoginFormViewContext): LoginFormViewOptions {
		return this.options as LoginFormViewOptions
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
		this.render()
	},

	_handlePasswordInput(this: LoginFormViewContext, event: Event) {
		const target = event.target as HTMLInputElement
		this._passwordValue = target.value
		this._options().onSubmit?.({username: '', password: this._passwordValue, longToken: false})
	},

	async _handleSubmit(this: LoginFormViewContext, event: Event) {
		event.preventDefault()
		const opts = this._options()
		if (opts.loading) {
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

		if (opts.needsTotpPasscode) {
			credentials.totpPasscode = this._totpInput?.value ?? ''
		}

		try {
			await opts.onSubmit(credentials)
		} catch (_e) {
			// Error handling is done in the host via setErrorMessage
		}
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
		const button = (event.target as HTMLElement).closest('[data-role="openid-provider"]') as HTMLButtonElement | null
		if (button) {
			const providerKey = button.getAttribute('data-provider-key')
			if (providerKey) {
				this._options().onOpenIdProviderClick(providerKey)
			}
		}
	},

	setLoading(this: LoginFormViewContext, loading: boolean): void {
		const opts = this._options()
		opts.loading = loading
		if (this._usernameInput) this._usernameInput.disabled = loading
		if (this._passwordInput) this._passwordInput.disabled = loading
		if (this._passwordToggle) this._passwordToggle.disabled = loading
		if (this._totpInput) this._totpInput.disabled = loading
		if (this._rememberCheckbox) this._rememberCheckbox.disabled = loading
		if (this._submitButton) this._submitButton.disabled = loading
		this.render()
	},

	setErrorMessage(this: LoginFormViewContext, message: string): void {
		const opts = this._options()
		opts.errorMessage = message
		this.render()
	},

	setNeedsTotpPasscode(this: LoginFormViewContext, needs: boolean): void {
		const opts = this._options()
		opts.needsTotpPasscode = needs
		this.render()
		if (needs && this._totpInput) {
			this._totpInput.focus()
		}
	},

	setConfirmedEmailSuccess(this: LoginFormViewContext, success: boolean): void {
		const opts = this._options()
		opts.confirmedEmailSuccess = success
		this.render()
	},

	focus(this: LoginFormViewContext): void {
		if (this._totpInput && this._options().needsTotpPasscode) {
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