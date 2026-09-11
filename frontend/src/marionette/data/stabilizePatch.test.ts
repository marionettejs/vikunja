import {describe, it, expect} from 'vitest'
import {stabilizePatch} from './stabilizePatch'
import {TaskRecords, type TaskPatch} from './TaskRecords'
import type {Label} from '@/client/generated'

describe('stabilizePatch', () => {
	it('returns every value unchanged when there is no previous record', () => {
		const labels: Label[] = [{id: 1, title: 'urgent'}]
		const result = stabilizePatch(undefined, {id: 1, labels})

		expect(result.labels).toBe(labels)
	})

	it('reuses the previous Date when both represent the same instant', () => {
		const previousDate = new Date(1700000000000)
		const result = stabilizePatch(
			{dueDate: previousDate},
			{id: 1, dueDate: new Date(1700000000000)},
		)

		expect(result.dueDate).toBe(previousDate)
	})

	it('keeps the new Date when the instants differ', () => {
		const patchDate = new Date(1700000001000)
		const result = stabilizePatch(
			{dueDate: new Date(1700000000000)},
			{id: 1, dueDate: patchDate},
		)

		expect(result.dueDate).toBe(patchDate)
	})

	it('reuses the previous array when a freshly built one is structurally equal', () => {
		const previousLabels: Label[] = [{id: 1, title: 'urgent'}]
		const result = stabilizePatch(
			{labels: previousLabels},
			{id: 1, labels: [{id: 1, title: 'urgent'}]},
		)

		expect(result.labels).toBe(previousLabels)
	})

	it('keeps the new array when one nested value differs', () => {
		const patchLabels: Label[] = [{id: 1, title: 'urgent'}, {id: 2, title: 'later'}]
		const result = stabilizePatch(
			{labels: [{id: 1, title: 'urgent'}, {id: 2, title: 'soon'}]},
			{id: 1, labels: patchLabels},
		)

		expect(result.labels).toBe(patchLabels)
	})

	it('keeps the new array when the previous one is a prefix of it', () => {
		const patchLabels: Label[] = [{id: 1}, {id: 2}, {id: 3}]
		const result = stabilizePatch(
			{labels: [{id: 1}, {id: 2}]},
			{id: 1, labels: patchLabels},
		)

		expect(result.labels).toBe(patchLabels)
	})

	it('reuses the previous repeatAfter object when it is structurally equal', () => {
		const previousRepeat = {type: 'hours', amount: 1} as const
		const result = stabilizePatch(
			{repeatAfter: previousRepeat},
			{id: 1, repeatAfter: {type: 'hours', amount: 1}},
		)

		expect(result.repeatAfter).toBe(previousRepeat)
	})

	it('treats objects with a different number of keys as unequal in both directions', () => {
		const patchWithFewer: Label[] = [{id: 1}]
		const fewer = stabilizePatch(
			{labels: [{id: 1, title: 'urgent'}]},
			{id: 1, labels: patchWithFewer},
		)
		expect(fewer.labels).toBe(patchWithFewer)

		const patchWithMore: Label[] = [{id: 1, title: 'urgent'}]
		const more = stabilizePatch(
			{labels: [{id: 1}]},
			{id: 1, labels: patchWithMore},
		)
		expect(more.labels).toBe(patchWithMore)
	})

	it('keeps a key that the previous record does not have', () => {
		const result = stabilizePatch({id: 1}, {id: 1, title: 'New task'})

		expect('title' in result).toBe(true)
		expect(result.title).toBe('New task')
	})

	it('returns null for a null patch value whether the previous value is null or an object', () => {
		const bothNull = stabilizePatch({dueDate: null}, {id: 1, dueDate: null})
		expect(bothNull.dueDate).toBeNull()

		const previousWasDate = stabilizePatch(
			{dueDate: new Date(1700000000000)},
			{id: 1, dueDate: null},
		)
		expect(previousWasDate.dueDate).toBeNull()
	})

	it('keeps a key whose patch value is undefined', () => {
		const result = stabilizePatch({description: 'hello'}, {id: 1, description: undefined})

		expect('description' in result).toBe(true)
		expect(Object.keys(result)).toContain('description')
		expect(result.description).toBeUndefined()
	})

	it('mutates neither argument and returns a new object', () => {
		const previous = {title: 'task', labels: [{id: 2}]}
		const patch: TaskPatch = {id: 1, title: 'task', labels: [{id: 2}]}
		const previousBefore = JSON.stringify(previous)
		const patchBefore = JSON.stringify(patch)

		const result = stabilizePatch(previous, patch)

		expect(JSON.stringify(previous)).toBe(previousBefore)
		expect(JSON.stringify(patch)).toBe(patchBefore)
		expect(result).not.toBe(patch)
	})

	it('compares nested objects and arrays to any depth', () => {
		const previousRelated = {subtask: [{id: 5, labels: [{id: 9, title: 'deep'}]}]}
		const patchRelated = {subtask: [{id: 5, labels: [{id: 9, title: 'deep'}]}]} as TaskPatch['relatedTasks']
		const result = stabilizePatch(
			{relatedTasks: previousRelated},
			{id: 1, relatedTasks: patchRelated},
		)

		expect(result.relatedTasks).toBe(previousRelated)
	})

	it('never treats a Date as equal to a plain object of the same shape', () => {
		const patchDate = new Date(1700000000000)
		const result = stabilizePatch(
			{dueDate: {getTime: () => 1700000000000}},
			{id: 1, dueDate: patchDate},
		)

		expect(result.dueDate).toBe(patchDate)
	})

	describe('composed with TaskRecords', () => {
		it('re-ingesting an unchanged response emits no change event', () => {
			const records = new TaskRecords()
			const first: TaskPatch = {id: 1, dueDate: new Date(1700000000000), labels: [{id: 9}]}
			const record = records.upsert(first)

			let changes = 0
			record.on('change', () => changes++)

			const reDelivered: TaskPatch = {id: 1, dueDate: new Date(1700000000000), labels: [{id: 9}]}
			records.upsert(stabilizePatch(record.toObject(), reDelivered))

			expect(changes).toBe(0)
			records.destroy()
		})

		it('without stabilizing, the same re-ingest does emit a change event', () => {
			const records = new TaskRecords()
			const record = records.upsert({id: 1, dueDate: new Date(1700000000000)})

			let changes = 0
			record.on('change', () => changes++)

			records.upsert({id: 1, dueDate: new Date(1700000000000)})

			expect(changes).toBe(1)
			records.destroy()
		})

		it('a genuinely changed value still emits a change event after stabilizing', () => {
			const records = new TaskRecords()
			const record = records.upsert({id: 1, dueDate: new Date(1700000000000)})

			const changedKeys: string[] = []
			record.on('change:dueDate', () => changedKeys.push('dueDate'))

			const moved: TaskPatch = {id: 1, dueDate: new Date(1700000009000)}
			records.upsert(stabilizePatch(record.toObject(), moved))

			expect(changedKeys).toEqual(['dueDate'])
			records.destroy()
		})
	})
})
