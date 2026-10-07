import {View, Region, type RegionInstance} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, type TemplateResult} from 'lit-html'
import {getDefaultTaskFilterParams, type TaskFilterParams} from '@/services/taskCollection'
import {hasFilterQuery, transformFilterStringForApi} from '@/helpers/filters'
import type {IProject} from '@/modelTypes/IProject'
import type {ListQuery} from './task-list-query'
import type {FilterContext} from '../filters/filter-context'
import {FilterInputView} from '../filters/filter-input'
import {FilterDocsView} from '../filters/filter-docs'
import {HintDialogView} from './list-help'
import {button, listIcon} from './list-ui'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import '../filters/filter-native.scss'

const FilterBodyView = View.extend({
	ui: {'clear': '[data-clear]', 'includeNulls': 'input[type="checkbox"]'},
	className: 'card filters has-overflow filter-popup', attributes: {role: 'search'},
	initialize(options: {context: FilterContext, project: IProject, viewId: number, params: TaskFilterParams, changed: (params: TaskFilterParams) => void, apply: (params: TaskFilterParams) => void, close: () => void}) { void options },
	regions: {input: '[data-filter-input]', docs: '[data-filter-docs]'},
	createState() { return {params: {...this.options.params}, query: this.options.params.filter || this.options.params.s || ''} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const t = this.options.context.ui.t, filterFromView = this.options.project.views.find(view => view.id === this.options.viewId)?.filter?.filter
		return html`<header class="card-header"><p class="card-header-title">${t('filters.title')}</p><button type="button" class="base-button base-button--type-button card-header-icon close" aria-label=${t('misc.close')} @click=${this.options.close}><span class="icon">${listIcon('times')}</span></button></header><div class="card-content loader-container"><div class="content"><div data-filter-input style="display:contents"></div>${filterFromView ? html`<div class="tw:text-sm mbe-2">${t('filters.fromView')} <code>${filterFromView}</code><br>${t('filters.fromViewBoth')}</div>` : ''}
			<div class="field is-flex is-flex-direction-column"><div class="base-checkbox fancy-checkbox" data-cy="checkbox"><label class="base-checkbox__label"><input type="checkbox" class="is-sr-only" .checked=${Boolean(this.getState().params.filter_include_nulls)} @change=${(event: Event) => { this.getState().params.filter_include_nulls = (event.target as HTMLInputElement).checked; this.options.changed(this.parameters()) }}>${unsafeHTML(checkboxSvg.replace('<svg ', '<svg class="fancy-checkbox__icon" '))}<span class="fancy-checkbox__content">${t('filters.attributes.includeNulls')}</span></label></div></div><div data-filter-docs style="display:contents"></div></div></div>
			<footer class="card-footer"><button type="button" class="base-button base-button--type-button button is-outlined mie-2" style="--button-white-space:break-spaces" data-clear ?disabled=${this.getState().query === ''} @click=${(event: Event) => { event.preventDefault(); event.stopPropagation(); this.clear() }}><span>${t('filters.clear')}</span></button>${button(t('filters.showResults'), event => { event.preventDefault(); event.stopPropagation(); this.options.apply(this.parameters()) })}</footer>`
	},
	onAttach() {
		this.showChildView('input', new FilterInputView({context: this.options.context, projectId: this.options.project.id, value: this.getState().query, changed: (value: string) => { this.getState().query = value; (this.getUI('clear')![0] as HTMLButtonElement)!.disabled = value === '' }}))
		this.showChildView('docs', new FilterDocsView({context: this.options.context.ui}))
	},
	parameters(): TaskFilterParams {
		const state = this.getState(), ctx = this.options.context
		const filter = transformFilterStringForApi(state.query, title => ctx.labelByTitle(title)?.id || null, title => ctx.projectByTitle(title)?.id || null)
		const s = hasFilterQuery(filter) ? '' : filter
		return {...state.params, filter: s === '' ? filter : '', s}
	},
	clear() { this.getState().query = ''; (this.getChildView('input') as InstanceType<typeof FilterInputView>).setModelValue(''); this.options.apply(this.parameters()) },
	updateParams(params: TaskFilterParams) {
		const previous = this.getState().params
		this.getState().params = {...params}
		;(this.getUI('includeNulls')![0] as HTMLInputElement)!.checked = Boolean(params.filter_include_nulls)
		if (previous.filter !== params.filter || previous.s !== params.s) { this.getState().query = params.filter || params.s || ''; (this.getChildView('input') as InstanceType<typeof FilterInputView>).setModelValue(this.getState().query); (this.getUI('clear')![0] as HTMLButtonElement)!.disabled = this.getState().query === '' }
	},
}).setDomApi(LitDomApi)

export const ListFilterView = View.extend({
	attributes: {style: 'display:contents'},
	initialize(options: {context: FilterContext, project: IProject, viewId: number, query: ListQuery, changed: (params: TaskFilterParams) => void}) { void options },
	createState() { return {params: {...getDefaultTaskFilterParams(), filter: this.options.query.filter, s: this.options.query.s, filter_include_nulls: this.options.query.includeNulls}, dialog: undefined as RegionInstance | undefined} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult { return html`<button type="button" class="base-button base-button--type-button button is-outlined ${this.getState().params.filter || this.getState().params.s ? 'has-filters' : ''}" style="--button-white-space:break-spaces" @click=${() => this.open()}><span class="icon is-small">${listIcon('filter')}</span><span>${this.options.context.ui.t('filters.title')}</span></button>` },
	open() {
		if (this.getState().dialog?.hasView()) return
		this.getState().dialog?.destroy()
		const el = document.createElement('div'); document.body.append(el)
		const region = new Region({el}); this.getState().dialog = region
		const body = new FilterBodyView({context: this.options.context, project: this.options.project, viewId: this.options.viewId, params: this.getState().params,
			changed: (params: TaskFilterParams) => { this.getState().params = params; this.render() },
			apply: (params: TaskFilterParams) => { this.getState().params = params; this.render(); this.options.changed(params); dialog.close() }, close: () => dialog.close()})
		const dialog = new HintDialogView({context: this.options.context.ui, content: body, ariaLabel: this.options.context.ui.t('filters.title')})
		this.listenTo(dialog, 'destroy', () => el.remove())
		region.show(dialog)
	},
	updateQuery(query: ListQuery) {
		this.options.query = query
		this.getState().params = {...getDefaultTaskFilterParams(), filter: query.filter, s: query.s, filter_include_nulls: query.includeNulls}
		this.render()
		const dialog = this.getState().dialog?.currentView as InstanceType<typeof HintDialogView> | undefined
		;(dialog?.getChildView('content') as InstanceType<typeof FilterBodyView> | undefined)?.updateParams(this.getState().params)
	},
	onBeforeDestroy() { const region = this.getState().dialog, el = region?.el; region?.destroy(); if (el instanceof Element) el.remove() },
}).setDomApi(LitDomApi)
