import {camelCase} from 'change-case'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import type {IUser} from '@/modelTypes/IUser'
import type {TaskPatch} from './TaskRecords'

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val)
}

// IUser declares created and updated as non-nullable Date, but the API sends a
// zero-time year for "never", and parseDateOrNull reports that as null. Saying
// Partial<IUser> would hide it and let a caller reach straight for .getTime().
export type UserPatch = Partial<Omit<IUser, 'created' | 'updated'>> & {
	created?: Date | null
	updated?: Date | null
}

export function normalizeUser(raw: Record<string, unknown>): UserPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		const camelKey = camelCase(key)
		result[camelKey] = camelKey === 'created' || camelKey === 'updated'
			? parseDateOrNull(raw[key] as Date | string | null | undefined)
			: raw[key]
	}
	return result as UserPatch
}

// Only assignees and createdBy are declared IUser, whose interface is camelCase
// while the wire is not. Every other nested field already matches its declared
// type and is left alone.
export function normalizeTaskUsers(patch: TaskPatch): TaskPatch {
	const source = patch as Record<string, unknown>
	const result: Record<string, unknown> = {}

	for (const key of Object.keys(source)) {
		const value = source[key]

		if (key === 'assignees') {
			result.assignees = Array.isArray(value)
				? value.map(item => isPlainObject(item) ? normalizeUser(item) : item)
				: value
			continue
		}

		if (key === 'createdBy') {
			result.createdBy = isPlainObject(value) ? normalizeUser(value) : value
			continue
		}

		result[key] = value
	}

	return result as TaskPatch
}
