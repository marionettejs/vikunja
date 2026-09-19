import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'

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

import {RegisterFormView} from './RegisterFormView'
import type {RegisterFormViewOptions} from './RegisterFormView'

type RegisterFormViewInstanceTyped = ViewInstance & {
	_form: HTMLFormElement | null
	_usernameInput: HTMLInputElement | null
	_emailInput: HTMLInputElement | null
	_passwordInput: HTMLInputElement | null
	_passwordToggle: HTMLButtonElement | null
	_submitButton: HTMLButtonElement | null
	_options(): RegisterFormViewOptions
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setConfirmEmailMessage: (message: string) => void
	setFieldErrors: (errors: Partial<Record<string, string>>) => void
	focus: () => void
}

describe('RegisterFormView', () => {
	let views: RegisterFormViewInstanceTyped[] = []

	function createView(overrides: Partial<RegisterFormViewOptions> = {}): RegisterFormViewInstanceTyped {
		const onSubmit = vi.fn()
		const onLogin = vi.fn()
		const t = vi.fn((key: string) => {
			const translations: Record<string, string> = {
				'user.auth.username': 'Username',
				'user.auth.usernamePlaceholder': 'e.g. frederick',
				'user.auth.usernameRequired': 'Please provide a username.',
				'user.auth.usernameMustNotContainSpace': 'Username must not contain spaces.',
				'user.auth.usernameMustNotLookLikeUrl': 'Username must not look like a URL.',
				'user.auth.email': 'Email',
				'user.auth.emailPlaceholder': 'e.g. frederick@example.com',
				'user.auth.emailInvalid': 'Please provide a valid email address.',
				'user.auth.password': 'Password',
				'user.auth.passwordPlaceholder': 'Your password',
				'user.auth.passwordRequired': 'Please provide a password.',
				'user.auth.passwordNotMin': 'Password must have at least 8 characters.',
				'user.auth.passwordNotMax': 'Password must have at most 72 characters.',
				'user.auth.createAccount': 'Create account',
				'user.auth.authenticating': 'Authenticating…',
				'demo.title': 'Demo title',
				'demo.accountWillBeDeleted': 'Demo account will be deleted.',
				'demo.everythingWillBeDeleted': 'Everything will be deleted.',
				'user.auth.alreadyHaveAnAccount': 'Already have an account?',
				'user.auth.login': 'Login',
				'user.auth.showPassword': 'Show the password',
				'user.auth.hidePassword': 'Hide the password',
				'user.auth.registrationDisabled': 'Registration is disabled.',
			}
			return translations[key] ?? key
		})

		const options: RegisterFormViewOptions = {
			t,
			registrationEnabled: true,
			demoModeEnabled: false,
			loading: false,
			errorMessage: '',
			confirmEmailMessage: '',
			fieldErrors: {},
			onSubmit,
			onLogin,
			...overrides,
		}

		const view = new RegisterFormView(options) as RegisterFormViewInstanceTyped
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
		it('renders username, email, password and submit button', () => {
			const view = createView()
			expect(view.el.querySelector('#registerform')).not.toBeNull()
			expect(view.el.querySelector('#username')).not.toBeNull()
			expect(view.el.querySelector('#email')).not.toBeNull()
			expect(view.el.querySelector('#password')).not.toBeNull()
			expect(view.el.querySelector('[data-role="submit"]')).not.toBeNull()
		})

		it('renders submit button with type submit', () => {
			const view = createView()
			expect(view.el.querySelector('[data-role="submit"]')?.getAttribute('type')).toBe('submit')
		})

		it('autofocuses the username input on render', () => {
			const view = createView()
			expect(document.activeElement).toBe(view._usernameInput)
		})

		it('hides the form and shows disabled message when registration is disabled', () => {
			const view = createView({registrationEnabled: false})
			expect(view.el.querySelector('#registerform')?.getAttribute('hidden')).not.toBeNull()
			expect(view.el.textContent).toContain('Registration is disabled.')
		})

		it('renders demo warning when demo mode is enabled', () => {
			const view = createView({demoModeEnabled: true})
			const warning = view.el.querySelector('[data-role="demo-warning"]')
			expect(warning).not.toBeNull()
			expect(warning?.textContent).toContain('Demo title')
		})

		it('does not render demo warning when demo mode is disabled', () => {
			const view = createView({demoModeEnabled: false})
			expect(view.el.querySelector('[data-role="demo-warning"]')).toBeNull()
		})

		it('renders login link', () => {
			const view = createView()
			expect(view.el.querySelector('[data-role="login"]')).not.toBeNull()
			expect(view.el.textContent).toContain('Already have an account?')
			expect(view.el.textContent).toContain('Login')
		})
	})

	describe('error message', () => {
		it('renders error message when errorMessage is set', () => {
			const view = createView({errorMessage: 'Registration failed.'})
			const message = view.el.querySelector('[data-role="error-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Registration failed.')
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

	describe('confirm email message', () => {
		it('renders success message when confirmEmailMessage is set', () => {
			const view = createView({confirmEmailMessage: 'Please confirm your email.'})
			const message = view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Please confirm your email.')
		})

		it('hides success message when empty', () => {
			const view = createView({confirmEmailMessage: ''})
			const message = view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(true)
		})

		it('updates success message via setConfirmEmailMessage', () => {
			const view = createView({confirmEmailMessage: ''})
			const message = () => view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message()?.hasAttribute('hidden')).toBe(true)

			view.setConfirmEmailMessage('Check your inbox.')
			expect(message()?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Check your inbox.')
		})
	})

	describe('field errors', () => {
		it('applies fieldErrors from options on render', () => {
			const view = createView({fieldErrors: {username: 'Username taken.'}})
			const help = view.el.querySelector('[data-role="username-help"]') as HTMLElement | null
			expect(help?.hasAttribute('hidden')).toBe(false)
			expect(help?.textContent).toBe('Username taken.')
			expect(view._usernameInput?.classList.contains('is-danger')).toBe(true)
		})

		it('updates username, email and password errors via setFieldErrors', () => {
			const view = createView()
			view.setFieldErrors({
				username: 'Username taken.',
				email: 'Email taken.',
				password: 'Password too weak.',
			})

			expect(view.el.querySelector('[data-role="username-help"]')?.textContent).toBe('Username taken.')
			expect(view.el.querySelector('[data-role="email-help"]')?.textContent).toBe('Email taken.')
			expect(view.el.querySelector('[data-role="password-help"]')?.textContent).toBe('Password too weak.')
			expect(view._usernameInput?.classList.contains('is-danger')).toBe(true)
			expect(view._emailInput?.classList.contains('is-danger')).toBe(true)
			expect(view._passwordInput?.classList.contains('is-danger')).toBe(true)
		})

		it('clears field error on keyup', () => {
			const view = createView({fieldErrors: {username: 'Username taken.'}})
			expect(view.el.querySelector('[data-role="username-help"]')?.hasAttribute('hidden')).toBe(false)

			view._usernameInput!.dispatchEvent(new Event('keyup', {bubbles: true}))

			expect(view.el.querySelector('[data-role="username-help"]')?.hasAttribute('hidden')).toBe(true)
			expect(view._usernameInput?.classList.contains('is-danger')).toBe(false)
		})
	})

	describe('username validation', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('shows required error when username is empty on focusout', () => {
			const view = createView()
			const usernameInput = view._usernameInput!
			usernameInput.value = ''
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(usernameInput.classList.contains('is-danger')).toBe(true)
			expect(usernameInput.getAttribute('aria-invalid')).toBe('true')
			expect(view.el.querySelector('[data-role="username-help"]')?.textContent).toBe('Please provide a username.')
		})

		it('shows error when username contains a space', () => {
			const view = createView()
			const usernameInput = view._usernameInput!
			usernameInput.value = 'my user'
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(usernameInput.classList.contains('is-danger')).toBe(true)
			expect(view.el.querySelector('[data-role="username-help"]')?.textContent).toBe('Username must not contain spaces.')
		})

		it('shows error when username looks like a url', () => {
			const view = createView()
			const usernameInput = view._usernameInput!
			usernameInput.value = 'my.user'
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(usernameInput.classList.contains('is-danger')).toBe(true)
			expect(view.el.querySelector('[data-role="username-help"]')?.textContent).toBe('Username must not look like a URL.')
		})

		it('clears error when username becomes valid', () => {
			const view = createView()
			const usernameInput = view._usernameInput!
			usernameInput.value = ''
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))
			vi.advanceTimersByTime(150)
			expect(usernameInput.classList.contains('is-danger')).toBe(true)

			usernameInput.value = 'testuser'
			usernameInput.dispatchEvent(new Event('focusout', {bubbles: true}))
			vi.advanceTimersByTime(150)

			expect(usernameInput.classList.contains('is-danger')).toBe(false)
			expect(view.el.querySelector('[data-role="username-help"]')?.hasAttribute('hidden')).toBe(true)
		})

		it('submits form on Enter key in username field when valid', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'test@example.com'
			view._passwordInput!.value = 'password123'
			view._usernameInput!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).toHaveBeenCalledWith({
				username: 'testuser',
				email: 'test@example.com',
				password: 'password123',
			})
		})
	})

	describe('email validation', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('shows error when email is invalid on focusout', () => {
			const view = createView()
			const emailInput = view._emailInput!
			emailInput.value = 'not-an-email'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(emailInput.classList.contains('is-danger')).toBe(true)
			expect(view.el.querySelector('[data-role="email-help"]')?.textContent).toBe('Please provide a valid email address.')
		})

		it('clears error when email becomes valid', () => {
			const view = createView()
			const emailInput = view._emailInput!
			emailInput.value = 'not-an-email'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))
			vi.advanceTimersByTime(150)
			expect(emailInput.classList.contains('is-danger')).toBe(true)

			emailInput.value = 'test@example.com'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))
			vi.advanceTimersByTime(150)

			expect(emailInput.classList.contains('is-danger')).toBe(false)
			expect(view.el.querySelector('[data-role="email-help"]')?.hasAttribute('hidden')).toBe(true)
		})

		it('submits form on Enter key in email field when valid', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'test@example.com'
			view._passwordInput!.value = 'password123'
			view._emailInput!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

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

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'test@example.com'

			view._form!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))
			vi.advanceTimersByTime(150)

			expect(view._passwordInput?.classList.contains('is-danger')).toBe(true)
			expect(onSubmit).not.toHaveBeenCalled()
		})

		it('submits form on Enter key in password field when valid', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'test@example.com'
			view._passwordInput!.value = 'password123'
			view._passwordInput!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).toHaveBeenCalled()
		})
	})

	describe('submit', () => {
		it('calls onSubmit with credentials when valid', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'test@example.com'
			view._passwordInput!.value = 'password123'
			view._form!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

			expect(onSubmit).toHaveBeenCalledWith({
				username: 'testuser',
				email: 'test@example.com',
				password: 'password123',
			})
		})

		it('does not call onSubmit when email is invalid', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'not-an-email'
			view._passwordInput!.value = 'password123'
			view._form!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

			expect(onSubmit).not.toHaveBeenCalled()
		})

		it('does not call onSubmit when loading', () => {
			const view = createView({loading: true})
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			view._usernameInput!.value = 'testuser'
			view._emailInput!.value = 'test@example.com'
			view._passwordInput!.value = 'password123'
			view._form!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

			expect(onSubmit).not.toHaveBeenCalled()
		})
	})

	describe('loading state', () => {
		it('disables all inputs when loading', () => {
			const view = createView()
			view.setLoading(true)

			expect(view._usernameInput?.disabled).toBe(true)
			expect(view._emailInput?.disabled).toBe(true)
			expect(view._passwordInput?.disabled).toBe(true)
			expect(view._passwordToggle?.disabled).toBe(true)
			expect(view._submitButton?.disabled).toBe(true)
			expect(view._submitButton?.textContent).toContain('Authenticating…')
		})

		it('enables inputs when not loading', () => {
			const view = createView({loading: true})
			view.setLoading(false)

			expect(view._usernameInput?.disabled).toBe(false)
			expect(view._emailInput?.disabled).toBe(false)
			expect(view._passwordInput?.disabled).toBe(false)
			expect(view._passwordToggle?.disabled).toBe(false)
			expect(view._submitButton?.disabled).toBe(false)
			expect(view._submitButton?.textContent).toContain('Create account')
		})
	})

	describe('login link', () => {
		it('calls onLogin when clicked via delegated event', () => {
			const view = createView()
			const onLogin = vi.fn()
			view._options().onLogin = onLogin

			const link = view.el.querySelector('[data-role="login"]') as HTMLAnchorElement
			link.click()

			expect(onLogin).toHaveBeenCalled()
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
