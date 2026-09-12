import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {UserSearchView} from './UserSearchView'
import type {UserSearchOption, UserSearchViewInstance} from './UserSearchView'

describe('UserSearchView', () => {
	const views: UserSearchViewInstance[] = []

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		for (const view of views) {
			view.destroy()
		}
		views.length = 0
		document.body.innerHTML = ''
	})

	function createView(overrides: Partial<ConstructorParameters<typeof UserSearchView>[0]> = {}): UserSearchViewInstance {
		const view = new UserSearchView({
			placeholder: 'Search users...',
			onSearch: vi.fn(),
			onSelect: vi.fn(),
			...overrides,
		})
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return view
	}

	it('renders input carrying the supplied placeholder inside .input-wrapper within .multiselect', () => {
		const view = createView({placeholder: 'Find a member'})
		expect(view.el.classList.contains('multiselect')).toBe(true)
		const inputWrapper = view.el.querySelector('.input-wrapper')
		expect(inputWrapper).not.toBeNull()
		const input = inputWrapper?.querySelector('input') as HTMLInputElement | null
		expect(input).not.toBeNull()
		expect(input?.getAttribute('placeholder')).toBe('Find a member')
	})

	it('does not call onSearch before the delay has elapsed', () => {
		const onSearch = vi.fn()
		const view = createView({onSearch, searchDelay: 200})
		const input = view.el.querySelector('.input-wrapper input') as HTMLInputElement

		input.value = 'al'
		input.dispatchEvent(new Event('input', {bubbles: true}))

		vi.advanceTimersByTime(199)
		expect(onSearch).not.toHaveBeenCalled()
	})

	it('produces exactly one onSearch call with the final value when three quick keystrokes occur', () => {
		const onSearch = vi.fn()
		const view = createView({onSearch, searchDelay: 200})
		const input = view.el.querySelector('.input-wrapper input') as HTMLInputElement

		input.value = 'a'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		vi.advanceTimersByTime(50)

		input.value = 'al'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		vi.advanceTimersByTime(50)

		input.value = 'ali'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		vi.advanceTimersByTime(199)
		expect(onSearch).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(onSearch).toHaveBeenCalledTimes(1)
		expect(onSearch).toHaveBeenCalledWith('ali')
	})

	it('clearing the input to empty calls onSearch with empty string and clears .search-results from the DOM', () => {
		const onSearch = vi.fn()
		const view = createView({onSearch, searchDelay: 200})
		view.setResults([
			{id: 1, username: 'alice', name: 'Alice'},
		])
		expect(view.el.querySelector('.search-results')).not.toBeNull()

		const input = view.el.querySelector('.input-wrapper input') as HTMLInputElement
		input.value = ''
		input.dispatchEvent(new Event('input', {bubbles: true}))

		vi.advanceTimersByTime(200)
		expect(onSearch).toHaveBeenCalledTimes(1)
		expect(onSearch).toHaveBeenCalledWith('')
		expect(view.el.querySelector('.search-results')).toBeNull()
	})

	it('.search-results is absent before any results and present after setResults', () => {
		const view = createView()
		expect(view.el.querySelector('.search-results')).toBeNull()

		const users: ReadonlyArray<UserSearchOption> = [
			{id: 1, username: 'alice', name: 'Alice'},
			{id: 2, username: 'bob', name: 'Bob'},
		]
		view.setResults(users)

		const resultsEl = view.el.querySelector('.search-results')
		expect(resultsEl).not.toBeNull()
		expect(resultsEl?.children.length).toBe(2)
	})

	it('a result direct child shows the display name, falling back to username when name is empty', () => {
		const view = createView()
		const users: ReadonlyArray<UserSearchOption> = [
			{id: 1, username: 'alice', name: 'Alice Smith'},
			{id: 2, username: 'bob_user', name: ''},
		]
		view.setResults(users)

		const resultsEl = view.el.querySelector('.search-results')
		expect(resultsEl).not.toBeNull()
		const firstChild = resultsEl?.children[0] as HTMLElement
		const secondChild = resultsEl?.children[1] as HTMLElement

		expect(firstChild.textContent?.trim()).toBe('Alice Smith')
		expect(secondChild.textContent?.trim()).toBe('bob_user')
	})

	it('clicking a result reports it, makes getSelected return it, and removes .search-results', () => {
		const onSelect = vi.fn()
		const view = createView({onSelect})
		const user: UserSearchOption = {id: 42, username: 'carol', name: 'Carol Danvers'}
		view.setResults([user])

		const resultsEl = view.el.querySelector('.search-results')
		expect(resultsEl).not.toBeNull()
		const firstChild = resultsEl?.children[0] as HTMLElement

		firstChild.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onSelect).toHaveBeenCalledTimes(1)
		expect(onSelect).toHaveBeenCalledWith(user)
		expect(view.getSelected()).toEqual(user)
		expect(view.el.querySelector('.search-results')).toBeNull()
	})

	it('clearSelection reports null and leaves nothing selected', () => {
		const onSelect = vi.fn()
		const view = createView({onSelect})
		const user: UserSearchOption = {id: 1, username: 'alice', name: 'Alice'}
		view.setResults([user])

		const firstChild = view.el.querySelector('.search-results')?.children[0] as HTMLElement
		firstChild.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(view.getSelected()).toEqual(user)
		expect(onSelect).toHaveBeenCalledWith(user)

		onSelect.mockClear()
		view.clearSelection()

		expect(view.getSelected()).toBeNull()
		expect(onSelect).toHaveBeenCalledTimes(1)
		expect(onSelect).toHaveBeenCalledWith(null)
	})
})
