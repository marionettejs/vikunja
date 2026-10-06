import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, type TemplateResult} from 'lit-html'
import type {AutocompleteItem} from './filter-autocomplete'
import type {FilterContext} from './filter-context'
import type {Label} from '@/client/generated/index'
import type {IUser} from '@/modelTypes/IUser'
import {getLabelColor} from '@/composables/useLabelStyles'
import {getTextColor} from '@/helpers/color/getTextColor'
import {getDisplayName, fetchAvatarBlobUrl} from '@/models/user'

export const FilterSuggestionsView = View.extend({
	className: 'native-list-surface',
	initialize(options: {context: FilterContext, items: AutocompleteItem[], command: (item: AutocompleteItem) => void}) { void options },
	createState() { return {selected: 0, avatars: new Map<string, string>(), requests: new Set<string>(), life: new AbortController()} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const state = this.getState()
		return html`<div class="filter-autocompletes">${this.options.items.map((item, index) => html`<button type="button" class="filter-autocomplete ${index === state.selected ? 'is-selected' : ''}" @click=${() => this.selectItem(index)}><div class="filter-autocomplete__content">${this.itemMarkup(item)}</div></button>`)}</div>`
	},
	itemMarkup(item: AutocompleteItem): TemplateResult {
		if (item.fieldType === 'labels') { const label = item.item as Label, color = getLabelColor(label); return html`<span class="tag filter-autocomplete__label" style=${`background:${color || 'var(--grey-200)'};color:${color ? getTextColor(color) : 'var(--grey-800)'}`}><span>${label.title}</span></span>` }
		if (item.fieldType === 'users') { const user = item.item as IUser, url = this.getState().avatars.get(user.username); return html`<div class="user filter-autocomplete__user" style="--avatar-size:20px"><span class="avatar-wrapper">${url ? html`<img class="avatar" src=${url} alt="" width="20" height="20">` : html`<span class="avatar user-avatar-placeholder" style="--user-avatar-size:20px"></span>`}</span><span class="username">${getDisplayName(user)}</span></div>` }
		return html`<div class="filter-autocomplete__project">${item.title}</div>`
	},
	onRender() {
		const state = this.getState()
		for (const item of this.options.items) {
			if (item.fieldType !== 'users') continue
			const user = item.item as IUser
			if (state.avatars.has(user.username) || state.requests.has(user.username)) continue
			state.requests.add(user.username)
			void fetchAvatarBlobUrl(user, 20).then(url => { if (!state.life.signal.aborted && url) { state.avatars.set(user.username, url); this.render() } }).catch(() => {}).finally(() => state.requests.delete(user.username))
		}
	},
	updateProps({items}: {items: AutocompleteItem[]}) { this.options.items = items; this.getState().selected = 0; this.render() },
	selectItem(index: number) { const item = this.options.items[index]; if (item) this.options.command(item) },
	onKeyDown({event}: {event: KeyboardEvent}) {
		if (event.key === 'Enter' && event.isComposing) return false
		if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return false
		event.preventDefault(); event.stopPropagation()
		if (event.key === 'Enter') this.selectItem(this.getState().selected)
		else { this.getState().selected = (this.getState().selected + this.options.items.length + (event.key === 'ArrowUp' ? -1 : 1)) % this.options.items.length; this.render() }
		return true
	},
	onBeforeDestroy() { this.getState().life.abort() },
}).setDomApi(LitDomApi)
