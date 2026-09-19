import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mount, type VueWrapper} from '@vue/test-utils'
import {nextTick} from 'vue'
import {createPinia, setActivePinia} from 'pinia'
import {createI18n} from 'vue-i18n'
import {createRouter, createMemoryHistory} from 'vue-router'

import AboutHost from './AboutHost.vue'
import {useConfigStore} from '@/stores/config'
import {ModalCardView} from '@/marionette/views/ModalCardView'
import AboutVersionView from '@/marionette/views/AboutVersionView'
import en from '@/i18n/lang/en.json'
import {VERSION as frontendVersion} from '@/version.json'

interface MockModalShape {
	options: Record<string, unknown>
	render: ReturnType<typeof vi.fn>
	showChildView: ReturnType<typeof vi.fn>
	destroy: ReturnType<typeof vi.fn>
	setPrimaryDisabled: ReturnType<typeof vi.fn>
	setDismissible: ReturnType<typeof vi.fn>
}

const mockModalInstances: MockModalShape[] = []

vi.mock('@/marionette/views/ModalCardView', () => ({
	ModalCardView: vi.fn(function (this: MockModalShape, options: Record<string, unknown>) {
		this.options = options
		this.render = vi.fn()
		this.showChildView = vi.fn()
		this.destroy = vi.fn()
		this.setPrimaryDisabled = vi.fn()
		this.setDismissible = vi.fn()
		mockModalInstances.push(this)
	}) as unknown as typeof ModalCardView,
}))

vi.mock('@/marionette/views/AboutVersionView', () => ({
	default: vi.fn(),
}))

function createTestI18n() {
	return createI18n({
		legacy: false,
		locale: 'en',
		messages: {
			en,
			de: {
				about: {
					title: 'Über',
					version: 'Version (de): {version}',
					frontendVersion: 'Frontend-Version (de): {version}',
					apiVersion: 'API-Version (de): {version}',
				},
				misc: {
					close: 'Schließen',
					cancel: 'Abbrechen',
					closeDialog: 'Dialog schließen',
				},
			},
		},
	})
}

type TestI18n = ReturnType<typeof createTestI18n>

describe('AboutHost.vue', () => {
	let wrapper: VueWrapper | undefined
	let i18n: TestI18n

	beforeEach(async () => {
		const pinia = createPinia()
		setActivePinia(pinia)
		mockModalInstances.length = 0

		i18n = createTestI18n()

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{path: '/', component: {template: '<div>Home</div>'}}, {path: '/about', component: AboutHost}],
		})
		await router.push('/about')
		await router.isReady()

		const configStore = useConfigStore()
		configStore.version = 'dev'

		wrapper = mount(AboutHost, {
			global: {
				plugins: [pinia, i18n, router],
			},
			attachTo: document.body,
		})
		await nextTick()
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
		document.body.innerHTML = ''
		vi.clearAllMocks()
	})

	it('renders single version line when config version equals frontend version', () => {
		expect(wrapper).toBeDefined()
		expect(ModalCardView).toHaveBeenCalledTimes(1)

		const modalOptions = (ModalCardView as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(modalOptions.title).toBe('About')
		expect(modalOptions.primaryLabel).toBe('Close')
		expect(modalOptions.hideCancel).toBe(true)
		expect(modalOptions.primaryButtonClass).toBe('is-outlined')
		expect(typeof modalOptions.onPrimary).toBe('function')
		expect(typeof modalOptions.onClose).toBe('function')

		expect(AboutVersionView).toHaveBeenCalledTimes(1)
		const versionOptions = (AboutVersionView as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(versionOptions.lines).toEqual([`Version: ${frontendVersion}`])
	})

	it('renders two version lines when config version differs from frontend version', async () => {
		const configStore = useConfigStore()
		configStore.version = '2.5.0'
		await nextTick()

		expect(AboutVersionView).toHaveBeenCalledTimes(2)
		const versionOptions = (AboutVersionView as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0]
		expect(versionOptions.lines).toEqual([
			`Frontend version: ${frontendVersion}`,
			'API version: 2.5.0',
		])
	})

	it('re-renders version lines when locale changes', async () => {
		const configStore = useConfigStore()
		configStore.version = '2.5.0'
		await nextTick()

		i18n.global.locale.value = 'de'
		await nextTick()

		expect(AboutVersionView).toHaveBeenCalledTimes(3)
		const versionOptions = (AboutVersionView as unknown as ReturnType<typeof vi.fn>).mock.calls[2][0]
		expect(versionOptions.lines).toEqual([
			`Frontend-Version (de): ${frontendVersion}`,
			'API-Version (de): 2.5.0',
		])
	})

	it('calls router.back on primary button click', async () => {
		const router = wrapper!.vm.$router
		const backSpy = vi.spyOn(router, 'back')

		const mockModal = mockModalInstances[mockModalInstances.length - 1]
		const modalOptions = (ModalCardView as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
		modalOptions.onPrimary()

		expect(mockModal.destroy).toHaveBeenCalled()
		expect(backSpy).toHaveBeenCalled()
	})

	it('calls router.back on close', async () => {
		const router = wrapper!.vm.$router
		const backSpy = vi.spyOn(router, 'back')

		const mockModal = mockModalInstances[mockModalInstances.length - 1]
		const modalOptions = (ModalCardView as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
		modalOptions.onClose()

		expect(mockModal.destroy).toHaveBeenCalled()
		expect(backSpy).toHaveBeenCalled()
	})

	it('destroys modal on unmount', () => {
		const mockModal = mockModalInstances[mockModalInstances.length - 1]
		wrapper!.unmount()
		expect(mockModal.destroy).toHaveBeenCalled()
	})
})