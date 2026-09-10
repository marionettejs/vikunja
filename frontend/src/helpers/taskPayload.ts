import type {ITask} from '@/modelTypes/ITask'

import {colorFromHex} from '@/helpers/color/colorFromHex'
import {SECONDS_A_DAY, SECONDS_A_HOUR, SECONDS_A_WEEK} from '@/constants/date'
import {objectToSnakeCase} from '@/helpers/case'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'

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

export function serializeTask(updatedModel: ITask) {
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
	}

	model.title = model.title?.trim()

	// Ensure that projectId is an int
	model.projectId = Number(model.projectId)

	// remove all nulls, these would create empty reminders
	model.reminders = (model.reminders ?? []).filter(r => r !== null)
	// Make normal timestamps from js dates
	if (model.reminders.length > 0) {
		model.reminders.forEach(r => {
			Object.assign(r, {reminder: toISOStringOrNull(r.reminder)})
		})
	}

	model.repeatAfter = repeatAfterToSeconds(model.repeatAfter)

	model.hexColor = colorFromHex(model.hexColor ?? '')

	// Do the same for all related tasks. `model` is only a shallow copy, so this
	// has to build a new object - assigning into relatedTasks would replace the
	// related tasks of the task we were passed with their api representation.
	model.relatedTasks = Object.fromEntries(
		Object.entries<ITask[]>(model.relatedTasks ?? {})
			.map(([relationKind, tasks]) => [relationKind, tasks.map(t => serializeTask(t))]),
	)

	const transformed = objectToSnakeCase(model)

	// We can't convert emojis to skane case, hence we add them back again
	transformed.reactions = {}
	Object.keys(updatedModel.reactions || {}).forEach(reaction => {
		transformed.reactions[reaction] = updatedModel.reactions[reaction].map(u => objectToSnakeCase(u))
	})

	return transformed
}
