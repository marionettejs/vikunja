import {describe, it, expect, afterEach, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import TeamsListView, {type TeamsListOptions} from './TeamsListView'

let activeViews: ViewInstance[] = []

function renderView(options: TeamsListOptions): HTMLElement {
	const view = new TeamsListView(options)
	activeViews.push(view)
	view.render()
	document.body.appendChild(view.el as HTMLElement)
	return view.el as HTMLElement
}

afterEach(() => {
	for (const view of activeViews) {
		view.destroy()
	}
	activeViews = []
	document.body.innerHTML = ''
})

const defaultLabels = {
	title: 'Teams',
	create: 'Create team',
	noTeams: 'No teams here.',
}

const defaultHrefFor = (path: string) => path

describe('TeamsListView', () => {
	it('renders the create link as an anchor with the button class pointing at the new team path', () => {
		const el = renderView({
			teams: [],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate: vi.fn(),
		})

		const anchor = el.querySelector('a.button.is-pulled-end')
		expect(anchor).not.toBeNull()
		expect(anchor?.getAttribute('href')).toBe('/teams/new')
		expect(anchor?.classList.contains('button')).toBe(true)
		expect(anchor?.classList.contains('is-pulled-end')).toBe(true)
		expect(anchor?.textContent?.trim()).toBe(defaultLabels.create)

		const h1 = el.querySelector('h1')
		expect(h1).not.toBeNull()
		expect(h1?.textContent?.trim()).toBe(defaultLabels.title)
	})

	it('renders every team as a list item inside ul.teams linking to that team edit path', () => {
		const teams = [
			{id: 1, name: 'Alpha'},
			{id: 2, name: 'Beta'},
			{id: 3, name: 'Gamma'},
		]
		const el = renderView({
			teams,
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate: vi.fn(),
		})

		const card = el.querySelector('div.card > div.card-content.loader-container.p-0')
		expect(card).not.toBeNull()

		const ul = el.querySelector('ul.teams')
		expect(ul).not.toBeNull()
		const items = ul?.querySelectorAll('li')
		expect(items?.length).toBe(3)

		items?.forEach((li, index) => {
			const team = teams[index]
			const anchor = li.querySelector('a')
			expect(anchor?.getAttribute('href')).toBe(`/teams/${team.id}/edit`)
			const p = anchor?.querySelector('p')
			expect(p?.textContent?.trim()).toBe(team.name)
		})
	})

	it('escapes markup in a team name instead of injecting it', () => {
		const evilName = '<img src=x onerror=alert(1)>'
		const el = renderView({
			teams: [{id: 42, name: evilName}],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate: vi.fn(),
		})

		expect(el.querySelector('img')).toBeNull()
		expect(el.textContent).toContain(evilName)
	})

	it('renders the empty state and no team list when there are no teams', () => {
		const el = renderView({
			teams: [],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate: vi.fn(),
		})

		expect(el.querySelector('ul.teams')).toBeNull()
		expect(el.querySelector('div.card')).toBeNull()

		const p = el.querySelector('p.has-text-centered.has-text-grey.is-italic')
		expect(p).not.toBeNull()
		expect(p?.textContent).toContain(defaultLabels.noTeams)

		const anchor = p?.querySelector('a')
		expect(anchor?.getAttribute('href')).toBe('/teams/new')
	})

	it('renders the team list and no empty state when teams are present', () => {
		const el = renderView({
			teams: [{id: 1, name: 'Team One'}],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate: vi.fn(),
		})

		expect(el.querySelector('ul.teams')).not.toBeNull()
		expect(el.querySelector('p.has-text-centered')).toBeNull()
	})

	it('navigates in-app instead of following the create link', () => {
		const navigate = vi.fn()
		const el = renderView({
			teams: [],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate,
		})

		const anchor = el.querySelector('a.button.is-pulled-end') as HTMLAnchorElement
		const event = new MouseEvent('click', {bubbles: true, cancelable: true})
		anchor.dispatchEvent(event)

		expect(navigate).toHaveBeenCalledTimes(1)
		expect(navigate).toHaveBeenCalledWith('/teams/new')
		expect(event.defaultPrevented).toBe(true)
	})

	it('navigates in-app to the edit path when a team link is clicked', () => {
		const navigate = vi.fn()
		const el = renderView({
			teams: [{id: 99, name: 'Design'}],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate,
		})

		const anchor = el.querySelector('ul.teams li a') as HTMLAnchorElement
		const event = new MouseEvent('click', {bubbles: true, cancelable: true})
		anchor.dispatchEvent(event)

		expect(navigate).toHaveBeenCalledTimes(1)
		expect(navigate).toHaveBeenCalledWith('/teams/99/edit')
		expect(event.defaultPrevented).toBe(true)
	})

	it('leaves a modified click to the browser so a link can open in a new tab', () => {
		const modifiers = ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const
		for (const modifier of modifiers) {
			const navigate = vi.fn()
			const el = renderView({
			teams: [{id: 1, name: 'Team One'}],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate,
			})
			const anchor = el.querySelector('ul.teams li a') as HTMLAnchorElement
			const event = new MouseEvent('click', {bubbles: true, cancelable: true, [modifier]: true})
			anchor.dispatchEvent(event)

			expect(navigate).not.toHaveBeenCalled()
			expect(event.defaultPrevented).toBe(false)
		}
	})

	it('leaves a non-primary button click to the browser', () => {
		const navigate = vi.fn()
		const el = renderView({
			teams: [{id: 1, name: 'Team One'}],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate,
		})
		const anchor = el.querySelector('ul.teams li a') as HTMLAnchorElement
		const event = new MouseEvent('click', {bubbles: true, cancelable: true, button: 1})
		anchor.dispatchEvent(event)

		expect(navigate).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(false)
	})

	it('leaves an already prevented click alone', () => {
		const navigate = vi.fn()
		const el = renderView({
			teams: [{id: 1, name: 'Team One'}],
			labels: defaultLabels,
			hrefFor: defaultHrefFor,
			navigate,
		})
		const anchor = el.querySelector('ul.teams li a') as HTMLAnchorElement
		const event = new MouseEvent('click', {bubbles: true, cancelable: true})
		event.preventDefault()
		anchor.dispatchEvent(event)

		expect(navigate).not.toHaveBeenCalled()
	})

	it('applies the application base to every link href', () => {
		const hrefFor = (path: string) => `/vikunja${path}`
		const teams = [
			{id: 1, name: 'Alpha'},
			{id: 2, name: 'Beta'},
		]
		const el = renderView({
			teams,
			labels: defaultLabels,
			hrefFor,
			navigate: vi.fn(),
		})

		const createAnchor = el.querySelector('a.button.is-pulled-end')
		expect(createAnchor?.getAttribute('href')).toBe('/vikunja/teams/new')
		expect(createAnchor?.getAttribute('data-path')).toBe('/teams/new')

		const teamAnchors = el.querySelectorAll('ul.teams li a')
		expect(teamAnchors.length).toBe(2)
		teamAnchors.forEach((anchor, index) => {
			const team = teams[index]
			expect(anchor.getAttribute('href')).toBe(`/vikunja/teams/${team.id}/edit`)
			expect(anchor.getAttribute('data-path')).toBe(`/teams/${team.id}/edit`)
		})

		const emptyEl = renderView({
			teams: [],
			labels: defaultLabels,
			hrefFor,
			navigate: vi.fn(),
		})
		const emptyCreateAnchor = emptyEl.querySelector('p.has-text-centered.has-text-grey.is-italic a')
		expect(emptyCreateAnchor?.getAttribute('href')).toBe('/vikunja/teams/new')
		expect(emptyCreateAnchor?.getAttribute('data-path')).toBe('/teams/new')
	})

	it('navigates to the unbased path so the router does not apply the base twice', () => {
		const hrefFor = (path: string) => `/vikunja${path}`
		const navigate = vi.fn()
		const el = renderView({
			teams: [{id: 1, name: 'Alpha'}],
			labels: defaultLabels,
			hrefFor,
			navigate,
		})

		const teamAnchor = el.querySelector('ul.teams li a') as HTMLAnchorElement
		const teamEvent = new MouseEvent('click', {bubbles: true, cancelable: true})
		teamAnchor.dispatchEvent(teamEvent)

		expect(navigate).toHaveBeenCalledTimes(1)
		expect(navigate).toHaveBeenCalledWith('/teams/1/edit')
		expect(navigate).not.toHaveBeenCalledWith('/vikunja/teams/1/edit')

		const createAnchor = el.querySelector('a.button.is-pulled-end') as HTMLAnchorElement
		const createEvent = new MouseEvent('click', {bubbles: true, cancelable: true})
		createAnchor.dispatchEvent(createEvent)

		expect(navigate).toHaveBeenCalledTimes(2)
		expect(navigate).toHaveBeenLastCalledWith('/teams/new')
		expect(navigate).not.toHaveBeenCalledWith('/vikunja/teams/new')
	})
})
