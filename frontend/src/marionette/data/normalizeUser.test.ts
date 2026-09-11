import {describe, it, expect} from 'vitest'
import {normalizeUser, normalizeTaskUsers} from './normalizeUser'
import type {TaskPatch} from './TaskRecords'

describe('normalizeUser', () => {
	it('renames snake_case top-level keys to camelCase without leaving original keys', () => {
		const input = {is_local_user: true, pending_email: 'a@b.c'}
		const result = normalizeUser(input)
		expect(result.isLocalUser).toBe(true)
		expect(result.pendingEmail).toBe('a@b.c')
		expect('is_local_user' in result).toBe(false)
	})

	it('returns empty object for empty object input', () => {
		const result = normalizeUser({})
		expect(Object.keys(result)).toHaveLength(0)
	})

	it('leaves omitted keys absent from result', () => {
		const result = normalizeUser({id: 5})
		expect('username' in result).toBe(false)
	})

	it('preserves explicit null values', () => {
		const result = normalizeUser({name: null})
		expect('name' in result).toBe(true)
		expect(result.name).toBeNull()
	})

	it('parses valid date and converts year 1 date to null', () => {
		const result = normalizeUser({
			created: '2026-03-01T12:00:00Z',
			updated: '0001-01-01T00:00:00Z',
		})
		expect(result.created).toEqual(new Date('2026-03-01T12:00:00Z'))
		expect(result.updated).toBeNull()
	})

	it('converts empty string and null dates to null', () => {
		const emptyResult = normalizeUser({created: ''})
		expect(emptyResult.created).toBeNull()
		const nullResult = normalizeUser({created: null})
		expect(nullResult.created).toBeNull()
	})

	it('copies nested settings object by reference', () => {
		const settings = {theme: 'dark'}
		const result = normalizeUser({settings} as unknown as Record<string, unknown>)
		expect(result.settings).toBe(settings)
	})

	it('does not mutate raw input', () => {
		const raw = {is_local_user: true, name: 'Alice'}
		const before = JSON.stringify(raw)
		normalizeUser(raw)
		const after = JSON.stringify(raw)
		expect(after).toBe(before)
	})
})

describe('normalizeTaskUsers', () => {
	it('normalizes elements in assignees array and creates a new array reference', () => {
		const rawAssignees = [{is_local_user: true}]
		const patch = {id: 1, assignees: rawAssignees as unknown as TaskPatch['assignees']}
		const result = normalizeTaskUsers(patch)
		expect((result.assignees?.[0] as unknown as {isLocalUser: boolean}).isLocalUser).toBe(true)
		expect(result.assignees).not.toBe(rawAssignees)
	})

	it('returns empty array when assignees is empty array', () => {
		const patch = {id: 1, assignees: []}
		const result = normalizeTaskUsers(patch)
		expect(result.assignees).toEqual([])
	})

	it('preserves null assignees verbatim', () => {
		const patch = {id: 1, assignees: null as unknown as TaskPatch['assignees']}
		const result = normalizeTaskUsers(patch)
		expect('assignees' in result).toBe(true)
		expect(result.assignees).toBeNull()
	})

	it('preserves null assignees array element verbatim while normalizing siblings', () => {
		const patch = {
			id: 1,
			assignees: [null, {is_local_user: true}] as unknown as TaskPatch['assignees'],
		}
		const result = normalizeTaskUsers(patch)
		expect(result.assignees?.[0]).toBeNull()
		expect((result.assignees?.[1] as unknown as {isLocalUser: boolean}).isLocalUser).toBe(true)
	})

	it('normalizes createdBy plain object', () => {
		const patch = {id: 1, createdBy: {is_local_user: false} as unknown as TaskPatch['createdBy']}
		const result = normalizeTaskUsers(patch)
		expect((result.createdBy as unknown as {isLocalUser: boolean}).isLocalUser).toBe(false)
	})

	it('preserves null createdBy verbatim and keeps the key present', () => {
		const patch = {id: 1, createdBy: null as unknown as TaskPatch['createdBy']}
		const result = normalizeTaskUsers(patch)
		expect('createdBy' in result).toBe(true)
		expect(result.createdBy).toBeNull()
	})

	it('copies untouched keys by reference', () => {
		const labels = [{id: 10, title: 'urgent'}]
		const patch = {
			id: 1,
			title: 'unchanged',
			labels: labels as unknown as TaskPatch['labels'],
		}
		const result = normalizeTaskUsers(patch)
		expect(result.title).toBe('unchanged')
		expect(result.labels).toBe(labels)
	})

	it('does not mutate patch and returns a new object reference', () => {
		const patch = {id: 1, title: 'original'}
		const before = JSON.stringify(patch)
		const result = normalizeTaskUsers(patch)
		const after = JSON.stringify(patch)
		expect(after).toBe(before)
		expect(result).not.toBe(patch)
	})
})
