import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {TaskWorkspace} from './TaskWorkspace'
import type {TaskTransport} from './TaskTransport'

vi.mock('@/helpers/fetcher', () => ({AuthenticatedHTTPFactory: vi.fn()}))

let workspace: TaskWorkspace
let transport: TaskTransport
function raw(id = 3) {
	return {id, title: 'Original', description: 'Retained', project_id: 7, max_permission: 1, repeat_after: 7200, reminders: [{reminder: '2026-10-01T09:00:00Z'}]}
}
function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason: unknown) => void
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
	return {promise, resolve, reject}
}
beforeEach(() => {
	transport = {
		load: vi.fn(async id => raw(id)),
		update: vi.fn(async (id, payload) => ({...payload, id})),
	}
	workspace = new TaskWorkspace(transport)
})
afterEach(() => workspace.destroy())

describe('native TaskWorkspace', () => {
	it('saves a full snapshot and updates the same canonical record only after success', async () => {
		const record = await workspace.load(3)
		const reminders = record.get('reminders')!
		const date = reminders[0].reminder
		const pending = deferred<Record<string, unknown>>()
		vi.mocked(transport.update).mockReturnValue(pending.promise)
		const saved = workspace.update(3, {title: 'Changed'})
		await vi.waitFor(() => expect(transport.update).toHaveBeenCalledTimes(1))
		expect(transport.update).toHaveBeenCalledWith(3, expect.objectContaining({description: 'Retained', title: 'Changed', repeat_after: 7200, reminders: [{reminder: '2026-10-01T09:00:00.000Z'}]}))
		expect(record.get('title')).toBe('Original')
		expect(record.get('reminders')).toBe(reminders)
		expect(reminders[0].reminder).toBe(date)
		expect(date).toBeInstanceOf(Date)
		pending.resolve({id: 3, title: 'Server title'})
		expect(await saved).toBe(record)
		expect(record.get('title')).toBe('Server title')
		expect(record.get('maxPermission')).toBe(1)
	})

	it('queues same-task work while allowing other task loads and retries after failure', async () => {
		const pending = deferred<Record<string, unknown>>()
		vi.mocked(transport.load).mockImplementation(id => id === 3 ? pending.promise : Promise.resolve(raw(id)))
		const first = workspace.load(3)
		const next = workspace.update(3, {title: 'Queued'})
		await expect(workspace.load(4)).resolves.toBeDefined()
		expect(transport.update).not.toHaveBeenCalled()
		pending.resolve(raw())
		const record = await first
		expect(await next).toBe(record)
		const failure = new Error('save failed')
		vi.mocked(transport.update).mockRejectedValueOnce(failure)
		await expect(workspace.update(3, {title: 'Bad'})).rejects.toBe(failure)
		expect(record.get('title')).toBe('Queued')
		await expect(workspace.update(3, {title: 'Retry'})).resolves.toBe(record)
		expect(record.get('title')).toBe('Retry')
	})

	it('waits for a pending save before refetching the same task', async () => {
		const record = await workspace.load(3)
		const pending = deferred<Record<string, unknown>>()
		vi.mocked(transport.update).mockReturnValue(pending.promise)
		const saved = workspace.update(3, {title: 'Changed'})
		const reloaded = workspace.load(3)
		await vi.waitFor(() => expect(transport.update).toHaveBeenCalled())
		expect(transport.load).toHaveBeenCalledTimes(1)
		vi.mocked(transport.load).mockResolvedValue({...raw(), title: 'Reloaded'})
		pending.resolve({...raw(), title: 'Changed'})
		await saved
		expect(await reloaded).toBe(record)
		expect(transport.load).toHaveBeenCalledTimes(2)
		expect(record.get('title')).toBe('Reloaded')
	})

	it('preserves an explicit permission revocation in an update response', async () => {
		const record = await workspace.load(3)
		vi.mocked(transport.update).mockResolvedValue({id: 3, title: 'Saved', max_permission: null})
		await workspace.update(3, {title: 'Saved'})
		expect(record.get('maxPermission')).toBeNull()
		await expect(workspace.update(3, {title: 'Forbidden'})).rejects.toThrow()
		expect(transport.update).toHaveBeenCalledTimes(1)
	})

	it('rejects unloaded, readonly, blank and changed-identity saves before transport', async () => {
		await expect(workspace.update(3, {title: 'Unknown'})).rejects.toThrow()
		vi.mocked(transport.load).mockResolvedValue({...raw(), max_permission: 0})
		const record = await workspace.load(3)
		await expect(workspace.update(3, {title: 'Readonly'})).rejects.toThrow()
		record.set('maxPermission', 1)
		await expect(workspace.update(3, {title: '  '})).rejects.toThrow()
		record.set('id', 4)
		await expect(workspace.update(3, {title: 'Wrong ID'})).rejects.toThrow()
		expect(transport.update).not.toHaveBeenCalled()
	})

	it('rejects wrong response identities without altering a loaded record', async () => {
		const record = await workspace.load(3)
		vi.mocked(transport.update).mockResolvedValue({...raw(4), title: 'Wrong'})
		await expect(workspace.update(3, {title: 'Changed'})).rejects.toThrow()
		expect(record.get('title')).toBe('Original')
		vi.mocked(transport.load).mockResolvedValue(raw(4))
		await expect(workspace.load(3)).rejects.toThrow()
		expect(record.get('title')).toBe('Original')
	})

	it('destroys owned records once and rejects late requests without recreating them', async () => {
		const record = await workspace.load(3)
		const destroyed = vi.fn()
		record.on('destroy', destroyed)
		const pending = deferred<Record<string, unknown>>()
		vi.mocked(transport.update).mockReturnValue(pending.promise)
		const saved = workspace.update(3, {title: 'Late'})
		await vi.waitFor(() => expect(transport.update).toHaveBeenCalled())
		workspace.destroy()
		workspace.destroy()
		pending.resolve({...raw(), title: 'Late'})
		await expect(saved).rejects.toThrow()
		await expect(workspace.load(3)).rejects.toThrow()
		expect(destroyed).toHaveBeenCalledTimes(1)
	})
})
