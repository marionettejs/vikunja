import type { IBucket } from '@/modelTypes/IBucket'
import type { IProjectView } from '@/modelTypes/IProjectView'
import type { ITask } from '@/modelTypes/ITask'
import { findIndexById } from '@/helpers/utils'

export function getTaskIndicesById(buckets: IBucket[], taskId: ITask['id']) {
	let taskIndex
	const bucketIndex = buckets.findIndex(({tasks}) => {
		taskIndex = findIndexById(tasks, taskId)
		return taskIndex !== -1
	})

	return {
		bucketIndex: bucketIndex !== -1 ? bucketIndex : null,
		taskIndex: taskIndex !== -1 ? taskIndex : null,
	}
}

export function setTaskInBucketByIndex(
	buckets: IBucket[],
	{
		bucketIndex,
		taskIndex,
		task,
	}: {
		bucketIndex: number
		taskIndex: number
		task: ITask
	},
) {
	const bucket = buckets[bucketIndex]
	bucket.tasks[taskIndex] = task
	buckets[bucketIndex] = bucket
}

export function setTaskInBucket(buckets: IBucket[], task: ITask) {
	// If this gets invoked without any tasks actually loaded, we can save the hassle of finding the task
	if (buckets.length === 0) {
		return
	}

	let found = false

	const findAndUpdate = (b: number) => {
		for (const [t, taskInBucket] of buckets[b].tasks.entries()) {
			if (taskInBucket.id === task.id) {
				const bucket = buckets[b]
				bucket.tasks[t] = task

				buckets[b] = bucket

				found = true
				return
			}
		}
	}

	for (let b = 0; b < buckets.length; b++) {
		findAndUpdate(b)
		if (found) {
			return
		}
	}
}

function getDefaultBucketId(buckets: IBucket[], view: IProjectView): IBucket['id'] {
	if (view.defaultBucketId) {
		return view.defaultBucketId
	}

	return buckets[0]?.id
}

export function ensureTaskIsInCorrectBucket(buckets: IBucket[], task: ITask, currentView: IProjectView | undefined) {
	if (buckets.length === 0) {
		return
	}

	const {bucketIndex} = getTaskIndicesById(buckets, task.id)
	if (bucketIndex === null) return
	const currentTaskBucket = buckets[bucketIndex]

	if(typeof currentView === 'undefined') return

	// If the task is done, make sure it is in the done bucket
	if (task.done && currentView.doneBucketId !== 0 && currentTaskBucket.id !== currentView.doneBucketId) {
		moveTaskToBucket(buckets, task, currentView.doneBucketId)
	}

	// If the task is not done but was in the done bucket before, move it to the default bucket
	if(!task.done && currentView.doneBucketId !== 0 && currentTaskBucket.id === currentView.doneBucketId) {
		const defaultBucketId = getDefaultBucketId(buckets, currentView)
		moveTaskToBucket(buckets, task, defaultBucketId)
	}

	setTaskInBucket(buckets, task)
}

export function moveTaskToBucket(buckets: IBucket[], task: ITask, bucketId: IBucket['id']) {
	const {bucketIndex} = getTaskIndicesById(buckets, task.id)
	if (bucketIndex === null) return
	const currentTaskBucket = buckets[bucketIndex]
	if (typeof currentTaskBucket === 'undefined' || currentTaskBucket.id === bucketId) {
		return
	}
	// The target bucket can belong to a kanban view other than the loaded one (the task detail
	// view lets users move tasks between buckets of any view). Removing the task here would drop
	// it from the board with no bucket to put it back into.
	if (findIndexById(buckets, bucketId) === -1) {
		return
	}
	removeTaskInBucket(buckets, task)
	task.bucketId = bucketId
	addTaskToBucket(buckets, task)
}

export function addTaskToBucket(buckets: IBucket[], task: ITask) {
	const bucketIndex = findIndexById(buckets, task.bucketId)
	const oldBucket = buckets[bucketIndex]
	if (typeof oldBucket === 'undefined') {
		return
	}
	const newBucket = {
		...oldBucket,
		count: (oldBucket.count || 0) + 1,
		tasks: [
			task,
			...oldBucket.tasks,
		],
	}
	buckets[bucketIndex] = newBucket
}

export function removeTaskInBucket(buckets: IBucket[], task: ITask) {
	// If this gets invoked without any tasks actually loaded, we can save the hassle of finding the task
	if (buckets.length === 0) {
		return
	}

	const {bucketIndex, taskIndex} = getTaskIndicesById(buckets, task.id)

	if (
		bucketIndex === null ||
		taskIndex === null ||
		(buckets[bucketIndex]?.tasks[taskIndex]?.id !== task.id)
	) {
		return
	}

	buckets[bucketIndex].tasks.splice(taskIndex, 1)
	buckets[bucketIndex].count--
}
