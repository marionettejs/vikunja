import type {Extensions} from '@tiptap/core'
import type {ViewInstance} from 'marionette'
import type {TaskRecord} from '../data/TaskRecords'
import {PERMISSIONS} from '@/constants/permissions'
import type {TaskWorkspace} from '../data/TaskWorkspace'
import {TaskHeadingView, type TaskHeadingViewInstance, type TaskHeadingViewLabels} from './TaskHeadingView'
import {TaskDescriptionView, type TaskDescriptionViewInstance, type TaskDescriptionViewLabels} from './TaskDescriptionView'
import TaskDetailLayoutView from './TaskDetailLayoutView'

export interface CreateTaskDetailScreenLabels {
	heading: TaskHeadingViewLabels
	description: TaskDescriptionViewLabels
	back: string
}

export interface CreateTaskDetailScreenOptions {
	record: TaskRecord
	workspace: TaskWorkspace
	extensions: Extensions
	isModal: boolean
	labels: CreateTaskDetailScreenLabels
	t: (key: string) => string
	taskUrl: string
	taskIdentifier: string
	onCopy: (taskUrl: string, taskIdentifier: string) => void | Promise<void>
	onBack: () => void
	onClose?: () => void
}

export interface TaskDetailScreen {
	view: ViewInstance
	heading: TaskHeadingViewInstance
	description: TaskDescriptionViewInstance
	saveBeforeLeave: () => Promise<void>
}

export function createTaskDetailScreen(options: CreateTaskDetailScreenOptions): TaskDetailScreen {
	const taskId = Number(options.record.get('id'))
	const maxPermission = options.record.get('maxPermission')
	const canWrite = maxPermission === PERMISSIONS.READ_WRITE || maxPermission === PERMISSIONS.ADMIN

	const heading = new TaskHeadingView({
		model: options.record,
		canWrite,
		hasClose: !!options.onClose,
		labels: options.labels.heading,
		taskUrl: options.taskUrl,
		taskIdentifier: options.taskIdentifier,
		onCopy: options.onCopy,
		onCommit: async (title: string) => {
			await options.workspace.update(taskId, {title})
		},
		onClose: options.onClose,
	})

	const description = new TaskDescriptionView({
		model: options.record,
		extensions: options.extensions,
		canWrite,
		labels: options.labels.description,
		t: options.t,
		onCommit: async (description: string) => {
			await options.workspace.update(taskId, {description})
		},
	})

	const view = new TaskDetailLayoutView({
		isModal: options.isModal,
		labels: {
			back: options.labels.back,
			description: options.labels.description.description,
		},
		onBack: options.onBack,
		children: {
			heading,
			description,
		},
	})

	return {
		view,
		heading,
		description,
		saveBeforeLeave: async () => {
			do {
				await heading.save()
				await description.save()
			} while (!view.isDestroyed() && (heading.hasUnsavedChanges() || description.hasUnsavedChanges()))
		},
	}
}
