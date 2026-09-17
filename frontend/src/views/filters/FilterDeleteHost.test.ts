import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {flushPromises, mount, type VueWrapper} from '@vue/test-utils'
import {i18n} from '@/i18n'
import FilterDeleteHost from './FilterDeleteHost.vue'

const {mockBack, mockDeleteFilter, mockError, mockModalInstances, mockSavedFilterStates} = vi.hoisted(() => ({
	mockBack: vi.fn(),
	mockDeleteFilter: vi.fn(),
	mockError: vi.fn(),
	mockModalInstances: [] as any[],
	mockSavedFilterStates: [] as any[],
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({back: mockBack}),
}))

vi.mock('@/message', () => ({error: mockError}))

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

vi.mock('@/services/savedFilter', async () => {
	const {reactive, ref} = await import('vue')
	return {
		useSavedFilter: () => {
			const state = {
				deleteFilter: mockDeleteFilter,
				filter: ref({id: 0}),
				filterService: reactive({loading: true}),
			}
			mockSavedFilterStates.push(state)
			return state
		},
	}
})

vi.mock('@/marionette/views/ModalCardView', () => ({
	ModalCardView: class {
		options: any
		setPrimaryDisabled = vi.fn()
		setDismissible = vi.fn()
		render = vi.fn()
		showChildView = vi.fn()
		destroy = vi.fn()

		constructor(options: any) {
			this.options = options
			mockModalInstances.push(this)
		}
	},
}))

vi.mock('@/marionette/views/ConfirmTextView', () => ({
	ConfirmTextView: class {
		constructor(public options: any) {}
	},
}))

describe('FilterDeleteHost', () => {
	let wrapper: VueWrapper | null = null

	beforeEach(() => {
		mockBack.mockReset()
		mockDeleteFilter.mockReset()
		mockError.mockReset()
		mockModalInstances.length = 0
		mockSavedFilterStates.length = 0
		i18n.global.locale.value = 'en'
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = null
	})

	it('keeps confirmation disabled until the requested filter has loaded', async () => {
		wrapper = mount(FilterDeleteHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		expect(modal.options.primaryDisabled).toBe(true)
		expect(modal.render).toHaveBeenCalledTimes(1)
		expect(modal.render.mock.invocationCallOrder[0]).toBeLessThan(
			modal.showChildView.mock.invocationCallOrder[0],
		)

		state.filter.value = {id: 1}
		state.filterService.loading = false
		await flushPromises()

		expect(modal.setPrimaryDisabled).toHaveBeenLastCalledWith(false)
	})

	it('reports a failed delete and restores the same modal for retry', async () => {
		const failure = new Error('delete failed')
		mockDeleteFilter.mockRejectedValueOnce(failure)
		wrapper = mount(FilterDeleteHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.filter.value = {id: 1}
		state.filterService.loading = false
		await flushPromises()

		await modal.options.onPrimary()

		expect(mockError).toHaveBeenCalledWith(failure)
		expect(modal.destroy).not.toHaveBeenCalled()
		expect(modal.setDismissible).toHaveBeenNthCalledWith(1, false)
		expect(modal.setDismissible).toHaveBeenLastCalledWith(true)
		expect(modal.setPrimaryDisabled).toHaveBeenLastCalledWith(false)
	})

	it('reports a navigation failure without allowing the deleted filter to be deleted again', async () => {
		const failure = new Error('navigation aborted')
		mockDeleteFilter.mockResolvedValueOnce(failure)
		wrapper = mount(FilterDeleteHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.filter.value = {id: 1}
		state.filterService.loading = false
		await flushPromises()

		await modal.options.onPrimary()
		await modal.options.onPrimary()

		expect(mockDeleteFilter).toHaveBeenCalledTimes(1)
		expect(mockError).toHaveBeenCalledWith(failure)
		expect(modal.setDismissible).toHaveBeenLastCalledWith(true)
		expect(modal.setPrimaryDisabled).toHaveBeenLastCalledWith(true)
	})

	it('rebuilds translated labels when the locale changes', async () => {
		wrapper = mount(FilterDeleteHost, {props: {projectId: -2}})
		await flushPromises()

		const initialModal = mockModalInstances[0]
		i18n.global.locale.value = 'de-DE'
		await flushPromises()

		expect(initialModal.destroy).toHaveBeenCalledTimes(1)
		expect(mockModalInstances).toHaveLength(2)
		expect(mockModalInstances[1].options.title).toBe('filters.delete.header')
	})
})
