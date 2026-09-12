import {afterEach, describe, expect, it} from 'vitest'
import type {ViewInstance} from 'marionette'
import {ConfirmTextView} from './ConfirmTextView'

describe('ConfirmTextView', () => {
	let views: ViewInstance[] = []

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	it('renders each supplied line as a paragraph', () => {
		const lines = ['Line one of explanation', 'Line two is irreversible warning']
		const view = new ConfirmTextView({lines})
		views.push(view)
		view.render()
		document.body.appendChild(view.el)

		const paragraphs = view.el.querySelectorAll('p')
		expect(paragraphs).toHaveLength(2)
		expect(paragraphs[0].textContent?.trim()).toBe('Line one of explanation')
		expect(paragraphs[1].textContent?.trim()).toBe('Line two is irreversible warning')
	})

	it('renders nothing when lines is empty', () => {
		const view = new ConfirmTextView({lines: []})
		views.push(view)
		view.render()
		document.body.appendChild(view.el)

		const paragraphs = view.el.querySelectorAll('p')
		expect(paragraphs).toHaveLength(0)
		expect(view.el.textContent?.trim()).toBe('')
	})
})
