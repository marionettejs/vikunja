import {afterEach, beforeEach, describe, expect, expectTypeOf, it} from 'vitest'
import type {ITask} from '@/modelTypes/ITask'
import {TaskRecords} from '@/marionette/data/TaskRecords'
import {ingestTask} from '@/marionette/data/ingestTask'
import {serializeTask} from './taskPayload'

let records: TaskRecords
beforeEach(() => { records = new TaskRecords() })
afterEach(() => { records.destroy() })

function task(overrides: Record<string, unknown> = {}) {
	return ingestTask(records, {id: 1, title: '  Test task  ', project_id: 3, ...overrides})
}

describe('serializeTask', () => {
	it('accepts native records and existing task callers without changing canonical data', () => {
		expectTypeOf<ITask>().toExtend<Parameters<typeof serializeTask>[0]>()
		const record = task({
			due_date: '2024-06-01T10:00:00Z',
			reminders: [{reminder: '2024-06-01T09:00:00Z', relative_period: 0}],
			repeat_after: 7200,
			hex_color: 'ff0000',
		})
		record.set('title', '  Test task  ')
		const reminders = record.get('reminders')!
		const reminder = reminders[0]
		const date = reminder.reminder
		Object.freeze(reminder)
		const result = serializeTask(record.toObject())
		expect(result).toMatchObject({title: 'Test task', project_id: 3, due_date: '2024-06-01T10:00:00.000Z', repeat_after: 7200, hex_color: 'ff0000', reminder_dates: null})
		expect(result.reminders[0].reminder).toBe('2024-06-01T09:00:00.000Z')
		expect(record.get('title')).toBe('  Test task  ')
		expect(record.get('reminders')).toBe(reminders)
		expect(reminders[0]).toBe(reminder)
		expect(reminder.reminder).toBe(date)
		expect(date).toBeInstanceOf(Date)
	})

	it('preserves nullable collections and dates, normalizing only null reminders', () => {
		const record = task({created: null, updated: null, reminders: null, labels: null, assignees: null, attachments: null, buckets: null, comments: null, related_tasks: {subtask: null}, reactions: {'👍': null}})
		expect(serializeTask(record.toObject())).toMatchObject({created: null, updated: null, reminders: [], labels: null, assignees: null, attachments: null, buckets: null, comments: null, related_tasks: {subtask: null}, reactions: {'👍': null}})
		expect(record.get('reminders')).toBeNull()
	})

	it('preserves nested reaction keys and null relation values without replacing children', () => {
		const record = task()
		const childRecord = task({id: 2, reminders: [{reminder: '2024-06-01T09:00:00Z'}], related_tasks: {related: null}, reactions: {'👍': null, ':customEmoji:': [{id: 4, username: 'example', is_local_user: true}]}})
		childRecord.set('title', ' child ')
		const child = childRecord.toObject()
		const related = {subtask: [child]}
		const input = {...record.toObject(), relatedTasks: related}
		const reminders = child.reminders!
		const result = serializeTask(input)
		expect(result.related_tasks.subtask[0]).toMatchObject({title: 'child', related_tasks: {related: null}, reactions: {'👍': null, ':customEmoji:': [{id: 4, is_local_user: true}]}})
		expect(Object.keys(result.related_tasks.subtask[0].reactions)).toEqual(['👍', ':customEmoji:'])
		expect(input.relatedTasks).toBe(related)
		expect(related.subtask![0]).toBe(child)
		expect(child.title).toBe(' child ')
		expect(child.reminders).toBe(reminders)
		expect(reminders[0].reminder).toBeInstanceOf(Date)
	})

	it.each([['hours', 7200], ['days', 172800], ['weeks', 1209600]] as const)('converts parsed %s recurrence to seconds', (type, seconds) => {
		const record = task()
		record.set('repeatAfter', {amount: 2, type})
		expect(serializeTask(record.toObject()).repeat_after).toBe(seconds)
		expect(record.get('repeatAfter')).toEqual({amount: 2, type})
	})
})
