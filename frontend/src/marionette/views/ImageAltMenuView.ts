import {View} from '../index'
import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'

export interface ImageAltMenuViewOptions {
	label: string
	onEdit: (rect: DOMRect) => void
}

export const ImageAltMenuView = View.extend({
	className: 'mn-image-alt-menu',

	events: {
		'click [data-action="edit-alt"]': 'onEditAltClick',
	},

	template(data: {label: string}) {
		return html`<button
			type="button"
			class="mn-image-alt-menu__button"
			data-action="edit-alt"
		>${data.label}</button>`
	},

	templateContext(this: ViewInstance & {options: ImageAltMenuViewOptions}) {
		return {
			label: this.options.label,
		}
	},

	onEditAltClick(this: ViewInstance & {options: ImageAltMenuViewOptions}, event: Event) {
		const button = (event.target as Element).closest<HTMLElement>('[data-action="edit-alt"]')
		if (!button || !this.el.contains(button)) {
			return
		}
		this.options.onEdit(button.getBoundingClientRect())
	},
}) as new (options: ImageAltMenuViewOptions) => ViewInstance
