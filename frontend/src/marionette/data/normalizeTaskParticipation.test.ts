import {describe, it, expect, expectTypeOf} from 'vitest'
import {
	normalizeReactions,
	normalizeSubscription,
	normalizeComment,
	normalizeTaskParticipation,
	type SubscriptionPatch,
	type CommentPatch,
	type ReactionsPatch,
} from './normalizeTaskParticipation'
import type {UserPatch} from './normalizeUser'
import type {TaskPatch} from './TaskRecords'

describe('normalizeReactions', () => {
	it('preserves emoji keys untouched and normalizes user values', () => {
		const result = normalizeReactions({'👍': [{is_local_user: true}]})
		expect(Object.keys(result)).toEqual(['👍'])
		expect(result['👍'][0].isLocalUser).toBe(true)
	})

	it('does not camelCase multi-word emoji-adjacent keys', () => {
		const result = normalizeReactions({thumbs_up: []})
		expect(Object.keys(result)).toEqual(['thumbs_up'])
		expect(result.thumbs_up).toEqual([])
	})

	it('copies non-array values verbatim', () => {
		const result = normalizeReactions({'👍': null})
		expect(result['👍']).toBeNull()
	})

	it('copies non-object array elements verbatim', () => {
		const result = normalizeReactions({'👍': [null, {is_local_user: true}]})
		expect(result['👍'][0]).toBeNull()
		expect(result['👍'][1].isLocalUser).toBe(true)
	})

	it('yields an empty object for empty input', () => {
		const result = normalizeReactions({})
		expect(result).toEqual({})
	})
})

describe('normalizeSubscription', () => {
	it('converts entity_id and valid created date', () => {
		const result = normalizeSubscription({entity_id: 7, created: '2026-03-01T12:00:00Z'})
		expect(result.entityId).toBe(7)
		expect(result.created).toBeInstanceOf(Date)
	})

	it('converts zero date and preserves explicit null created', () => {
		const zeroResult = normalizeSubscription({created: '0001-01-01T00:00:00Z'})
		expect(zeroResult.created).toBeNull()
		const nullResult = normalizeSubscription({created: null})
		expect(Object.prototype.hasOwnProperty.call(nullResult, 'created')).toBe(true)
		expect(nullResult.created).toBeNull()
	})

	it('normalizes user object and copies explicit null user verbatim', () => {
		const result = normalizeSubscription({user: {is_local_user: true}})
		expect(result.user?.isLocalUser).toBe(true)
		const nullResult = normalizeSubscription({user: null})
		expect(Object.prototype.hasOwnProperty.call(nullResult, 'user')).toBe(true)
		expect(nullResult.user).toBeNull()
	})

	it('yields empty object for empty input and omits user when absent', () => {
		const emptyResult = normalizeSubscription({})
		expect(emptyResult).toEqual({})
		const partialResult = normalizeSubscription({entity: 'task'})
		expect(Object.prototype.hasOwnProperty.call(partialResult, 'user')).toBe(false)
	})
})

describe('normalizeComment', () => {
	it('converts task_id and preserves comment', () => {
		const result = normalizeComment({task_id: 7, comment: 'hi'})
		expect(result.taskId).toBe(7)
		expect(result.comment).toBe('hi')
	})

	it('normalizes author object', () => {
		const result = normalizeComment({author: {is_local_user: true}})
		expect(result.author?.isLocalUser).toBe(true)
	})

	it('normalizes nested reactions object preserving emoji keys', () => {
		const result = normalizeComment({reactions: {'👍': [{is_local_user: true}]}})
		expect(result.reactions).not.toBeNull()
		expect(Object.keys(result.reactions!)).toEqual(['👍'])
		expect(result.reactions!['👍'][0].isLocalUser).toBe(true)
	})

	it('converts empty string created and null updated to null', () => {
		const result = normalizeComment({created: '', updated: null})
		expect(Object.prototype.hasOwnProperty.call(result, 'created')).toBe(true)
		expect(Object.prototype.hasOwnProperty.call(result, 'updated')).toBe(true)
		expect(result.created).toBeNull()
		expect(result.updated).toBeNull()
	})

	it('copies null reactions and author verbatim', () => {
		const result = normalizeComment({reactions: null, author: null})
		expect(Object.prototype.hasOwnProperty.call(result, 'reactions')).toBe(true)
		expect(Object.prototype.hasOwnProperty.call(result, 'author')).toBe(true)
		expect(result.reactions).toBeNull()
		expect(result.author).toBeNull()
	})
})

describe('normalizeTaskParticipation', () => {
	it('normalizes subscription object', () => {
		const result = normalizeTaskParticipation({subscription: {entity_id: 7}} as unknown as TaskPatch)
		expect((result.subscription as unknown as SubscriptionPatch).entityId).toBe(7)
	})

	it('normalizes comments array as a new array reference', () => {
		const commentsInput = [{task_id: 7}]
		const result = normalizeTaskParticipation({comments: commentsInput} as unknown as TaskPatch)
		const commentsResult = result.comments as unknown as CommentPatch[]
		expect(commentsResult[0].taskId).toBe(7)
		expect(commentsResult).not.toBe(commentsInput)
	})

	it('copies null comments and subscription verbatim', () => {
		const result = normalizeTaskParticipation({comments: null, subscription: null} as unknown as TaskPatch)
		expect(Object.prototype.hasOwnProperty.call(result, 'comments')).toBe(true)
		expect(Object.prototype.hasOwnProperty.call(result, 'subscription')).toBe(true)
		expect(result.comments).toBeNull()
		expect(result.subscription).toBeNull()
	})

	it('yields an empty array when comments is empty', () => {
		const result = normalizeTaskParticipation({comments: []} as unknown as TaskPatch)
		expect(result.comments).toEqual([])
	})

	it('does not touch assignees and reminders arrays', () => {
		const assignees = [{id: 1}] as unknown as TaskPatch['assignees']
		const reminders = [{id: 2}] as unknown as TaskPatch['reminders']
		const result = normalizeTaskParticipation({assignees, reminders} as unknown as TaskPatch)
		expect(result.assignees).toBe(assignees)
		expect(result.reminders).toBe(reminders)
	})

	it('copies untouched keys by reference', () => {
		const labels = [{id: 1}] as unknown as TaskPatch['labels']
		const result = normalizeTaskParticipation({labels, title: 'unchanged'} as unknown as TaskPatch)
		expect(result.labels).toBe(labels)
		expect(result.title).toBe('unchanged')
	})

	it('does not mutate input patch and returns a new reference', () => {
		const input = {title: 'task', comments: [{task_id: 1}]} as unknown as TaskPatch
		const before = JSON.stringify(input)
		const result = normalizeTaskParticipation(input)
		expect(JSON.stringify(input)).toBe(before)
		expect(result).not.toBe(input)
	})
})

describe('patch type contracts', () => {
	it('asserts SubscriptionPatch and CommentPatch type contracts', () => {
		expectTypeOf<SubscriptionPatch['user']>().toEqualTypeOf<UserPatch | null | undefined>()
		expectTypeOf<SubscriptionPatch['created']>().toEqualTypeOf<Date | null | undefined>()
		expectTypeOf<CommentPatch['author']>().toEqualTypeOf<UserPatch | null | undefined>()
		expectTypeOf<CommentPatch['reactions']>().toEqualTypeOf<ReactionsPatch | null | undefined>()
		expectTypeOf<CommentPatch['created']>().toEqualTypeOf<Date | null | undefined>()
	})
})
