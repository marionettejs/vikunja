import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {OAuthAuthorizeView, type OAuthAuthorizeViewInstance} from './OAuthAuthorizeView'
import type {OAuthAuthorizeViewOptions} from './OAuthAuthorizeView'

type OAuthAuthorizeViewInstanceTyped = ViewInstance & {
	_loading: boolean
	_errorMessage: string
	_redirectedToApp: boolean
	_options(): OAuthAuthorizeViewOptions
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setRedirectedToApp: (redirected: boolean) => void
}

describe('OAuthAuthorizeView', () => {
	let views: OAuthAuthorizeViewInstanceTyped[] = []

	function createView(overrides: Partial<OAuthAuthorizeViewOptions> = {}): OAuthAuthorizeViewInstanceTyped {
		const t = vi.fn((key: string, params?: Record<string, string>) => {
			const translations: Record<string, string> = {
				'user.auth.authenticating': 'Authenticating…',
				'user.auth.oauthRedirectedToApp': 'You have been redirected to the app. You can close this tab now.',
				'user.auth.oauthMissingParams': 'Missing required OAuth parameters: {params}',
			}
			let result = translations[key] ?? key
			if (params) {
				Object.entries(params).forEach(([k, v]) => {
					result = result.replace(`{${k}}`, v)
				})
			}
			return result
		})

		const options: OAuthAuthorizeViewOptions = {
			t,
			loading: true,
			errorMessage: '',
			redirectedToApp: false,
			...overrides,
		}

		const view = new OAuthAuthorizeView(options) as OAuthAuthorizeViewInstanceTyped
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
		it('renders loading message by default', () => {
			const view = createView({loading: true, errorMessage: '', redirectedToApp: false})
			expect(view.el.querySelector('.message')).not.toBeNull()
			expect(view.el.textContent).toContain('Authenticating…')
		})

		it('renders error message when errorMessage is set', () => {
			const view = createView({loading: false, errorMessage: 'Missing required OAuth parameters: client_id', redirectedToApp: false})
			const message = view.el.querySelector('.message.danger')
			expect(message).not.toBeNull()
			expect(message?.getAttribute('role')).toBe('alert')
			expect(view.el.textContent).toContain('Missing required OAuth parameters: client_id')
		})

		it('renders redirected message when redirectedToApp is true', () => {
			const view = createView({loading: false, errorMessage: '', redirectedToApp: true})
			const message = view.el.querySelector('.message')
			expect(message).not.toBeNull()
			expect(message?.getAttribute('role')).toBe('status')
			expect(view.el.textContent).toContain('You have been redirected to the app. You can close this tab now.')
		})

		it('does not render loading message when errorMessage is set', () => {
			const view = createView({loading: true, errorMessage: 'Some error', redirectedToApp: false})
			expect(view.el.textContent).not.toContain('Authenticating…')
			expect(view.el.textContent).toContain('Some error')
		})

		it('does not render loading message when redirectedToApp is true', () => {
			const view = createView({loading: true, errorMessage: '', redirectedToApp: true})
			expect(view.el.textContent).not.toContain('Authenticating…')
			expect(view.el.textContent).toContain('You have been redirected to the app')
		})
	})

	describe('setErrorMessage', () => {
		it('updates error message via setErrorMessage', () => {
			const view = createView({loading: false, errorMessage: '', redirectedToApp: false})
			expect(view.el.querySelector('.message.danger')).toBeNull()

			view.setErrorMessage('New error')
			const message = view.el.querySelector('.message.danger')
			expect(message).not.toBeNull()
			expect(view.el.textContent).toContain('New error')
		})

		it('clears error message when empty string', () => {
			const view = createView({loading: false, errorMessage: 'Some error', redirectedToApp: false})
			expect(view.el.querySelector('.message.danger')).not.toBeNull()

			view.setErrorMessage('')
			expect(view.el.querySelector('.message.danger')).toBeNull()
		})
	})

	describe('setRedirectedToApp', () => {
		it('updates redirected state via setRedirectedToApp', () => {
			const view = createView({loading: false, errorMessage: '', redirectedToApp: false})
			expect(view.el.textContent).not.toContain('You have been redirected')

			view.setRedirectedToApp(true)
			expect(view.el.textContent).toContain('You have been redirected to the app')
		})

		it('clears redirected state', () => {
			const view = createView({loading: false, errorMessage: '', redirectedToApp: true})
			expect(view.el.textContent).toContain('You have been redirected to the app')

			view.setRedirectedToApp(false)
			expect(view.el.textContent).not.toContain('You have been redirected to the app')
		})
	})

	describe('setLoading', () => {
		it('shows loading message when set to true and no error or redirect', () => {
			const view = createView({loading: false, errorMessage: '', redirectedToApp: false})
			expect(view.el.textContent).not.toContain('Authenticating…')

			view.setLoading(true)
			expect(view.el.textContent).toContain('Authenticating…')
		})

		it('hides loading message when set to false', () => {
			const view = createView({loading: true, errorMessage: '', redirectedToApp: false})
			expect(view.el.textContent).toContain('Authenticating…')

			view.setLoading(false)
			expect(view.el.textContent).not.toContain('Authenticating…')
		})

		it('does not show loading when error is present', () => {
			const view = createView({loading: false, errorMessage: 'Some error', redirectedToApp: false})
			view.setLoading(true)
			expect(view.el.textContent).toContain('Some error')
			expect(view.el.textContent).not.toContain('Authenticating…')
		})

		it('does not show loading when redirectedToApp is true', () => {
			const view = createView({loading: false, errorMessage: '', redirectedToApp: true})
			view.setLoading(true)
			expect(view.el.textContent).toContain('You have been redirected to the app')
			expect(view.el.textContent).not.toContain('Authenticating…')
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