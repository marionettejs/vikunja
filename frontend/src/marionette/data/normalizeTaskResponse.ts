import {camelCase} from 'change-case'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {parseRepeatAfter} from '@/models/task'
import type {TaskPatch} from './TaskRecords'

// Only top-level keys are renamed. objectToCamelCase recurses and rebuilds nested
// arrays and objects, which would hand Model.set a fresh reference on every ingest
// and report a change that did not happen.
export function normalizeTaskResponse(raw: Record<string, unknown>): TaskPatch {
	const camel: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		camel[camelCase(key)] = raw[key]
	}

	if (!Object.prototype.hasOwnProperty.call(camel, 'id')) {
		throw new Error('Missing required field: id')
	}

	const idNum = Number(camel.id)
	if (!Number.isFinite(idNum)) {
		throw new Error('Field id must be a finite number')
	}

	const result: Record<string, unknown> = {}

	for (const key of Object.keys(camel)) {
		const value = camel[key]

		switch (key) {
			case 'id':
				result.id = idNum
				break
			case 'projectId':
				result.projectId = Number(value)
				break
			case 'title':
				result.title = typeof value === 'string' ? value.trim() : value
				break
			case 'doneAt':
			case 'deletedAt':
			case 'dueDate':
			case 'startDate':
			case 'endDate':
			case 'created':
			case 'updated':
				result[key] = parseDateOrNull(value as Date | string | null | undefined)
				break
			case 'repeatAfter':
				result.repeatAfter = typeof value === 'number' ? parseRepeatAfter(value) : value
				break
			case 'hexColor':
				result.hexColor = typeof value === 'string' && value.length > 0 && !value.startsWith('#')
					? `#${value}`
					: value
				break
			case 'identifier':
				if (
					Object.prototype.hasOwnProperty.call(camel, 'index') &&
					value === `-${camel.index}`
				) {
					result.identifier = ''
				} else {
					result.identifier = value
				}
				break
			default:
				result[key] = value
				break
		}
	}

	return result as TaskPatch
}
