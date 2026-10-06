import AbstractService from './abstractService'
import TaskModel from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'

import {colorFromHex} from '@/helpers/color/colorFromHex'
import {SECONDS_A_DAY, SECONDS_A_HOUR, SECONDS_A_WEEK} from '@/constants/date'
import {objectToSnakeCase} from '@/helpers/case'
import {apiV2Url, AuthenticatedHTTPFactory} from '@/helpers/fetcher'
import {invalidateCachedTask} from '@/helpers/taskCache'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'
import {translatedError} from '@/shared/notifications'

// Mirrors models.MaxTasksPerBulkCreation on the backend.
const MAX_TASKS_PER_BULK_CREATION = 100

/**
 * Tasks reaching processModel did not necessarily go through the TaskModel
 * constructor - related tasks nested in a task are plain api objects - so
 * repeatAfter is either the parsed object, raw seconds, or missing entirely.
 */
function repeatAfterToSeconds(repeatAfter: ITask['repeatAfter'] | undefined): number {
	if (typeof repeatAfter === 'number') {
		return repeatAfter
	}

	if (!repeatAfter?.amount) {
		return 0
	}

	switch (repeatAfter.type) {
		case 'hours':
			return repeatAfter.amount * SECONDS_A_HOUR
		case 'days':
			return repeatAfter.amount * SECONDS_A_DAY
		case 'weeks':
			return repeatAfter.amount * SECONDS_A_WEEK
		default:
			return 0
	}
}

export interface TaskWire extends Record<string, unknown> {
 assignees: {id: number, username: string}[]
 reminders: {reminder: string | null, relative_period: number, relative_to: string | null}[]
}

export default class TaskService extends AbstractService<ITask> {
	constructor() {
		super({
			create: '/projects/{projectId}/tasks',
			getAll: '/tasks',
			get: '/tasks/{id}',
			update: '/tasks/{id}',
			delete: '/tasks/{id}',
		})
	}

	modelFactory(data: ConstructorParameters<typeof TaskModel>[0]) {
		return new TaskModel(data)
	}

	beforeUpdate(model: ITask) {
		return this.processModel(model)
	}

	beforeCreate(model: ITask) {
		return this.processModel(model)
	}

	autoTransformBeforePost(): boolean {
		return false
	}

	async update(model: ITask, signal?: AbortSignal) {
		const updated = await super.update(model, signal)
		signal?.throwIfAborted()
		invalidateCachedTask(model.id)
		return updated
	}

	async delete(model: ITask, signal?:AbortSignal) {
		const response = await super.delete(model,signal)
		invalidateCachedTask(model.id)
		return response
	}

	processModel(updatedModel: ITask): TaskWire {
		const model = {
			...updatedModel,
			title: updatedModel.title?.trim(),
			projectId: Number(updatedModel.projectId),
			dueDate: toISOStringOrNull(updatedModel.dueDate),
			startDate: toISOStringOrNull(updatedModel.startDate),
			endDate: toISOStringOrNull(updatedModel.endDate),
			doneAt: toISOStringOrNull(updatedModel.doneAt),
			deletedAt: toISOStringOrNull(updatedModel.deletedAt),
			created: toISOStringOrNull(updatedModel.created),
			updated: toISOStringOrNull(updatedModel.updated),
			reminderDates: null,
			reminders: (updatedModel.reminders ?? []).filter(reminder => reminder !== null).map(reminder => ({...reminder, reminder: toISOStringOrNull(reminder.reminder)})),
			repeatAfter: repeatAfterToSeconds(updatedModel.repeatAfter),
			hexColor: colorFromHex(updatedModel.hexColor ?? ''),
			relatedTasks: Object.fromEntries(Object.entries<ITask[]>(updatedModel.relatedTasks ?? {}).map(([kind, tasks]) => [kind, tasks.map(task => this.processModel(task))])),
		}
		const transformed = objectToSnakeCase(model)
		transformed.reactions = Object.fromEntries(Object.entries(updatedModel.reactions ?? {}).map(([reaction, users]) => [reaction, users.map(user => objectToSnakeCase(user))]))
		return {
			...transformed,
			assignees: (updatedModel.assignees ?? []).map(user => ({...objectToSnakeCase(user), id: user.id, username: user.username})),
			reminders: model.reminders.map(reminder => ({...objectToSnakeCase(reminder), reminder: reminder.reminder, relative_period: reminder.relativePeriod, relative_to: reminder.relativeTo})),
		}
	}

	// The v2 endpoint validates strictly against the task schema and rejects the
	// frontend-only properties (max_permission, reminder_dates, …) processModel
	// adds, hence the allowlist.
	private toBulkCreatePayload(task: ITask) {
		const processed = this.processModel(task)
		return {
			title: processed.title,
			description: processed.description,
			done: processed.done,
			due_date: processed.due_date,
			start_date: processed.start_date,
			end_date: processed.end_date,
			priority: processed.priority,
			hex_color: processed.hex_color,
			percent_done: processed.percent_done,
			repeat_after: processed.repeat_after,
			repeat_mode: processed.repeat_mode,
			is_favorite: processed.is_favorite,
			bucket_id: processed.bucket_id,
			assignees: processed.assignees.map(a => ({
				id: a.id,
				username: a.username,
			})),
			reminders: processed.reminders.map(r => ({
				reminder: r.reminder,
				relative_period: r.relative_period,
				relative_to: r.relative_to,
			})),
		}
	}

	// Returns tasks aligned 1:1 with the input (null = not created). Grouped per
	// project because the endpoint takes the project from the URL.
	async bulkCreate(tasks: ITask[], signal?: AbortSignal): Promise<{tasks: (ITask | null)[], error: unknown | null}> {
		const cancel = this.setLoading()

		try {
			const groups = new Map<ITask['projectId'], number[]>()
			tasks.forEach((task, index) => {
				const group = groups.get(task.projectId)
				if (group) {
					group.push(index)
				} else {
					groups.set(task.projectId, [index])
				}
			})

			const created: (ITask | null)[] = new Array(tasks.length).fill(null)
			let error: unknown | null = null
			// Sequential throughout: the server assigns task indexes at insert time,
			// and concurrent bulk writes fail under write contention (SQLite).
			for (const [projectId, indexes] of groups) {
				const batches: number[][] = []
				for (let i = 0; i < indexes.length; i += MAX_TASKS_PER_BULK_CREATION) {
					batches.push(indexes.slice(i, i + MAX_TASKS_PER_BULK_CREATION))
				}

				// Last chunk first: the server puts each batch on top in every view, so
				// posting in reverse leaves the earliest input lines topmost. Tradeoff:
				// per-project index numbers then run backwards across batches.
				for (const batch of batches.reverse()) {
					signal?.throwIfAborted()
					try {
						// Fresh http instance: the shared one's interceptors would run
						// processModel on the {tasks} wrapper.
						const {data} = await AuthenticatedHTTPFactory().post(
							apiV2Url(`projects/${Number(projectId)}/tasks/bulk`),
							{tasks: batch.map(index => this.toBulkCreatePayload(tasks[index]))},
							{signal},
						)
						signal?.throwIfAborted()
						if (!Array.isArray(data?.tasks) || data.tasks.length !== batch.length) {
							throw translatedError('task.bulkCreateUnexpectedResponse')
						}
						// The response is in payload order. Don't match by title — quick
						// add magic cleans titles and duplicates would collide.
						data.tasks.forEach((t: Partial<ITask>, batchIndex: number) => {
							created[batch[batchIndex]] = this.modelCreateFactory(t)
						})
					} catch (e) {
						signal?.throwIfAborted()
						// Keep what other batches created so the caller can retry only
						// the missing tasks instead of duplicating everything.
						error ??= e
						break
					}
				}
			}

			return {tasks: created, error}
		} finally {
			cancel()
		}
	}

	async markTaskAsRead(taskId: ITask['id']): Promise<void> {
		const cancel = this.setLoading()
	
		try {
			await AuthenticatedHTTPFactory().post(`/tasks/${taskId}/read`, {} as ITask)
		} finally {
			cancel()
		}
	}
}
