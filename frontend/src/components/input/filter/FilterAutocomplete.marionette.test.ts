import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {html} from 'lit-html'

vi.mock('@/helpers/avatarCache', async importOriginal => {
	const original = await importOriginal<typeof import('@/helpers/avatarCache')>()
	return {...original, fetchAvatarBlobUrl: vi.fn(async () => 'blob:avatar')}
})

import {buildFilterEntries} from './FilterAutocomplete'
import type {AutocompleteItem} from './FilterAutocomplete'
import {SuggestionListView} from '@/marionette/views/SuggestionListView'
import type {SuggestionListViewInstance, SuggestionListViewOptions} from '@/marionette/views/SuggestionListView'
import type {UserAvatarViewInstance} from '@/marionette/views/UserAvatarView'
import type {IUser} from '@/modelTypes/IUser'
import type {IProject} from '@/modelTypes/IProject'
import type {Label} from '@/client/generated'

function makeItem(fieldType: AutocompleteItem['fieldType'], item: Label | IUser | IProject, id: number | string, title: string): AutocompleteItem {
	return {
		id,
		title,
		item,
		fieldType,
		context: {
			field: '',
			prefix: '',
			keyword: '',
			search: '',
			operator: '=',
			startPos: 0,
			endPos: 0,
			isComplete: false,
			quoteChar: '',
		},
	}
}

function entries(...titles: string[]) {
	return titles.map(title => ({key: title, content: html`<span>${title}</span>`}))
}

describe('buildFilterEntries', () => {
	const views: SuggestionListViewInstance[] = []
	const avatarViews: UserAvatarViewInstance[] = []

	function createView(overrides: Partial<SuggestionListViewOptions> = {}) {
		const options: SuggestionListViewOptions = {
			className: 'filter-autocompletes',
			itemClassName: 'filter-autocomplete',
			emptyLabel: 'No result',
			entries: entries('Project A', 'Project B', 'Project C'),
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
		avatarViews.forEach(view => view.destroy())
		avatarViews.length = 0
		document.body.innerHTML = ''
	})

	it('renders one button per entry with the first selected', () => {
		const {view} = createView()
		const buttons = view.el.querySelectorAll('button')

		expect(buttons).toHaveLength(3)
		expect(buttons[0].className).toContain('is-selected')
		expect(buttons[1].className).not.toContain('is-selected')
		expect(view.el.className).toBe('filter-autocompletes')
	})

	it('selects an entry on click', () => {
		const {view, options} = createView()

		view.el.querySelectorAll('button')[2].dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(options.onSelect).toHaveBeenCalledWith(2)
	})

	it('renders user entries with avatar and username', () => {
		const items = ['alice', 'bob', 'charlie'].map(username =>
			makeItem('users', {username} as IUser, username, username),
		)
		const {view} = createView({entries: buildFilterEntries(items, avatarViews)})

		const buttons = view.el.querySelectorAll('button')
		expect(buttons).toHaveLength(3)

		expect(buttons[0].querySelector('.filter-autocomplete__avatar')).not.toBeNull()
		expect(buttons[0].querySelector('.filter-autocomplete__username')?.textContent).toBe('alice')
		expect(buttons[1].querySelector('.filter-autocomplete__username')?.textContent).toBe('bob')
		expect(buttons[2].querySelector('.filter-autocomplete__username')?.textContent).toBe('charlie')
	})

	it('renders label entries with title and label colors', () => {
		const items = [
			makeItem('labels', {title: 'Red Label', hex_color: 'ff0000'} as Label, 1, 'Red Label'),
			makeItem('labels', {title: 'No Color Label'} as Label, 2, 'No Color Label'),
		]
		const {view} = createView({entries: buildFilterEntries(items, avatarViews)})

		const buttons = view.el.querySelectorAll('button')
		expect(buttons).toHaveLength(2)

		expect(buttons[0].querySelector('.filter-autocomplete__label')?.getAttribute('style')).toContain('background: #ff0000')
		expect(buttons[0].querySelector('.filter-autocomplete__label')?.textContent).toBe('Red Label')
		expect(buttons[1].querySelector('.filter-autocomplete__label')?.getAttribute('style')).toContain('background: var(--grey-200)')
		expect(buttons[1].querySelector('.filter-autocomplete__label')?.textContent).toBe('No Color Label')
	})

	it('renders project entries with title', () => {
		const items = [
			makeItem('projects', {title: 'Project One'} as IProject, 1, 'Project One'),
			makeItem('projects', {title: 'Project Two'} as IProject, 2, 'Project Two'),
		]
		const {view} = createView({entries: buildFilterEntries(items, avatarViews)})

		const buttons = view.el.querySelectorAll('button')
		expect(buttons).toHaveLength(2)

		expect(buttons[0].querySelector('.filter-autocomplete__project')?.textContent).toBe('Project One')
		expect(buttons[1].querySelector('.filter-autocomplete__project')?.textContent).toBe('Project Two')
	})
})