import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

let nextModalId = 0

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
	_titleId: '',
	_dismissible: true,

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

	setDismissible(dismissible: boolean) {
		this._dismissible = Boolean(dismissible)
	},

	template(data: {titleId: string, title: string, primaryLabel: string, cancelLabel: string, closeLabel: string, primaryDisabled?: boolean}) {
		return html`
			<div class='card'>
				<header class='card-header'>
					<p class='card-header-title' id='${data.titleId}'>${data.title}</p>
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
			titleId: this._titleId,
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
		'click [data-role="close"]': 'onCloseClick',
		'click [data-role="cancel"]': 'onCancelClick',
		'click [data-role="primary"]': 'onPrimaryClick',
	},

	initialize() {
		nextModalId += 1
		this._titleId = `modal-card-title-${nextModalId}`
		this.el.setAttribute('aria-labelledby', this._titleId)

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
		if (!this._dismissible) {
			return
		}
		this.dismiss()
	},

	onMouseDown(event: MouseEvent) {
		if (event.target === this.el) {
			if (!this._dismissible) {
				return
			}
			this.dismiss()
		}
	},

	onCloseClick() {
		if (!this._dismissible) {
			return
		}
		this.dismiss()
	},

	onCancelClick() {
		if (!this._dismissible) {
			return
		}
		this.dismiss()
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
	setDismissible: (dismissible: boolean) => void
}
