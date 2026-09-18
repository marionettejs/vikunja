import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface PopupViewOptions {
	open?: boolean
	hasOverflow?: boolean
	ignoreClickClasses?: string[]
	onOpenChange?: (open: boolean) => void
}

interface PopupViewContext extends ViewInstance {
	_open: boolean
	_closedByClickOutside: boolean
	_lastFocused: HTMLElement | null
	_focusEnteredPopup: boolean
	_onClickOutside: (event: Event) => void
	_onEscape: (event: KeyboardEvent) => void
	toggle(): boolean
	close(): void
	onPopupFocusIn(): void
	_applyOpenState(): void
	_restoreFocus(): void
	_notifyOpenChange(): void
	_handleClickOutside(event: Event): void
	_handleEscape(event: KeyboardEvent): void
}

export const PopupView = View.extend({
	tagName: 'div',

	_open: false,
	_closedByClickOutside: false,
	_lastFocused: null as HTMLElement | null,
	_focusEnteredPopup: false,

	regions: {
		trigger: '[data-region="trigger"]',
		content: '[data-region="content"]',
	},

	events: {
		'focusin .popup': 'onPopupFocusIn',
	},

	template(data: {open: boolean, hasOverflow: boolean}) {
		return html`
			<div data-region="trigger"></div>
			<div
				data-region="content"
				class="popup ${data.open ? 'is-open' : ''} ${data.hasOverflow && data.open ? 'has-overflow' : ''}"
				?inert=${!data.open}
			></div>
		`
	},

	templateContext(this: PopupViewContext) {
		const opts = this.options as PopupViewOptions
		return {
			open: this._open,
			hasOverflow: Boolean(opts.hasOverflow),
		}
	},

	initialize(this: PopupViewContext) {
		const opts = this.options as PopupViewOptions
		this._open = Boolean(opts.open)
		this._closedByClickOutside = false
		this._lastFocused = null
		this._focusEnteredPopup = false

		this._onClickOutside = this._handleClickOutside.bind(this)
		this._onEscape = this._handleEscape.bind(this)

		document.addEventListener('click', this._onClickOutside, true)
		document.addEventListener('keydown', this._onEscape)

		if (this._open) {
			this._lastFocused = document.activeElement as HTMLElement | null
		}
	},

	onBeforeDestroy(this: PopupViewContext) {
		document.removeEventListener('click', this._onClickOutside, true)
		document.removeEventListener('keydown', this._onEscape)
	},

	onPopupFocusIn(this: PopupViewContext) {
		this._focusEnteredPopup = true
	},

	toggle(this: PopupViewContext): boolean {
		if (this._closedByClickOutside) {
			this._closedByClickOutside = false
			return false
		}
		const wasOpen = this._open
		this._open = !this._open
		this._notifyOpenChange()
		if (!wasOpen) {
			this._lastFocused = document.activeElement as HTMLElement | null
		} else {
			this._restoreFocus()
		}
		this._applyOpenState()
		return this._open
	},

	close(this: PopupViewContext) {
		if (!this._open) {
			return
		}
		this._open = false
		this._notifyOpenChange()
		this._restoreFocus()
		this._applyOpenState()
	},

	_applyOpenState(this: PopupViewContext) {
		const popupEl = this.el.querySelector('.popup')
		const opts = this.options as PopupViewOptions
		const hasOverflow = Boolean(opts.hasOverflow)

		if (popupEl) {
			popupEl.classList.toggle('is-open', this._open)
			popupEl.classList.toggle('has-overflow', hasOverflow && this._open)
			popupEl.toggleAttribute('inert', !this._open)
		}
	},

	_restoreFocus(this: PopupViewContext) {
		const active = document.activeElement
		const popupEl = this.el.querySelector('.popup')

		if (this._focusEnteredPopup && this._lastFocused?.isConnected && (popupEl?.contains(active) || active === document.body)) {
			this._lastFocused.focus()
		}
		this._lastFocused = null
		this._focusEnteredPopup = false
	},

	_notifyOpenChange(this: PopupViewContext) {
		const opts = this.options as PopupViewOptions
		if (opts.onOpenChange) {
			opts.onOpenChange(this._open)
		}
	},

	_handleClickOutside(this: PopupViewContext, event: Event) {
		const target = event.target as HTMLElement
		const opts = this.options as PopupViewOptions

		if (target?.classList && opts.ignoreClickClasses?.some(className => target.classList.contains(className))) {
			return
		}

		const popupEl = this.el.querySelector('.popup')
		if (popupEl?.contains(target)) {
			return
		}

		const triggerEl = this.el.querySelector('[data-region="trigger"]')
		if (triggerEl?.contains(target)) {
			this.toggle()
			return
		}

		if (!this._open) {
			return
		}
		this._closedByClickOutside = true
		setTimeout(() => {
			this._closedByClickOutside = false
		})
		this.close()
	},

	_handleEscape(this: PopupViewContext, event: KeyboardEvent) {
		if (event.key !== 'Escape' || !this._open || event.defaultPrevented) {
			return
		}

		const target = event.target as Node | null
		const popupEl = this.el.querySelector('.popup')

		if (!target || (!popupEl?.contains(target) && target !== this._lastFocused)) {
			return
		}

		event.preventDefault()
		this.close()
	},
}) as new (options: PopupViewOptions) => ViewInstance & {
	toggle: () => boolean
	close: () => void
}