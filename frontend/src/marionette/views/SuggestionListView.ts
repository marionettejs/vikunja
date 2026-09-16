import {html} from 'lit-html'
import type {TemplateResult} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface SuggestionListEntry {
	key: string
	content: TemplateResult
}

export interface SuggestionListViewOptions {
	className: string
	itemClassName: string
	emptyLabel: string
	entries: SuggestionListEntry[]
	onSelect: (index: number) => void
	acceptKeys?: string[]
	scrollSelectedIntoView?: boolean
}

export interface SuggestionListViewInstance extends ViewInstance {
	setEntries(entries: SuggestionListEntry[]): void
	getSelectedIndex(): number
	onKeyDown(event: KeyboardEvent): boolean
}

interface SuggestionListViewContext extends ViewInstance {
	options: SuggestionListViewOptions
	_selectedIndex: number
	_entries(): SuggestionListEntry[]
	_acceptKeys(): string[]
	_move(offset: number): void
	_select(index: number): void
	_scrollSelectedIntoView(): void
}

const DEFAULT_ACCEPT_KEYS = ['Enter']

export const SuggestionListView = View.extend({
	_selectedIndex: 0,

	events: {
		'click [data-index]': 'onItemClick',
	},

	template(data: {
		entries: SuggestionListEntry[]
		selectedIndex: number
		itemClassName: string
		emptyLabel: string
	}) {
		if (data.entries.length === 0) {
			return html`<div class=${`${data.itemClassName} no-results`}>${data.emptyLabel}</div>`
		}

		return html`${data.entries.map((entry, index) => html`
			<button
				type="button"
				data-index=${index}
				data-key=${entry.key}
				class=${index === data.selectedIndex ? `${data.itemClassName} is-selected` : data.itemClassName}
			>${entry.content}</button>
		`)}`
	},

	templateContext(this: SuggestionListViewContext) {
		return {
			entries: this._entries(),
			selectedIndex: this._selectedIndex,
			itemClassName: this.options.itemClassName,
			emptyLabel: this.options.emptyLabel,
		}
	},

	_entries(this: SuggestionListViewContext): SuggestionListEntry[] {
		return this.options.entries ?? []
	},

	_acceptKeys(this: SuggestionListViewContext): string[] {
		return this.options.acceptKeys ?? DEFAULT_ACCEPT_KEYS
	},

	setEntries(this: SuggestionListViewContext, entries: SuggestionListEntry[]) {
		this.options.entries = entries
		this._selectedIndex = 0
		this.render()
	},

	getSelectedIndex(this: SuggestionListViewContext): number {
		return this._selectedIndex
	},

	onItemClick(this: SuggestionListViewContext, event: Event) {
		const button = (event.target as Element).closest<HTMLElement>('[data-index]')
		if (!button || !this.el.contains(button)) {
			return
		}
		this._select(Number(button.dataset.index))
	},

	onKeyDown(this: SuggestionListViewContext, event: KeyboardEvent): boolean {
		const entries = this._entries()
		if (entries.length === 0 || event.isComposing) {
			return false
		}

		if (event.key === 'ArrowUp') {
			this._move(-1)
			return true
		}

		if (event.key === 'ArrowDown') {
			this._move(1)
			return true
		}

		if (this._acceptKeys().includes(event.key)) {
			this._select(this._selectedIndex)
			return true
		}

		return false
	},

	_move(this: SuggestionListViewContext, offset: number) {
		const length = this._entries().length
		this._selectedIndex = (this._selectedIndex + offset + length) % length
		this.render()
		this._scrollSelectedIntoView()
	},

	_select(this: SuggestionListViewContext, index: number) {
		if (!Number.isInteger(index) || index < 0 || index >= this._entries().length) {
			return
		}
		this.options.onSelect(index)
	},

	_scrollSelectedIntoView(this: SuggestionListViewContext) {
		if (!this.options.scrollSelectedIntoView) {
			return
		}
		const selected = this.el.querySelector<HTMLElement>(`[data-index="${this._selectedIndex}"]`)
		selected?.scrollIntoView({block: 'nearest'})
	},
}) as new (options: SuggestionListViewOptions) => SuggestionListViewInstance
