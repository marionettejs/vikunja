import {afterEach, expect, it, vi} from 'vitest'
import {ApiConfigView, apiCandidates, discoverApi} from './api-config'
const transport = vi.hoisted(() => ({get: vi.fn(), configure: vi.fn(), clear: vi.fn()}))
vi.mock('@/helpers/fetcher', () => ({HTTPFactory: () => ({get: transport.get})}))
vi.mock('@/client/http', () => ({configureApiClient: transport.configure}))
vi.mock('@/helpers/taskCache', () => ({clearTaskCache: transport.clear}))
afterEach(() => {vi.clearAllMocks(); localStorage.clear()})
it('discovers nested installation paths without changing the active API during unsuccessful probes', async () => {
	window.API_URL = 'https://active.example/api/v1'
	transport.get.mockRejectedValueOnce(new Error('not here')).mockResolvedValueOnce({data: {auth: {local: {enabled: true}}}})
	const signal = new AbortController().signal
	await expect(discoverApi('https://candidate.example/nested', signal)).resolves.toEqual({url: 'https://candidate.example/nested/api/v1', config: {auth: {local: {enabled: true}}}})
	expect(transport.get.mock.calls.map(call => call[0])).toEqual(['https://candidate.example/nested/info', 'https://candidate.example/nested/api/v1/info'])
	expect(window.API_URL).toBe('https://active.example/api/v1')
	expect(localStorage.getItem('API_URL')).toBeNull()
})
it('rejects an ignored abort before an obsolete probe can be accepted or fallback requests sent', async () => {
	let resolve!: (value: unknown) => void
	transport.get.mockImplementationOnce(() => new Promise(ready => {resolve = ready}))
	const request = new AbortController(), pending = discoverApi('https://candidate.example', request.signal)
	request.abort(); resolve({data: {auth: {local: {enabled: true}}}})
	await expect(pending).rejects.toMatchObject({name: 'AbortError'})
	expect(transport.get).toHaveBeenCalledTimes(1)
})
it('destroying the selector prevents publication even when its transport ignores cancellation', async () => {
	window.API_URL = 'https://active.example/api/v1'
	let resolve!: (value: unknown) => void
	transport.get.mockImplementationOnce(() => new Promise(ready => {resolve = ready}))
	const accepted = vi.fn(), view = new ApiConfigView({canChange: () => true, busy: vi.fn(), accepted})
	view.render(); view.edit(); (view.getUI('url')![0] as HTMLInputElement).value = 'https://obsolete.example/api/v1'
	const pending = view.submit({preventDefault() {}} as SubmitEvent)
	view.destroy(); resolve({data: {auth: {local: {enabled: true}}}}); await pending
	expect(window.API_URL).toBe('https://active.example/api/v1'); expect(accepted).not.toHaveBeenCalled()
	expect(transport.configure).not.toHaveBeenCalled(); expect(transport.clear).not.toHaveBeenCalled()
})
it('normalizes relative paths and avoids duplicate default-path probes', () => {
	expect(apiCandidates('/nested')[0]).toBe(`${location.origin}/nested`)
	expect(apiCandidates('https://candidate.example/api/v1/')).toEqual(['https://candidate.example/api/v1', 'https://candidate.example:3456/api/v1'])
})
