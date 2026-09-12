import {afterEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import {TeamMembersView, type TeamMemberSummary, type TeamMembersViewOptions} from './TeamMembersView'

describe('TeamMembersView', () => {
	const views: ViewInstance[] = []

	afterEach(() => {
		for (const v of views) {
			v.destroy()
		}
		views.length = 0
		document.body.innerHTML = ''
	})

	const defaultLabels = {
		admin: 'Admin',
		member: 'Member',
		you: 'You',
		makeAdmin: 'Make Admin',
		makeMember: 'Make Member',
		remove: 'Remove',
	}

	function renderView(options: Partial<TeamMembersViewOptions> = {}) {
		const opts: TeamMembersViewOptions = {
			members: [],
			currentUserId: 1,
			canManage: false,
			labels: defaultLabels,
			onToggleAdmin: vi.fn(),
			onRemove: vi.fn(),
			...options,
		}
		const view = new TeamMembersView(opts)
		views.push(view)
		view.render()
		document.body.appendChild(view.el)
		return {view, opts}
	}

	it('renders a table with correct classes and tbody structure', () => {
		const {view} = renderView()
		const table = view.el.querySelector('table')
		expect(table).not.toBeNull()
		expect(table?.classList.contains('table')).toBe(true)
		expect(table?.classList.contains('has-actions')).toBe(true)
		expect(table?.classList.contains('is-striped')).toBe(true)
		expect(table?.classList.contains('is-hoverable')).toBe(true)
		expect(table?.classList.contains('is-fullwidth')).toBe(true)
		expect(table?.querySelector('tbody')).not.toBeNull()
	})

	it('renders members sorted by display name case-insensitively and falls back to username when name is empty', () => {
		const members: TeamMemberSummary[] = [
			{id: 1, name: 'bob', username: 'user_bob', admin: false},
			{id: 2, name: 'Alice', username: 'user_alice', admin: false},
			{id: 3, name: '', username: 'charlie', admin: false},
			{id: 4, name: 'adam', username: 'user_adam', admin: false},
		]
		const {view} = renderView({members})
		const rows = view.el.querySelectorAll('tbody tr')
		expect(rows.length).toBe(4)

		const names = Array.from(rows).map(row => row.querySelector('td')?.textContent?.trim())
		expect(names[0]).toContain('adam')
		expect(names[1]).toContain('Alice')
		expect(names[2]).toContain('bob')
		expect(names[3]).toContain('charlie')
	})

	it('does not mutate the supplied members array', () => {
		const members: ReadonlyArray<TeamMemberSummary> = Object.freeze([
			{id: 2, name: 'Zoe', username: 'zoe', admin: false},
			{id: 1, name: 'Alex', username: 'alex', admin: false},
		])
		expect(() => renderView({members})).not.toThrow()
		expect(members[0].id).toBe(2)
		expect(members[1].id).toBe(1)
	})

	it('shows the "you" label for the current user row and not for other rows', () => {
		const members: TeamMemberSummary[] = [
			{id: 1, name: 'Alice', username: 'alice', admin: false},
			{id: 2, name: 'Bob', username: 'bob', admin: false},
		]
		const {view} = renderView({members, currentUserId: 1})
		const aliceRow = view.el.querySelector('tr[data-member-id="1"]')
		const bobRow = view.el.querySelector('tr[data-member-id="2"]')

		expect(aliceRow?.textContent).toContain(defaultLabels.you)
		expect(bobRow?.textContent).not.toContain(defaultLabels.you)
	})

	it('renders member role labels correctly for admin and regular member', () => {
		const members: TeamMemberSummary[] = [
			{id: 1, name: 'Alice', username: 'alice', admin: true},
			{id: 2, name: 'Bob', username: 'bob', admin: false},
		]
		const {view} = renderView({members})
		const aliceRow = view.el.querySelector('tr[data-member-id="1"]')
		const bobRow = view.el.querySelector('tr[data-member-id="2"]')

		expect(aliceRow?.querySelectorAll('td')[1]?.textContent).toBe(defaultLabels.admin)
		expect(bobRow?.querySelectorAll('td')[1]?.textContent).toBe(defaultLabels.member)
	})

	it('renders no action controls at all when canManage is false', () => {
		const members: TeamMemberSummary[] = [
			{id: 1, name: 'Alice', username: 'alice', admin: true},
			{id: 2, name: 'Bob', username: 'bob', admin: false},
		]
		const {view} = renderView({members, canManage: false, currentUserId: 1})
		const buttons = view.el.querySelectorAll('button')
		expect(buttons.length).toBe(0)
		const cells = view.el.querySelectorAll('tbody td')
		expect(cells.length).toBe(4)
	})

	it('offers make member for a non-self admin row and make admin for a non-self non-admin row when canManage is true', () => {
		const members: TeamMemberSummary[] = [
			{id: 1, name: 'Alice', username: 'alice', admin: true},
			{id: 2, name: 'Bob', username: 'bob', admin: true},
			{id: 3, name: 'Charlie', username: 'charlie', admin: false},
		]
		const {view} = renderView({members, canManage: true, currentUserId: 1})

		const bobRow = view.el.querySelector('tr[data-member-id="2"]')
		const bobToggle = bobRow?.querySelector('.toggle-admin')
		expect(bobToggle?.textContent?.trim()).toBe(defaultLabels.makeMember)
		expect(bobToggle?.classList.contains('button')).toBe(true)

		const charlieRow = view.el.querySelector('tr[data-member-id="3"]')
		const charlieToggle = charlieRow?.querySelector('.toggle-admin')
		expect(charlieToggle?.textContent?.trim()).toBe(defaultLabels.makeAdmin)
		expect(charlieToggle?.classList.contains('button')).toBe(true)

		const removeButtons = view.el.querySelectorAll('.remove-member')
		expect(removeButtons.length).toBe(2)
		for (const btn of Array.from(removeButtons)) {
			expect(btn.getAttribute('aria-label')).toBe(defaultLabels.remove)
			expect(btn.classList.contains('button')).toBe(true)
		}
	})

	it('renders no action controls for current user row even when canManage is true', () => {
		const members: TeamMemberSummary[] = [
			{id: 1, name: 'Alice', username: 'alice', admin: true},
			{id: 2, name: 'Bob', username: 'bob', admin: false},
		]
		const {view} = renderView({members, canManage: true, currentUserId: 1})
		const aliceRow = view.el.querySelector('tr[data-member-id="1"]')
		expect(aliceRow?.querySelectorAll('button').length).toBe(0)
	})

	it('calls onToggleAdmin and onRemove with the correct member object when activated', () => {
		const alice: TeamMemberSummary = {id: 1, name: 'Alice', username: 'alice', admin: true}
		const bob: TeamMemberSummary = {id: 2, name: 'Bob', username: 'bob', admin: false}
		const onToggleAdmin = vi.fn()
		const onRemove = vi.fn()
		const {view} = renderView({
			members: [alice, bob],
			canManage: true,
			currentUserId: 1,
			onToggleAdmin,
			onRemove,
		})

		const bobToggle = view.el.querySelector('tr[data-member-id="2"] .toggle-admin') as HTMLButtonElement
		const bobRemove = view.el.querySelector('tr[data-member-id="2"] .remove-member') as HTMLButtonElement

		bobToggle.click()
		expect(onToggleAdmin).toHaveBeenCalledTimes(1)
		expect(onToggleAdmin).toHaveBeenCalledWith(bob)

		bobRemove.click()
		expect(onRemove).toHaveBeenCalledTimes(1)
		expect(onRemove).toHaveBeenCalledWith(bob)
	})
})
