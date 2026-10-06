import {afterEach, expect, it, vi} from 'vitest'
import {TaskMembershipView, type MembershipContext, type MembershipInputs} from './task-membership'
let view: InstanceType<typeof TaskMembershipView> | undefined
afterEach(() => view?.destroy())
const inputs: MembershipInputs = {taskId: 1, projectId: 1, items: [], canWrite: true, canCreate: true}
function setup(overrides: Partial<MembershipContext> = {}, kind: 'labels' | 'assignees' = 'labels') {
	const accepted = vi.fn(), context: MembershipContext = {t: key => key, labels: () => [], users: async () => [], currentUser: () => 1, add: async () => {}, remove: async () => {}, createLabel: async title => ({id: 7, title}), observeLabels: () => () => {}, observeLoading: () => () => {}, observeAvatar: () => () => {}, success: vi.fn(), reportError: vi.fn(), ...overrides}
	view = new TaskMembershipView({...inputs, kind, context, accepted}).render()
	return {view, context, accepted}
}
it.each(['destroy', 'task', 'permission'] as const)('%s aborts a relation and clears pending lifetime without late publication', async reason => {
	let finish!: () => void, signal!: AbortSignal
	const {view, context, accepted} = setup({add: (_kind, _task, _item, request) => { signal = request; return new Promise<void>(done => { finish = done }) }})
	const pending = view.select({id: 7, title: 'Pending'})
	expect(view.getState().pending.size).toBe(1)
	if (reason === 'destroy') view.destroy()
	else view.updateInputs({...inputs, ...(reason === 'task' ? {taskId: 2} : {canWrite: false})})
	expect(signal.aborted).toBe(true)
	expect(view.getState().pending.size).toBe(0)
	finish(); await pending
	expect(accepted).not.toHaveBeenCalled(); expect(context.success).not.toHaveBeenCalled(); expect(context.reportError).not.toHaveBeenCalled()
	expect(view.getState().requests.size).toBe(0)
})
it('failed add keeps the visible optimistic tag but does not publish an accepted relation', async () => {
	const {view, context, accepted} = setup({add: async () => { throw new Error('fixture rejection') }})
	await view.select({id: 7, title: 'Pending'})
	expect(view.el.textContent).toContain('Pending'); expect(context.reportError).toHaveBeenCalledOnce(); expect(accepted).not.toHaveBeenCalled()
	expect(view.getState().pending.size).toBe(0)
})
it('readonly and link-share creation permissions block transport', async () => {
	const createLabel = vi.fn(), add = vi.fn(), {view} = setup({createLabel, add})
	view.getState().query = 'New'
	view.updateInputs({...inputs, canCreate: false})
	await view.createLabel(); expect(createLabel).not.toHaveBeenCalled()
	view.updateInputs({...inputs, canWrite: false})
	await view.select({id: 7, title: 'Pending'}); expect(add).not.toHaveBeenCalled()
})
it('changing project identity aborts lookup and rejects late results', async () => {
	let finish!: (users: never[]) => void, signal!: AbortSignal
	const {view, context} = setup({users: (_project, _query, request) => { signal = request; return new Promise(done => { finish = done }) }}, 'assignees')
	const pending = view.search('member')
	view.updateInputs({...inputs, projectId: 2})
	expect(signal.aborted).toBe(true); expect(view.getState().lookup).toBeUndefined()
	finish([]); await pending
	expect(view.getState().results).toEqual([]); expect(view.getState().requests.size).toBe(0); expect(context.reportError).not.toHaveBeenCalled()
})
it('root activation focuses the input and preloads project users only once', async () => {
	const users = vi.fn(async () => []), {view} = setup({users}, 'assignees')
	view.el.dispatchEvent(new FocusEvent('focus'))
	await vi.waitFor(() => expect(users).toHaveBeenCalledOnce())
	expect(users.mock.calls[0].slice(0, 2)).toEqual([1, ''])
	view.el.dispatchEvent(new FocusEvent('focus'))
	expect(users).toHaveBeenCalledOnce()
})
