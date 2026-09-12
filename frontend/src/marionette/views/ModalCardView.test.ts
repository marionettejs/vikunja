import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {ModalCardView, type ModalCardViewOptions} from './ModalCardView'

describe('ModalCardView', () => {
	let views: ViewInstance[] = []

	const createView = (overrides: Partial<ModalCardViewOptions> = {}) => {
		const options: ModalCardViewOptions = {
			title: 'Test Modal',
			primaryLabel: 'Confirm',
			cancelLabel: 'Cancel',
			closeLabel: 'Close dialog',
			onPrimary: vi.fn(),
			onClose: vi.fn(),
			...overrides,
		}
		const view = new ModalCardView(options)
		views.push(view)
		view.render()
		return {view, options}
	}

	beforeEach(() => {
		if (!HTMLDialogElement.prototype.showModal) {
			HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
				this.setAttribute('open', '')
			}
		}
		if (!HTMLDialogElement.prototype.close) {
			HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
				this.removeAttribute('open')
			}
		}
	})

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
		document.body.removeAttribute('style')
	})

	it('shows the title in p.card-header-title', () => {
		const {view} = createView({title: 'Expected Heading'})
		const titleEl = view.el.querySelector('.card header.card-header p.card-header-title')
		expect(titleEl).not.toBeNull()
		expect(titleEl?.textContent?.trim()).toBe('Expected Heading')
	})

	it('renders child view content into the card body content area', () => {
		const {view} = createView()
		const ChildView = View.extend({
			template() {
				return html`<div class='custom-child'>Child body content</div>`
			},
		}) as new () => ViewInstance
		const child = new ChildView()
		views.push(child)
		view.showChildView('body', child)

		const childEl = view.el.querySelector('.card .card-content .custom-child')
		expect(childEl).not.toBeNull()
		expect(childEl?.textContent).toBe('Child body content')
	})

	it('renders button classes and labels on cancel and confirm footer controls', () => {
		const {view} = createView({cancelLabel: 'Dismiss Me', primaryLabel: 'Accept Me'})
		const cancelBtn = view.el.querySelector('.card-footer .button[data-role="cancel"]')
		const primaryBtn = view.el.querySelector('.card-footer .button[data-role="primary"]')

		expect(cancelBtn).not.toBeNull()
		expect(cancelBtn?.textContent?.trim()).toBe('Dismiss Me')
		expect(primaryBtn).not.toBeNull()
		expect(primaryBtn?.textContent?.trim()).toBe('Accept Me')
	})

	it('attaches the dialog to document.body and opens it as a modal', () => {
		const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
		const {view} = createView()
		expect(view.el.tagName.toLowerCase()).toBe('dialog')
		expect(document.body.contains(view.el)).toBe(true)
		expect(showModalSpy).toHaveBeenCalled()
		showModalSpy.mockRestore()
	})

	it('suppresses body scroll while open and restores the previous overflow value upon destruction', () => {
		document.body.style.overflow = 'auto'
		const {view} = createView()
		expect(document.body.style.overflow).toBe('hidden')
		view.destroy()
		expect(document.body.style.overflow).toBe('auto')
	})

	it('dismisses and calls onClose when pressing Escape via dialog cancel event', () => {
		const {view, options} = createView()
		const event = new Event('cancel', {cancelable: true})
		view.el.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(options.onClose).toHaveBeenCalledTimes(1)
	})

	it('dismisses and calls onClose when mousedown occurs directly on the backdrop dialog', () => {
		const {view, options} = createView()
		const event = new MouseEvent('mousedown', {bubbles: true})
		view.el.dispatchEvent(event)

		expect(options.onClose).toHaveBeenCalledTimes(1)
	})

	it('does not dismiss or call onClose when mousedown occurs on the card', () => {
		const {view, options} = createView()
		const card = view.el.querySelector('.card') as HTMLElement
		const event = new MouseEvent('mousedown', {bubbles: true})
		card.dispatchEvent(event)

		expect(options.onClose).not.toHaveBeenCalled()
	})

	it('dismisses and calls onClose when clicking the close control with accessible closeLabel', () => {
		const {view, options} = createView({closeLabel: 'Close this dialog'})
		const closeBtn = view.el.querySelector('[data-role="close"]') as HTMLElement
		expect(closeBtn).not.toBeNull()
		expect(closeBtn.getAttribute('aria-label')).toBe('Close this dialog')

		closeBtn.click()
		expect(options.onClose).toHaveBeenCalledTimes(1)
	})

	it('dismisses and calls onClose when clicking the cancel control', () => {
		const {view, options} = createView()
		const cancelBtn = view.el.querySelector('.card-footer [data-role="cancel"]') as HTMLElement
		cancelBtn.click()
		expect(options.onClose).toHaveBeenCalledTimes(1)
	})

	it('calls onPrimary when the confirm control is activated and not disabled', () => {
		const {view, options} = createView()
		const primaryBtn = view.el.querySelector('.card-footer [data-role="primary"]') as HTMLElement
		primaryBtn.click()
		expect(options.onPrimary).toHaveBeenCalledTimes(1)
	})

	it('disables the confirm control and does not call onPrimary when primaryDisabled is true', () => {
		const {view, options} = createView({primaryDisabled: true})
		const primaryBtn = view.el.querySelector('.card-footer [data-role="primary"]') as HTMLButtonElement
		expect(primaryBtn.disabled).toBe(true)
		primaryBtn.click()
		expect(options.onPrimary).not.toHaveBeenCalled()
	})

	it('restores focus to the element that was focused before opening', () => {
		const triggerBtn = document.createElement('button')
		document.body.appendChild(triggerBtn)
		triggerBtn.focus()
		expect(document.activeElement).toBe(triggerBtn)

		const {view} = createView()
		view.destroy()

		expect(document.activeElement).toBe(triggerBtn)
	})

	it('removes the dialog from document and can be destroyed twice without throwing', () => {
		const {view} = createView()
		expect(document.body.contains(view.el)).toBe(true)

		expect(() => {
			view.destroy()
			view.destroy()
		}).not.toThrow()

		expect(document.body.contains(view.el)).toBe(false)
	})
})
