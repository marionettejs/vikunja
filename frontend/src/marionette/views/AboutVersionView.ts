import {View} from 'marionette'
import type {ViewInstance} from 'marionette'

export interface AboutVersionOptions {
	lines: string[]
}

type TemplateData = AboutVersionOptions

/**
 * Text is set via textContent so markup characters in version strings are
 * treated as literals rather than HTML.
 */
const AboutVersionView = View.extend({
	className: 'p-4',

	template(data: TemplateData): string {
		const lines = data.lines
		const div = document.createElement('div')

		for (const line of lines) {
			const p = document.createElement('p')
			p.textContent = line
			div.appendChild(p)
		}

		return div.innerHTML
	},

	templateContext(): TemplateData {
		const opts = this.options as AboutVersionOptions
		return {
			lines: opts.lines,
		}
	},
}) as new (options: AboutVersionOptions) => ViewInstance

export default AboutVersionView
