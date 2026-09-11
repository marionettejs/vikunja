import {describe, it, expect} from 'vitest'
import {
	normalizeReminder,
	normalizeFile,
	normalizeAttachment,
	normalizeTaskNested,
} from './normalizeTaskNested'
import type {TaskPatch} from './TaskRecords'
import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import type {IAttachment} from '@/modelTypes/IAttachment'

describe('normalizeReminder', () => {
	it('converts relative_period and relative_to to camelCase and drops wire keys', () => {
		const input = {relative_period: 60, relative_to: 'due_date'}
		const result = normalizeReminder(input)
		expect(result.relativePeriod).toBe(60)
		expect(result.relativeTo).toBe('due_date')
		expect('relative_period' in result).toBe(false)
	})

	it('yields empty object for empty object input', () => {
		const result = normalizeReminder({})
		expect(Object.keys(result)).toHaveLength(0)
	})

	it('converts reminder date string to Date or null properly', () => {
		const result1 = normalizeReminder({reminder: '2026-03-01T12:00:00Z'})
		expect(result1.reminder).toEqual(new Date('2026-03-01T12:00:00Z'))

		const result2 = normalizeReminder({reminder: '0001-01-01T00:00:00Z'})
		expect(result2.reminder).toBeNull()

		const result3 = normalizeReminder({reminder: null})
		expect(result3.reminder).toBeNull()
		expect('reminder' in result3).toBe(true)
	})

	it('preserves omission of keys in result', () => {
		const result = normalizeReminder({reminder: null})
		expect('relativePeriod' in result).toBe(false)
	})
})

describe('normalizeFile', () => {
	it('keeps mime and converts created to Date', () => {
		const result = normalizeFile({mime: 'image/png', created: '2026-03-01T12:00:00Z'})
		expect(result.mime).toBe('image/png')
		expect(result.created).toEqual(new Date('2026-03-01T12:00:00Z'))
	})

	it('yields null for empty created string', () => {
		const result = normalizeFile({created: ''})
		expect(result.created).toBeNull()
	})
})

describe('normalizeAttachment', () => {
	it('normalizes nested created_by with normalizeUser', () => {
		const result = normalizeAttachment({created_by: {is_local_user: true}})
		expect(result.createdBy?.isLocalUser).toBe(true)
	})

	it('normalizes nested file with normalizeFile', () => {
		const result = normalizeAttachment({file: {mime: 'text/plain', created: '0001-01-01T00:00:00Z'}})
		expect(result.file?.mime).toBe('text/plain')
		expect(result.file?.created).toBeNull()
	})

	it('copies null created_by and null file verbatim with keys present', () => {
		const result = normalizeAttachment({created_by: null, file: null})
		expect(result.createdBy).toBeNull()
		expect(result.file).toBeNull()
		expect('createdBy' in result).toBe(true)
		expect('file' in result).toBe(true)
	})

	it('converts task_id to taskId', () => {
		const result = normalizeAttachment({task_id: 7})
		expect(result.taskId).toBe(7)
	})

	it('yields empty object for empty object input', () => {
		const result = normalizeAttachment({})
		expect(Object.keys(result)).toHaveLength(0)
	})
})

describe('normalizeTaskNested', () => {
	it('normalizes reminders elements and returns a new array reference', () => {
		const remindersInput = [{relative_period: 60}] as unknown as ITaskReminder[]
		const patch = {id: 1, reminders: remindersInput} as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.reminders?.[0]?.relativePeriod).toBe(60)
		expect(result.reminders).not.toBe(remindersInput)
	})

	it('normalizes attachments elements', () => {
		const patch = {id: 1, attachments: [{task_id: 7}] as unknown as IAttachment[]} as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.attachments?.[0]?.taskId).toBe(7)
	})

	it('copies null reminders verbatim with key present', () => {
		const patch = {id: 1, reminders: null as unknown as ITaskReminder[]} as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.reminders).toBeNull()
		expect('reminders' in result).toBe(true)
	})

	it('yields empty array for empty attachments array', () => {
		const patch = {id: 1, attachments: []} as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.attachments).toEqual([])
	})

	it('copies null reminders array element verbatim while normalizing sibling elements', () => {
		const patch = {id: 1, reminders: [null, {relative_period: 60}]} as unknown as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.reminders?.[0]).toBeNull()
		expect(result.reminders?.[1]?.relativePeriod).toBe(60)
	})

	it('does not touch assignees and preserves reference', () => {
		const assignees = [{is_local_user: true}] as unknown as TaskPatch['assignees']
		const patch = {id: 1, assignees} as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.assignees).toBe(assignees)
	})

	it('copies untouched keys by reference and preserves primitive values', () => {
		const labels = [{id: 10}] as unknown as TaskPatch['labels']
		const patch = {id: 1, labels, title: 'unchanged'} as TaskPatch
		const result = normalizeTaskNested(patch)
		expect(result.labels).toBe(labels)
		expect(result.title).toBe('unchanged')
	})

	it('does not mutate patch and returns a new object reference', () => {
		const patch = {
			id: 1,
			title: 'test',
			reminders: [{relative_period: 60}] as unknown as ITaskReminder[],
		} as TaskPatch
		const before = JSON.stringify(patch)
		const result = normalizeTaskNested(patch)
		const after = JSON.stringify(patch)
		expect(before).toBe(after)
		expect(result).not.toBe(patch)
	})
})
