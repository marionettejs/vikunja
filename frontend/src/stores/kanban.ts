import {computed, readonly, ref} from 'vue'
import {acceptHMRUpdate, defineStore} from 'pinia'
import {klona} from 'klona/lite'

import {findById, findIndexById} from '@/helpers/utils'
import {
	getTaskIndicesById,
	setTaskInBucketByIndex as setTaskInBucketByIndexInState,
	setTaskInBucket as setTaskInBucketInState,
	ensureTaskIsInCorrectBucket as ensureTaskIsInCorrectBucketInState,
	moveTaskToBucket as moveTaskToBucketInState,
	addTaskToBucket as addTaskToBucketInState,
	removeTaskInBucket as removeTaskInBucketInState,
} from '@/helpers/kanbanTransitions'

import BucketService from '@/services/bucket'
import TaskCollectionService, {type TaskFilterParams} from '@/services/taskCollection'

import {setModuleLoading} from '@/stores/helper'

import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'
import type {IBucket} from '@/modelTypes/IBucket'
import {useAuthStore} from '@/stores/auth'
import type {IProjectView} from '@/modelTypes/IProjectView'
import {useBaseStore} from '@/stores/base'
import {useProjectStore} from '@/stores/projects'

const TASKS_PER_BUCKET = 25

/**
 * This store is intended to hold the currently active kanban view.
 * It should hold only the current buckets.
 */
export const useKanbanStore = defineStore('kanban', () => {
	const authStore = useAuthStore()
	const baseStore = useBaseStore()
	const projectStore = useProjectStore()

	const buckets = ref<IBucket[]>([])
	const projectId = ref<IProject['id']>(0)
	const bucketLoading = ref<{ [id: IBucket['id']]: boolean }>({})
	const taskPagesPerBucket = ref<{ [id: IBucket['id']]: number }>({})
	const allTasksLoadedForBucket = ref<{ [id: IBucket['id']]: boolean }>({})
	const isLoading = ref(false)

	const getBucketById = computed(() => (bucketId: IBucket['id']): IBucket | undefined => findById(buckets.value, bucketId))
	const getTaskById = computed(() => {
		return (id: ITask['id']) => {
			const {bucketIndex, taskIndex} = getTaskIndicesById(buckets.value, id)

			return {
				bucketIndex,
				taskIndex,
				task: bucketIndex !== null && taskIndex !== null && buckets.value[bucketIndex]?.tasks?.[taskIndex] || null,
			}
		}
	})

	function setIsLoading(newIsLoading: boolean) {
		isLoading.value = newIsLoading
	}

	function setProjectId(newProjectId: IProject['id']) {
		projectId.value = Number(newProjectId)
	}

	function setBuckets(newBuckets: IBucket[]) {
		buckets.value = newBuckets
		newBuckets.forEach(b => {
			taskPagesPerBucket.value[b.id] = 1
			allTasksLoadedForBucket.value[b.id] = false
		})
	}

	function addBucket(bucket: IBucket) {
		buckets.value.push(bucket)
	}

	function removeBucket(newBucket: IBucket) {
		const bucketIndex = findIndexById(buckets.value, newBucket.id)
		buckets.value.splice(bucketIndex, 1)
	}

	function setBucketById(newBucket: IBucket, setTasks: boolean = true) {
		const bucketIndex = findIndexById(buckets.value, newBucket.id)
		if (bucketIndex === -1) {
			return
		}

		if (!setTasks) {
			newBucket.tasks = [
				...buckets.value[bucketIndex].tasks,
			]
		}
		buckets.value[bucketIndex] = newBucket
	}

	function setTaskInBucketByIndex({
		bucketIndex,
		taskIndex,
		task,
	}: {
		bucketIndex: number
		taskIndex: number
		task: ITask
	}) {
		setTaskInBucketByIndexInState(buckets.value, {
			bucketIndex,
			taskIndex,
			task,
		})
	}

	function setTaskInBucket(task: ITask) {
		setTaskInBucketInState(buckets.value, task)
	}

	function ensureTaskIsInCorrectBucket(task: ITask) {
		const currentView: IProjectView | undefined = baseStore.currentProject?.views?.find(v => v.id === baseStore.currentProjectViewId)
		ensureTaskIsInCorrectBucketInState(buckets.value, task, currentView)
	}
	
	function moveTaskToBucket(task: ITask, bucketId: IBucket['id']) {
		moveTaskToBucketInState(buckets.value, task, bucketId)
	}

	function addTaskToBucket(task: ITask) {
		addTaskToBucketInState(buckets.value, task)
	}

	function addTasksToBucket(tasks: ITask[], bucketId: IBucket['id']) {
		const bucketIndex = findIndexById(buckets.value, bucketId)
		const oldBucket = buckets.value[bucketIndex]
		if (typeof oldBucket === 'undefined') {
			return
		}
		const newBucket = {
			...oldBucket,
			tasks: [
				...oldBucket.tasks,
				...tasks,
			],
		}
		buckets.value[bucketIndex] = newBucket
	}

	function removeTaskInBucket(task: ITask) {
		removeTaskInBucketInState(buckets.value, task)
	}

	function setBucketLoading({bucketId, loading}: { bucketId: IBucket['id'], loading: boolean }) {
		bucketLoading.value[bucketId] = loading
	}

	function setTasksLoadedForBucketPage({bucketId, page}: { bucketId: IBucket['id'], page: number }) {
		taskPagesPerBucket.value[bucketId] = page
	}

	function setAllTasksLoadedForBucket(bucketId: IBucket['id']) {
		allTasksLoadedForBucket.value[bucketId] = true
	}

	async function loadBucketsForProject(projectId: IProject['id'], viewId: IProjectView['id'], params) {
		const cancel = setModuleLoading(setIsLoading)

		// Clear everything to prevent having old buckets in the project if loading the buckets from this project takes a few moments
		setBuckets([])

		const taskCollectionService = new TaskCollectionService()
		try {
			const newBuckets = await taskCollectionService.getAll({projectId, viewId}, {
				...params,
				expand: ['comment_count', 'is_unread'],
				per_page: TASKS_PER_BUCKET,
			})
			setBuckets(newBuckets)
			setProjectId(projectId)
			return newBuckets
		} finally {
			cancel()
		}
	}

	async function loadNextTasksForBucket(
		projectId: IProject['id'],
		viewId: IProjectView['id'],
		ps: TaskFilterParams,
		bucketId: IBucket['id'],
	) {
		const isLoading = bucketLoading.value[bucketId] ?? false
		if (isLoading) {
			return
		}

		const page = (taskPagesPerBucket.value[bucketId] ?? 1) + 1

		const alreadyLoaded = allTasksLoadedForBucket.value[bucketId] ?? false
		if (alreadyLoaded) {
			return
		}

		const cancel = setModuleLoading(setIsLoading)
		setBucketLoading({bucketId: bucketId, loading: true})

		const params: TaskFilterParams = JSON.parse(JSON.stringify(ps))

		params.sort_by = ['position']
		params.order_by = ['asc']
		params.filter = `${params.filter === '' ? '' : params.filter + ' && '}bucket_id = ${bucketId}`
		params.filter_timezone = authStore.settings.timezone
		params.per_page = TASKS_PER_BUCKET
		params.expand = ['comment_count', 'is_unread']

		const taskService = new TaskCollectionService()
		try {
			const tasks = await taskService.getAll({projectId, viewId}, params, page)
			addTasksToBucket(tasks, bucketId)
			setTasksLoadedForBucketPage({bucketId, page})
			if (taskService.totalPages <= page) {
				setAllTasksLoadedForBucket(bucketId)
			}
			return tasks
		} finally {
			cancel()
			setBucketLoading({bucketId, loading: false})
		}
	}

	async function createBucket(bucket: IBucket) {
		const cancel = setModuleLoading(setIsLoading)

		const bucketService = new BucketService()
		try {
			const createdBucket = await bucketService.create(bucket)
			addBucket(createdBucket)
			return createdBucket
		} finally {
			cancel()
		}
	}

	async function deleteBucket({bucket, params}: { bucket: IBucket, params }) {
		const cancel = setModuleLoading(setIsLoading)

		const bucketService = new BucketService()
		try {
			const response = await bucketService.delete(bucket)
			removeBucket(bucket)

			// Mirrors Bucket.Delete on the server, which zeroes these when they pointed at the deleted bucket.
			const view = projectStore.projects[bucket.projectId]?.views?.find(v => v.id === bucket.projectViewId)
			if (view && (view.defaultBucketId === bucket.id || view.doneBucketId === bucket.id)) {
				projectStore.setProjectView({
					...view,
					defaultBucketId: view.defaultBucketId === bucket.id ? 0 : view.defaultBucketId,
					doneBucketId: view.doneBucketId === bucket.id ? 0 : view.doneBucketId,
				} as IProjectView)
			}

			// We reload all buckets because tasks are being moved from the deleted bucket
			loadBucketsForProject(bucket.projectId, bucket.projectViewId, params)
			return response
		} finally {
			cancel()
		}
	}

	async function updateBucket(updatedBucketData: Partial<IBucket>) {
		const bucket = findById(buckets.value, updatedBucketData.id)
		if (typeof bucket === 'undefined') {
			return
		}

		const cancel = setModuleLoading(setIsLoading)

		const oldBucket = klona(bucket)
		const updatedBucket = {
			...oldBucket,
			...updatedBucketData,
		}

		setBucketById(updatedBucket)

		const bucketService = new BucketService()
		try {
			// The board can be replaced while the request is in flight, for example when navigating to
			// another view. All writes go by id so the response never lands in another view's buckets.
			const returnedBucket = await bucketService.update(updatedBucket)
			setBucketById(returnedBucket, false)
			return returnedBucket
		} catch (e) {
			// restore original state
			setBucketById(oldBucket)

			throw e
		} finally {
			cancel()
		}
	}

	return {
		buckets,
		isLoading: readonly(isLoading),

		getBucketById,
		getTaskById,

		setBuckets,
		setBucketById,
		setTaskInBucketByIndex,
		setTaskInBucket,
		addTaskToBucket,
		removeTaskInBucket,
		moveTaskToBucket,
		loadBucketsForProject,
		loadNextTasksForBucket,
		createBucket,
		deleteBucket,
		updateBucket,
		ensureTaskIsInCorrectBucket,
	}
})

// support hot reloading
if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useKanbanStore, import.meta.hot))
}
