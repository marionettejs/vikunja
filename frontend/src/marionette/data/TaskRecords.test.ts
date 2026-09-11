import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Collection } from '@mnjs/data'
import type {ITask} from '@/modelTypes/ITask'
import { TaskRecords, type TaskRecord } from './TaskRecords'

describe('TaskRecords', () => {
	let records: TaskRecords
	const borrowers: Collection<TaskRecord>[] = []

	beforeEach(() => {
		records = new TaskRecords()
	})

	afterEach(() => {
		for (const borrower of borrowers) {
			borrower.destroy()
		}
		borrowers.length = 0
		records.destroy()
	})

	it('creates and retains same-ID identity across multiple lookups and upserts', () => {
		const record1 = records.upsert({ id: 1, title: 'First Task' })
		const record2 = records.get(1)
		const record3 = records.upsert({ id: 1, done: true })

		expect(record1).toBe(record2)
		expect(record1).toBe(record3)
		expect(record1.get('title')).toBe('First Task')
		expect(record1.get('done')).toBe(true)
	})

	it('retains omitted fields when patched with partial details', () => {
		const record = records.upsert({
			id: 2,
			title: 'Detailed Task',
			description: 'Initial description',
			dueDate: new Date('2026-10-01T00:00:00Z'),
		})

		records.upsert({ id: 2, title: 'Updated Title' })

		expect(record.get('title')).toBe('Updated Title')
		expect(record.get('description')).toBe('Initial description')
		expect(record.get('dueDate')).toEqual(new Date('2026-10-01T00:00:00Z'))
	})

	it('handles explicit null and undefined values per Model.set semantics', () => {
		const record = records.upsert({
			id: 3,
			title: 'Clearing Task',
			description: 'Some text',
			dueDate: new Date('2026-10-01T00:00:00Z'),
		})

		records.upsert({ id: 3, description: '', dueDate: null })
		expect(record.get('description')).toBe('')
		expect(record.get('dueDate')).toBeNull()

		records.upsert({ id: 3, title: undefined })
		expect(record.get('title')).toBeUndefined()
		expect(record.has('title')).toBe(true)
	})

	it('distinguishes same-reference no-change from fresh-reference change on nested arrays', () => {
		const attachments: ITask['attachments'] = []
		const record = records.upsert({ id: 4, attachments })

		const changeHandler = vi.fn()
		record.on('change', changeHandler)

		records.upsert({ id: 4, attachments })
		expect(changeHandler).not.toHaveBeenCalled()

		const freshAttachments: ITask['attachments'] = []
		records.upsert({ id: 4, attachments: freshAttachments })
		expect(changeHandler).toHaveBeenCalledTimes(1)
		expect(record.get('attachments')).toBe(freshAttachments)
	})

	it('drops record from shared borrower Collections when owner removes the record', () => {
		const record = records.upsert({ id: 5, title: 'Shared Task' })
		const collection1 = new Collection<TaskRecord>([record])
		const collection2 = new Collection<TaskRecord>([record])
		borrowers.push(collection1, collection2)

		expect(collection1.length).toBe(1)
		expect(collection2.length).toBe(1)
		expect(collection1.get(5)).toBe(record)
		expect(collection2.get(5)).toBe(record)

		records.remove(5)

		expect(records.get(5)).toBeUndefined()
		expect(record.isDestroyed()).toBe(true)
		expect(collection1.length).toBe(0)
		expect(collection2.length).toBe(0)
		expect(collection1.get(5)).toBeUndefined()
		expect(collection2.get(5)).toBeUndefined()
	})

	it('maintains isolation between independent owners', () => {
		const otherRecords = new TaskRecords()
		try {
			const recordA = records.upsert({ id: 6, title: 'Owner A' })
			const recordB = otherRecords.upsert({ id: 6, title: 'Owner B' })

			expect(recordA).not.toBe(recordB)
			expect(recordA.get('title')).toBe('Owner A')
			expect(recordB.get('title')).toBe('Owner B')

			records.remove(6)
			expect(records.get(6)).toBeUndefined()
			expect(otherRecords.get(6)).toBe(recordB)
			expect(recordB.isDestroyed()).toBe(false)
		} finally {
			otherRecords.destroy()
		}
	})

	it('releases owned records on destroy, is idempotent, and rejects subsequent upsert', () => {
		const record = records.upsert({ id: 7, title: 'Doomed' })
		const second = records.upsert({id: 8, title: 'Second'})
		const borrower = new Collection<TaskRecord>([record, second])
		borrowers.push(borrower)

		records.destroy()

		expect(record.isDestroyed()).toBe(true)
		expect(borrower.length).toBe(0)
		expect(records.get(7)).toBeUndefined()

		expect(second.isDestroyed()).toBe(true)
		expect(records.get(8)).toBeUndefined()

		expect(() => records.destroy()).not.toThrow()
		expect(() => records.remove(7)).not.toThrow()
		expect(records.get(7)).toBeUndefined()

		expect(() => records.upsert({ id: 7, title: 'Revived' })).toThrow('Cannot upsert into destroyed TaskRecords')
	})
})
