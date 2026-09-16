import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import axios, {AxiosHeaders} from 'axios'
import type {AxiosAdapter} from 'axios'
import {createTaskTransport} from './TaskTransport'

vi.mock('@/helpers/auth', () => ({
	getToken: () => 'test-token',
	getTokenType: () => 1,
	refreshToken: vi.fn(),
}))

const previousAdapter = axios.defaults.adapter
const previousApi = window.API_URL
const adapter = vi.fn<AxiosAdapter>()
beforeEach(() => {
	adapter.mockReset()
	axios.defaults.adapter = adapter
	window.API_URL = 'https://example.test/api/v1/'
})
afterEach(() => {
	axios.defaults.adapter = previousAdapter
	window.API_URL = previousApi
})

function respond(data: Record<string, unknown>, permission?: string) {
	adapter.mockImplementation(async config => ({data, status: 200, statusText: 'OK', headers: new AxiosHeaders(permission === undefined ? {} : {'x-max-permission': permission}), config}))
}

describe('native task transport', () => {
	it.each(['0', '1', '2'])('loads raw task data with authenticated v1 GET and permission %s', async permission => {
		const raw = {id: 3, repeat_after: 7200, due_date: null}
		respond(raw, permission)
		const result = await createTaskTransport().load(3)
		expect(result).toEqual({...raw, max_permission: Number(permission)})
		expect(raw).not.toHaveProperty('max_permission')
		const config = adapter.mock.calls[0][0]
		expect(config).toMatchObject({method: 'get', url: '/tasks/3', baseURL: 'https://example.test/api/v1/', withCredentials: true})
		expect(config.headers.get('Authorization')).toBe('Bearer test-token')
	})

	it.each([undefined, '', 'invalid', '3', '-1', '1.5', ' ', '0x1', '1e0'])('fails closed for permission header %s', async permission => {
		respond({id: 3, max_permission: 2}, permission)
		expect((await createTaskTransport().load(3)).max_permission).toBeNull()
	})

	it('posts the full wire payload without reparsing the task response', async () => {
		const raw = {id: 3, repeat_after: 7200, reactions: {'👍': null}}
		respond(raw)
		const payload = {id: 3, title: 'Changed', description: 'Retained', repeat_after: 7200, reminders: [], reactions: {'👍': null}}
		const result = await createTaskTransport().update(3, payload)
		const config = adapter.mock.calls[0][0]
		expect(config).toMatchObject({method: 'post', url: '/tasks/3'})
		expect(JSON.parse(config.data)).toEqual(payload)
		expect(result).toBe(raw)
	})

	it('propagates failed requests without returning a task', async () => {
		const error = new Error('network unavailable')
		adapter.mockRejectedValue(error)
		const transport = createTaskTransport()
		await expect(transport.load(3)).rejects.toBe(error)
		await expect(transport.update(3, {id: 3})).rejects.toBe(error)
	})
})
