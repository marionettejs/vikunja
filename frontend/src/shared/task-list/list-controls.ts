import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import type {ListContext} from './list-context'
import type {Sort} from './task-list-query'
import {button, listIcon} from './list-ui'

export const ListPaginationView = View.extend({
	attributes: {style: 'display:contents'},
	initialize(options: {context: ListContext, pages: number, page: number}) { void options },
	createState() { return {pages: this.options.pages, page: this.options.page} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const {pages, page} = this.getState(), ctx = this.options.context
		if (pages <= 1) return nothing
		const items: (number | null)[] = []
		// Preserve BasePagination's published page/ellipsis algorithm.
		for (let i = 0; i < pages; i++) {
			if (i > 0 && i + 1 < pages && (i + 1 > page + 1 || i + 1 < page - 1)) {
				const previous = items[i - 1]
				if (previous !== undefined && previous !== null) items.push(null)
				continue
			}
			items.push(i + 1)
		}
		const link = (target: number, label: string, variant: string, disabled = false) => disabled
			? html`<div class="base-button pagination-${variant}" aria-disabled="true">${label}</div>`
			: html`<a class="base-button pagination-${variant} ${target === page && variant === 'link' ? 'is-current' : ''}" href=${ctx.pageHref(target)} aria-label=${variant === 'link' ? `Goto page ${target}` : nothing} @click=${ctx.navigate}>${label}</a>`
		return html`<nav aria-label="pagination" class="pagination is-centered p-4" role="navigation">
			${link(page - 1, ctx.t('misc.previous'), 'previous', page <= 1)}${link(page + 1, ctx.t('misc.next'), 'next', page >= pages)}
			<ul class="pagination-list">${items.map(value => html`<li>${value === null ? html`<span class="pagination-ellipsis">…</span>` : link(value, String(value), 'link')}</li>`)}</ul>
		</nav>`
	},
	update(pages: number, page: number) { Object.assign(this.getState(), {pages, page}); this.render() },
}).setDomApi(LitDomApi)

export const ListEmptyView = View.extend({
	tagName: 'p', className: 'has-text-centered has-text-grey is-italic p-4 mbe-4',
	initialize(options: {context: ListContext, canWrite: boolean, focus: () => void}) { void options },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing { return html`${this.options.context.t('project.list.empty')}${this.options.canWrite ? html`<button type="button" class="base-button base-button--type-button button-link" @click=${this.options.focus}>${this.options.context.t('project.list.newTaskCta')}</button>` : nothing}` },
}).setDomApi(LitDomApi)

export const ListSortView = View.extend({
	ui: {'popup': '.popup'},
	attributes: {style: 'display:contents'},
	initialize(options: {context: ListContext, sort: Sort, changed: (sort: Sort) => void}) { void options },
	createState() { return {selected: 'position:asc', open: false, previous: null as HTMLElement | null,
		outside: (event: MouseEvent) => { if (!this.el.contains(event.target as Node)) this.close() },
		escape: (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && this.getState().open && this.el.contains(event.target as Node)) { event.preventDefault(); this.close() } }} },
	onBeforeRender() { if (!this.getState().open) this.selectSort(this.options.sort) },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const ctx = this.options.context
		const names: Record<string, string> = {title: 'title', priority: 'priority', due_date: 'dueDate', start_date: 'startDate', end_date: 'endDate', percent_done: 'percentDone', created: 'created', updated: 'updated'}
		const options = Object.entries(names).flatMap(([field, name]) => ['asc', 'desc'].map(order => ({value: `${field}:${order}`, label: ctx.t(`sorting.options.${name}${order === 'asc' ? 'Asc' : 'Desc'}`)}))).sort((a, b) => a.label.localeCompare(b.label))
		return html`${button(ctx.t('project.list.sort'), event => { event.preventDefault(); event.stopPropagation(); this.toggle() }, 'secondary', 'sort')}
			<div class="popup ${this.getState().open ? 'is-open' : ''}" ?inert=${!this.getState().open}>
				<div class="card sort-popup"><div class="card-content loader-container"><div class="content">
					<p class="sort-description has-text-grey is-size-7">${ctx.t('sorting.description')}</p>
					<div class="field"><div class="select is-fullwidth"><select aria-label=${ctx.t('misc.sortBy')} .value=${this.getState().selected} @change=${(event: Event) => { this.getState().selected = (event.target as HTMLSelectElement).value }}>
						<option value="position:asc">${ctx.t('sorting.manually')}</option>${options.map(option => html`<option value=${option.value}>${option.label}</option>`)}
					</select></div></div>
					<div class="actions">${button(ctx.t('misc.cancel'), () => this.close(), 'tertiary')}${button(ctx.t('sorting.apply'), () => { const [field, order] = this.getState().selected.split(':'); this.options.changed({[field]: order as 'asc' | 'desc'}); this.close() })}</div>
				</div></div></div>
			</div>`
	},
	onAttach() { document.addEventListener('click', this.getState().outside); document.addEventListener('keydown', this.getState().escape) },
	onBeforeDestroy() { document.removeEventListener('click', this.getState().outside); document.removeEventListener('keydown', this.getState().escape) },
	selectSort(sort: Sort) { const key = Object.keys(sort)[0]; this.getState().selected = !key || key === 'position' ? 'position:asc' : `${key}:${sort[key]}` },
	updateSort(sort: Sort) { this.options.sort = sort; this.selectSort(sort); this.render() },
	toggle() { if (this.getState().open) this.close(); else { this.getState().previous = document.activeElement as HTMLElement; this.getState().open = true; this.render() } },
	close() {
		if (!this.getState().open) return
		const previous = this.getState().previous
		if ((this.getUI('popup')![0] as HTMLElement)?.contains(document.activeElement) || document.activeElement === document.body) previous?.focus()
		this.getState().open = false
		this.render()
	},
}).setDomApi(LitDomApi)
export {listIcon}
