import {afterEach, expect, it, vi} from 'vitest'
import {registerServiceWorker} from './registerServiceWorker'

afterEach(() => vi.restoreAllMocks())

it('registers without a future document load and announces an installed update once under the owner signal', async () => {
	const installing = Object.assign(new EventTarget(), {state: 'installing'})
	const registration = Object.assign(new EventTarget(), {waiting: null, installing})
	const worker = {controller: {}, register: vi.fn().mockResolvedValue(registration)}
	const notice = vi.fn()
	document.addEventListener('swUpdated', notice)
	const owner = new AbortController()
	try {
		await registerServiceWorker(worker as unknown as ServiceWorkerContainer, owner.signal)
		expect(worker.register).toHaveBeenCalledWith('/sw.js')
		installing.state = 'installed'
		installing.dispatchEvent(new Event('statechange'))
		installing.dispatchEvent(new Event('statechange'))
		expect(notice).toHaveBeenCalledTimes(1)
		expect(notice.mock.calls[0][0].detail).toBe(registration)
	} finally {owner.abort(); document.removeEventListener('swUpdated', notice)}
})

it('an abandoned owner cannot publish late registration or update events', async () => {
	let resolve!: (value: unknown) => void
	const worker = {register: vi.fn().mockImplementation(() => new Promise(done => {resolve = done}))}
	const notice = vi.fn(), owner = new AbortController()
	document.addEventListener('swUpdated', notice)
	try {
		const pending = registerServiceWorker(worker as unknown as ServiceWorkerContainer, owner.signal)
		owner.abort(); resolve({waiting: {}})
		await pending
		expect(notice).not.toHaveBeenCalled()
	} finally {document.removeEventListener('swUpdated', notice)}
})
