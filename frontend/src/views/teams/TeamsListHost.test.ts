import {describe, it, expect, vi} from 'vitest'
import {mount, flushPromises} from '@vue/test-utils'
import TeamsListHost from './TeamsListHost.vue'

const {mockError, mockPush, mockRejection} = vi.hoisted(() => ({
	mockError: vi.fn(),
	mockPush: vi.fn(),
	mockRejection: new Error('Failed to load teams'),
}))

vi.mock('@/services/team', () => {
	return {
		default: class {
			getAll() {
				return Promise.reject(mockRejection)
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
	}),
}))

describe('TeamsListHost', () => {
	it('reports the error instead of leaving a blank screen when loading teams fails', async () => {
		const wrapper = mount(TeamsListHost)

		await flushPromises()

		expect(mockError).toHaveBeenCalledTimes(1)
		expect(mockError).toHaveBeenCalledWith(mockRejection)
		expect(wrapper.classes()).not.toContain('is-loading')
	})
})
