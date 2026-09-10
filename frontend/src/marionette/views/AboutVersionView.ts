import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface AboutVersionOptions {
	lines: string[]
}

type TemplateData = AboutVersionOptions

/**
 * Lit template interpolations into element content escape text automatically,
 * ensuring markup characters in version strings are treated as literals.
 */
const AboutVersionView = View.extend({
	className: 'p-4',

	template(data: TemplateData) {
		return html`${data.lines.map(line => html`<p>${line}</p>`)}`
	},

	templateContext(): TemplateData {
		const opts = this.options as AboutVersionOptions
		return {
			lines: opts.lines,
		}
	},
}) as new (options: AboutVersionOptions) => ViewInstance

export default AboutVersionView
