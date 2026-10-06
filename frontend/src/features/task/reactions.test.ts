import {afterEach, expect, it, vi} from 'vitest'
import UserModel from '@/models/user'
import type {IReactionPerEntity} from '@/modelTypes/IReaction'
import {ReactionsView} from './reactions'

vi.mock('emoji-picker-element', () => ({}))

let view: InstanceType<typeof ReactionsView> | undefined
afterEach(() => view?.destroy())
function setup() {
	const user = new UserModel({id: 1}), other = new UserModel({id: 2})
	let reactions: IReactionPerEntity = {}, writable = true
	const accepted = vi.fn((value: IReactionPerEntity) => { reactions = value }), reportError = vi.fn()
	let resolve!: () => void, reject!: (error: Error) => void, signal!: AbortSignal
	const transport = vi.fn((_value: string, _remove: boolean, request: AbortSignal) => { signal = request; return new Promise<void>((done, failed) => {resolve = done; reject = failed}) })
	view = new ReactionsView({user: () => user, canWrite: () => writable, reactions: () => reactions, t: key => key, transport, accepted, reportError}).render()
	return {user, other, accepted, reportError, transport, resolve: () => resolve(), reject: () => reject(new Error('Fixture failure')), signal: () => signal, publish: (value: IReactionPerEntity) => {reactions = value}, revoke: () => {writable = false; view!.updateInputs()}}
}
it('merges a reaction with updates accepted while the request is pending and blocks repeated writes', async () => {
	const state = setup(), pending = view!.toggle('😀')
	await view!.toggle('😀')
	expect(state.transport).toHaveBeenCalledTimes(1)
	expect(view!.el.querySelector<HTMLButtonElement>('[data-add-reaction]')?.disabled).toBe(true)
	state.publish({'😀': [state.other], '👍': [state.other]}); state.resolve(); await pending
	expect(state.accepted).toHaveBeenCalledWith({'😀': [state.other, state.user], '👍': [state.other]})
	expect(view!.el.textContent).toContain('😀 2')
})
it('aborts on permission loss and rejects a late response without reporting a cancellation error', async () => {
	const state = setup(), pending = view!.toggle('😀')
	state.revoke(); expect(state.signal().aborted).toBe(true); state.resolve(); await pending
	expect(state.accepted).not.toHaveBeenCalled(); expect(state.reportError).not.toHaveBeenCalled()
	expect(view!.el.querySelector('[data-add-reaction]')).toBeNull()
})
it('aborts on destruction even if transport ignores cancellation', async () => {
	const state = setup(), pending = view!.toggle('😀')
	view!.destroy(); expect(state.signal().aborted).toBe(true); state.resolve(); await pending
	expect(state.accepted).not.toHaveBeenCalled(); expect(state.reportError).not.toHaveBeenCalled()
})
it('keeps the picker and accepted reactions on failure, allowing retry', async () => {
	const state = setup(); view!.getState().picker = true
	const pending = view!.toggle('😀'); state.reject(); await pending
	expect(state.accepted).not.toHaveBeenCalled(); expect(state.reportError).toHaveBeenCalledTimes(1)
	expect(view!.getState().picker).toBe(true)
	const retry = view!.toggle('😀'); state.resolve(); await retry
	expect(state.accepted).toHaveBeenCalledTimes(1); expect(view!.getState().picker).toBe(false)
})
