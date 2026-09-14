import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface ConfirmTextViewOptions {
	lines: ReadonlyArray<string>
}

interface TemplateData {
	lines: ReadonlyArray<string>
}

export const ConfirmTextView = View.extend({
	template(data: TemplateData) {
		return html`
			${data.lines.map(line => html`
				<p>${line}</p>
			`)}
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as ConfirmTextViewOptions
		return {
			lines: opts.lines ?? [],
		}
	},
}) as new (options: ConfirmTextViewOptions) => ViewInstance
