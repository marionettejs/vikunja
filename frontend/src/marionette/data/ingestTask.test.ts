import {afterEach, beforeEach, describe, expect, expectTypeOf, it, vi} from 'vitest'
import {TaskRecords} from './TaskRecords'
import type {TaskRecord} from './TaskRecords'
import {ingestTask} from './ingestTask'

describe('ingestTask', () => {
	let records: TaskRecords

	beforeEach(() => {
		records = new TaskRecords()
	})

	afterEach(() => {
		records.destroy()
	})

	function buildRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			id: 1,
			title: 'Write the ingest path',
			description: 'A detailed description',
			due_date: '2026-10-01T00:00:00Z',
			assignees: [{id: 7, name: 'Ada Lovelace', username: 'ada'}],
			created_by: {id: 7, name: 'Ada Lovelace', username: 'ada'},
			reminders: [{reminder: '2026-09-30T09:00:00Z', relative_period: 0}],
			attachments: [{id: 3, created_by: {id: 7, username: 'ada'}, file: {id: 4, name: 'spec.pdf'}}],
			subscription: {entity: 'task', entity_id: 1},
			comments: [{id: 11, comment: 'first', author: {id: 7, name: 'Ada Lovelace'}}],
			reactions: {thumbs_up: [{id: 7, username: 'ada', is_local_user: true}]},
			...overrides,
		}
	}

	it('normalizes through all four normalizers in one call', () => {
		const record = ingestTask(records, buildRaw())

		expect(record.get('dueDate')).toBeInstanceOf(Date)
		expect(record.get('assignees')?.[0].name).toBe('Ada Lovelace')
		expect(record.get('createdBy')?.name).toBe('Ada Lovelace')
		expect(record.get('reminders')?.[0].relativePeriod).toBe(0)
		expect(record.get('attachments')?.[0].createdBy.username).toBe('ada')
		expect(record.get('subscription')?.entityId).toBe(1)
		expect(record.get('comments')?.[0].author.name).toBe('Ada Lovelace')
		const reactions = record.get('reactions') as Record<string, unknown>
		expect(reactions).toHaveProperty('thumbs_up')
		expect(reactions).not.toHaveProperty('thumbsUp')
		expect(record.get('reactions')?.thumbs_up?.[0].isLocalUser).toBe(true)
	})

	it('is silent when an unchanged re-fetch arrives as a freshly parsed payload', () => {
		const record = ingestTask(records, buildRaw())
		const assignees = record.get('assignees')
		const attachments = record.get('attachments')
		const comments = record.get('comments')
		const reactions = record.get('reactions')

		const onChange = vi.fn()
		record.on('change', onChange)

		ingestTask(records, buildRaw())

		expect(onChange).not.toHaveBeenCalled()
		expect(record.get('assignees')).toBe(assignees)
		expect(record.get('attachments')).toBe(attachments)
		expect(record.get('comments')).toBe(comments)
		expect(record.get('reactions')).toBe(reactions)
	})

	it('fires exactly one change event naming only the field that actually changed', () => {
		const record = ingestTask(records, buildRaw())
		const assignees = record.get('assignees')

		const onChange = vi.fn()
		record.on('change', onChange)

		ingestTask(records, buildRaw({title: 'Changed title'}))

		expect(onChange).toHaveBeenCalledTimes(1)
		expect(Object.keys(record.changed)).toEqual(['title'])
		expect(record.get('title')).toBe('Changed title')
		expect(record.get('assignees')).toBe(assignees)
	})

	it('detects a change inside a nested collection', () => {
		const record = ingestTask(records, buildRaw())
		const assignees = record.get('assignees')

		const onChange = vi.fn()
		record.on('change', onChange)

		ingestTask(records, buildRaw({assignees: [{id: 7, name: 'Grace Hopper', username: 'ada'}]}))

		expect(onChange).toHaveBeenCalled()
		expect(record.get('assignees')).not.toBe(assignees)
		expect(record.get('assignees')?.[0].name).toBe('Grace Hopper')
	})

	it('creates the record on first ingest and returns the same record on re-ingest', () => {
		expect(records.get(1)).toBeUndefined()
		const first = ingestTask(records, buildRaw())
		const second = ingestTask(records, buildRaw())

		expect(first).toBe(second)
		expect(first).toBe(records.get(1))
		})

	it('preserves fields omitted by a partial list response', () => {
		const record = ingestTask(records, buildRaw())

		const onChange = vi.fn()
		record.on('change', onChange)

		ingestTask(records, {id: 1, title: 'Write the ingest path', done: false})

		expect(record.get('description')).toBe('A detailed description')
		expect(record.has('description')).toBe(true)
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(record.get('done')).toBe(false)
	})

	it('keeps an explicit null and stays silent when the same null is re-fetched', () => {
		const record = ingestTask(records, buildRaw({due_date: null}))
		expect(record.get('dueDate')).toBeNull()

		const onChange = vi.fn()
		record.on('change', onChange)

		ingestTask(records, buildRaw({due_date: null}))
		expect(onChange).not.toHaveBeenCalled()
	})

	it('normalizes before stabilizing, so an equal date string re-fetch is still silent', () => {
		const record = ingestTask(records, buildRaw())
		const firstDate = record.get('dueDate')

		const onChange = vi.fn()
		record.on('change', onChange)

		ingestTask(records, buildRaw())

		expect(onChange).not.toHaveBeenCalled()
		expect(record.get('dueDate')).toBe(firstDate)
	})

	it('declares the ingest contract at type level', () => {
		expectTypeOf(ingestTask).parameters.toEqualTypeOf<[TaskRecords, Record<string, unknown>]>()
		expectTypeOf(ingestTask).returns.toEqualTypeOf<TaskRecord>()
	})
})
