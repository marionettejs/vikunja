import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {flushPromises, mount, type VueWrapper} from '@vue/test-utils'
import {i18n} from '@/i18n'
import FilterNewHost from '@/views/filters/FilterNewHost.vue'

const {mockBack, mockCreateFilterWithValidation, mockValidateTitleField, mockModalInstances, mockSavedFilterStates} = vi.hoisted(() => ({
	mockBack: vi.fn(),
	mockCreateFilterWithValidation: vi.fn(),
	mockValidateTitleField: vi.fn(),
	mockModalInstances: [] as any[],
	mockSavedFilterStates: [] as any[],
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({back: mockBack}),
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

vi.mock('@/composables/useLabels', async () => {
	const {ref} = await import('vue')
	const labelsRef = ref([] as any[])
	const isPendingRef = ref(false)
	return {
		useLabels: () => ({
			labels: labelsRef,
			isPending: isPendingRef,
			getLabelByExactTitle: vi.fn(),
			getLabelById: vi.fn(),
		}),
	}
})

vi.mock('@/stores/projects', () => ({
	useProjectStore: () => ({
		projects: {} as Record<number, {id: number; title: string}>,
		findProjectByExactname: vi.fn(),
	}),
}))

vi.mock('@/stores/auth', async () => {
	const {ref} = await import('vue')
	return {
		useAuthStore: () => ({
			settings: ref({weekStart: 1}),
		}),
	}
})

vi.mock('@/helpers/useFlatpickrLanguage', async () => {
	const {computed} = await import('vue')
	return {
		useFlatpickrLanguage: () => computed(() => ({firstDayOfWeek: 1})),
	}
})

vi.mock('@/services/savedFilter', async () => {
	const {reactive, ref} = await import('vue')
	return {
		useSavedFilter: () => {
			const state = {
				createFilterWithValidation: mockCreateFilterWithValidation,
				filter: ref({title: '', description: '', filters: ''}),
				filterService: reactive({loading: false}),
				titleValid: ref(false),
				validateTitleField: mockValidateTitleField,
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

const mockFormView: Record<string, {mockReset(): void}> = {
	render: vi.fn(),
	destroy: vi.fn(),
	setLoading: vi.fn(),
	setTitleValid: vi.fn(),
	updateLabels: vi.fn(),
	setTitle: vi.fn(),
	setDescription: vi.fn(),
	setQuery: vi.fn(),
}

vi.mock('@/marionette/views/FilterNewFormView', () => ({
	FilterNewFormView: class {
		constructor() {
			Object.assign(this, mockFormView)
		}
	},
}))

describe('FilterNewHost', () => {
	let wrapper: VueWrapper | null = null

	beforeEach(() => {
		mockBack.mockReset()
		mockCreateFilterWithValidation.mockReset()
		mockValidateTitleField.mockReset()
		mockModalInstances.length = 0
		mockSavedFilterStates.length = 0
		Object.keys(mockFormView).forEach(key => {
			mockFormView[key].mockReset()
		})
		i18n.global.locale.value = 'en'
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = null
	})

	it('renders modal after mount', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		expect(mockModalInstances).toHaveLength(1)
		const modal = mockModalInstances[0]
		expect(modal.options.title).toBe('filters.create.title')
		expect(modal.options.primaryLabel).toBe('filters.create.action')
		expect(modal.render).toHaveBeenCalledTimes(1)
		// render() should be called before showChildView
		expect(modal.render.mock.invocationCallOrder[0]).toBeLessThan(
			modal.showChildView.mock.invocationCallOrder[0],
		)
	})

	it('disables primary button while loading or title invalid', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		// Initially loading=false, titleValid=false -> disabled
		expect(modal.options.primaryDisabled).toBe(true)

		state.titleValid.value = true
		await flushPromises()

		// Now loading=false, titleValid=true -> not disabled
		expect(modal.setPrimaryDisabled).toHaveBeenLastCalledWith(false)
	})

	it('calls createFilterWithValidation on primary click when valid', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.filterService.loading = false
		state.titleValid.value = true
		await flushPromises()

		await modal.options.onPrimary()

		expect(mockCreateFilterWithValidation).toHaveBeenCalledTimes(1)
	})

	it('does not call createFilterWithValidation when loading', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.filterService.loading = true
		state.titleValid.value = true
		await flushPromises()

		await modal.options.onPrimary()

		expect(mockCreateFilterWithValidation).not.toHaveBeenCalled()
		// Reset for other tests
		state.filterService.loading = false
	})

	it('does not call createFilterWithValidation when title invalid', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.filterService.loading = false
		state.titleValid.value = false
		await flushPromises()

		await modal.options.onPrimary()

		expect(mockCreateFilterWithValidation).not.toHaveBeenCalled()
	})

	it('navigates back on close', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		await modal.options.onClose()

		expect(mockBack).toHaveBeenCalledTimes(1)
		expect(modal.destroy).toHaveBeenCalledTimes(1)
	})

	it('rebuilds modal when locale changes', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const initialModal = mockModalInstances[0]
		i18n.global.locale.value = 'de-DE'
		await flushPromises()

		expect(initialModal.destroy).toHaveBeenCalledTimes(1)
		expect(mockModalInstances).toHaveLength(2)
		expect(mockModalInstances[1].options.title).toBe('filters.create.title')
	})

	it('updates form loading state when filterService.loading changes', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const state = mockSavedFilterStates[0]
		state.filterService.loading = true
		await flushPromises()

		expect(mockFormView.setLoading).toHaveBeenCalledWith(true)
	})

	it('updates form title validity when titleValid changes', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const state = mockSavedFilterStates[0]
		state.titleValid.value = true
		await flushPromises()

		expect(mockFormView.setTitleValid).toHaveBeenCalledWith(true)
	})

	it('updates form labels when labels change', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		// Import the mocked useLabels to trigger label changes
		const {useLabels} = await import('@/composables/useLabels')
		const labelsHook = useLabels()
		const labelsRef = labelsHook.labels as {value: unknown[]}
		labelsRef.value = [{id: 1, title: 'bug', hex_color: '3b82f6', description: '', created: '', updated: ''}]
		await flushPromises()

		expect(mockFormView.updateLabels).toHaveBeenCalled()
	})

	it('cleans up on unmount', async () => {
		wrapper = mount(FilterNewHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		wrapper.unmount()
		await flushPromises()

		expect(modal.destroy).toHaveBeenCalledTimes(1)
	})
})