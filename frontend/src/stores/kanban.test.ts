import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'

const {bucketUpdate, baseState} = vi.hoisted(() => ({
	bucketUpdate: vi.fn(),
	baseState: {
		currentProject: {views: [] as {id: number; doneBucketId: number; defaultBucketId: number}[]},
		currentProjectViewId: 1,
		setCurrentProject: vi.fn(),
	},
}))

beforeEach(() => {
	baseState.currentProject.views = []
})

vi.mock('@/services/bucket', () => ({
	default: class {
		update = bucketUpdate
	},
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({push: vi.fn()}),
}))

vi.mock('vue-i18n', () => ({
	useI18n: () => ({t: (key: string) => key}),
	createI18n: () => ({global: {t: (key: string) => key}}),
}))

vi.mock('@/stores/base', () => ({
	useBaseStore: () => baseState,
}))

vi.mock('@/stores/auth', () => ({
	useAuthStore: () => ({
		authUser: true,
		info: null,
	}),
}))

import {useKanbanStore} from './kanban'

import type {IBucket} from '@/modelTypes/IBucket'
import type {ITask} from '@/modelTypes/ITask'

function makeBucket(id: number, title: string, tasks: ITask[] = []): IBucket {
	return {
		id,
		title,
		projectViewId: 1,
		tasks,
		count: tasks.length,
	} as IBucket
}

function makeTask(id: number, bucketId: number): ITask {
	return {
		id,
		title: `Task ${id}`,
		bucketId,
	} as ITask
}

describe('kanban store: moveTaskToBucket', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('relocates a task from its current bucket into the target bucket', () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'To-Do'), makeBucket(2, 'Done')])

		const task = makeTask(42, 2)
		kanban.addTaskToBucket(task)
		expect(kanban.buckets[1].tasks.map(t => t.id)).toEqual([42])

		kanban.moveTaskToBucket(task, 1)

		expect(kanban.buckets[0].tasks.map(t => t.id)).toEqual([42])
		expect(kanban.buckets[0].tasks[0].bucketId).toBe(1)
		expect(kanban.buckets[1].tasks.map(t => t.id)).toEqual([])
	})

	it('is a no-op when the task is already in the target bucket', () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'To-Do'), makeBucket(2, 'Done')])

		const task = makeTask(42, 1)
		kanban.addTaskToBucket(task)

		kanban.moveTaskToBucket(task, 1)

		expect(kanban.buckets[0].tasks.map(t => t.id)).toEqual([42])
		expect(kanban.buckets[1].tasks.map(t => t.id)).toEqual([])
	})

	it('is a no-op when the task is not present in any bucket', () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'To-Do'), makeBucket(2, 'Done')])

		const strayTask = makeTask(99, 2)
		kanban.moveTaskToBucket(strayTask, 1)

		expect(kanban.buckets[0].tasks).toEqual([])
		expect(kanban.buckets[1].tasks).toEqual([])
	})

	it('keeps the task where it is when the target bucket is not loaded', () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'To-Do'), makeBucket(2, 'Done')])

		const task = makeTask(42, 1)
		kanban.addTaskToBucket(task)

		expect(() => kanban.moveTaskToBucket(task, 404)).not.toThrow()

		expect(kanban.buckets[0].tasks.map(t => t.id)).toEqual([42])
		expect(task.bucketId).toBe(1)
	})
})

describe('kanban store: updateBucket', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		bucketUpdate.mockReset()
	})

	it('does not touch the board when the update response arrives after the board was replaced', async () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'First'), makeBucket(2, 'Second'), makeBucket(3, 'Third')])

		let respond: (bucket: IBucket) => void = () => {}
		bucketUpdate.mockReturnValue(new Promise<IBucket>(resolve => respond = resolve))

		const updating = kanban.updateBucket({id: 3, title: 'Renamed'})

		// Navigating to another view clears the board while the request is in flight
		kanban.setBuckets([])

		respond(makeBucket(3, 'Renamed'))
		await updating

		expect(kanban.buckets).toEqual([])
	})

	it('does not send an update for a bucket which is not on the board', async () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'First')])

		await kanban.updateBucket({id: 404, title: 'Renamed'})

		expect(bucketUpdate).not.toHaveBeenCalled()
		expect(kanban.buckets).toHaveLength(1)
	})

	it('keeps the loaded tasks when the api returns the bucket without them', async () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'First', [makeTask(42, 1)])])

		bucketUpdate.mockResolvedValue(makeBucket(1, 'Renamed'))

		await kanban.updateBucket({id: 1, title: 'Renamed'})

		expect(kanban.buckets[0].title).toBe('Renamed')
		expect(kanban.buckets[0].tasks.map(t => t.id)).toEqual([42])
	})
})

describe('kanban store: addTaskToBucket', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('does nothing when the bucket is not loaded', () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'To-Do')])

		expect(() => kanban.addTaskToBucket(makeTask(42, 404))).not.toThrow()

		expect(kanban.buckets[0].tasks).toEqual([])
		expect(kanban.buckets).toHaveLength(1)
	})
})


describe('kanban store: saved task placement', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		baseState.currentProject.views = [{id: 1, doneBucketId: 2, defaultBucketId: 3}]
	})

	it.each([
		{done: true, start: 1, defaultBucketId: 3, target: 2},
		{done: false, start: 2, defaultBucketId: 3, target: 3},
		{done: false, start: 2, defaultBucketId: 0, target: 1},
	])('places a saved task with done=$done in bucket $target', ({done, start, defaultBucketId, target}) => {
		baseState.currentProject.views[0].defaultBucketId = defaultBucketId
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'First'), makeBucket(2, 'Done'), makeBucket(3, 'Default')])
		kanban.addTaskToBucket(makeTask(42, start))
		const saved = {...makeTask(42, start), done, title: 'Saved title'}

		kanban.ensureTaskIsInCorrectBucket(saved)

		expect(saved.bucketId).toBe(target)
		expect(kanban.buckets.find(b => b.id === target)?.tasks).toEqual([saved])
		expect(kanban.buckets.find(b => b.id === start)?.tasks).toEqual([])
		expect(kanban.buckets.map(b => b.count)).toEqual([1, 2, 3].map(id => id === target ? 1 : 0))
	})

	it('retains the loaded task when its current view is unavailable', () => {
		baseState.currentProject.views = []
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'First', [makeTask(42, 1)])])
		const loaded = kanban.buckets[0].tasks[0]

		kanban.ensureTaskIsInCorrectBucket({...makeTask(42, 1), done: true})

		expect(kanban.buckets[0].tasks[0]).toBe(loaded)
		expect(kanban.buckets[0].count).toBe(1)
	})

	it('keeps a saved task visible when the done bucket is not loaded', () => {
		const kanban = useKanbanStore()
		kanban.setBuckets([makeBucket(1, 'First', [makeTask(42, 1)])])
		const saved = {...makeTask(42, 1), done: true, title: 'Saved title'}

		kanban.ensureTaskIsInCorrectBucket(saved)

		expect(saved.bucketId).toBe(1)
		expect(kanban.buckets[0].tasks).toEqual([saved])
		expect(kanban.buckets[0].count).toBe(1)
	})
})
