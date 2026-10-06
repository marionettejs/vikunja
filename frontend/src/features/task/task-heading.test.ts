import {afterEach, expect, it, vi} from 'vitest'
import TaskModel from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'
import {TaskHeadingView} from './task-heading'

let view: InstanceType<typeof TaskHeadingView> | undefined
afterEach(() => { view?.destroy(); vi.useRealTimers() })

it('permission loss cancels a pending write, clears draft/status timers and rejects late publication', async () => {
	vi.useFakeTimers()
	const task = new TaskModel({id: 1, title: 'Original'})
	let resolve!: (task: TaskModel) => void
	let signal: AbortSignal | undefined
	const accepted = vi.fn()
	const reportError = vi.fn()
	const inputs = {task, canWrite: true, hasClose: false, identifier: '#1', color: ''}
	view = new TaskHeadingView({...inputs, t: (key: string) => key, accepted, reportError, close: vi.fn(), copyUrl: async () => {},
		saveTask: (_task: ITask, requestSignal: AbortSignal) => {
			signal = requestSignal
			return new Promise<TaskModel>(done => { resolve = done })
		},
	}).render()
	const title = view.el.querySelector('h1')!
	title.textContent = 'Pending draft'
	view.edit()
	const saving = view.save()
	await vi.advanceTimersByTimeAsync(100)
	expect(view.el.textContent).toContain('misc.saving')
	view.updateInputs({...inputs, canWrite: false})
	expect(signal?.aborted).toBe(true)
	expect(title.hasAttribute('contenteditable')).toBe(false)
	expect(title.textContent).toBe('Original')
	resolve(new TaskModel({id: 1, title: 'Pending draft'}))
	await saving
	await vi.advanceTimersByTimeAsync(2500)
	expect(accepted).not.toHaveBeenCalled()
	expect(reportError).not.toHaveBeenCalled()
	expect(view.el.textContent).not.toContain('misc.saving')
	expect(view.el.textContent).not.toContain('misc.saved')
	expect(title.textContent).toBe('Original')
})
