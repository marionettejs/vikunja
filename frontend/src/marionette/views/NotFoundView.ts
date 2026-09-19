import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface NotFoundViewOptions {
	title: string
	text: string
}

type TemplateData = NotFoundViewOptions

const NotFoundView = View.extend({
	className: 'content has-text-centered',

	template(data: TemplateData) {
		return html`
			<h1>${data.title}</h1>
			<p>${data.text}</p>
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as NotFoundViewOptions
		return {
			title: opts.title,
			text: opts.text,
		}
	},
}) as new (options: NotFoundViewOptions) => ViewInstance

export default NotFoundView