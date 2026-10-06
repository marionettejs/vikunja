import {expect, it, vi} from 'vitest'
import type {IRepeatAfter} from '@/types/IRepeatAfter'
import TaskModel from '@/models/task'
import {TaskRecordSession} from './task-record'

it('queued field writes use the latest accepted record rather than stale View snapshots', async () => {
	const bodies: TaskModel[] = [], finish: ((task: TaskModel) => void)[] = []
	const session = new TaskRecordSession(new TaskModel({id: 1, title: 'Before', priority: 2}), task => { bodies.push(task as TaskModel); return new Promise(done => finish.push(done)) })
	const title = session.save({title: 'Accepted title'})
	const priority = session.save({priority: 4})
	await vi.waitFor(() => expect(bodies).toHaveLength(1))
	finish[0](new TaskModel({...bodies[0], title: 'Accepted title'})); await title
	await vi.waitFor(() => expect(bodies).toHaveLength(2))
	expect(bodies[1].title).toBe('Accepted title')
	expect(bodies[1].priority).toBe(4)
	finish[1](new TaskModel(bodies[1])); await priority
	expect(session.task.title).toBe('Accepted title')
	session.close()
})
it('close aborts an active write and prevents queued transport and publication', async () => {
	let finish!: (task: TaskModel) => void, signal!: AbortSignal
	const update = vi.fn((_task, request) => { signal = request; return new Promise<TaskModel>(done => { finish = done }) })
	const session = new TaskRecordSession(new TaskModel({id: 1}), update), published = vi.fn()
	session.observe(published)
	const first = session.save({priority: 3}).catch(error => error)
	const second = session.save({percentDone: 0.7}).catch(error => error)
	await vi.waitFor(() => expect(update).toHaveBeenCalledOnce())
	session.close(); expect(signal.aborted).toBe(true)
	finish(new TaskModel({id: 1, priority: 3})); await first; await second
	expect(update).toHaveBeenCalledOnce(); expect(published).not.toHaveBeenCalled()
})
it('relation publications made during a whole-task write remain in the accepted record', async () => {
	let finish!: (task: TaskModel) => void
	const session = new TaskRecordSession(new TaskModel({id: 1}), () => new Promise<TaskModel>(done => { finish = done }))
	const saved = session.save({priority: 3})
	await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
	session.acceptFields({labels: [{id: 7, title: 'New label'}]})
	finish(new TaskModel({id: 1, priority: 3, labels: []})); await saved
	expect(session.task.labels.map(label => label.id)).toEqual([7])
	session.close()
})
it('a rejected write does not block later patches or leak its unaccepted fields', async () => {
	const bodies: TaskModel[] = []
	const session = new TaskRecordSession(new TaskModel({id: 1, title: 'Accepted', priority: 2}), async task => {
		bodies.push(task as TaskModel)
		if (bodies.length === 1) throw new Error('fixture rejection')
		return new TaskModel(task)
	})
	const rejected = session.save({title: 'Rejected'}).catch(error => error)
	const priority = session.save({priority: 4}), progress = session.save({percentDone: 0.5})
	expect(await rejected).toBeInstanceOf(Error)
	await priority; await progress
	expect(bodies.map(task => task.title)).toEqual(['Rejected', 'Accepted', 'Accepted'])
	expect(bodies[2].priority).toBe(4)
	expect(session.task.percentDone).toBe(0.5)
	session.close()
})

it('public snapshots cannot mutate the accepted record during a pending write', async () => {
 let finish!: (task: TaskModel) => void
 const initial = new TaskModel({id: 1}); initial.repeatAfter = {amount: 2, type: 'days'}
 const session = new TaskRecordSession(initial, () => new Promise<TaskModel>(done => { finish = done }))
 session.observe(task => { (task.repeatAfter as IRepeatAfter).amount = 99 })
 session.acceptFields({priority: 2})
 const snapshot = session.task
 ;(snapshot.repeatAfter as IRepeatAfter).amount = 88
 const pending = session.save({title: 'Saved'})
 await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
 expect((session.task.repeatAfter as IRepeatAfter).amount).toBe(2)
 session.acceptFields({repeatAfter: {amount: 3, type: 'days'}})
 finish(new TaskModel({id: 1, title: 'Saved', repeatAfter: {amount: 2, type: 'days'}}))
 const result = await pending
 ;(result.repeatAfter as IRepeatAfter).amount = 77
 expect((session.task.repeatAfter as IRepeatAfter).amount).toBe(3)
 session.close()
})
it('an aborted queued operation never dispatches and the next operation still succeeds', async () => {
 let finish!: (task: TaskModel) => void
 const update = vi.fn(task => update.mock.calls.length === 1 ? new Promise<TaskModel>(done => { finish = done }) : Promise.resolve(new TaskModel(task)))
 const session = new TaskRecordSession(new TaskModel({id: 1}), update), caller = new AbortController()
 const first = session.save({title: 'First'})
 const aborted = session.save({priority: 4}, caller.signal).catch(error => error)
 const next = session.save({percentDone: 0.5})
 await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
 caller.abort(); finish(new TaskModel({id: 1, title: 'First'})); await first
 expect(await aborted).toMatchObject({name: 'AbortError'})
 await next
 expect(update).toHaveBeenCalledTimes(2)
 expect(session.task.priority).toBe(0)
 expect(session.task.percentDone).toBe(0.5)
 session.close()
})
it('Gantt date writes preserve a due endpoint without deriving a new end field', async () => {
	const update = vi.fn(async task => new TaskModel(task))
	const session = new TaskRecordSession(new TaskModel({id: 1, startDate: new Date('2026-10-05T00:00:00Z'), dueDate: new Date('2026-10-08T23:59:59Z')}), update)
	await session.save({startDate: new Date('2026-10-06T00:00:00Z'), dueDate: new Date('2026-10-09T23:59:59Z')}, undefined, false)
	expect(update.mock.calls[0][0].endDate).toBeNull()
	expect(session.task.endDate).toBeNull(); session.close()
})
