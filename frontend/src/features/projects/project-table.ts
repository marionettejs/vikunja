import {View, CollectionView, type ViewConfiguration, Region} from 'marionette'
import {Collection, DataApi, type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, render, nothing, type TemplateResult} from 'lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'
import {getTaskIdentifier} from '@/models/task'
import {getDisplayName, fetchAvatarBlobUrl} from '@/models/user'
import {getLabelColor} from '@/composables/useLabelStyles'
import {getTextColor} from '@/helpers/color/getTextColor'
import {formatISO, formatDateLong} from '@/shared/dates'
import type {ListContext} from '../../shared/task-list/list-context'
import type {ListWidgets} from '../../shared/task-list/list-context'
import type {ListQuery, Sort} from '../../shared/task-list/task-list-query'
import {ListFrameView} from '../../shared/task-list/list-frame'
import {ListPaginationView} from '../../shared/task-list/list-controls'
import {ListFilterView} from '../../shared/task-list/list-filter'
import {TaskGlanceView} from '../../shared/task-list/list-task-row'
import {getTopLayerContainer} from '@/helpers/getTopLayerContainer'
import {listIcon} from '../../shared/task-list/list-ui'
import '../../shared/task-list/list-native.scss'
import './project-table.scss'
export const tableColumns = ['index', 'done', 'project', 'title', 'priority', 'labels', 'assignees', 'dueDate', 'commentCount', 'startDate', 'endDate', 'percentDone', 'doneAt', 'created', 'updated', 'createdBy'] as const
type Column = typeof tableColumns[number]
const defaults = Object.fromEntries(tableColumns.map(key => [key, ['index', 'done', 'title', 'labels', 'assignees', 'dueDate'].includes(key)])) as Record<Column, boolean>
const fields: Partial<Record<Column, string>> = {index: 'index', done: 'done', title: 'title', priority: 'priority', dueDate: 'due_date', startDate: 'start_date', endDate: 'end_date', percentDone: 'percent_done', doneAt: 'done_at', created: 'created', updated: 'updated'}
function stored<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }
export function tableDefaultSort(): Sort { return stored('tableViewSortBy', {index: 'desc'}) }
export function cycleTableSort(sort: Sort, field: string, multiple: boolean): Sort { const order = sort[field] === 'desc' ? 'asc' : sort[field] === 'asc' ? undefined : 'desc', next = multiple ? {...sort} : {}; if (order) next[field] = order; else delete next[field]; return next }
function columnTitle(context: ListContext, key: Column) { return key === 'index' ? '#' : context.t(`task.attributes.${key}`) }
const ColumnsView = View.extend({
	ui: {'trigger': 'button'},
	initialize(options: {context: ListContext, columns: Record<Column, boolean>, changed: () => void}) { void options },
	attributes: {style: 'display:contents'}, createState() { return {open: false, life: new AbortController()} },
	templateContext() { return {content: this.content()} }, template: ({content}: {content: TemplateResult}) => content,
	content() { const ctx = this.options.context; return html`<button type="button" class="base-button base-button--type-button button is-outlined mie-2" aria-expanded=${this.getState().open} @click=${() => { this.getState().open = !this.getState().open; this.render() }}><span class="icon is-small">${listIcon('th')}</span><span>${ctx.t('project.table.columns')}</span></button>${this.getState().open ? html`<div class="popup is-open"><div class="card columns-filter is-open"><div class="card-content content">${tableColumns.map(key => html`<div class="base-checkbox fancy-checkbox"><label class="base-checkbox__label"><input class="is-sr-only" type="checkbox" .checked=${this.options.columns[key]} @change=${(event: Event) => { this.options.columns[key] = (event.target as HTMLInputElement).checked; localStorage.setItem('tableViewColumns', JSON.stringify(this.options.columns)); this.options.changed() }}>${unsafeHTML(checkboxSvg)}<span class="fancy-checkbox__content">${columnTitle(ctx, key)}</span></label></div>`)}</div></div></div>` : nothing}` },
	onAttach() { const signal = this.getState().life.signal; document.addEventListener('click', event => { if (this.getState().open && !this.el.contains(event.target as Node)) this.close() }, {signal}); document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.getState().open && !event.defaultPrevented) { event.preventDefault(); this.close() } }, {signal}) },
	close() { const focus = this.el.contains(document.activeElement); this.getState().open = false; this.render(); if (focus) (this.getUI('trigger')![0] as HTMLButtonElement)?.focus() },
	onBeforeDestroy() { this.getState().life.abort() },
}).setDomApi(LitDomApi)
interface RowOptions extends ViewConfiguration {model: Model, context: ListContext, columns: () => Column[]}
const TableRowView = View.extend({
	ui: {avatars: '[data-avatar]'},
	initialize(options: RowOptions) { void options }, tagName: 'tr',
	createState() { return {life: new AbortController(), timer: undefined as ReturnType<typeof setTimeout> | undefined, tip: undefined as InstanceType<typeof Region> | undefined} },
	modelEvents: {'change': 'render'},
	templateContext() { return {content: this.content()} }, template: ({content}: {content: TemplateResult}) => content,
	content() { const task = this.options.model.get('task') as ITask, ctx = this.options.context; return html`${this.options.columns().map(key => html`<td>${this.cell(key, task, ctx)}</td>`)}` },
	cell(key: Column, task: ITask, ctx: ListContext): unknown {
		if (key === 'index' || key === 'title') return html`<a href=${ctx.taskHref(task.id)} @click=${ctx.navigate} @mouseenter=${key === 'title' ? (event: MouseEvent) => this.glance(event.currentTarget as HTMLElement, task) : nothing} @mouseleave=${() => this.hideTip()}>${key === 'index' ? getTaskIdentifier(task) : task.title}</a>`
		if (key === 'done') return task.done ? html`<span class="is-done is-done--small">${ctx.t('task.attributes.done')}</span>` : nothing
		if (key === 'project') { const project = ctx.getProject(task.projectId); return project ? html`<a href=${ctx.viewHref(project, project.views[0])} @click=${ctx.navigate}>${project.title}</a>` : nothing }
		if (key === 'labels') { const labels = Array.from(new Map(task.labels.map(label => [label.id, label])).values()).sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')); return html`<div class="label-wrapper">${labels.map(label => { const color = getLabelColor(label); return html`<span class="tag" style=${`background:${color || 'var(--grey-200)'};color:${color ? getTextColor(color) : 'var(--grey-800)'}`}>${label.title}</span>` })}</div>` }
		if (key === 'assignees' || key === 'createdBy') { const users = key === 'createdBy' ? [task.createdBy] : task.assignees; return html`${users.map(user => html`<img data-avatar=${user.username} class="image is-avatar mis-1" width=${key === 'createdBy' ? 27 : 28} height=${key === 'createdBy' ? 27 : 28} title=${getDisplayName(user)} alt=${getDisplayName(user)}>`)}` }
		if (key === 'priority') { const names = ['unset', 'low', 'medium', 'high', 'urgent', 'doNow']; return !task.done ? html`<span class="priority-label ${task.priority <= 1 ? 'negligible' : task.priority < 3 ? 'not-so-high' : 'high-priority'}"><span class="icon">${listIcon(task.priority >= 3 ? 'exclamation-circle' : 'exclamation')}</span><span>${ctx.t(`task.priority.${names[task.priority]}`)}</span></span>` : nothing }
		if (key === 'percentDone') return `${task.percentDone * 100}%`
		if (key === 'commentCount') return task.commentCount ? html`<span class="comment-count ${task.isUnread ? 'is-unread' : ''}" role="img" aria-label=${ctx.t('task.attributes.comment', task.commentCount)} title=${ctx.t('task.attributes.comment', task.commentCount)}>${listIcon('comments', true)}<span class="comment-count-badge">${task.commentCount}</span>${task.isUnread ? html`<span class="unread-indicator"></span>` : nothing}</span>` : nothing
		const date = task[key] as Date | null
		return date && +date ? html`<time datetime=${formatISO(date)} title=${formatDateLong(date)}>${ctx.displayDate(date)}</time>` : '-'
	},
	onRender() { this.hideTip(); const state = this.getState(); for (const img of Array.from(this.getUI('avatars')! as ArrayLike<HTMLImageElement>)) { void fetchAvatarBlobUrl({username: img.dataset.avatar!}, img.width).then(url => { if (!state.life.signal.aborted && img.isConnected && url) img.src = url }).catch(error => { if (!state.life.signal.aborted && img.isConnected) this.options.context.reportError(error) }) } },
	glance(trigger: HTMLElement, task: ITask) { this.hideTip(); this.getState().timer = setTimeout(() => { const host = document.createElement('div'); getTopLayerContainer().append(host); const region = new Region({el: host}); this.getState().tip = region; region.show(new TaskGlanceView({context: this.options.context, task, id: `table-glance-${task.id}`, trigger})) }, 450) },
	hideTip() { clearTimeout(this.getState().timer); const region = this.getState().tip, host = region?.el; region?.destroy(); if (host instanceof Element) host.remove(); this.getState().tip = undefined },
	onBeforeDestroy() { this.getState().life.abort(); this.hideTip() },
}).setDomApi(LitDomApi).setDataApi(DataApi)
const TableRowsView = CollectionView.extend({
	initialize(options: {collection: Collection, context: ListContext, columns: () => Column[]}) { void options }, tagName: 'tbody', childView: TableRowView, viewComparator: 'order',
	childViewOptions() { return {context: this.options.context, columns: this.options.columns} },
}).setDataApi(DataApi)
export const ProjectTableView = View.extend({
	initialize(options: {widgets: ListWidgets, project: IProject, viewId: number}) { void options; this.addRegion('frame', {el: this.el}) },
	template: false, className: 'native-list-surface', attributes: {style: 'display:contents'},
	createState() { return {columns: {...defaults, ...stored('tableViewColumns', defaults)}, sort: tableDefaultSort(), collection: (new Collection() as Collection<Model>), query: undefined as ListQuery | undefined, tasks: [] as ITask[], pages: 0, loading: false} },
	onAttach() {
		const frame = new ListFrameView({context: this.options.widgets.context, project: this.options.project, viewId: this.options.viewId}); this.showChildView('frame', frame); frame.el.classList.remove('project-list'); frame.el.classList.add('project-table')
		frame.showChildView('sort', new ColumnsView({context: this.options.widgets.context, columns: this.getState().columns, changed: () => this.columnsChanged()}))
		frame.showChildView('filter', new ListFilterView({context: this.options.widgets.filter, project: this.options.project, viewId: this.options.viewId, query: this.getState().query!, changed: params => this.trigger('filter:change', params)}))
		const body = new TableBodyView({owner: this}); frame.showChildView('body', body); this.publish(this.getState().tasks, this.getState().pages, this.getState().query!); this.setLoading(this.getState().loading); frame.checkOverflow()
	},
	visibleColumns() { return tableColumns.filter(key => this.getState().columns[key]) },
	columnsChanged() { ((this.getChildView('frame') as InstanceType<typeof ListFrameView>).getChildView('body') as InstanceType<typeof TableBodyView>).render(); const active = Object.fromEntries(Object.entries(this.getState().sort).filter(([field]) => this.visibleColumns().some(key => fields[key] === field))) as Sort; this.trigger('sort:change', active) },
	sort(field: string, event: MouseEvent) { this.getState().sort = cycleTableSort(this.getState().sort, field, event.ctrlKey || event.metaKey); localStorage.setItem('tableViewSortBy', JSON.stringify(this.getState().sort)); this.columnsChanged() },
	pending(query: ListQuery, clear: boolean) { this.getState().query = query; if (clear) { this.getState().tasks = []; this.getState().collection.reset([]) }; const frame = this.getChildView('frame') as InstanceType<typeof ListFrameView> | undefined; (frame?.getChildView('filter') as InstanceType<typeof ListFilterView> | undefined)?.updateQuery(query) },
	publish(tasks: ITask[], pages: number, query: ListQuery) { Object.assign(this.getState(), {tasks, pages, query}); this.getState().collection.reset(tasks.map((task, order) => ({id: task.id, task, order}))); ((this.getChildView('frame') as InstanceType<typeof ListFrameView> | undefined)?.getChildView('body') as InstanceType<typeof TableBodyView> | undefined)?.update(pages, query) },
	setLoading(loading: boolean) { this.getState().loading = loading; (this.getChildView('frame') as InstanceType<typeof ListFrameView> | undefined)?.getChildView('body')?.el.classList.toggle('is-loading', loading) },
})
const TableBodyView = View.extend({
	ui: {headers: 'th', sortIcons: '.sort__icon'},
	initialize(options: {owner: InstanceType<typeof ProjectTableView>}) { void options }, className: 'loader-container native-table-body', regions: {rows: {el: 'tbody', replaceElement: true}, pagination: '[data-pagination]'},
	templateContext() { return {content: this.content()} }, template: ({content}: {content: TemplateResult}) => content,
	content() { const owner = this.options.owner, ctx = owner.options.widgets.context, query = owner.getState().query; return html`<div class="card"><div style="overflow:auto"><table class="table has-actions is-hoverable is-fullwidth mbe-0"><thead><tr>${owner.visibleColumns().map(key => { const field = fields[key], order = field ? query?.sort[field] : undefined; return html`<th aria-sort=${order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : nothing}>${columnTitle(ctx, key)}${field ? html` <button type="button" class="base-button base-button--type-button" aria-label=${ctx.t('project.table.sortBy', {column: columnTitle(ctx, key)})} @click=${(event: MouseEvent) => owner.sort(field, event)}><span class="sort__icon" style=${order === 'desc' ? 'transform:rotate(180deg)' : ''}></span></button>` : nothing}</th>` })}</tr></thead><tbody></tbody></table></div><div data-pagination></div></div>` },
	onRender() { const owner = this.options.owner; this.showChildView('rows', new TableRowsView({collection: owner.getState().collection, context: owner.options.widgets.context, columns: () => owner.visibleColumns()})); if (owner.getState().query) this.update(owner.getState().pages, owner.getState().query!) },
	update(pages: number, query: ListQuery) { const pagination = this.getChildView('pagination') as InstanceType<typeof ListPaginationView> | undefined; if (pagination) pagination.update(pages, query.page); else this.showChildView('pagination', new ListPaginationView({context: this.options.owner.options.widgets.context, pages, page: query.page})); const headers = this.getUI('headers')!; this.options.owner.visibleColumns().forEach((key, index) => { const field = fields[key], order = field ? query.sort[field] : undefined; if (order) headers[index].setAttribute('aria-sort', order === 'asc' ? 'ascending' : 'descending'); else headers[index].removeAttribute('aria-sort'); const icon = Array.from(this.getUI('sortIcons')! as ArrayLike<HTMLElement>).find(icon => icon.closest('th') === headers[index]); if (icon) { render(listIcon(order ? 'sort-up' : 'sort'), icon); icon.style.transform = order === 'desc' ? 'rotate(180deg)' : '' } }) },
}).setDomApi(LitDomApi)
