import {afterEach, expect, it, vi} from 'vitest'
import TaskModel from '@/models/task'
import {TaskSelectFieldView} from './task-select-field'

let view: InstanceType<typeof TaskSelectFieldView> | undefined
afterEach(() => view?.destroy())
it.each(['destroy', 'task', 'permission'] as const)('%s rejects a late select write and clears its request', async reason => {
	const task = new TaskModel({id: 1, priority: 3})
	let finish!: (task: TaskModel) => void, signal: AbortSignal | undefined
	const accepted = vi.fn(), reportError = vi.fn(), changed = vi.fn()
	view = new TaskSelectFieldView({task, canWrite: true, field: 'priority', t: key => key, accepted, reportError, changed,
		saveTask: (_task, requestSignal) => { signal = requestSignal; return new Promise(done => { finish = done }) }}).render()
	expect(view.el.querySelector('select')!.value).toBe('3')
	const pending = view.change(4)
	if (reason === 'destroy') view.destroy()
	else if (reason === 'task') { task.id = 2; view.updateInputs({task, canWrite: true}) }
	else view.updateInputs({task, canWrite: false})
	expect(signal?.aborted).toBe(true)
	finish(new TaskModel({id: 1, priority: 4}))
	await pending
	expect(accepted).not.toHaveBeenCalled()
	expect(reportError).not.toHaveBeenCalled()
	expect(view.getState().request).toBeUndefined()
})
it('a newer selection aborts the old write and only publishes the latest response', async () => {
	const task = new TaskModel({id: 1})
	const requests: {signal: AbortSignal, finish: (task: TaskModel) => void}[] = []
	const accepted = vi.fn()
	view = new TaskSelectFieldView({task, canWrite: true, field: 'percentDone', t: key => key, accepted, reportError: vi.fn(), changed: (_field, value) => { task.percentDone = value },
		saveTask: (_task, signal) => new Promise(done => requests.push({signal, finish: done}))}).render()
	const first = view.change(0.2), second = view.change(0.7)
	expect(requests[0].signal.aborted).toBe(true)
	requests[0].finish(new TaskModel({id: 1, percentDone: 0.2})); await first
	expect(accepted).not.toHaveBeenCalled()
	requests[1].finish(new TaskModel({id: 1, percentDone: 0.7})); await second
	expect(accepted).toHaveBeenCalledOnce()
	expect(accepted.mock.calls[0][0].percentDone).toBe(0.7)
	expect(view.getState().request).toBeUndefined()
})
