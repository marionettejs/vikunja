import {afterEach, expect, it, vi} from 'vitest'
import UserModel from '@/models/user'
import TaskCommentModel from '@/models/taskComment'
import {TaskCommentsView, type CommentsContext, type CommentsInputs} from './task-comments'
let view: InstanceType<typeof TaskCommentsView> | undefined
afterEach(() => view?.destroy())
const inputs: CommentsInputs = {taskId: 1, projectId: 1, canWrite: true, user: new UserModel({id: 1, username: 'reviewer'}), initialComments: []}
function setup(overrides: Partial<CommentsContext> = {}) {
 const context: CommentsContext = {editor: {t: key => key, reportError: vi.fn(), avatar: async () => '', users: async () => [], fetchTask: async () => { throw new Error('unused') }, projectTitle: () => '', openTask: () => {}, observeTasks: () => () => {}, displayDate: () => ''}, displayDate: date => date.toISOString(), upload: async () => [], order: 'asc', maxItems: 50, load: async () => ({comments: [], pages: 1}), create: async comment => comment, update: async comment => comment, remove: async () => {}, reaction: async () => {}, sort: async () => {}, copy: vi.fn(), success: vi.fn(), ...overrides}
 view = new TaskCommentsView({...inputs, context}).render()
 return {view, context}
}
it.each(['destroy', 'permission', 'identity'] as const)('%s aborts a pending create without publication or clearing its draft', async reason => {
 let finish!: (comment: TaskCommentModel) => void, signal!: AbortSignal
 const {view, context} = setup({create: (_comment, request) => { signal = request; return new Promise(done => { finish = done }) }})
 view.getState().composer!.setReplyContent('<p>Pending draft</p>')
 const pending = view.create().catch(error => error)
 if (reason === 'destroy') view.destroy()
 else view.updateInputs({...inputs, ...(reason === 'permission' ? {canWrite: false} : {user: new UserModel({id: 2, username: 'other'})})})
 expect(signal.aborted).toBe(true)
 finish(new TaskCommentModel({id: 9, taskId: 1, comment: '<p>Pending draft</p>'})); await pending
 expect(view.getState().comments).toEqual([]); expect(view.getState().value).toBe('<p>Pending draft</p>'); expect(context.success).not.toHaveBeenCalled(); expect(context.editor.reportError).not.toHaveBeenCalled()
})
it('create acknowledgements preserve a newer draft and a failed retry retains it', async () => {
 let finish!: (comment: TaskCommentModel) => void
 const {view} = setup({create: () => new Promise(done => { finish = done })})
 const composer = view.getState().composer!
 composer.setReplyContent('<p>Submitted</p>'); const pending = view.create(); composer.setReplyContent('<p>Newer draft</p>')
 finish(new TaskCommentModel({id: 1, taskId: 1, author: inputs.user, comment: '<p>Submitted</p>'})); await pending
 expect(view.getState().value).toBe('<p>Newer draft</p>'); expect(composer.live()?.getHTML()).toBe('<p>Newer draft</p>')
 view.options.context.create = async () => { throw new Error('fixture failure') }
 await expect(view.create()).rejects.toThrow('fixture failure')
 expect(composer.live()?.getHTML()).toBe('<p>Newer draft</p>'); expect(view.getState().creating).toBe(false)
})
it('a replaced page request cannot publish its late response', async () => {
 const finish: ((result: {comments: TaskCommentModel[], pages: number}) => void)[] = [], signals: AbortSignal[] = []
 const {view} = setup({load: (_task, _order, _page, signal) => { signals.push(signal); return new Promise(done => finish.push(done)) }})
 const first = view.load(), second = view.load()
 expect(signals[0].aborted).toBe(true)
 finish[1]({comments: [new TaskCommentModel({id: 2, author: inputs.user, comment: 'Current'})], pages: 2}); await second
 finish[0]({comments: [new TaskCommentModel({id: 1, author: inputs.user, comment: 'Stale'})], pages: 1}); await first
 expect(view.getState().comments.map(c => c.id)).toEqual([2]); expect(view.getState().pages).toBe(2)
})
it('permission loss and restoration during editor save cannot acknowledge an aborted draft', async () => {
 let finish!: (comment: TaskCommentModel) => void
 const {view, context} = setup({create: () => new Promise(done => { finish = done })})
 const composer = view.getState().composer!
 composer.setReplyContent('<p>Unacknowledged</p>'); const pending = composer.saveNow()
 view.updateInputs({...inputs, canWrite: false}); view.updateInputs(inputs)
 finish(new TaskCommentModel({id: 1, author: inputs.user, comment: '<p>Unacknowledged</p>'})); await pending
 expect(composer.getState().dirty.value).toBe(true)
 expect(composer.live()?.getHTML()).toBe('<p>Unacknowledged</p>')
 expect(localStorage.getItem('editorDraft-task-comment-1')).toBe('<p>Unacknowledged</p>')
 expect(context.editor.reportError).not.toHaveBeenCalled()
})
it('composer Escape preserves its draft and reaches the parent handler', () => {
 const {view} = setup(), bubbled = vi.fn()
 view.el.addEventListener('keydown', bubbled)
 const composer = view.getState().composer!
 composer.setReplyContent('<p>Keep composer draft</p>')
 composer.live()!.view.dom.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
 expect(bubbled).toHaveBeenCalledOnce()
 expect(composer.live()!.getHTML()).toBe('<p>Keep composer draft</p>')
})
