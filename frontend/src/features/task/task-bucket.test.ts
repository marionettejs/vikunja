import {afterEach, expect, it, vi} from 'vitest'
import TaskModel from '@/models/task'
import ProjectModel from '@/models/project'
import ProjectViewModel from '@/models/projectView'
import BucketModel from '@/models/bucket'
import TaskBucketModel from '@/models/taskBucket'
import type {ITaskBucket} from '@/modelTypes/ITaskBucket'
import {TaskRecordSession} from './task-record'
import {TaskBucketView} from './task-bucket'
let view: InstanceType<typeof TaskBucketView> | undefined, record: TaskRecordSession
const manual = new ProjectViewModel({id: 4, projectId: 1, viewKind: 'kanban', bucketConfigurationMode: 'manual'})
afterEach(() => {view?.destroy(); record.close()})
function setup() {
	record = new TaskRecordSession(new TaskModel({id: 1, projectId: 1, maxPermission: 2, title: 'Original', buckets: [new BucketModel({id: 1, projectViewId: 4}), new BucketModel({id: 9, projectViewId: 5})]}), vi.fn())
	let project = new ProjectModel({id: 1, views: [manual]}), active = 0, resolve!: (value: ITaskBucket) => void, signal!: AbortSignal
	const move = vi.fn((_bucket, request: AbortSignal) => {signal = request; return new Promise<ITaskBucket>(done => {resolve = done})})
	view = new TaskBucketView({record, project: () => project, activeView: () => active, t: key => key, reportError: vi.fn(), success: vi.fn(), load: async () => [], move}).render(); view.updateInputs()
	return {move, signal: () => signal, resolve: (value: ITaskBucket) => resolve(value), project: (value: ProjectModel) => {project = value}, active: (value: number) => {active = value}}
}
it('chooses the only manual view, or the active manual view when more than one exists', () => {
	const state = setup(); expect(view!.getState().view?.id).toBe(4)
	state.project(new ProjectModel({id: 1, views: [manual, new ProjectViewModel({...manual, id: 5})]})); view!.updateInputs(); expect(view!.getState().view).toBeUndefined()
	state.active(5); view!.updateInputs(); expect(view!.getState().view?.id).toBe(5)
})
it('merges bucket and completion effects without losing independent task fields or other view memberships', async () => {
	const state = setup(), target = new BucketModel({id: 2, projectViewId: 4, title: 'Doing'}), pending = view!.select(target)
	await view!.select(target); expect(state.move).toHaveBeenCalledTimes(1)
	record.acceptFields({description: 'Independent draft accepted', title: 'Later title'})
	state.resolve(new TaskBucketModel({task: new TaskModel({done: true, doneAt: new Date('2026-01-01')}), bucketId: 2})); await pending
	expect(record.task.title).toBe('Later title'); expect(record.task.description).toBe('Independent draft accepted'); expect(record.task.maxPermission).toBe(2); expect(record.task.done).toBe(true); expect(record.task.buckets.map(bucket => bucket.id)).toEqual([9, 2])
})
it('cancels a move on project change and rejects a response from the previous selector', async () => {
	const state = setup(), pending = view!.select(new BucketModel({id: 2, projectViewId: 4}))
	record.acceptFields({projectId: 2}); state.project(new ProjectModel({id: 2, views: []})); view!.updateInputs(); expect(state.signal().aborted).toBe(true)
	state.resolve(new TaskBucketModel({task: new TaskModel({done: true})})); await pending; expect(record.task.bucketId).toBe(0); expect(record.task.done).toBe(false)
})
it('permission loss and destruction abort pending moves without publication', async () => {
	const state = setup(), pending = view!.select(new BucketModel({id: 2, projectViewId: 4}))
	record.acceptFields({maxPermission: 0}); view!.updateInputs(); expect(state.signal().aborted).toBe(true)
	view!.destroy(); state.resolve(new TaskBucketModel({task: new TaskModel({done: true})})); await pending; expect(record.task.done).toBe(false)
})
