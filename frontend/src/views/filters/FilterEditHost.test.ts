import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {flushPromises, mount, type VueWrapper} from '@vue/test-utils'
import {i18n} from '@/i18n'
import FilterEditHost from '@/views/filters/FilterEditHost.vue'

const {mockBack, mockPush, mockSaveFilterWithValidation, mockValidateTitleField, mockModalInstances, mockSavedFilterStates} = vi.hoisted(() => ({
	mockBack: vi.fn(),
	mockPush: vi.fn(),
	mockSaveFilterWithValidation: vi.fn(),
	mockValidateTitleField: vi.fn(),
	mockModalInstances: [] as any[],
	mockSavedFilterStates: [] as any[],
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({back: mockBack, push: mockPush}),
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
				saveFilterWithValidation: mockSaveFilterWithValidation,
				filter: ref({id: 0, title: '', description: '', filters: {filter: '', s: ''}}),
				filters: ref({filter: '', s: ''}),
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

vi.mock('@/marionette/views/FilterEditFormView', () => ({
	FilterEditFormView: class {
		constructor() {
			Object.assign(this, mockFormView)
		}
	},
}))

describe('FilterEditHost', () => {
	let wrapper: VueWrapper | null = null

	beforeEach(() => {
		mockBack.mockReset()
		mockPush.mockReset()
		mockSaveFilterWithValidation.mockReset()
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

	it('renders modal with edit chrome after mount', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		expect(mockModalInstances).toHaveLength(1)
		const modal = mockModalInstances[0]
		expect(modal.options.title).toBe('filters.edit.title')
		expect(modal.options.primaryLabel).toBe('misc.save')
		expect(modal.options.tertiaryLabel).toBe('misc.delete')
		expect(modal.render).toHaveBeenCalledTimes(1)
		expect(modal.render.mock.invocationCallOrder[0]).toBeLessThan(
			modal.showChildView.mock.invocationCallOrder[0],
		)
	})

	it('calls saveFilterWithValidation on primary click when valid', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.titleValid.value = true
		await flushPromises()

		await modal.options.onPrimary()

		expect(mockSaveFilterWithValidation).toHaveBeenCalledTimes(1)
	})

	it('does not save while submitting', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const state = mockSavedFilterStates[0]
		state.titleValid.value = true
		await flushPromises()

		const first = modal.options.onPrimary()
		const second = modal.options.onPrimary()
		await Promise.all([first, second])

		expect(mockSaveFilterWithValidation).toHaveBeenCalledTimes(1)
	})

	it('navigates to delete on tertiary', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		modal.options.onTertiary()

		expect(mockPush).toHaveBeenCalledWith({name: 'filter.settings.delete', params: {id: -2}})
	})

	it('navigates back on close', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		modal.options.onClose()

		expect(mockBack).toHaveBeenCalled()
	})

	it('populates the form when the filter loads', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		const state = mockSavedFilterStates[0]
		state.filter.value = {id: 5, title: 'Loaded', description: 'desc', filters: {filter: 'done = false', s: ''}}
		await flushPromises()

		const form = mockModalInstances[0].showChildView.mock.calls[0][1]
		expect(form.setTitle).toHaveBeenCalledWith('Loaded')
		expect(form.setDescription).toHaveBeenCalledWith('desc')
		expect(form.setQuery).toHaveBeenCalledWith('done = false')
	})

	it('rebuilds modal when locale changes', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		i18n.global.locale.value = 'de-DE'
		await flushPromises()

		expect(mockModalInstances.length).toBeGreaterThan(1)
	})

	it('cleans up on unmount', async () => {
		wrapper = mount(FilterEditHost, {props: {projectId: -2}})
		await flushPromises()

		const modal = mockModalInstances[0]
		const destroySpy = vi.spyOn(modal, 'destroy')
		wrapper?.unmount()
		wrapper = null

		expect(destroySpy).toHaveBeenCalled()
	})
})
