import type {ISubscription} from '@/modelTypes/ISubscription'
import type {ITaskComment} from '@/modelTypes/ITaskComment'
import type {TaskPatch} from './TaskRecords'
import {normalizeUser, type UserPatch} from './normalizeUser'
import {camelCase} from 'change-case'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'

export type SubscriptionPatch = Partial<Omit<ISubscription, 'user' | 'created'>> & {
	user?: UserPatch | null
	created?: Date | null
}

export type CommentPatch = Partial<Omit<ITaskComment, 'author' | 'reactions' | 'created' | 'updated'>> & {
	author?: UserPatch | null
	reactions?: ReactionsPatch | null
	created?: Date | null
	updated?: Date | null
}

export type ReactionsPatch = {[reaction: string]: UserPatch[]}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeReactions(raw: Record<string, unknown>): ReactionsPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		if (!Object.prototype.hasOwnProperty.call(raw, key)) {
			continue
		}
		const value = raw[key]
		if (Array.isArray(value)) {
			result[key] = value.map(element => {
				if (isRecord(element)) {
					return normalizeUser(element)
				}
				return element
			})
		} else {
			result[key] = value
		}
	}
	return result as unknown as ReactionsPatch
}

export function normalizeSubscription(raw: Record<string, unknown>): SubscriptionPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		if (!Object.prototype.hasOwnProperty.call(raw, key)) {
			continue
		}
		const camelKey = camelCase(key)
		const value = raw[key]
		if (camelKey === 'created') {
			result[camelKey] = parseDateOrNull(value as Date | string | null | undefined)
		} else if (camelKey === 'user') {
			if (isRecord(value)) {
				result[camelKey] = normalizeUser(value)
			} else {
				result[camelKey] = value
			}
		} else {
			result[camelKey] = value
		}
	}
	return result as unknown as SubscriptionPatch
}

export function normalizeComment(raw: Record<string, unknown>): CommentPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(raw)) {
		if (!Object.prototype.hasOwnProperty.call(raw, key)) {
			continue
		}
		const camelKey = camelCase(key)
		const value = raw[key]
		if (camelKey === 'created' || camelKey === 'updated') {
			result[camelKey] = parseDateOrNull(value as Date | string | null | undefined)
		} else if (camelKey === 'author') {
			if (isRecord(value)) {
				result[camelKey] = normalizeUser(value)
			} else {
				result[camelKey] = value
			}
		} else if (camelKey === 'reactions') {
			if (isRecord(value)) {
				result[camelKey] = normalizeReactions(value)
			} else {
				result[camelKey] = value
			}
		} else {
			result[camelKey] = value
		}
	}
	return result as unknown as CommentPatch
}

export function normalizeTaskParticipation(patch: TaskPatch): TaskPatch {
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(patch)) {
		if (!Object.prototype.hasOwnProperty.call(patch, key)) {
			continue
		}
		const value = (patch as Record<string, unknown>)[key]
		if (key === 'subscription') {
			if (isRecord(value)) {
				result[key] = normalizeSubscription(value)
			} else {
				result[key] = value
			}
		} else if (key === 'comments') {
			if (Array.isArray(value)) {
				result[key] = value.map(element => {
					if (isRecord(element)) {
						return normalizeComment(element)
					}
					return element
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