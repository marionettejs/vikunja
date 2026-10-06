import {html, nothing, type TemplateResult} from 'lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import {icon, type IconName, type IconPrefix} from '@fortawesome/fontawesome-svg-core'

export function listIcon(name: string, regular = false) {
	const svg = icon({prefix: (regular ? 'far' : 'fas') as IconPrefix, iconName: name as IconName})
	return svg ? unsafeHTML(svg.html.join('')) : nothing
}
export function button(label: string, action: (event: MouseEvent) => void, variant = 'primary', symbol?: string, ariaLabel?: string) {
	return html`<button type="button" class="base-button base-button--type-button button ${variant === 'secondary' ? 'is-outlined' : variant === 'tertiary' ? 'is-text is-inverted underline-none has-no-shadow' : 'is-primary'}" style="--button-white-space:break-spaces" aria-label=${ariaLabel || nothing} @click=${action}>
		${symbol ? html`<span class="icon is-small">${listIcon(symbol)}</span>` : nothing}<span>${label}</span>
	</button>`
}

export function translatedParts(t: (key: string, values?: unknown[] | Record<string, unknown>) => string, key: string, parts: (TemplateResult | string)[] | Record<string, TemplateResult | string>): TemplateResult {
	const values = Object.values(parts)
	const markers = values.map((_part, index) => `\uFFF0${index}\uFFF1`)
	const params = Array.isArray(parts) ? markers : Object.fromEntries(Object.keys(parts).map((name,index)=>[name,markers[index]]))
	return html`${t(key, params).split(/(\uFFF0\d+\uFFF1)/).map(value => /^\uFFF0\d+\uFFF1$/.test(value) ? values[Number(value.slice(1, -1))] : value)}`
}
