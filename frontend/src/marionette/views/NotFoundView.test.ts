import {describe, it, expect, afterEach} from 'vitest'
import type {ViewInstance} from 'marionette'
import NotFoundView, {type NotFoundViewOptions} from './NotFoundView'

let activeViews: ViewInstance[] = []

function renderView(options: NotFoundViewOptions): HTMLElement {
	const view = new NotFoundView(options)
	activeViews.push(view)
	view.render()
	return view.el as HTMLElement
}

afterEach(() => {
	for (const view of activeViews) {
		view.destroy()
	}
	activeViews = []
	document.body.innerHTML = ''
})

describe('NotFoundView', () => {
	it('renders title and text in centered content div', () => {
		const el = renderView({
			title: 'Not found',
			text: 'The page you requested does not exist.',
		})

		expect(el.classList.contains('content')).toBe(true)
		expect(el.classList.contains('has-text-centered')).toBe(true)

		const h1 = el.querySelector('h1')
		expect(h1).not.toBeNull()
		expect(h1?.textContent).toBe('Not found')

		const p = el.querySelector('p')
		expect(p).not.toBeNull()
		expect(p?.textContent).toBe('The page you requested does not exist.')
	})

	it('renders different title and text when provided', () => {
		const el = renderView({
			title: 'Custom 404',
			text: 'Custom message here.',
		})

		const h1 = el.querySelector('h1')
		expect(h1?.textContent).toBe('Custom 404')

		const p = el.querySelector('p')
		expect(p?.textContent).toBe('Custom message here.')
	})

	it('treats markup characters in title/text as literal text, not HTML', () => {
		const el = renderView({
			title: '<script>alert(1)</script>',
			text: '<b>bold</b> & <i>italic</i>',
		})

		expect(el.querySelector('script')).toBeNull()
		expect(el.querySelector('b')).toBeNull()
		expect(el.querySelector('i')).toBeNull()
		expect(el.textContent).toContain('<script>alert(1)</script>')
		expect(el.textContent).toContain('<b>bold</b> & <i>italic</i>')
	})

	it('renders a new snapshot in a new view', () => {
		const view = new NotFoundView({
			title: 'First',
			text: 'First text',
		})
		activeViews.push(view)
		view.render()
		expect((view.el as HTMLElement).querySelector('h1')?.textContent).toBe('First')

		const view2 = new NotFoundView({
			title: 'Second',
			text: 'Second text',
		})
		activeViews.push(view2)
		view2.render()
		expect((view2.el as HTMLElement).querySelector('h1')?.textContent).toBe('Second')
		expect((view2.el as HTMLElement).querySelector('p')?.textContent).toBe('Second text')
	})
})