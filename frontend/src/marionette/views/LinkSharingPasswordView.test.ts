import {afterEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {LinkSharingPasswordView, type LinkSharingPasswordViewInstance} from './LinkSharingPasswordView'

describe('LinkSharingPasswordView', () => {
	let views: ViewInstance[] = []

	const createView = (overrides: Partial<{
		t: (key: string) => string
		onSubmit: (password: string) => void
		loading: boolean
		errorMessage: string
	}> = {}) => {
		const options = {
			t: (key: string) => key,
			onSubmit: vi.fn(),
			loading: false,
			errorMessage: '',
			...overrides,
		}
		const view = new LinkSharingPasswordView(options) as LinkSharingPasswordViewInstance
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return {view, options}
	}

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	it('renders the password required text', () => {
		const {view} = createView()
		const text = view.el.querySelector('p.pbe-2')
		expect(text?.textContent?.trim()).toBe('sharing.passwordRequired')
	})

	it('renders password input with correct id, type, autocomplete, and placeholder', () => {
		const {view} = createView()
		const input = view.el.querySelector('#linkSharePassword') as HTMLInputElement
		expect(input).not.toBeNull()
		expect(input.type).toBe('password')
		expect(input.autocomplete).toBe('off')
		expect(input.placeholder).toBe('user.auth.passwordPlaceholder')
	})

	it('renders login button with correct label', () => {
		const {view} = createView()
		const button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		expect(button).not.toBeNull()
		expect(button.textContent?.trim()).toBe('user.auth.login')
	})

	it('focuses the password input on render', () => {
		const {view} = createView()
		const input = view.el.querySelector('#linkSharePassword') as HTMLInputElement
		expect(document.activeElement).toBe(input)
	})

	it('calls onSubmit with the password value when button is clicked', () => {
		const {view, options} = createView()
		const input = view.el.querySelector('#linkSharePassword') as HTMLInputElement
		input.value = 'test-password'
		const button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		button.click()
		expect(options.onSubmit).toHaveBeenCalledTimes(1)
		expect(options.onSubmit).toHaveBeenCalledWith('test-password')
	})

	it('calls onSubmit when Enter is pressed in the password input', () => {
		const {view, options} = createView()
		const input = view.el.querySelector('#linkSharePassword') as HTMLInputElement
		input.value = 'enter-password'
		input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))
		expect(options.onSubmit).toHaveBeenCalledTimes(1)
		expect(options.onSubmit).toHaveBeenCalledWith('enter-password')
	})

	it('does not call onSubmit when loading is true and button is clicked', () => {
		const {view, options} = createView({loading: true})
		const button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		button.click()
		expect(options.onSubmit).not.toHaveBeenCalled()
	})

	it('disables input and button when loading is true', () => {
		const {view} = createView({loading: true})
		const input = view.el.querySelector('#linkSharePassword') as HTMLInputElement
		const button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		expect(input.disabled).toBe(true)
		expect(button.disabled).toBe(true)
	})

	it('shows loading spinner in button when loading is true', () => {
		const {view} = createView({loading: true})
		const button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		expect(button.querySelector('.fa-spinner')).not.toBeNull()
	})

	it('renders error message when errorMessage is set', () => {
		const {view} = createView({errorMessage: 'Invalid password'})
		const errorEl = view.el.querySelector('.notification.is-danger')
		expect(errorEl).not.toBeNull()
		expect(errorEl?.textContent?.trim()).toBe('Invalid password')
	})

	it('does not render error message when errorMessage is empty', () => {
		const {view} = createView({errorMessage: ''})
		expect(view.el.querySelector('.notification.is-danger')).toBeNull()
	})

	it('setLoading updates loading state and re-renders', () => {
		const {view} = createView({loading: false})
		let button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		expect(button.disabled).toBe(false)
		expect(button.querySelector('.fa-spinner')).toBeNull()

		view.setLoading(true)
		button = view.el.querySelector('[data-role="submit"]') as HTMLButtonElement
		expect(button.disabled).toBe(true)
		expect(button.querySelector('.fa-spinner')).not.toBeNull()
	})

	it('setErrorMessage updates error message and re-renders', () => {
		const {view} = createView({errorMessage: ''})
		expect(view.el.querySelector('.notification.is-danger')).toBeNull()

		view.setErrorMessage('New error')
		const errorEl = view.el.querySelector('.notification.is-danger')
		expect(errorEl).not.toBeNull()
		expect(errorEl?.textContent?.trim()).toBe('New error')
	})

	it('focus method focuses the password input', () => {
		const {view} = createView()
		const input = view.el.querySelector('#linkSharePassword') as HTMLInputElement
		input.blur()
		expect(document.activeElement).not.toBe(input)

		view.focus()
		expect(document.activeElement).toBe(input)
	})

	it('renders label with correct for attribute pointing to password input', () => {
		const {view} = createView()
		const label = view.el.querySelector('label[for="linkSharePassword"]')
		expect(label).not.toBeNull()
		expect(label?.textContent?.trim()).toBe('user.auth.password')
	})
})