import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mount, type VueWrapper} from '@vue/test-utils'
import {nextTick} from 'vue'
import {createRouter, createMemoryHistory} from 'vue-router'

import NotFoundHost from '@/views/NotFoundHost.vue'
import {i18n} from '@/i18n'
import en from '@/i18n/lang/en.json'

const {mockLocaleBox} = vi.hoisted(() => ({
	mockLocaleBox: {current: null as {value: string} | null},
}))

function mockLocale(): {value: string} {
	if (!mockLocaleBox.current) {
		throw new Error('mock locale not initialized')
	}
	return mockLocaleBox.current
}

vi.mock('@/i18n', async () => {
	const {ref} = await import('vue')
	if (!mockLocaleBox.current) {
		mockLocaleBox.current = ref('en')
	}
	const localeRef = mockLocaleBox.current
	// NOTE: en.json is pre-compiled to message ASTs by the vite i18n
	// plugin, so read display strings literally here instead.
	const messages: Record<string, Record<string, string>> = {
		en: {
			'404.title': 'Not found',
			'404.text': 'The page you requested does not exist.',
		},
		de: {
			'404.title': 'Nicht gefunden',
			'404.text': 'Die angeforderte Seite existiert nicht.',
		},
	}
	return {
		i18n: {
			global: {
				t: (key: string) => messages[localeRef.value]?.[key] ?? key,
				locale: localeRef,
			},
		},
	}
})

const mockViewInstances: Array<{render: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; el: HTMLElement | null}> = []

vi.mock('@/marionette/views/NotFoundView', () => {
	const MockNotFoundView = vi.fn(function (this: {options: {title: string; text: string}; render: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; el: HTMLElement | null}, options: {title: string; text: string}) {
		this.options = options
		this.render = vi.fn(() => {
			this.el = document.createElement('div')
			this.el.className = 'content has-text-centered'
			this.el.innerHTML = `<h1>${options.title}</h1><p>${options.text}</p>`
		})
		this.destroy = vi.fn(() => {
			this.el?.remove?.()
			this.el = null
		})
		this.el = null
		mockViewInstances.push(this)
	})
	return {default: MockNotFoundView}
})

// Import the mocked module after vi.mock
import NotFoundView from '@/marionette/views/NotFoundView'

describe('NotFoundHost.vue', () => {
	let wrapper: VueWrapper | undefined

	beforeEach(async () => {
		mockLocale().value = 'en'
		mockViewInstances.length = 0

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{path: '/', component: {template: '<div>Home</div>'}},
				{path: '/404', component: NotFoundHost},
			],
		})
		await router.push('/404')
		await router.isReady()

		wrapper = mount(NotFoundHost, {
			global: {
				plugins: [router],
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

	it('mounts NotFoundView with translated title and text', () => {
		expect(wrapper).toBeDefined()
		expect(NotFoundView).toHaveBeenCalledTimes(1)

		const viewOptions = (NotFoundView as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(viewOptions.title).toBe(i18n.global.t('404.title'))
		expect(viewOptions.text).toBe(i18n.global.t('404.text'))

		const view = mockViewInstances[mockViewInstances.length - 1]
		expect(view.render).toHaveBeenCalled()

		const container = wrapper!.find('div')
		expect(container.exists()).toBe(true)
		expect(container.element.querySelector('h1')?.textContent).toBe(i18n.global.t('404.title'))
		expect(container.element.querySelector('p')?.textContent).toBe(i18n.global.t('404.text'))
	})

	it('sets document title to translated 404.title | Vikunja', () => {
		expect(document.title).toBe(`${i18n.global.t('404.title')} | Vikunja`)
	})

	it('re-renders with new translations when locale changes', async () => {
		expect(NotFoundView).toHaveBeenCalledTimes(1)

		mockLocale().value = 'de'
		await nextTick()

		expect(NotFoundView).toHaveBeenCalledTimes(2)
		const viewOptions = (NotFoundView as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0]
		expect(viewOptions.title).toBe('Nicht gefunden')
		expect(viewOptions.text).toBe('Die angeforderte Seite existiert nicht.')

		expect(document.title).toBe('Nicht gefunden | Vikunja')
	})

	it('destroys view on unmount', () => {
		const view = mockViewInstances[mockViewInstances.length - 1]
		wrapper!.unmount()
		expect(view.destroy).toHaveBeenCalled()
	})
})