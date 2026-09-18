import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {PopupView, type PopupViewOptions} from './PopupView'

type PopupViewInstance = ViewInstance & {
	toggle: () => boolean
	close: () => void
}

describe('PopupView', () => {
	let views: ViewInstance[] = []

	const createView = (overrides: Partial<PopupViewOptions> = {}) => {
		const options: PopupViewOptions = {
			open: false,
			hasOverflow: false,
			ignoreClickClasses: [],
			onOpenChange: vi.fn(),
			...overrides,
		}
		const view = new PopupView(options) as PopupViewInstance
		views.push(view)
		view.render()
		document.body.appendChild(view.el)
		return {view, options}
	}

	beforeEach(() => {
		document.body.innerHTML = ''
	})

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	it('renders with correct initial classes and inert when closed', () => {
		const {view} = createView({open: false})
		const popup = view.el.querySelector('.popup') as HTMLElement

		expect(popup).not.toBeNull()
		expect(popup.classList.contains('popup')).toBe(true)
		expect(popup.classList.contains('is-open')).toBe(false)
		expect(popup.classList.contains('has-overflow')).toBe(false)
		expect(popup.hasAttribute('inert')).toBe(true)
	})

	it('renders with is-open class and no inert when initially open', () => {
		const {view} = createView({open: true})
		const popup = view.el.querySelector('.popup') as HTMLElement

		expect(popup.classList.contains('is-open')).toBe(true)
		expect(popup.hasAttribute('inert')).toBe(false)
	})

	it('adds has-overflow class only when hasOverflow and open', () => {
		const {view: view1} = createView({open: true, hasOverflow: true})
		const popup1 = view1.el.querySelector('.popup') as HTMLElement
		expect(popup1.classList.contains('has-overflow')).toBe(true)

		const {view: view2} = createView({open: false, hasOverflow: true})
		const popup2 = view2.el.querySelector('.popup') as HTMLElement
		expect(popup2.classList.contains('has-overflow')).toBe(false)

		const {view: view3} = createView({open: true, hasOverflow: false})
		const popup3 = view3.el.querySelector('.popup') as HTMLElement
		expect(popup3.classList.contains('has-overflow')).toBe(false)
	})

	it('toggle flips open state and notifies via onOpenChange', () => {
		const {view, options} = createView({open: false})

		const result = view.toggle()
		expect(result).toBe(true)
		expect(options.onOpenChange).toHaveBeenCalledWith(true)

		const popup = view.el.querySelector('.popup') as HTMLElement
		expect(popup.classList.contains('is-open')).toBe(true)
		expect(popup.hasAttribute('inert')).toBe(false)

		const result2 = view.toggle()
		expect(result2).toBe(false)
		expect(options.onOpenChange).toHaveBeenCalledWith(false)

		expect(popup.classList.contains('is-open')).toBe(false)
		expect(popup.hasAttribute('inert')).toBe(true)
	})

	it('toggle returns false and does not change state when closedByClickOutside guard is set', () => {
		const {view, options} = createView({open: true})
		const trigger = view.el.querySelector('[data-region="trigger"]') as HTMLElement

		// Click outside to close and set the guard
		const outsideClick = new MouseEvent('click', {bubbles: true})
		document.dispatchEvent(outsideClick)
		expect(options.onOpenChange).toHaveBeenCalledWith(false)
		expect(options.onOpenChange).toHaveBeenCalledTimes(1)

		// Click trigger - should not reopen due to guard
		const triggerClick = new MouseEvent('click', {bubbles: true})
		trigger.dispatchEvent(triggerClick)

		expect(options.onOpenChange).toHaveBeenCalledTimes(1)
		const popup = view.el.querySelector('.popup') as HTMLElement
		expect(popup.classList.contains('is-open')).toBe(false)
	})

	it('outside click closes popup and notifies', () => {
		const {view, options} = createView({open: true})
		expect(options.onOpenChange).toHaveBeenCalledTimes(0)

		const event = new MouseEvent('click', {bubbles: true})
		document.dispatchEvent(event)

		expect(options.onOpenChange).toHaveBeenCalledWith(false)
		const popup = view.el.querySelector('.popup') as HTMLElement
		expect(popup.classList.contains('is-open')).toBe(false)
	})

	it('outside click does nothing when popup is already closed', () => {
		const {view, options} = createView({open: false})

		const event = new MouseEvent('click', {bubbles: true})
		document.dispatchEvent(event)

		expect(options.onOpenChange).not.toHaveBeenCalled()
	})

	it('outside click is ignored when target has ignored class', () => {
		const {view, options} = createView({
			open: true,
			ignoreClickClasses: ['ignored-class'],
		})

		const ignoredEl = document.createElement('div')
		ignoredEl.classList.add('ignored-class')
		document.body.appendChild(ignoredEl)

		const event = new MouseEvent('click', {bubbles: true})
		ignoredEl.dispatchEvent(event)

		expect(options.onOpenChange).not.toHaveBeenCalled()
		const popup = view.el.querySelector('.popup') as HTMLElement
		expect(popup.classList.contains('is-open')).toBe(true)
	})

	it('content click does not close popup', () => {
		const {view, options} = createView({open: true})
		const popup = view.el.querySelector('.popup') as HTMLElement

		const event = new MouseEvent('click', {bubbles: true})
		popup.dispatchEvent(event)

		expect(options.onOpenChange).not.toHaveBeenCalled()
		expect(popup.classList.contains('is-open')).toBe(true)
	})

	it('trigger click toggles popup', () => {
		const {view, options} = createView({open: false})
		const trigger = view.el.querySelector('[data-region="trigger"]') as HTMLElement

		const event = new MouseEvent('click', {bubbles: true})
		trigger.dispatchEvent(event)

		expect(options.onOpenChange).toHaveBeenCalledWith(true)
		const popup = view.el.querySelector('.popup') as HTMLElement
		expect(popup.classList.contains('is-open')).toBe(true)

		const event2 = new MouseEvent('click', {bubbles: true})
		trigger.dispatchEvent(event2)

		expect(options.onOpenChange).toHaveBeenCalledWith(false)
		expect(popup.classList.contains('is-open')).toBe(false)
	})

	it('Escape closes popup only when open and focus is inside popup or on lastFocused', () => {
		const triggerBtn = document.createElement('button')
		document.body.appendChild(triggerBtn)
		triggerBtn.focus()

		const {view, options} = createView({open: false})
		const popup = view.el.querySelector('.popup') as HTMLElement

		view.toggle()
		const focusInEvent = new FocusEvent('focusin', {bubbles: true})
		popup.dispatchEvent(focusInEvent)

		const escapeInside = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
		popup.dispatchEvent(escapeInside)
		expect(options.onOpenChange).toHaveBeenCalledWith(false)

		view.destroy()
		views = views.filter(v => v !== view)
		document.body.innerHTML = ''

		const triggerBtn2 = document.createElement('button')
		document.body.appendChild(triggerBtn2)
		triggerBtn2.focus()

		const {view: view2, options: options2} = createView({open: false})
		const popup2 = view2.el.querySelector('.popup') as HTMLElement

		view2.toggle()
		const focusInEvent2 = new FocusEvent('focusin', {bubbles: true})
		popup2.dispatchEvent(focusInEvent2)

		const escapeOnTrigger = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
		triggerBtn2.dispatchEvent(escapeOnTrigger)
		expect(options2.onOpenChange).toHaveBeenCalledWith(false)
	})

	it('Escape does not close when defaultPrevented', () => {
		const {view, options} = createView({open: true})
		const popup = view.el.querySelector('.popup') as HTMLElement

		const escapeEvent = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})
		escapeEvent.preventDefault()
		popup.dispatchEvent(escapeEvent)

		expect(options.onOpenChange).not.toHaveBeenCalled()
	})

	it('Escape does not close when focus is outside popup and not on lastFocused', () => {
		const {view, options} = createView({open: true})
		const outsideBtn = document.createElement('button')
		document.body.appendChild(outsideBtn)
		outsideBtn.focus()

		const escapeEvent = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
		outsideBtn.dispatchEvent(escapeEvent)

		expect(options.onOpenChange).not.toHaveBeenCalled()
	})

	it('records lastFocused on open via toggle and restores focus on close when focus entered popup', () => {
		const triggerBtn = document.createElement('button')
		document.body.appendChild(triggerBtn)
		triggerBtn.focus()
		expect(document.activeElement).toBe(triggerBtn)

		const {view} = createView({open: false})
		const popup = view.el.querySelector('.popup') as HTMLElement

		view.toggle()
		const focusInEvent = new FocusEvent('focusin', {bubbles: true})
		popup.dispatchEvent(focusInEvent)

		view.close()

		expect(document.activeElement).toBe(triggerBtn)
	})

	it('does not restore focus when focus never entered popup', () => {
		const triggerBtn = document.createElement('button')
		document.body.appendChild(triggerBtn)
		triggerBtn.focus()

		const {view} = createView({open: false})
		view.toggle()
		view.close()

		expect(document.activeElement).toBe(triggerBtn)
	})

	it('does not restore focus when lastFocused is disconnected', () => {
		const triggerBtn = document.createElement('button')
		document.body.appendChild(triggerBtn)
		triggerBtn.focus()

		const {view} = createView({open: false})
		const popup = view.el.querySelector('.popup') as HTMLElement

		view.toggle()
		const focusInEvent = new FocusEvent('focusin', {bubbles: true})
		popup.dispatchEvent(focusInEvent)

		triggerBtn.remove()

		view.close()

		expect(document.activeElement).toBe(document.body)
	})

	it('destroy removes document listeners and can be called twice safely', () => {
		const {view} = createView({open: true})

		const clickSpy = vi.spyOn(document, 'removeEventListener')
		const keydownSpy = vi.spyOn(document, 'removeEventListener')

		view.destroy()
		view.destroy()

		expect(clickSpy).toHaveBeenCalled()
		expect(keydownSpy).toHaveBeenCalled()
		clickSpy.mockRestore()
		keydownSpy.mockRestore()
	})

	it('renders trigger and content regions for showChildView', () => {
		const {view} = createView()
		const triggerRegion = view.el.querySelector('[data-region="trigger"]')
		const contentRegion = view.el.querySelector('[data-region="content"]')

		expect(triggerRegion).not.toBeNull()
		expect(contentRegion).not.toBeNull()

		const ChildView = View.extend({
			template() {
				return html`<span>Child Content</span>`
			},
		}) as new () => ViewInstance
		const child = new ChildView()
		views.push(child)
		view.showChildView('content', child)

		expect(contentRegion?.textContent).toContain('Child Content')
	})
})