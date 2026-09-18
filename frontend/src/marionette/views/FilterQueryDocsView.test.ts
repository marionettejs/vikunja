import {afterEach, describe, expect, it} from 'vitest'
import type {ViewInstance} from 'marionette'
import {FilterQueryDocsView} from './FilterQueryDocsView'

describe('FilterQueryDocsView', () => {
	let views: ViewInstance[] = []

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	function createView(t: (key: string) => string = (k) => k) {
		const view = new FilterQueryDocsView({t})
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return view
	}

	it('is closed by default', () => {
		const view = createView()

		const content = view.el.querySelector('.content')
		expect(content).toBeNull()

		const toggle = view.el.querySelector<HTMLButtonElement>('.filter-docs-toggle')
		expect(toggle).not.toBeNull()
		expect(toggle?.textContent?.trim()).toBe('filters.query.help.link')
		// The docs may live inside a form (FilterEdit); the toggle must not submit it.
		expect(toggle?.getAttribute('type')).toBe('button')
	})

	it('click toggles open then closed', () => {
		const tCalls: string[] = []
		const t = (key: string) => {
			tCalls.push(key)
			return key
		}
		const view = createView(t)

		const toggle = view.el.querySelector<HTMLButtonElement>('.filter-docs-toggle')!
		toggle.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		let content = view.el.querySelector('.content')
		expect(content).not.toBeNull()

		const sections = [
			'filters.query.help.intro',
			'filters.query.help.canUseDatemath',
			'filters.query.help.operators.intro',
			'filters.query.help.logicalOperators.intro',
			'filters.query.help.examples.intro',
		]
		for (const section of sections) {
			expect(tCalls).toContain(section)
		}

		for (const field of [
			'done', 'priority', 'percentDone', 'dueDate', 'startDate', 'endDate',
			'doneAt', 'assignees', 'createdBy', 'labels', 'project', 'reminders',
			'created', 'updated',
		]) {
			expect(tCalls).toContain(`filters.query.help.fields.${field}`)
		}

		for (const op of ['notEqual', 'equal', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'like', 'in', 'notIn']) {
			expect(tCalls).toContain(`filters.query.help.operators.${op}`)
		}

		for (const op of ['and', 'or', 'parentheses']) {
			expect(tCalls).toContain(`filters.query.help.logicalOperators.${op}`)
		}

		for (const ex of ['priorityEqual', 'dueDatePast', 'undoneHighPriority', 'assigneesIn', 'createdByEqual', 'priorityOneOrTwoPastDue']) {
			expect(tCalls).toContain(`filters.query.help.examples.${ex}`)
		}

		tCalls.length = 0
		toggle.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		content = view.el.querySelector('.content')
		expect(content).toBeNull()
	})

	it('open state contains every section with fake-t marker', () => {
		const marker = 'T_'
		const t = (key: string) => `${marker}${key}`
		const view = createView(t)

		const toggle = view.el.querySelector<HTMLButtonElement>('.filter-docs-toggle')!
		toggle.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		const content = view.el.querySelector('.content')!
		const text = content.textContent ?? ''

		expect(text).toContain(`${marker}filters.query.help.intro`)
		expect(text).toContain(`${marker}filters.query.help.canUseDatemath`)
		expect(text).toContain(`${marker}filters.query.help.operators.intro`)
		expect(text).toContain(`${marker}filters.query.help.logicalOperators.intro`)
		expect(text).toContain(`${marker}filters.query.help.examples.intro`)

		for (const field of [
			'done', 'priority', 'percentDone', 'dueDate', 'startDate', 'endDate',
			'doneAt', 'assignees', 'createdBy', 'labels', 'project', 'reminders',
			'created', 'updated',
		]) {
			expect(text).toContain(`${marker}filters.query.help.fields.${field}`)
		}

		for (const op of ['notEqual', 'equal', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'like', 'in', 'notIn']) {
			expect(text).toContain(`${marker}filters.query.help.operators.${op}`)
		}

		for (const op of ['and', 'or', 'parentheses']) {
			expect(text).toContain(`${marker}filters.query.help.logicalOperators.${op}`)
		}

		for (const ex of ['priorityEqual', 'dueDatePast', 'undoneHighPriority', 'assigneesIn', 'createdByEqual', 'priorityOneOrTwoPastDue']) {
			expect(text).toContain(`${marker}filters.query.help.examples.${ex}`)
		}
	})
})