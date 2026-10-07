import {afterEach, expect, it, vi} from 'vitest'
import {Model} from '@mnjs/data'
import TaskModel from '@/models/task'
import type {ListContext} from './list-context'
import {ListTaskRowView} from './list-task-row'

const owners: InstanceType<typeof ListTaskRowView>[] = []
afterEach(() => { owners.splice(0).forEach(view => view.destroy()); vi.restoreAllMocks() })
function row() {
 const task = new TaskModel({id: 1, done: true, dueDate: new Date('2026-01-02')})
 const model = new Model({task})
 const context = {updateTask: vi.fn(), reportError: vi.fn(), success: vi.fn(), t: (key: string) => key}
 const view = new ListTaskRowView({model, context: context as unknown as ListContext, allTasks: () => [task], canWrite: true})
 owners.push(view)
 vi.spyOn(view, 'render').mockReturnValue(view)
 vi.spyOn(view, 'closeDue').mockImplementation(() => {})
 return {view, model, task, context}
}
it('failed Undo retains the local restored draft until authoritative model publication', async () => {
 const {view, model, task, context} = row(), restored = {...task, dueDate: new Date('2026-01-01')}
 context.updateTask.mockRejectedValue(new Error('Undo unavailable'))
 await view.markDone(restored, false, true)
 expect(context.reportError).not.toHaveBeenCalled()
 expect(context.success).not.toHaveBeenCalled()
 expect(model.get('task')).toBe(task)
 expect(view.getState().requests.size).toBe(0)
 expect(view.getState().overrides.get(1)).toMatchObject({done: false, dueDate: restored.dueDate})
 model.set('task', new TaskModel({...task, title: 'Authoritative result'}))
 expect(view.getState().overrides.size).toBe(0)
})
it('ordinary failed completion rolls back its preview and reports the error', async () => {
 const {view, task, context} = row(), error = new Error('Completion unavailable')
 context.updateTask.mockRejectedValue(error)
 await view.markDone(task, false)
 expect(context.reportError).toHaveBeenCalledWith(error)
 expect(view.getState().overrides.size).toBe(0)
 expect(view.getState().requests.size).toBe(0)
})
it('a superseded ignored-abort Undo rejection cannot clear the newer request draft', async () => {
 const {view, task, context} = row()
 let rejectFirst!: (error: Error) => void, resolveSecond!: (task: TaskModel) => void
 context.updateTask.mockImplementationOnce(() => new Promise((_resolve, reject) => rejectFirst = reject))
 context.updateTask.mockImplementationOnce(() => new Promise(resolve => resolveSecond = resolve))
 const first = view.markDone(task, false, true), second = view.markDone(task, false, true)
 const current = view.getState().requests.get(1)
 rejectFirst(new Error('Stale Undo unavailable')); await first
 expect(view.getState().requests.get(1)).toBe(current)
 expect(view.getState().overrides.get(1)?.done).toBe(false)
 expect(context.reportError).not.toHaveBeenCalled()
 resolveSecond(new TaskModel({...task, done: false})); await second
 expect(view.getState().requests.size).toBe(0)
 expect(view.getState().overrides.size).toBe(0)
})
it.each(['permission', 'destroy'])('failed Undo draft clears on %s', async lifetime => {
 const {view, task, context} = row()
 context.updateTask.mockRejectedValue(new Error('Undo unavailable'))
 await view.markDone(task, false, true)
 expect(view.getState().overrides.size).toBe(1)
 if (lifetime === 'permission') view.setCanWrite(false)
 else view.destroy()
 expect(view.getState().overrides.size).toBe(0)
 expect(context.reportError).not.toHaveBeenCalled()
})
it('a retained successful completion action consumes rejection after row destruction', async () => {
 const {view, task, context} = row()
 context.updateTask.mockResolvedValueOnce(task).mockRejectedValueOnce(new Error('Retained Undo unavailable'))
 await view.markDone(task, true)
 const action = context.success.mock.calls[0][1] as () => void
 view.destroy(); action(); await Promise.resolve(); await Promise.resolve()
 expect(context.updateTask).toHaveBeenCalledTimes(2)
 expect(context.reportError).not.toHaveBeenCalled()
})
