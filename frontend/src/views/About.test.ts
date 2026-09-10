import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {mount, type VueWrapper} from '@vue/test-utils'
import {nextTick} from 'vue'
import {createPinia, setActivePinia} from 'pinia'
import {createI18n} from 'vue-i18n'
import {createRouter, createMemoryHistory} from 'vue-router'

import About from './About.vue'
import {useConfigStore} from '@/stores/config'
import {VERSION as frontendVersion} from '@/version.json'
import en from '@/i18n/lang/en.json'

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
				},
			},
		},
	})
}

type TestI18n = ReturnType<typeof createTestI18n>

describe('About.vue', () => {
	let wrapper: VueWrapper | undefined
	let i18n: TestI18n

	beforeEach(async () => {
		const pinia = createPinia()
		setActivePinia(pinia)

		i18n = createTestI18n()

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{path: '/', component: About}],
		})
		await router.push('/')
		await router.isReady()

		const configStore = useConfigStore()
		configStore.version = frontendVersion

		wrapper = mount(About, {
			global: {
				plugins: [pinia, i18n, router],
				stubs: {
					Modal: {template: '<div><slot /></div>'},
					Card: {template: '<div><slot /><slot name="footer" /></div>'},
					XButton: {template: '<button><slot /></button>'},
				},
			},
			attachTo: document.body,
		})
		await nextTick()
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
		document.body.innerHTML = ''
	})

	it('renders single version paragraph initially when config version equals frontend version', () => {
		expect(wrapper).toBeDefined()
		const paras = wrapper!.findAll('p')
		expect(paras).toHaveLength(1)
		expect(paras[0].text()).toBe(`Version: ${frontendVersion}`)
	})

	it('updates version paragraphs automatically when config version changes', async () => {
		const configStore = useConfigStore()
		configStore.version = '2.5.0'
		await nextTick()

		const paras = wrapper!.findAll('p')
		expect(paras).toHaveLength(2)
		expect(paras[0].text()).toBe(`Frontend version: ${frontendVersion}`)
		expect(paras[1].text()).toBe('API version: 2.5.0')
	})

	it('updates version paragraphs automatically when locale changes', async () => {
		const configStore = useConfigStore()
		configStore.version = '2.5.0'
		await nextTick()

		i18n.global.locale.value = 'de'
		await nextTick()

		const paras = wrapper!.findAll('p')
		expect(paras).toHaveLength(2)
		expect(paras[0].text()).toBe(`Frontend-Version (de): ${frontendVersion}`)
		expect(paras[1].text()).toBe('API-Version (de): 2.5.0')
	})

	it('updates to single line when version matches again after locale change', async () => {
		const configStore = useConfigStore()
		configStore.version = '2.5.0'
		await nextTick()

		i18n.global.locale.value = 'de'
		await nextTick()

		let paras = wrapper!.findAll('p')
		expect(paras).toHaveLength(2)

		configStore.version = frontendVersion
		await nextTick()

		paras = wrapper!.findAll('p')
		expect(paras).toHaveLength(1)
		expect(paras[0].text()).toBe(`Version (de): ${frontendVersion}`)
	})
})
