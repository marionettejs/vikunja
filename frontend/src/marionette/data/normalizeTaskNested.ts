import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import type {IAttachment} from '@/modelTypes/IAttachment'
import type {IFile} from '@/modelTypes/IFile'
import type {TaskPatch} from './TaskRecords'
import {camelCase} from 'change-case'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {normalizeUser, type UserPatch} from './normalizeUser'

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// IFile and IAttachment declare created as a non-nullable Date, but the API sends
// a zero-time year for "never" and parseDateOrNull reports that as null. Saying
// Partial<IFile> or Partial<IAttachment> would hide it behind the cast.
export type FilePatch = Partial<Omit<IFile, 'created'>> & {
	created?: Date | null
}

export type AttachmentPatch = Partial<Omit<IAttachment, 'created' | 'createdBy' | 'file'>> & {
	created?: Date | null
	createdBy?: UserPatch
	file?: FilePatch
}

export function normalizeReminder(raw: Record<string, unknown>): Partial<ITaskReminder> {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		if (!Object.prototype.hasOwnProperty.call(raw, key)) {
			continue
		}
		const camelKey = camelCase(key)
		const value = raw[key]
		if (camelKey === 'reminder') {
			result[camelKey] = parseDateOrNull(value as string | Date | null | undefined)
		} else {
			result[camelKey] = value
		}
	}
	return result as Partial<ITaskReminder>
}

export function normalizeFile(raw: Record<string, unknown>): FilePatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		const camelKey = camelCase(key)
		const value = raw[key]
		if (camelKey === 'created') {
			result[camelKey] = parseDateOrNull(value as string | Date | null | undefined)
		} else {
			result[camelKey] = value
		}
	}
	return result as FilePatch
}

export function normalizeAttachment(raw: Record<string, unknown>): AttachmentPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		if (!Object.prototype.hasOwnProperty.call(raw, key)) {
			continue
		}
		const camelKey = camelCase(key)
		const value = raw[key]
		if (camelKey === 'created') {
			result[camelKey] = parseDateOrNull(value as string | Date | null | undefined)
		} else if (camelKey === 'createdBy') {
			if (isPlainObject(value)) {
				result[camelKey] = normalizeUser(value)
			} else {
				result[camelKey] = value
			}
		} else if (camelKey === 'file') {
			if (isPlainObject(value)) {
				result[camelKey] = normalizeFile(value)
			} else {
				result[camelKey] = value
			}
		} else {
			result[camelKey] = value
		}
	}
	return result as AttachmentPatch
}

export function normalizeTaskNested(patch: TaskPatch): TaskPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(patch)) {
		if (!Object.prototype.hasOwnProperty.call(patch, key)) {
			continue
		}
		const value = (patch as Record<string, unknown>)[key]
		if (key === 'reminders') {
			if (Array.isArray(value)) {
				result[key] = value.map(item => {
					if (isPlainObject(item)) {
						return normalizeReminder(item)
					}
					return item
				})
			} else {
				result[key] = value
			}
		} else if (key === 'attachments') {
			if (Array.isArray(value)) {
				result[key] = value.map(item => {
					if (isPlainObject(item)) {
						return normalizeAttachment(item)
					}
					return item
				})
			} else {
				result[key] = value
			}
		} else {
			result[key] = value
		}
	}
	return result as unknown as TaskPatch
}
