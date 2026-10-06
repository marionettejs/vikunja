import {afterEach, expect, it, vi} from 'vitest'
import {VikunjaApplication} from './application'
import {SessionApplication} from './session'

let app: InstanceType<typeof VikunjaApplication> | undefined
const host = document.createElement('div')
document.body.append(host)
afterEach(() => {app?.destroy(); vi.restoreAllMocks(); host.replaceChildren()})

it('owns the accessible loading view while readiness waits and destroys it on cancellation without late publication', async () => {
	let resolve!: (result: {user: null, config: Record<string, unknown>, status: 'anonymous'}) => void
	let signal!: AbortSignal
	vi.spyOn(SessionApplication.prototype, 'prepareStart').mockImplementation((_options, context) => {
		signal = context.signal
		return new Promise(done => {resolve = done})
	})
	app = new VikunjaApplication({region: {el: host}})
	const dispatch = vi.spyOn(app, 'dispatch').mockResolvedValue(undefined)
	const pending = app.start()
	expect(host.querySelector('[role=status]')?.textContent).toContain('Vikunja is loading…')
	expect(app.isRunning()).toBe(false)
	app.stop()
	expect(signal.aborted).toBe(true)
	expect(host.childElementCount).toBe(0)
	resolve({user: null, config: {}, status: 'anonymous'})
	await expect(pending).resolves.toBe(false)
	expect(dispatch).not.toHaveBeenCalled()
	expect(host.childElementCount).toBe(0)
})

it('shows a recoverable readiness error and replaces it after a successful retry', async () => {
	vi.spyOn(SessionApplication.prototype, 'prepareStart')
		.mockRejectedValueOnce(new Error('Fixture unavailable'))
		.mockResolvedValueOnce({user: null, config: {}, status: 'anonymous'})
	app = new VikunjaApplication({region: {el: host}})
	const dispatch = vi.spyOn(app, 'dispatch').mockResolvedValue(undefined)
	await expect(app.start()).rejects.toThrow('Fixture unavailable')
	expect(host.querySelector('[role=alert]')?.textContent).toContain('Fixture unavailable')
	expect(host.querySelector('#api-url')).not.toBeNull()
	expect(host.querySelector('[role=status]')).toBeNull()
	await expect(app.start()).resolves.toBe(true)
	expect(host.querySelector('[role=alert]')).toBeNull()
	expect(dispatch).toHaveBeenCalledTimes(1)
})

it('owns offline presentation, stops routed owners and reconnects without resetting Session', async () => {
	let online = true
	vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
	vi.spyOn(SessionApplication.prototype, 'prepareStart').mockResolvedValue({user: null, config: {}, status: 'anonymous'})
	app = new VikunjaApplication({region: {el: host}})
	const dispatch = vi.spyOn(app, 'dispatch').mockResolvedValue(undefined)
	const routed = ['workspace', 'sharing', 'authentication'].map(name => vi.spyOn(app!.getChildApp(name)!, 'stop'))
	await app.start()
	online = false
	window.dispatchEvent(new Event('offline'))
	expect(host.querySelector('.offline h1')?.textContent).toBe('You are offline.')
	expect(host.querySelector('.add-to-home-screen')).toBeNull()
	routed.forEach(stop => expect(stop).toHaveBeenCalled())
	expect(app.getChildApp('session')!.isRunning()).toBe(true)
	online = true
	window.dispatchEvent(new Event('online'))
	expect(host.querySelector('.app.offline')).toBeNull()
	expect(dispatch).toHaveBeenCalledTimes(2)
})

it('keeps offline presentation through pending readiness and removes network listeners on stop', async () => {
	let online = false
	vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
	let resolve!: (result: {user: null, config: Record<string, unknown>, status: 'anonymous'}) => void
	vi.spyOn(SessionApplication.prototype, 'prepareStart').mockImplementation(() => new Promise(done => {resolve = done}))
	app = new VikunjaApplication({region: {el: host}})
	const pending = app.start()
	expect(host.querySelector('.offline h1')?.textContent).toBe('You are offline.')
	resolve({user: null, config: {}, status: 'anonymous'})
	await pending
	expect(host.querySelector('.app.offline')).not.toBeNull()
	expect(host.querySelector('.add-to-home-screen')).toBeNull()
	app.stop()
	online = true
	window.dispatchEvent(new Event('online'))
	expect(host.childElementCount).toBe(0)
	expect(app.isRunning()).toBe(false)
})
