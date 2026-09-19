import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {mount, flushPromises, type VueWrapper} from '@vue/test-utils'
import {i18n} from '@/i18n'
import RegisterHost from '@/views/user/RegisterHost.vue'

const {mockRegister, mockPush, mockRedirect, mockFormInstances, mockAuth, mockConfig} = vi.hoisted(() => {
	return {
		mockRegister: vi.fn(),
		mockPush: vi.fn(),
		mockRedirect: vi.fn(),
		mockFormInstances: [] as any[],
		mockAuth: {
			authenticated: false,
			isLoading: false,
			register: undefined as unknown as (...args: any[]) => Promise<unknown>,
		},
		mockConfig: {
			auth: {
				local: {
					registrationEnabled: true,
				},
			},
			demoModeEnabled: false,
		},
	}
})

mockAuth.register = mockRegister

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mockPush,
	}),
}))

vi.mock('@/i18n', async () => {
	const {ref} = await import('vue')
	return {
		i18n: {
			global: {
				t: (key: string) => key,
				locale: ref('en'),
			},
		},
	}
})

vi.mock('@/stores/auth', () => ({
	useAuthStore: () => mockAuth,
}))

vi.mock('@/stores/config', () => ({
	useConfigStore: () => mockConfig,
}))

vi.mock('@/composables/useRedirectToLastVisited', () => ({
	useRedirectToLastVisited: () => ({
		redirectIfSaved: mockRedirect,
	}),
}))

vi.mock('@/composables/useTitle', () => ({
	useTitle: vi.fn(),
}))

vi.mock('@/marionette/views/RegisterFormView', () => {
	return {
		RegisterFormView: class {
			options: any
			el: HTMLElement
			render = vi.fn()
			destroy = vi.fn()
			setLoading = vi.fn()
			setErrorMessage = vi.fn()
			setConfirmEmailMessage = vi.fn()
			setFieldErrors = vi.fn()
			constructor(options: any) {
				this.options = options
				this.el = document.createElement('div')
				mockFormInstances.push(this)
			}
		},
	}
})

describe('RegisterHost', () => {
	let wrapper: VueWrapper | null = null

	beforeEach(() => {
		mockRegister.mockReset()
		mockPush.mockReset()
		mockRedirect.mockReset()
		mockFormInstances.length = 0
		mockAuth.authenticated = false
		mockAuth.isLoading = false
		mockConfig.auth.local.registrationEnabled = true
		mockConfig.demoModeEnabled = false
		i18n.global.locale.value = 'en'
		document.body.innerHTML = ''
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = null
		document.body.innerHTML = ''
	})

	async function mountHost() {
		wrapper = mount(RegisterHost, {
			attachTo: document.body,
		})
		await flushPromises()
		return wrapper
	}

	it('mounts RegisterFormView with initial fieldErrors and confirmEmailMessage', async () => {
		await mountHost()

		expect(mockFormInstances).toHaveLength(1)
		const form = mockFormInstances[0]
		expect(form.options.registrationEnabled).toBe(true)
		expect(form.options.demoModeEnabled).toBe(false)
		expect(form.options.loading).toBe(false)
		expect(form.options.errorMessage).toBe('')
		expect(form.options.confirmEmailMessage).toBe('')
		expect(form.options.fieldErrors).toEqual({})
		expect(typeof form.options.onSubmit).toBe('function')
		expect(typeof form.options.onLogin).toBe('function')
		expect(form.render).toHaveBeenCalled()

		const host = document.getElementById('register-form-host')
		expect(host).not.toBeNull()
		expect(host?.contains(form.el)).toBe(true)
	})

	it('registers and redirects on successful submit', async () => {
		mockRegister.mockResolvedValueOnce(undefined)
		await mountHost()

		const form = mockFormInstances[0]
		await form.options.onSubmit({username: 'testuser', email: 'test@example.com', password: 'password123'})

		expect(mockRegister).toHaveBeenCalledWith({username: 'testuser', email: 'test@example.com', password: 'password123'})
		expect(mockRedirect).toHaveBeenCalled()
	})

	it('shows confirm email message on code 1012', async () => {
		mockRegister.mockRejectedValueOnce({code: 1012})
		await mountHost()

		const form = mockFormInstances[0]
		await form.options.onSubmit({username: 'testuser', email: 'test@example.com', password: 'password123'})

		expect(form.setConfirmEmailMessage).toHaveBeenCalledWith('user.auth.registrationConfirmEmail')
		expect(mockRedirect).not.toHaveBeenCalled()
	})

	it('sets field errors on api validation error', async () => {
		mockRegister.mockRejectedValueOnce({invalid_fields: ['username: Username taken.']})
		await mountHost()

		const form = mockFormInstances[0]
		await form.options.onSubmit({username: 'testuser', email: 'test@example.com', password: 'password123'})

		expect(form.setFieldErrors).toHaveBeenCalledWith({username: 'Username taken.'})
		expect(mockRedirect).not.toHaveBeenCalled()
	})

	it('shows generic error when validation error cannot be mapped to fields', async () => {
		mockRegister.mockRejectedValueOnce({invalid_fields: ['no field prefix here']})
		await mountHost()

		const form = mockFormInstances[0]
		await form.options.onSubmit({username: 'testuser', email: 'test@example.com', password: 'password123'})

		expect(form.setErrorMessage).toHaveBeenCalledWith('user.auth.registrationFailed')
	})

	it('shows api message on generic error with message', async () => {
		mockRegister.mockRejectedValueOnce({message: 'Boom'})
		await mountHost()

		const form = mockFormInstances[0]
		await form.options.onSubmit({username: 'testuser', email: 'test@example.com', password: 'password123'})

		expect(form.setErrorMessage).toHaveBeenCalledWith('Boom')
	})

	it('shows generic error on unknown failure', async () => {
		mockRegister.mockRejectedValueOnce({})
		await mountHost()

		const form = mockFormInstances[0]
		await form.options.onSubmit({username: 'testuser', email: 'test@example.com', password: 'password123'})

		expect(form.setErrorMessage).toHaveBeenCalledWith('user.auth.registrationFailed')
	})

	it('navigates to login on login link', async () => {
		await mountHost()

		const form = mockFormInstances[0]
		form.options.onLogin()

		expect(mockPush).toHaveBeenCalledWith({name: 'user.login'})
	})

	it('redirects home when already authenticated', async () => {
		mockAuth.authenticated = true
		await mountHost()

		expect(mockPush).toHaveBeenCalledWith({name: 'home'})
	})

	it('destroys view on unmount', async () => {
		await mountHost()

		const form = mockFormInstances[0]
		wrapper!.unmount()
		wrapper = null

		expect(form.destroy).toHaveBeenCalled()
	})
})
