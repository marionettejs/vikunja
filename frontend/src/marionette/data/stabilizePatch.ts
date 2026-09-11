// The es6 entrypoint, already used by useRouteFilters, handles Map, Set and typed
// arrays. The default entrypoint compares them by own enumerable keys, which makes
// any two Maps look equal and would suppress a real change.
import equal from 'fast-deep-equal/es6'

import type {TaskPatch} from './TaskRecords'

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
		if (equal(previousValue, result[key])) {
			result[key] = previousValue
		}
	}

	return result as TaskPatch
}
