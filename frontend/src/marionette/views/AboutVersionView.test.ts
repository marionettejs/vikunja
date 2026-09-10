import {describe, it, expect, afterEach} from 'vitest'
import type {ViewInstance} from 'marionette'
import AboutVersionView, {type AboutVersionOptions} from './AboutVersionView'

let activeViews: ViewInstance[] = []

function renderView(options: AboutVersionOptions): HTMLElement {
	const view = new AboutVersionView(options)
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

describe('AboutVersionView', () => {
	describe('equal versions (single line)', () => {
		it('renders a single version paragraph with p-4 wrapper when versions are equal', () => {
			const el = renderView({
				lines: ['Version: 1.2.3'],
			})

			expect(el.classList.contains('p-4')).toBe(true)
			const paras = el.querySelectorAll('p')
			expect(paras).toHaveLength(1)
			expect(paras[0].textContent).toBe('Version: 1.2.3')
		})

		it('renders no separate frontend/api paragraphs when only one line is passed', () => {
			const el = renderView({
				lines: ['Version: 0.1.0'],
			})

			expect(el.textContent).not.toContain('Frontend version')
			expect(el.textContent).not.toContain('API version')
		})
	})

	describe('separate versions (two lines)', () => {
		it('renders two paragraphs when frontend and api versions differ', () => {
			const el = renderView({
				lines: ['Frontend version: 1.9.9', 'API version: 2.0.0'],
			})

			const paras = el.querySelectorAll('p')
			expect(paras).toHaveLength(2)
			expect(paras[0].textContent).toBe('Frontend version: 1.9.9')
			expect(paras[1].textContent).toBe('API version: 2.0.0')
		})

		it('renders no single-version paragraph when separate lines are passed', () => {
			const el = renderView({
				lines: ['Frontend version: 1.9.9', 'API version: 2.0.0'],
			})

			const paras = Array.from(el.querySelectorAll('p'))
			const hasSingleVersion = paras.some(p => p.textContent?.startsWith('Version:'))
			expect(hasSingleVersion).toBe(false)
		})
	})

	describe('data updates', () => {
		it('renders a new snapshot in a new view', () => {
			const view = new AboutVersionView({
				lines: ['Version: 1.0.0'],
			})
			activeViews.push(view)
			view.render()
			expect((view.el as HTMLElement).querySelector('p')?.textContent).toBe('Version: 1.0.0')

			const view2 = new AboutVersionView({
				lines: ['Frontend version: 1.0.0', 'API version: 2.0.0'],
			})
			activeViews.push(view2)
			view2.render()
			const paras = (view2.el as HTMLElement).querySelectorAll('p')
			expect(paras).toHaveLength(2)
			expect(paras[0].textContent).toBe('Frontend version: 1.0.0')
			expect(paras[1].textContent).toBe('API version: 2.0.0')
		})
	})

	describe('markup characters in version strings', () => {
		it('treats version strings containing < > & as literal text, not HTML', () => {
			const el = renderView({
				lines: ['<b>1.0</b>'],
			})

			expect(el.querySelector('b')).toBeNull()
			expect(el.textContent).toContain('<b>1.0</b>')
		})

		it('escapes & in version strings', () => {
			const el = renderView({
				lines: ['1.0 & 2.0'],
			})

			expect(el.querySelector('p')?.textContent).toContain('1.0 & 2.0')
		})
	})
})
