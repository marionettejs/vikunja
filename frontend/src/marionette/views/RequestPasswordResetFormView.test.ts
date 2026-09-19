import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'

vi.mock('@/helpers/isEmail', () => ({
	isEmail: vi.fn((email: string) => {
		if (email === '') {
			return false
		}
		const format = /^.+@.+$/
		return email.match(format) !== null
	}),
}))

import {RequestPasswordResetFormView} from './RequestPasswordResetFormView'
import type {RequestPasswordResetFormViewOptions} from './RequestPasswordResetFormView'

type RequestPasswordResetFormViewInstanceTyped = ViewInstance & {
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
	_options(): RequestPasswordResetFormViewOptions
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setSuccess: (success: boolean) => void
	focus: () => void
}

describe('RequestPasswordResetFormView', () => {
	let views: RequestPasswordResetFormViewInstanceTyped[] = []

	function createView(overrides: Partial<RequestPasswordResetFormViewOptions> = {}): RequestPasswordResetFormViewInstanceTyped {
		const onSubmit = vi.fn()
		const onLogin = vi.fn()
		const t = vi.fn((key: string) => {
			const translations: Record<string, string> = {
				'user.auth.email': 'Email',
				'user.auth.emailPlaceholder': 'e.g. frederick@example.com',
				'user.auth.emailInvalid': 'Please provide a valid email address.',
				'user.auth.resetPasswordAction': 'Send me a password reset link',
				'user.auth.resetPasswordSuccess': 'Check your inbox! You should have an email with instructions on how to reset your password.',
				'user.auth.login': 'Login',
				'user.auth.authenticating': 'Authenticating…',
			}
			return translations[key] ?? key
		})

		const options: RequestPasswordResetFormViewOptions = {
			t,
			loading: false,
			errorMessage: '',
			isSuccess: false,
			onSubmit,
			onLogin,
			...overrides,
		}

		const view = new RequestPasswordResetFormView(options) as RequestPasswordResetFormViewInstanceTyped
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
		it('renders email input and submit button', () => {
			const view = createView()
			expect(view.el.querySelector('#request-password-reset-form')).not.toBeNull()
			expect(view.el.querySelector('#email')).not.toBeNull()
			expect(view.el.querySelector('[data-role="submit"]')).not.toBeNull()
		})

		it('autofocuses the email input on render', () => {
			const view = createView()
			expect(document.activeElement).toBe(view._emailInput)
		})

		it('hides the form and shows success message when isSuccess is true', () => {
			const view = createView({isSuccess: true})
			expect(view._form?.getAttribute('hidden')).not.toBeNull()
			expect(view._successMessage?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Check your inbox!')
		})

		it('shows the form and hides success message when isSuccess is false', () => {
			const view = createView({isSuccess: false})
			expect(view._form?.hasAttribute('hidden')).toBe(false)
			expect(view._successMessage?.hasAttribute('hidden')).toBe(true)
		})

		it('renders login link in success message', () => {
			const view = createView({isSuccess: true})
			expect(view._loginLink).not.toBeNull()
			expect(view.el.textContent).toContain('Login')
		})
	})

	describe('error message', () => {
		it('renders error message when errorMessage is set', () => {
			const view = createView({errorMessage: 'Failed to send reset email.'})
			const message = view.el.querySelector('[data-role="error-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Failed to send reset email.')
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

	describe('success state', () => {
		it('renders success message when isSuccess is true', () => {
			const view = createView({isSuccess: true})
			const message = view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(false)
			expect(view.el.textContent).toContain('Check your inbox!')
		})

		it('hides success message when isSuccess is false', () => {
			const view = createView({isSuccess: false})
			const message = view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message?.hasAttribute('hidden')).toBe(true)
		})

		it('updates success state via setSuccess', () => {
			const view = createView({isSuccess: false})
			const message = () => view.el.querySelector('[data-role="success-message"]') as HTMLElement | null
			expect(message()?.hasAttribute('hidden')).toBe(true)
			expect(view._form?.hasAttribute('hidden')).toBe(false)

			view.setSuccess(true)
			expect(message()?.hasAttribute('hidden')).toBe(false)
			expect(view._form?.getAttribute('hidden')).not.toBeNull()
		})

		it('focuses login link when success state is set to true', () => {
			const view = createView({isSuccess: false})
			view.setSuccess(true)
			expect(document.activeElement).toBe(view._loginLink)
		})
	})

	describe('email validation', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('shows error when email is empty on focusout', () => {
			const view = createView()
			const emailInput = view._emailInput!
			emailInput.value = ''
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(emailInput.classList.contains('is-danger')).toBe(true)
			expect(emailInput.getAttribute('aria-invalid')).toBe('true')
			const help = view.el.querySelector('[data-role="email-help"]')
			expect(help).not.toBeNull()
			expect(help?.textContent).toBe('Please provide a valid email address.')
		})

		it('shows error when email is invalid on focusout', () => {
			const view = createView()
			const emailInput = view._emailInput!
			emailInput.value = 'invalid-email'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(emailInput.classList.contains('is-danger')).toBe(true)
			expect(emailInput.getAttribute('aria-invalid')).toBe('true')
			const help = view.el.querySelector('[data-role="email-help"]')
			expect(help).not.toBeNull()
			expect(help?.textContent).toBe('Please provide a valid email address.')
		})

		it('clears error when valid email is entered', () => {
			const view = createView()
			const emailInput = view._emailInput!
			emailInput.value = 'invalid-email'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			emailInput.value = 'test@example.com'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(emailInput.classList.contains('is-danger')).toBe(false)
			expect(emailInput.hasAttribute('aria-invalid')).toBe(false)
			expect(view._emailHelp?.hasAttribute('hidden')).toBe(true)
		})

		it('clears error on keyup after first validation', () => {
			const view = createView()
			const emailInput = view._emailInput!
			emailInput.value = 'invalid-email'
			emailInput.dispatchEvent(new Event('focusout', {bubbles: true}))

			vi.advanceTimersByTime(150)

			emailInput.value = 'test@example.com'
			emailInput.dispatchEvent(new Event('keyup', {bubbles: true}))

			vi.advanceTimersByTime(150)

			expect(emailInput.classList.contains('is-danger')).toBe(false)
			expect(view._emailHelp?.hasAttribute('hidden')).toBe(true)
		})

		it('submits form on Enter key in email field', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const emailInput = view._emailInput!
			emailInput.value = 'test@example.com'
			emailInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).toHaveBeenCalledWith('test@example.com')
		})

		it('does not submit when email is invalid', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const emailInput = view._emailInput!
			emailInput.value = 'invalid-email'
			emailInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).not.toHaveBeenCalled()
		})

		it('does not submit when email is empty', () => {
			const view = createView()
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const emailInput = view._emailInput!
			emailInput.value = ''
			emailInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).not.toHaveBeenCalled()
		})
	})

	describe('loading state', () => {
		it('disables email input and submit button when loading', () => {
			const view = createView()
			view.setLoading(true)

			expect(view._emailInput?.disabled).toBe(true)
			expect(view._submitButton?.disabled).toBe(true)
			expect(view._submitButton?.textContent).toContain('Authenticating…')
			expect(view._submitSpinner?.hasAttribute('hidden')).toBe(false)
			expect(view._submitLabel?.hasAttribute('hidden')).toBe(true)
		})

		it('enables inputs when not loading', () => {
			const view = createView({loading: true})
			view.setLoading(false)

			expect(view._emailInput?.disabled).toBe(false)
			expect(view._submitButton?.disabled).toBe(false)
			expect(view._submitButton?.textContent).toContain('Send me a password reset link')
			expect(view._submitSpinner?.hasAttribute('hidden')).toBe(true)
			expect(view._submitLabel?.hasAttribute('hidden')).toBe(false)
		})

		it('does not submit when loading', () => {
			const view = createView()
			view.setLoading(true)
			const onSubmit = vi.fn()
			view._options().onSubmit = onSubmit

			const emailInput = view._emailInput!
			emailInput.value = 'test@example.com'
			emailInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

			expect(onSubmit).not.toHaveBeenCalled()
		})
	})

	describe('login link', () => {
		it('calls onLogin when clicked in success state', () => {
			const view = createView({isSuccess: true})
			const onLogin = vi.fn()
			view._options().onLogin = onLogin

			view._loginLink?.click()

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