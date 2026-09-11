import type {TaskPatch} from './TaskRecords'

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Date)
}

function deepEquals(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) {
		return true
	}
	if (a === null || a === undefined || b === null || b === undefined) {
		return false
	}
	if (a instanceof Date || b instanceof Date) {
		if (a instanceof Date && b instanceof Date) {
			return a.getTime() === b.getTime()
		}
		return false
	}
	if (Array.isArray(a) || Array.isArray(b)) {
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) {
				return false
			}
			for (let i = 0; i < a.length; i++) {
				if (!deepEquals(a[i], b[i])) {
					return false
				}
			}
			return true
		}
		return false
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const aKeys = Object.keys(a)
		const bKeys = Object.keys(b)
		if (aKeys.length !== bKeys.length) {
			return false
		}
		for (const key of aKeys) {
			if (!Object.prototype.hasOwnProperty.call(b, key)) {
				return false
			}
			if (!deepEquals(a[key], b[key])) {
				return false
			}
		}
		return true
	}
	return false
}

// Object.is is how Model.set decides an attribute changed, so a freshly built but
// unchanged value would report a change that did not happen. Swapping in the
// previous reference keeps re-delivered data silent.
export function stabilizePatch(previous: Record<string, unknown> | undefined, patch: TaskPatch): TaskPatch {
	const result: Record<string, unknown> = {...patch}
	if (previous === undefined) {
		return result as TaskPatch
	}

	for (const key of Object.keys(patch)) {
		if (!Object.prototype.hasOwnProperty.call(previous, key)) {
			continue
		}

		const previousValue = previous[key]
		if (deepEquals(previousValue, result[key])) {
			result[key] = previousValue
		}
	}

	return result as TaskPatch
}
