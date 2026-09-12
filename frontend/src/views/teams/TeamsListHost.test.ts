import {describe, it, expect, vi, beforeEach} from 'vitest'
import {nextTick} from 'vue'
import {mount, flushPromises} from '@vue/test-utils'
import {i18n} from '@/i18n'
import TeamsListHost from './TeamsListHost.vue'

const {mockError, mockPush, mockGetAll} = vi.hoisted(() => {
	return {
		mockError: vi.fn(),
		mockPush: vi.fn(),
		mockGetAll: vi.fn(),
	}
})

vi.mock('@/i18n', async () => {
	const {ref} = await import('vue')
	const locale = ref('en')
	return {i18n: {global: {t: (key: string) => `${locale.value}:${key}`, locale}}}
})

vi.mock('@/services/team', () => {
	return {
		default: class {
			getAll() {
				return mockGetAll()
			}
		},
	}
})

vi.mock('@/message', () => ({
	error: mockError,
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mockPush,
		resolve: (path: string) => ({href: `/vikunja${path}`}),
	}),
}))

describe('TeamsListHost', () => {
	beforeEach(() => {
		mockGetAll.mockReset()
		mockError.mockReset()
		i18n.global.locale.value = 'en'
	})

	it('reports the error instead of leaving a blank screen when loading teams fails', async () => {
		const rejection = new Error('Failed to load teams')
		mockGetAll.mockRejectedValueOnce(rejection)

		const wrapper = mount(TeamsListHost)

		await flushPromises()

		expect(mockError).toHaveBeenCalledTimes(1)
		expect(mockError).toHaveBeenCalledWith(rejection)
		expect(wrapper.classes()).not.toContain('is-loading')
		expect(document.title.startsWith('en:team.title')).toBe(true)
	})

	it('relabels the screen and the document title when the locale changes while mounted', async () => {
		mockGetAll.mockResolvedValueOnce([{id: 1, name: 'Team One'}])

		const wrapper = mount(TeamsListHost)

		await flushPromises()

		expect(wrapper.find('a[href="/vikunja/teams/new"]').text()).toContain('en:team.create.title')
		expect(document.title.startsWith('en:team.title')).toBe(true)

		i18n.global.locale.value = 'de-DE'
		await nextTick()

		expect(wrapper.find('a[href="/vikunja/teams/new"]').text()).toContain('de-DE:team.create.title')
		expect(document.title.startsWith('de-DE:team.title')).toBe(true)
		expect(wrapper.findAll('ul.teams')).toHaveLength(1)
	})

	it('does not report an error when the load fails after the host has unmounted', async () => {
		let rejectPromise!: (reason?: any) => void
		const pendingPromise = new Promise((_, reject) => {
			rejectPromise = reject
		})
		mockGetAll.mockReturnValueOnce(pendingPromise)

		const wrapper = mount(TeamsListHost)
		await flushPromises()

		wrapper.unmount()

		rejectPromise(new Error('Failed after unmount'))
		await flushPromises()

		expect(mockError).not.toHaveBeenCalled()
	})

	it('gives the view router-resolved hrefs while navigation stays unbased', async () => {
		mockGetAll.mockResolvedValueOnce([{id: 1, name: 'Team One'}])

		const wrapper = mount(TeamsListHost)

		await flushPromises()

		const createAnchor = wrapper.find('a[data-path="/teams/new"]')
		expect(createAnchor.attributes('href')).toBe('/vikunja/teams/new')
		expect(createAnchor.attributes('data-path')).toBe('/teams/new')

		const teamAnchor = wrapper.find('a[data-path="/teams/1/edit"]')
		expect(teamAnchor.attributes('href')).toBe('/vikunja/teams/1/edit')
		expect(teamAnchor.attributes('data-path')).toBe('/teams/1/edit')
	})
})
