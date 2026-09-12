import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {mount, flushPromises, VueWrapper} from '@vue/test-utils'
import {i18n} from '@/i18n'
import NewTeamHost from './NewTeamHost.vue'

const {mockCreate, mockError, mockSuccess, mockPush, mockBack, mockModalInstances, mockFormInstances} = vi.hoisted(() => {
	return {
		mockCreate: vi.fn(),
		mockError: vi.fn(),
		mockSuccess: vi.fn(),
		mockPush: vi.fn(),
		mockBack: vi.fn(),
		mockModalInstances: [] as any[],
		mockFormInstances: [] as any[],
	}
})

vi.mock('@/services/team', () => {
	return {
		default: class {
			create(model: any) {
				return mockCreate(model)
			}
		},
	}
})

vi.mock('@/message', () => ({
		error: mockError,
		success: mockSuccess,
}))

vi.mock('vue-router', () => ({
		useRouter: () => ({
		push: mockPush,
		back: mockBack,
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

vi.mock('@/stores/config', () => ({
	useConfigStore: () => ({ 
		publicTeamsEnabled: true,
	}),
}))

vi.mock('@/marionette/views/ModalCardView', () => {
	return {
		ModalCardView: class {
			options: any
			setPrimaryDisabled = vi.fn()
			setDismissible = vi.fn()
			showChildView = vi.fn()
			destroy = vi.fn()
			constructor(options: any) {
				this.options = options
				mockModalInstances.push(this)
			}
		},
	}
})

vi.mock('@/marionette/views/NewTeamFormView', () => {
	return {
		NewTeamFormView: class {
			options: any
			getValues = vi.fn()
			setDisabled = vi.fn()
			isValid = vi.fn(() => true)
			submit = vi.fn(() => {
				return this.options.onSubmit({name: 'Test Team', isPublic: false})
			})
			destroy = vi.fn()
			constructor(options: any) {
				this.options = options
				mockFormInstances.push(this)
			}
		},
	}
})

describe('NewTeamHost', () => {
	let wrapper: VueWrapper | null = null

	beforeEach(() => {
		mockCreate.mockReset()
		mockError.mockReset()
		mockSuccess.mockReset()
		mockPush.mockReset()
		mockBack.mockReset()
		mockModalInstances.length = 0
		mockFormInstances.length = 0
		i18n.global.locale.value = 'en'
	})

	afterEach(() => {
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it('A successful create followed by a successful navigation reports success once and pushes to teams.edit with the new id', async () => {
		mockCreate.mockResolvedValueOnce({id: 42, name: 'Test Team'})
		mockPush.mockResolvedValueOnce(undefined)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const form = mockFormInstances[mockFormInstances.length - 1]
		await form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		expect(mockCreate).toHaveBeenCalledTimes(1)
		expect(mockPush).toHaveBeenCalledWith({name: 'teams.edit', params: {id: 42}})
		expect(mockSuccess).toHaveBeenCalledTimes(1)
		expect(mockSuccess).toHaveBeenCalledWith({message: 'team.create.success'})
		expect(mockError).not.toHaveBeenCalled()
	})

	it('A successful create followed by a REJECTED navigation still reports the team was created, surfaces the error, and leaves the modal dismissible again', async () => {
		const navError = new Error('Navigation failed')
		mockCreate.mockResolvedValueOnce({id: 42, name: 'Test Team'})
		mockPush.mockRejectedValueOnce(navError)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const modal = mockModalInstances[mockModalInstances.length - 1]
		const form = mockFormInstances[mockFormInstances.length - 1]
		await form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		expect(mockSuccess).toHaveBeenCalledTimes(1)
		expect(mockSuccess).toHaveBeenCalledWith({message: 'team.create.success'})
		expect(mockError).toHaveBeenCalledTimes(1)
		expect(mockError).toHaveBeenCalledWith(navError)
		expect(modal.setDismissible).toHaveBeenLastCalledWith(true)
	})

	it('A successful create followed by a navigation that RESOLVES with a failure behaves the same way as the rejection: creation confirmed, failure surfaced, dismissal restored', async () => {
		const navFailure = {type: 2, to: '/teams/42/edit', from: '/teams/new'}
		mockCreate.mockResolvedValueOnce({id: 42, name: 'Test Team'})
		mockPush.mockResolvedValueOnce(navFailure)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const modal = mockModalInstances[mockModalInstances.length - 1]
		const form = mockFormInstances[mockFormInstances.length - 1]
		await form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		expect(mockSuccess).toHaveBeenCalledTimes(1)
		expect(mockSuccess).toHaveBeenCalledWith({message: 'team.create.success'})
		expect(mockError).toHaveBeenCalledTimes(1)
		expect(mockError).toHaveBeenCalledWith(navFailure)
		expect(modal.setDismissible).toHaveBeenLastCalledWith(true)
	})

	it('A failed create surfaces the error and does not navigate', async () => {
		const createError = new Error('Create failed')
		mockCreate.mockRejectedValueOnce(createError)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const modal = mockModalInstances[mockModalInstances.length - 1]
		const form = mockFormInstances[mockFormInstances.length - 1]
		await form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		expect(mockError).toHaveBeenCalledTimes(1)
		expect(mockError).toHaveBeenCalledWith(createError)
		expect(mockPush).not.toHaveBeenCalled()
		expect(mockSuccess).not.toHaveBeenCalled()
		expect(modal.setDismissible).toHaveBeenLastCalledWith(true)
		expect(form.setDisabled).toHaveBeenLastCalledWith(false)
	})

	it('Nothing is reported after the component unmounts: unmount before the create settles, and assert neither the success nor the error mock was called', async () => {
		let resolveCreate!: (value: any) => void
		const pendingCreate = new Promise((resolve) => {
			resolveCreate = resolve
		})
		mockCreate.mockReturnValueOnce(pendingCreate)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const form = mockFormInstances[mockFormInstances.length - 1]
		const submitPromise = form.options.onSubmit({name: 'Test Team', isPublic: false})

		wrapper.unmount()
		wrapper = null

		resolveCreate({id: 42, name: 'Test Team'})
		await submitPromise
		await flushPromises()

		expect(mockSuccess).not.toHaveBeenCalled()
		expect(mockError).not.toHaveBeenCalled()
		expect(mockPush).not.toHaveBeenCalled()
	})

	it('After a create succeeds and navigation REJECTS, a locale change rebuilds the views and the modal is still dismissible', async () => {
		const navError = new Error('Navigation failed')
		mockCreate.mockResolvedValueOnce({id: 42, name: 'Test Team'})
		mockPush.mockRejectedValueOnce(navError)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const initialCount = mockModalInstances.length
		const form = mockFormInstances[mockFormInstances.length - 1]
		await form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		i18n.global.locale.value = 'de-DE'
		await flushPromises()

		expect(mockModalInstances.length).toBeGreaterThan(initialCount)
		const rebuiltModal = mockModalInstances[mockModalInstances.length - 1]
		const rebuiltForm = mockFormInstances[mockFormInstances.length - 1]
		expect(rebuiltModal.setDismissible).not.toHaveBeenCalledWith(false)
		expect(rebuiltForm.setDisabled).toHaveBeenCalledWith(true)
		expect(rebuiltModal.options.primaryDisabled).toBe(true)
	})

	it('After a create FAILS, a locale change rebuilds the views and the modal is dismissible and the form enabled', async () => {
		const createError = new Error('Create failed')
		mockCreate.mockRejectedValueOnce(createError)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const initialCount = mockModalInstances.length
		const form = mockFormInstances[mockFormInstances.length - 1]
		await form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		i18n.global.locale.value = 'de-DE'
		await flushPromises()

		expect(mockModalInstances.length).toBeGreaterThan(initialCount)
		const rebuiltModal = mockModalInstances[mockModalInstances.length - 1]
		const rebuiltForm = mockFormInstances[mockFormInstances.length - 1]
		expect(rebuiltModal.setDismissible).not.toHaveBeenCalledWith(false)
		expect(rebuiltForm.setDisabled).not.toHaveBeenCalledWith(true)
		expect(rebuiltModal.options.primaryDisabled).toBe(false)
	})

	it('A locale change WHILE navigation is still pending rebuilds the views and the rebuilt modal is NOT dismissible', async () => {
		let resolvePush!: (value: any) => void
		const pendingPush = new Promise((resolve) => {
			resolvePush = resolve
		})
		mockCreate.mockResolvedValueOnce({id: 42, name: 'Test Team'})
		mockPush.mockReturnValueOnce(pendingPush)

		wrapper = mount(NewTeamHost)
		await flushPromises()

		const initialCount = mockModalInstances.length
		const form = mockFormInstances[mockFormInstances.length - 1]
		const submitPromise = form.options.onSubmit({name: 'Test Team', isPublic: false})
		await flushPromises()

		i18n.global.locale.value = 'de-DE'
		await flushPromises()

		expect(mockModalInstances.length).toBeGreaterThan(initialCount)
		const rebuiltModal = mockModalInstances[mockModalInstances.length - 1]
		const rebuiltForm = mockFormInstances[mockFormInstances.length - 1]
		expect(rebuiltModal.setDismissible).toHaveBeenCalledWith(false)
		expect(rebuiltForm.setDisabled).toHaveBeenCalledWith(true)
		expect(rebuiltModal.options.primaryDisabled).toBe(true)

		resolvePush(undefined)
		await submitPromise
		await flushPromises()
	})
})
