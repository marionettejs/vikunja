import {afterEach, expect, it, vi} from 'vitest'
import UserModel from '@/models/user'
import {TaskCommentsView, type CommentsContext, type CommentsInputs} from './task-comments'
let view: InstanceType<typeof TaskCommentsView> | undefined
afterEach(() => view?.destroy())
const inputs: CommentsInputs = {taskId: 1, projectId: 1, canWrite: true, user: new UserModel({id: 1, username: 'sort-owner'}), initialComments: []}
function setup(sort: CommentsContext['sort']) {
	const context: CommentsContext = {
		editor: {t: key => key, reportError: vi.fn(), avatar: async () => '', users: async () => [], fetchTask: async () => {throw new Error('unused')}, projectTitle: () => '', openTask: () => {}, observeTasks: () => () => {}, displayDate: () => ''},
		displayDate: date => date.toISOString(), upload: async () => [], order: 'asc', maxItems: 50,
		load: async () => ({comments: [], pages: 1}), create: async comment => comment,
		update: async comment => comment, remove: async () => {}, reaction: async () => {},
		sort, copy: vi.fn(), success: vi.fn(),
	}
	view = new TaskCommentsView({...inputs, context}).render()
	return {view, context}
}

it.each(['destroy', 'identity'] as const)('%s cancels a held sort preference save without changing order', async reason => {
	let finish!: () => void, signal!: AbortSignal
	const {view, context} = setup((_order, request) => {signal = request; return new Promise<void>(resolve => {finish = resolve})})
	const pending = view.toggleSort()
	if (reason === 'destroy') view.destroy()
	else view.updateInputs({...inputs, user: new UserModel({id: 2, username: 'replacement-sort-user'})})
	expect(signal.aborted).toBe(true)
	finish()
	await pending
	expect(view.getState().order).toBe('asc')
	expect(context.editor.reportError).not.toHaveBeenCalled()
})
