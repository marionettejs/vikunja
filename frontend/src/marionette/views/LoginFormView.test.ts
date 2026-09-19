import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {validatePassword} from '@/helpers/validatePasswort'

vi.mock('@/helpers/validatePasswort', () => ({
	validatePassword: vi.fn((password: string, validateMinLength: boolean) => {
		if (password === '') {
			return 'user.auth.passwordRequired'
		}
		if (validateMinLength && password.length < 8) {
			return 'user.auth.passwordNotMin'
		}
		if (validateMinLength && password.length > 72) {
			return 'user.auth.passwordNotMax'
		}
		return true
	}),
}))

import {LoginFormView, type LoginFormViewInstance} from './LoginFormView'
import type {LoginFormViewOptions} from './LoginFormView'

type LoginFormViewInstanceTyped = ViewInstance & {
	_form: HTMLFormElement | null
	_usernameInput: HTMLInputElement | null
	_passwordInput: HTMLInputElement | null
	_passwordValue: string
	_passwordToggle: HTMLButtonElement | null
	_totpInput: HTMLInputElement | null
	_rememberCheckbox: HTMLInputElement | null
	_submitButton: HTMLButtonElement | null
	_options(): LoginFormViewOptions
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setNeedsTotpPasscode: (needs: boolean) => void
	setConfirmedEmailSuccess: (success: boolean) => void
	focus: () => void
}

const createMockProvider = (key: string, name: string) => ({key, label: `Log in with ${name}`})

describe('LoginFormView', () => {
	let views: LoginFormViewInstanceTyped[] = []

	function createView(overrides: Partial<LoginFormViewOptions> = {}): LoginFormViewInstanceTyped {
		const onSubmit = vi.fn()
		const onForgotPassword = vi.fn()
		const onRegister = vi.fn()
		const onOpenIdProviderClick = vi.fn()
		const t = vi.fn((key: string, params?: Record<string, string>) => {
			const translations: Record<string, string> = {
				'user.auth.usernameEmail': 'Username Or Email Address',
				'user.auth.usernamePlaceholder': 'e.g. frederick',
				'user.auth.usernameRequired': 'Please provide a username.',
				'user.auth.password': 'Password',
				'user.auth.passwordPlaceholder': 'Your password',
				'user.auth.forgotPassword': 'Forgot your password?',
				'user.auth.totpTitle': 'Two Factor Authentication Code',
				'user.auth.totpPlaceholder': 'e.g. 123456',
				'user.auth.remember': 'Stay logged in',
				'user.auth.login': 'Login',
				'user.auth.authenticating': 'Authenticating…',
				'user.auth.noAccountYet': 'Don\'t have an account yet?',
				'user.auth.createAccount': 'Create account',
				'user.auth.loginWith': 'Log in with {provider}',
				'user.auth.confirmEmailSuccess': 'You successfully confirmed your email! You can log in now.',
				'user.auth.showPassword': 'Show the password',
				'user.auth.hidePassword': 'Hide the password',
				'user.auth.passwordRequired': 'Please provide a password.',
				'user.auth.passwordNotMin': 'Password must have at least 8 characters.',
				'user.auth.passwordNotMax': 'Password must have at most 72 characters.',
			}
			let result = translations[key] ?? key
			if (params) {
				Object.entries(params).forEach(([k, v]) => {
					result = result.replace(`{${k}}`, v)
				})
			}
			return result
		})

		const options: LoginFormViewOptions = {
			t,
			localAuthEnabled: true,
			ldapAuthEnabled: false,
			registrationEnabled: true,
			openidEnabled: true,
			openidProviders: [createMockProvider('google', 'Google'), createMockProvider('github', 'GitHub')],
			needsTotpPasscode: false,
			loading: false,
			errorMessage: '',
			confirmedEmailSuccess: false,
			onSubmit,
			onForgotPassword,
			onRegister,
			onOpenIdProviderClick,
			...overrides,
		}

		const view = new LoginFormView(options) as LoginFormViewInstanceTyped
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return view
	}

	beforeEach(() => {
		views = []
		document.body.innerHTML = ''
		vi.clearAllMocks()
	})

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	describe('initialization', () => {
		it('renders username, password, remember me, submit button', () => {
			const view = createView()
			expect(view.el.querySelector('#loginform')).not.toBeNull()
			expect(view.el.querySelector('#username')).not.toBeNull()
			expect(view.el.querySelector('#password')).not.toBeNull()
			expect(view.el.querySelector('input[name="rememberMe"]')).not.toBeNull()
			expect(view.el.querySelector('[data-role="submit"]')).not.toBeNull()
		})

		it('autofocuses the username input on render', () => {
			const view = createView()
			expect(document.activeElement).toBe(view._usernameInput)
		})

		it('renders registration link when enabled', () => {
			const view = createView({registrationEnabled: true})
			expect(view.el.textContent).toContain('Don\'t have an account yet?')
			expect(view.el.textContent).toContain('Create account')
		})

		it('does not render registration link when disabled', () => {
			const view = createView({registrationEnabled: false})
			expect(view.el.textContent).not.toContain('Don\'t have an account yet?')
		})

		it('renders OpenID provider buttons when enabled', () => {
			const view = createView()
			const buttons = view.el.querySelectorAll('.button.is-outlined.is-fullwidth')
			expect(buttons.length).toBe(2)
			expect(buttons[0].textContent).toContain('Log in with Google')
			expect(buttons[1].textContent).toContain('Log in with GitHub')
		})

		it('does not render OpenID provider buttons when disabled', () => {
			const view = createView({openidEnabled: false, openidProviders: []})
			const buttons = view.el.querySelectorAll('.button.is-outlined.is-fullwidth')
			expect(buttons.length).toBe(0)
		})

		it('does not render local form when both local and LDAP auth are disabled', () => {
			const view = createView({localAuthEnabled: false, ldapAuthEnabled: false})
			expect(view.el.querySelector('#loginform')?.getAttribute('hidden')).not.toBeNull()
		})
	})

	describe('email confirmation success message', () => {
		it('renders success message when confirmedEmailSuccess is true', () => {
			const view = createView({confirmedEmailSuccess: true})
			const message = view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message).not.toBeNull()
			expect(message?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('You successfully confirmed your email!')
		})

		it('hides success message when confirmedEmailSuccess is false', () => {
			const view = createView({confirmedEmailSuccess: false})
			const message = view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(true)
		})

		it('updates success message via setConfirmedEmailSuccess', () => {
			const view = createView({confirmedEmailSuccess: false})
			const message = () => view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message()?.hasAttribute('hidden')).toBe(true)

			view.setConfirmedEmailSuccess(true)
			expect(message()?.hasAttribute('hidden')).toBe(false)
		})
	})

	describe('error message', () => {
		it('renders error message when errorMessage is set', () => {
			const view = createView({errorMessage: 'Wrong username or password.'})
			const message = view.el.querySelector('[data-role="error-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Wrong username or password.')
		})

		it('hides error message when empty', () => {
			const view = createView({errorMessage: ''})
			const message = view.el.querySelector('[data-role="error-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(true)
		})

		it('updates error message via setErrorMessage', () => {
			const view = createView({errorMessage: ''})
			const message = () => view.el.querySelector('[data-role="error-message"]') as HTMLElement | null
			expect(message()?.hasAttribute('hidden')).toBe(true)

			view.setErrorMessage('New error')
			expect(message()?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('New error')
		})
	})

describe('username validation', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('shows error when username is empty on focusout', () => {
			const view = createView()
			const usernameInput = view._usernameInput!
			usernameInput.value = ''
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(usernameInput.classList.contains('is-danger')).toBe(true)
			expect(usernameInput.getAttribute('aria-invalid')).toBe('true')
			const help = view.el.querySelector('.help.is-danger')
			expect(help).not.toBeNull()
			expect(help?.textContent).toBe('Please provide a username.')
		})

		it('clears error when username is filled', () => {
			const view = createView()
			const usernameInput = view._usernameInput!
			usernameInput.value = ''
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			usernameInput.value = 'testuser'
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(usernameInput.classList.contains('is-danger')).toBe(false)
			expect(usernameInput.getAttribute('aria-invalid')).toBe('false')
			expect(view.el.querySelector('[data-role="username-help"]')?.hasAttribute('hidden')).toBe(true)
		})

		it('submits form on Enter key in username field', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const usernameInput = view._usernameInput!
			usernameInput.value = 'testuser'
			view._passwordValue = 'password123'
			usernameInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).toHaveBeenCalled()
		})
	})

describe('password field', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('renders password input with show/hide toggle', () => {
			const view = createView()
			expect(view._passwordInput).not.toBeNull()
			expect(view._passwordInput?.type).toBe('password')
			expect(view._passwordToggle).not.toBeNull()
			expect(view._passwordToggle?.querySelector('i.fa-eye')).not.toBeNull()
		})

		it('toggles password visibility on toggle button click', () => {
			const view = createView()
			expect(view._passwordInput?.type).toBe('password')

			view._passwordToggle?.click()
			expect(view._passwordInput?.type).toBe('text')
			expect(view._passwordToggle?.querySelector('i.fa-eye-slash')).not.toBeNull()

			view._passwordToggle?.click()
			expect(view._passwordInput?.type).toBe('password')
			expect(view._passwordToggle?.querySelector('i.fa-eye')).not.toBeNull()
		})

		it('shows error when password is empty on submit', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const usernameInput = view._usernameInput!
			usernameInput.value = 'testuser'

			const form = view._form!
			form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

			vi.advanceTimersByTime(150)

			expect(view._passwordInput?.classList.contains('is-danger')).toBe(true)
			expect(onSubmit).not.toHaveBeenCalled()
		})

		it('validates password on focusout after first validation', () => {
			const view = createView()
			const passwordInput = view._passwordInput!

			passwordInput.value = 'short'
			passwordInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			// First focusout enables validation, second triggers it
			passwordInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(passwordInput.classList.contains('is-danger')).toBe(true)
			const help = passwordInput.closest('.field')?.querySelector('.help.is-danger')
			expect(help?.textContent).toBe('Please provide a password.')

			passwordInput.value = 'password123'
			passwordInput.dispatchEvent(new Event('input', {bubbles: true}))
			passwordInput.dispatchEvent(new Event('keyup', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(passwordInput.classList.contains('is-danger')).toBe(false)
			expect(passwordInput.closest('.field')?.querySelector('.help.is-danger')?.hasAttribute('hidden')).toBe(true)
		})

		it('submits form on Enter key in password field', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const usernameInput = view._usernameInput!
			usernameInput.value = 'testuser'
			view._passwordValue = 'password123'

			const passwordInput = view._passwordInput!
			passwordInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).toHaveBeenCalled()
		})
	})

	describe('TOTP field', () => {
		it('renders TOTP field when needsTotpPasscode is true', () => {
			const view = createView({needsTotpPasscode: true})
			expect(view._totpInput).not.toBeNull()
			expect(view._totpInput?.getAttribute('inputmode')).toBe('numeric')
			expect(view._totpInput?.getAttribute('autocomplete')).toBe('one-time-code')
		})

		it('hides TOTP field when needsTotpPasscode is false', () => {
			const view = createView({needsTotpPasscode: false})
			expect(view._totpInput).not.toBeNull()
			expect(view.el.querySelector('[data-role="totp-field"]')?.hasAttribute('hidden')).toBe(true)
		})

		it('updates TOTP field visibility via setNeedsTotpPasscode', () => {
			const view = createView({needsTotpPasscode: false})
			const field = () => view.el.querySelector('[data-role="totp-field"]') as HTMLElement | null
			expect(field()?.hasAttribute('hidden')).toBe(true)

			view.setNeedsTotpPasscode(true)
			expect(field()?.hasAttribute('hidden')).toBe(false)
			expect(document.activeElement).toBe(view._totpInput)

			view.setNeedsTotpPasscode(false)
			expect(field()?.hasAttribute('hidden')).toBe(true)
		})

		it('submits form on Enter key in TOTP field', () => {
			const view = createView({needsTotpPasscode: true})
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const usernameInput = view._usernameInput!
			usernameInput.value = 'testuser'
			view._passwordValue = 'password123'
			view._totpInput!.value = '123456'

			view._totpInput!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).toHaveBeenCalled()
		})
	})

	describe('remember me checkbox', () => {
		it('renders remember me checkbox', () => {
			const view = createView()
			expect(view._rememberCheckbox).not.toBeNull()
			expect(view._rememberCheckbox?.type).toBe('checkbox')
		})

		it('includes longToken in credentials when checked', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const usernameInput = view._usernameInput!
			usernameInput.value = 'testuser'
			view._passwordValue = 'password123'
			view._rememberCheckbox!.checked = true

			view._form!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({longToken: true})
			)
		})

		it('excludes longToken in credentials when unchecked', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const usernameInput = view._usernameInput!
			usernameInput.value = 'testuser'
			view._passwordValue = 'password123'
			view._rememberCheckbox!.checked = false

			view._form!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({longToken: false})
			)
		})
	})

	describe('loading state', () => {
		it('disables all inputs when loading', () => {
			const view = createView()
			view.setLoading(true)

			expect(view._usernameInput?.disabled).toBe(true)
			expect(view._passwordInput?.disabled).toBe(true)
			expect(view._passwordToggle?.disabled).toBe(true)
			expect(view._rememberCheckbox?.disabled).toBe(true)
			expect(view._submitButton?.disabled).toBe(true)
			expect(view._submitButton?.textContent).toContain('Authenticating…')
		})

		it('enables inputs when not loading', () => {
			const view = createView({loading: true})
			view.setLoading(false)

			expect(view._usernameInput?.disabled).toBe(false)
			expect(view._passwordInput?.disabled).toBe(false)
			expect(view._passwordToggle?.disabled).toBe(false)
			expect(view._rememberCheckbox?.disabled).toBe(false)
			expect(view._submitButton?.disabled).toBe(false)
			expect(view._submitButton?.textContent).toContain('Login')
		})
	})

	describe('forgot password link', () => {
		it('calls onForgotPassword when clicked', () => {
			const view = createView({localAuthEnabled: true})
			const onForgotPassword = vi.fn()
			view._options().onForgotPassword = onForgotPassword

			const link = view.el.querySelector('.reset-password-link') as HTMLAnchorElement
			link.click()

			expect(onForgotPassword).toHaveBeenCalled()
		})

		it('does not render when localAuthEnabled is false', () => {
			const view = createView({localAuthEnabled: false, ldapAuthEnabled: true})
			expect(view.el.querySelector('.reset-password-link')).toBeNull()
		})
	})

	describe('register link', () => {
		it('calls onRegister when clicked', () => {
			const view = createView()
			const onRegister = vi.fn()
			view._options().onRegister = onRegister

			const link = view.el.querySelector('.inline-link') as HTMLAnchorElement
			link.click()

			expect(onRegister).toHaveBeenCalled()
		})
	})

	describe('OpenID provider buttons', () => {
		it('calls onOpenIdProviderClick with provider when clicked', () => {
			const view = createView()
			const onOpenIdProviderClick = vi.fn()
			view._options().onOpenIdProviderClick = onOpenIdProviderClick

			const buttons = view.el.querySelectorAll('.button.is-outlined.is-fullwidth')
			;(buttons[0] as HTMLButtonElement).click()

			expect(onOpenIdProviderClick).toHaveBeenCalledWith('google')
		})

		it('disables buttons when loading', () => {
			const view = createView({loading: true})
			const buttons = view.el.querySelectorAll('.button.is-outlined.is-fullwidth')
			expect(buttons[0].getAttribute('disabled')).toBe('')
		})
	})

	describe('teardown', () => {
		it('does not throw on double destroy', () => {
			const view = createView()
			expect(() => view.destroy()).not.toThrow()
			expect(() => view.destroy()).not.toThrow()
		})
	})
})