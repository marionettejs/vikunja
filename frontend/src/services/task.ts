import AbstractService from './abstractService'
import TaskModel from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'

import {apiV2Url, AuthenticatedHTTPFactory} from '@/helpers/fetcher'
import {invalidateCachedTask} from '@/helpers/taskCache'
import {serializeTask} from '@/helpers/taskPayload'
import {translatedError} from '@/message'

// Mirrors models.MaxTasksPerBulkCreation on the backend.
const MAX_TASKS_PER_BULK_CREATION = 100

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

	modelFactory(data) {
		return new TaskModel(data)
	}

	beforeUpdate(model) {
		return this.processModel(model)
	}

	beforeCreate(model) {
		return this.processModel(model)
	}

	autoTransformBeforePost(): boolean {
		return false
	}

	async update(model: ITask) {
		const updated = await super.update(model)
		invalidateCachedTask(model.id)
		return updated
	}

	async delete(model: ITask) {
		const response = await super.delete(model)
		invalidateCachedTask(model.id)
		return response
	}

	processModel(updatedModel) {
		return serializeTask(updatedModel) as ITask
	}

	// The v2 endpoint validates strictly against the task schema and rejects the
	// frontend-only properties (max_permission, reminder_dates, …) processModel
	// adds, hence the allowlist.
	private toBulkCreatePayload(task: ITask) {
		// processModel lies about its return type — it returns the snake_cased
		// wire format, not an ITask.
		const processed = this.processModel(task) as unknown as {
			assignees: {id: number, username: string}[],
			reminders: {reminder: string | null, relative_period: number, relative_to: string | null}[],
		} & Record<string, unknown>
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
	async bulkCreate(tasks: ITask[]): Promise<{tasks: (ITask | null)[], error: unknown | null}> {
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
				for (let i = 0; i < indexes.length; i += MAX_TASKS_PER_BULK_CREATION)
				{
					batches.push(indexes.slice(i, i + MAX_TASKS_PER_BULK_CREATION))
				}

				// Last chunk first: the server puts each batch on top in every view, so
				// posting in reverse leaves the earliest input lines topmost. Tradeoff:
				// per-project index numbers then run backwards across batches.
				for (const batch of batches.reverse()) {
					try {
						// Fresh http instance: the shared one's interceptors would run
						// processModel on the {tasks} wrapper.
						const {data} = await AuthenticatedHTTPFactory().post(
							apiV2Url(`projects/${Number(projectId)}/tasks/bulk`),
							{tasks: batch.map(index => this.toBulkCreatePayload(tasks[index]))},
						)
						if (!Array.isArray(data?.tasks) || data.tasks.length !== batch.length) {
							throw translatedError('task.bulkCreateUnexpectedResponse')
						}
						// The response is in payload order. Don't match by title — quick
						// add magic cleans titles and duplicates would collide.
						data.tasks.forEach((t: Partial<ITask>, batchIndex: number) => {
							created[batch[batchIndex]] = this.modelCreateFactory(t)
						})
					} catch (e) {
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
