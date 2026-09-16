import type {ITask} from '@/modelTypes/ITask'
import type {IRelationKind} from '@/types/IRelationKind'
import type {IUser} from '@/modelTypes/IUser'

import {colorFromHex} from '@/helpers/color/colorFromHex'
import {SECONDS_A_DAY, SECONDS_A_HOUR, SECONDS_A_WEEK} from '@/constants/date'
import {objectToSnakeCase} from '@/helpers/case'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'

type NullableTaskField = 'created' | 'updated' | 'assignees' | 'attachments' | 'buckets' | 'comments' | 'labels' | 'reminders'

// API null values are retained by native records; existing ITask callers remain valid.
type SerializableTask = Partial<Omit<ITask, NullableTaskField | 'relatedTasks' | 'reactions'> & {
	[K in NullableTaskField]: ITask[K] | null
} & {
	relatedTasks: Partial<Record<IRelationKind, SerializableTask[] | null>>
	reactions: { [reaction: string]: IUser[] | null }
}>

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

export function serializeTask(updatedModel: SerializableTask) {
	const model = {
		...updatedModel,
		dueDate: toISOStringOrNull(updatedModel.dueDate),
		startDate: toISOStringOrNull(updatedModel.startDate),
		endDate: toISOStringOrNull(updatedModel.endDate),
		doneAt: toISOStringOrNull(updatedModel.doneAt),
		deletedAt: toISOStringOrNull(updatedModel.deletedAt),
		created: toISOStringOrNull(updatedModel.created),
		updated: toISOStringOrNull(updatedModel.updated),
		reminderDates: null,
		reminders: (updatedModel.reminders ?? []).filter(r => r !== null).map(r => ({
			...r,
			reminder: toISOStringOrNull(r.reminder),
		})),
	}

	model.title = model.title?.trim()

	// Ensure that projectId is an int
	model.projectId = Number(model.projectId)

	model.repeatAfter = repeatAfterToSeconds(model.repeatAfter)

	model.hexColor = colorFromHex(model.hexColor ?? '')

	const transformed = objectToSnakeCase({...model, relatedTasks: {}, reactions: {}})

	// Serialize children after key conversion so their emoji reaction keys stay intact.
	transformed.related_tasks = Object.fromEntries(
		Object.entries(updatedModel.relatedTasks ?? {}).map(([kind, tasks]) => [
			kind,
			tasks === null ? null : tasks.map(task => serializeTask(task)),
		]),
	)

	// We can't convert emojis to snake case, hence we add them back again.
	transformed.reactions = {}
	Object.entries(updatedModel.reactions ?? {}).forEach(([reaction, users]) => {
		transformed.reactions[reaction] = users === null ? null : users.map(u => objectToSnakeCase(u))
	})

	return transformed
}
