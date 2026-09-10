import {describe, it, expect, vi, afterEach} from 'vitest'
import {ref, nextTick} from 'vue'
import {mount} from '@vue/test-utils'
import {createI18n} from 'vue-i18n'
import {View} from 'marionette'
import type {ViewInstance} from 'marionette'

import MarionetteViewHost from './MarionetteViewHost.vue'
import AboutVersionView from '@/marionette/views/AboutVersionView'

// Build a minimal Marionette View for use in tests.
function makeView(html: string): ViewInstance {
	return new (View.extend({
		template: () => html,
	}))()
}

describe('MarionetteViewHost', () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	describe('attach lifecycle', () => {
		it('shows the view inside the container after mount', async () => {
			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: () => makeView('<span>hello</span>')},
				attachTo: document.body,
			})
			await nextTick()
			expect(wrapper.find('span').text()).toBe('hello')
			wrapper.unmount()
		})

		it('the child view is attached (isAttached) when mounted into document', async () => {
			const view = makeView('<p>content</p>')
			const wrapper = mount(MarionetteViewHost, {
				props: {
					viewFactory: () => view,
				},
				attachTo: document.body,
			})
			await nextTick()
			// Region.show() sets isAttached true when the region el is in the document
			expect(view.isAttached()).toBe(true)
			wrapper.unmount()
		})
	})

	describe('replacement', () => {
		it('replaces the child view when viewFactory prop changes', async () => {
			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: () => makeView('<span>first</span>')},
				attachTo: document.body,
			})
			await nextTick()
			expect(wrapper.find('span').text()).toBe('first')

			await wrapper.setProps({viewFactory: () => makeView('<span>second</span>')})
			await nextTick()
			expect(wrapper.find('span').text()).toBe('second')

			wrapper.unmount()
		})

		it('the previous view is destroyed when replaced', async () => {
			let destroyCalled = false
			const DestroyView = View.extend({
				template: () => '<p>old</p>',
				onDestroy() {
					destroyCalled = true
				},
			})
			const oldView = new DestroyView()

			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: () => oldView},
				attachTo: document.body,
			})
			await nextTick()

			await wrapper.setProps({viewFactory: () => makeView('<p>new</p>')})
			await nextTick()

			expect(destroyCalled).toBe(true)
			wrapper.unmount()
		})

		it('the replaced view is detached (isAttached false) before being destroyed', async () => {
			let wasDetachedOnDestroy: boolean | null = null
			const TrackDetach = View.extend({
				template: () => '<p>track</p>',
				onDestroy() {
					wasDetachedOnDestroy = this.isAttached()
				},
			})
			const trackedView = new TrackDetach()

			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: () => trackedView},
				attachTo: document.body,
			})
			await nextTick()

			await wrapper.setProps({viewFactory: () => makeView('<p>next</p>')})
			await nextTick()

			// By the time onDestroy fires, the view should be detached from the document
			expect(wasDetachedOnDestroy).toBe(false)
			wrapper.unmount()
		})
	})

	describe('unmount cleanup', () => {
		it('the child view is destroyed when the component unmounts', async () => {
			const onDestroy = vi.fn()
			const TrackingView = View.extend({
				template: () => '<p>track</p>',
				onDestroy,
			})

			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: () => new TrackingView()},
				attachTo: document.body,
			})
			await nextTick()

			wrapper.unmount()
			expect(onDestroy).toHaveBeenCalledTimes(1)
		})

		it('the child view is not in the DOM after unmount', async () => {
			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: () => makeView('<b>gone</b>')},
				attachTo: document.body,
			})
			await nextTick()
			expect(document.body.querySelector('b')).not.toBeNull()

			wrapper.unmount()
			expect(document.body.querySelector('b')).toBeNull()
		})

		it('the child view is detached (isAttached false) after host unmounts', async () => {
			const view = makeView('<p>attached</p>')
			const wrapper = mount(MarionetteViewHost, {
				props: {
					viewFactory: () => view,
				},
				attachTo: document.body,
			})
			await nextTick()
			expect(view.isAttached()).toBe(true)

			wrapper.unmount()
			expect(view.isAttached()).toBe(false)
		})
	})

	describe('locale reactivity integration', () => {
		it('re-renders AboutVersionView content when factory is replaced after locale change', async () => {
			const messages = {
				en: {'about.version': 'Version: {version}'},
				fr: {'about.version': 'Version (fr): {version}'},
			}
			const i18n = createI18n({
				legacy: false,
				locale: 'en',
				messages,
			})

			// Initial factory using 'en' locale snapshot
			const factory = ref(() => new AboutVersionView({
				lines: [i18n.global.t('about.version', {version: '1.0.0'})],
			}))

			const wrapper = mount(MarionetteViewHost, {
				props: {viewFactory: factory.value},
				attachTo: document.body,
				global: {plugins: [i18n]},
			})
			await nextTick()

			// English rendering
			expect(wrapper.find('p').text()).toBe('Version: 1.0.0')

			// Switch locale and provide a new factory — the explicit replacement
			// contract (not incidental reactive tracking) drives the update.
			i18n.global.locale.value = 'fr'
			factory.value = () => new AboutVersionView({
				lines: [i18n.global.t('about.version', {version: '1.0.0'})],
			})
			await wrapper.setProps({viewFactory: factory.value})
			await nextTick()

			// French rendering via replaced view
			expect(wrapper.find('p').text()).toBe('Version (fr): 1.0.0')

			wrapper.unmount()
		})
	})
})
