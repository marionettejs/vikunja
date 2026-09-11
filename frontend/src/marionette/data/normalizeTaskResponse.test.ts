import {describe, it, expect} from 'vitest'
import {normalizeTaskResponse} from './normalizeTaskResponse'

describe('normalizeTaskResponse', () => {
	it('returns exactly {id: 42} with absent fields for {id: 42}', () => {
		const result = normalizeTaskResponse({id: 42})
		expect(Object.keys(result)).toHaveLength(1)
		expect(result.id).toBe(42)
		expect('description' in result).toBe(false)
		expect('dueDate' in result).toBe(false)
		expect('title' in result).toBe(false)
	})

	it('preserves explicit null due_date and keeps start_date absent', () => {
		const result = normalizeTaskResponse({id: 1, due_date: null})
		expect('dueDate' in result).toBe(true)
		expect(result.dueDate).toBeNull()
		expect('startDate' in result).toBe(false)
	})

	it('converts snake_case keys to camelCase in output', () => {
		const result = normalizeTaskResponse({
			id: 1,
			due_date: '2026-03-01T12:00:00Z',
			hex_color: '00ff00',
			percent_done: 0.5,
		})
		expect(result.dueDate).toEqual(new Date('2026-03-01T12:00:00Z'))
		expect(result.hexColor).toBe('#00ff00')
		expect(result.percentDone).toBe(0.5)
		expect('due_date' in result).toBe(false)
		expect('hex_color' in result).toBe(false)
		expect('percent_done' in result).toBe(false)
	})

	it('parses repeat_after seconds into object and preserves already-parsed object without NaN', () => {
		const fromSeconds = normalizeTaskResponse({id: 1, repeat_after: 3600})
		expect(fromSeconds.repeatAfter).toEqual({type: 'hours', amount: 1})

		const parsedObject = {type: 'hours', amount: 1}
		const fromObject = normalizeTaskResponse({id: 1, repeat_after: parsedObject})
		expect(fromObject.repeatAfter).toEqual({type: 'hours', amount: 1})
		expect(Number.isNaN((fromObject.repeatAfter as {amount: number}).amount)).toBe(false)
	})

	it('prefixes hex_color with # when missing, leaves prefixed unchanged, and keeps empty string', () => {
		const withPrefix = normalizeTaskResponse({id: 1, hex_color: 'ff0000'})
		expect(withPrefix.hexColor).toBe('#ff0000')

		const alreadyPrefixed = normalizeTaskResponse({id: 1, hex_color: '#ff0000'})
		expect(alreadyPrefixed.hexColor).toBe('#ff0000')

		const empty = normalizeTaskResponse({id: 1, hex_color: ''})
		expect(empty.hexColor).toBe('')
	})

	it('clears identifier when matching -index and preserves it when index is omitted', () => {
		const cleared = normalizeTaskResponse({id: 1, identifier: '-7', index: 7})
		expect(cleared.identifier).toBe('')

		const preserved = normalizeTaskResponse({id: 1, identifier: '-7'})
		expect(preserved.identifier).toBe('-7')
	})

	it('normalizes zero-time date string to null', () => {
		const result = normalizeTaskResponse({id: 1, created: '0001-01-01T00:00:00Z'})
		expect(result.created).toBeNull()
	})

	it('preserves labels array reference unchanged', () => {
		const labels = [{id: 1, title: 'urgent'}]
		const result = normalizeTaskResponse({id: 1, labels})
		expect(result.labels).toBe(labels)
	})

	it('throws when id is missing or non-numeric', () => {
		expect(() => normalizeTaskResponse({})).toThrow('Missing required field: id')
		expect(() => normalizeTaskResponse({id: 'not-a-number'})).toThrow('Field id must be a finite number')
		expect(() => normalizeTaskResponse({id: NaN})).toThrow('Field id must be a finite number')
	})

	it('does not mutate raw input', () => {
		const raw = {id: 42, title: ' test ', labels: [{id: 1}]}
		const snapshot = JSON.stringify(raw)
		normalizeTaskResponse(raw)
		expect(JSON.stringify(raw)).toBe(snapshot)
	})
})
