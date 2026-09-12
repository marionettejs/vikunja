import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface ModalCardViewOptions {
	title: string
	primaryLabel: string
	cancelLabel: string
	closeLabel: string
	onPrimary: () => void
	onClose: () => void
	primaryDisabled?: boolean
}

export const ModalCardView = View.extend({
	tagName: 'dialog',

	_previousActiveElement: null as HTMLElement | null,
	_previousOverflow: '',
	_restored: false,

	regions: {
		body: '.card-content',
	},

	setPrimaryDisabled(disabled: boolean) {
		const opts = this.options as ModalCardViewOptions
		opts.primaryDisabled = Boolean(disabled)
		const primaryBtn = this.el.querySelector('.card-footer [data-role="primary"]') as HTMLButtonElement | null
		if (primaryBtn) {
			primaryBtn.disabled = Boolean(disabled)
		}
	},

	template(data: {title: string, primaryLabel: string, cancelLabel: string, closeLabel: string, primaryDisabled?: boolean}) {
		return html`
			<div class='card'>
				<header class='card-header'>
					<p class='card-header-title'>${data.title}</p>
					<button class='card-header-icon' aria-label='${data.closeLabel}' data-role='close'>
						<span class='icon'>&times;</span>
					</button>
				</header>
				<div class='card-content'></div>
				<footer class='card-footer'>
					<button class='button' data-role='cancel'>${data.cancelLabel}</button>
					<button class='button' data-role='primary' ?disabled='${data.primaryDisabled}'>${data.primaryLabel}</button>
				</footer>
			</div>
		`
	},

	templateContext() {
		const opts = this.options as ModalCardViewOptions
		return {
			title: opts.title,
			primaryLabel: opts.primaryLabel,
			cancelLabel: opts.cancelLabel,
			closeLabel: opts.closeLabel,
			primaryDisabled: Boolean(opts.primaryDisabled),
		}
	},

	events: {
		'cancel': 'onNativeCancel',
		'mousedown': 'onMouseDown',
		'click [data-role="close"]': 'dismiss',
		'click [data-role="cancel"]': 'dismiss',
		'click [data-role="primary"]': 'onPrimaryClick',
	},

	initialize() {
		this._previousActiveElement = document.activeElement as HTMLElement | null
		this._previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		document.body.appendChild(this.el)
		const dialog = this.el as HTMLDialogElement
		if (typeof dialog.showModal === 'function') {
			dialog.showModal()
		} else {
			dialog.setAttribute('open', '')
		}
	},

	onNativeCancel(event: Event) {
		event.preventDefault()
		this.dismiss()
	},

	onMouseDown(event: MouseEvent) {
		if (event.target === this.el) {
			this.dismiss()
		}
	},

	onPrimaryClick() {
		const opts = this.options as ModalCardViewOptions
		if (opts.primaryDisabled) {
			return
		}
		opts.onPrimary()
	},

	dismiss() {
		const opts = this.options as ModalCardViewOptions
		this.closeDialog()
		opts.onClose()
	},

	closeDialog() {
		const dialog = this.el as HTMLDialogElement
		if (dialog && dialog.open && typeof dialog.close === 'function') {
			dialog.close()
		}
		this.restoreEnvironment()
	},

	restoreEnvironment() {
		if (this._restored) {
			return
		}
		this._restored = true
		if (this._previousOverflow !== undefined) {
			document.body.style.overflow = this._previousOverflow
		}
		if (this._previousActiveElement && typeof this._previousActiveElement.focus === 'function') {
			this._previousActiveElement.focus()
		}
	},

	onBeforeDestroy() {
		this.restoreEnvironment()
		if (this.el && this.el.parentNode) {
			this.el.parentNode.removeChild(this.el)
		}
	},
}) as new (options: ModalCardViewOptions) => ViewInstance & {
	setPrimaryDisabled: (disabled: boolean) => void
}
