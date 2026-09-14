import {describe, it, expect, vi} from 'vitest'
import {ImageAltMenuView} from './ImageAltMenuView'

describe('ImageAltMenuView', () => {
	it('escapes its label and anchors nested clicks to its button', () => {
		const onEdit = vi.fn()
		const view = new ImageAltMenuView({label: '<img src=x>', onEdit})
		try {
			view.render()
			document.body.appendChild(view.el)
			const button = view.el.querySelector('button')!
			expect(button.type).toBe('button')
			expect(button.textContent).toBe('<img src=x>')
			expect(view.el.querySelector('img')).toBeNull()
			const rect = new DOMRect(10, 20, 30, 40)
			vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect)
			const child = document.createElement('span')
			button.appendChild(child)
			child.click()
			expect(onEdit).toHaveBeenCalledWith(rect)
			view.destroy()
			child.click()
			expect(onEdit).toHaveBeenCalledTimes(1)
			expect(document.body.contains(button)).toBe(false)
		} finally {
			view.destroy()
		}
	})
})
