import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {html} from 'lit-html'
import {SuggestionListView} from './SuggestionListView'
import type {SuggestionListViewInstance, SuggestionListViewOptions} from './SuggestionListView'

function entries(...titles: string[]) {
	return titles.map(title => ({key: title, content: html`<span>${title}</span>`}))
}

function key(k: string, init: Partial<KeyboardEventInit> = {}) {
	return new KeyboardEvent('keydown', {key: k, ...init})
}

describe('SuggestionListView', () => {
	const views: SuggestionListViewInstance[] = []

	function createView(overrides: Partial<SuggestionListViewOptions> = {}) {
		const options: SuggestionListViewOptions = {
			className: 'items editor-suggestion-popup',
			itemClassName: 'item',
			emptyLabel: 'No result',
			entries: entries('Text', 'Heading 1', 'Heading 2'),
			onSelect: vi.fn(),
			...overrides,
		}
		const view = new SuggestionListView(options)
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return {view, options}
	}

	beforeEach(() => {
		document.body.innerHTML = ''
	})

	afterEach(() => {
		views.forEach(view => view.destroy())
		views.length = 0
		document.body.innerHTML = ''
	})

	it('renders one button per entry with the first selected', () => {
		const {view} = createView()
		const buttons = view.el.querySelectorAll('button')

		expect(buttons).toHaveLength(3)
		expect(buttons[0].className).toContain('is-selected')
		expect(buttons[1].className).not.toContain('is-selected')
		expect(view.el.className).toBe('items editor-suggestion-popup')
	})

	it('renders the empty label instead of buttons when there are no entries', () => {
		const {view} = createView({entries: [], emptyLabel: 'No emoji found'})

		expect(view.el.querySelectorAll('button')).toHaveLength(0)
		expect(view.el.textContent).toContain('No emoji found')
		expect(view.el.querySelector('.no-results')).not.toBeNull()
	})

	it('moves the selection with the arrow keys and wraps around', () => {
		const {view} = createView()

		expect(view.onKeyDown(key('ArrowDown'))).toBe(true)
		expect(view.getSelectedIndex()).toBe(1)

		expect(view.onKeyDown(key('ArrowUp'))).toBe(true)
		expect(view.onKeyDown(key('ArrowUp'))).toBe(true)
		expect(view.getSelectedIndex()).toBe(2)
		expect(view.el.querySelectorAll('button')[2].className).toContain('is-selected')
	})

	it('selects the highlighted entry on Enter', () => {
		const {view, options} = createView()

		view.onKeyDown(key('ArrowDown'))
		expect(view.onKeyDown(key('Enter'))).toBe(true)
		expect(options.onSelect).toHaveBeenCalledWith(1)
	})

	it('ignores keys it does not handle', () => {
		const {view, options} = createView()

		expect(view.onKeyDown(key('Tab'))).toBe(false)
		expect(options.onSelect).not.toHaveBeenCalled()
	})

	it('leaves every key to the IME while composing', () => {
		const {view, options} = createView()

		expect(view.onKeyDown(key('Enter', {isComposing: true}))).toBe(false)
		expect(view.onKeyDown(key('ArrowDown', {isComposing: true}))).toBe(false)
		expect(view.getSelectedIndex()).toBe(0)
		expect(options.onSelect).not.toHaveBeenCalled()
	})

	it('honours additional accept keys', () => {
		const {view, options} = createView({acceptKeys: ['Enter', 'Tab']})

		expect(view.onKeyDown(key('Tab'))).toBe(true)
		expect(options.onSelect).toHaveBeenCalledWith(0)
	})

	it('handles no keys at all while empty so the editor keeps the keystroke', () => {
		const {view, options} = createView({entries: []})

		expect(view.onKeyDown(key('ArrowDown'))).toBe(false)
		expect(view.onKeyDown(key('Enter'))).toBe(false)
		expect(options.onSelect).not.toHaveBeenCalled()
	})

	it('selects an entry on click', () => {
		const {view, options} = createView()

		view.el.querySelectorAll('button')[2].dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(options.onSelect).toHaveBeenCalledWith(2)
	})

	it('resets the selection when the entries change', () => {
		const {view} = createView()

		view.onKeyDown(key('ArrowDown'))
		view.setEntries(entries('Quote', 'Code'))

		expect(view.getSelectedIndex()).toBe(0)
		expect(view.el.querySelectorAll('button')).toHaveLength(2)
		expect(view.el.querySelectorAll('button')[0].className).toContain('is-selected')
	})

	it('scrolls the selected entry into view only when asked to', () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView

		const plain = createView()
		plain.view.onKeyDown(key('ArrowDown'))
		expect(scrollIntoView).not.toHaveBeenCalled()

		const scrolling = createView({scrollSelectedIntoView: true})
		scrolling.view.onKeyDown(key('ArrowDown'))
		expect(scrollIntoView).toHaveBeenCalledWith({block: 'nearest'})
	})
})
