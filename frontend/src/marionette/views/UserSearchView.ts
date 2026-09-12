import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface UserSearchOption {
	id: number
	username: string
	name: string
}

export interface UserSearchViewOptions {
	placeholder: string
	searchDelay?: number
	onSearch: (query: string, generation?: number) => void
	onSelect: (user: UserSearchOption | null) => void
}

export interface UserSearchViewInstance extends ViewInstance {
	setResults(users: ReadonlyArray<UserSearchOption>, generation?: number): void
	getSelected(): UserSearchOption | null
	clearSelection(): void
	getGeneration(): number
}

interface TemplateData {
	placeholder: string
	query: string
	results: ReadonlyArray<UserSearchOption>
	selected: UserSearchOption | null
}

export const UserSearchView = View.extend({
	className: 'multiselect',

	_query: '',
	_results: [] as ReadonlyArray<UserSearchOption>,
	_selected: null as UserSearchOption | null,
	_timer: null as ReturnType<typeof setTimeout> | null,
	_generation: 0,

	events: {
		'input .input-wrapper input': 'onInput',
		'click .search-results > *': 'onResultClick',
	},

	template(data: TemplateData) {
		return html`
			<div class='input-wrapper'>
				<input
					type='text'
					.value=${data.query}
					placeholder=${data.placeholder}
				>
			</div>
			${data.results.length > 0 ? html`
				<div class='search-results'>
					${data.results.map(user => html`
						<button
							type='button'
							class='search-result-item'
							data-id=${user.id}
						>
							${user.name !== '' ? user.name : user.username}
						</button>
					`)}
				</div>
			` : ''}
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as UserSearchViewOptions
		return {
			placeholder: opts.placeholder,
			query: this._query,
			results: this._results,
			selected: this._selected,
		}
	},

	onInput(event: Event) {
		const opts = this.options as UserSearchViewOptions
		const value = (event.target as HTMLInputElement).value
		this._query = value

		if (this._selected !== null) {
			this._selected = null
			opts.onSelect(null)
		}

		if (this._timer !== null) {
			clearTimeout(this._timer)
			this._timer = null
		}

		const delay = opts.searchDelay ?? 200
		this._timer = setTimeout(() => {
			this._timer = null
			this._generation += 1
			if (this._query === '') {
				this._results = []
				this.render()
			}
			if (opts.onSearch.length > 1) {
				opts.onSearch(this._query, this._generation)
			} else {
				opts.onSearch(this._query)
			}
		}, delay)
	},

	onResultClick(event: Event) {
		const opts = this.options as UserSearchViewOptions
		const target = event.target as Element
		const itemEl = target.closest('.search-results > *')
		if (!itemEl) {
			return
		}
		const id = Number(itemEl.getAttribute('data-id'))
		const picked = this._results.find((u: UserSearchOption) => u.id === id) ?? null
		if (picked) {
			this._selected = picked
			this._results = []
			this.render()
			opts.onSelect(picked)
		}
	},

	setResults(users: ReadonlyArray<UserSearchOption>, generation?: number) {
		if (generation !== undefined && generation !== this._generation) {
			return
		}
		this._results = users
		this.render()
	},

	getSelected(): UserSearchOption | null {
		return this._selected
	},

	getGeneration(): number {
		return this._generation
	},

	clearSelection() {
		if (this._timer !== null) {
			clearTimeout(this._timer)
			this._timer = null
		}
		const opts = this.options as UserSearchViewOptions
		this._selected = null
		this._query = ''
		this.render()
		opts.onSelect(null)
	},

	onDestroy() {
		if (this._timer !== null) {
			clearTimeout(this._timer)
			this._timer = null
		}
	},
}) as new (options: UserSearchViewOptions) => UserSearchViewInstance
