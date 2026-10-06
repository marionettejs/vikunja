import {View, CollectionView} from 'marionette'
import {Collection, DataApi, type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import Sortable, {type SortableEvent} from 'sortablejs'
import type {TaskFilterParams} from '@/services/taskCollection'
import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'
import {shouldShowTaskInListView} from '@/composables/useTaskListFiltering'
import {ListFilterView} from '../../shared/task-list/list-filter'
import type {QueryPatch, Query} from '@/app/routes'
import type {ListQuery, Sort} from '../../shared/task-list/task-list-query'
import './project-list.scss'
import '../../shared/task-list/list-native.scss'
import type {ListContext, ListWidgets} from '../../shared/task-list/list-context'
export type {ListWidgets} from '../../shared/task-list/list-context'
import {ListTaskRowView} from '../../shared/task-list/list-task-row'
import {ListPaginationView, ListEmptyView, ListSortView} from '../../shared/task-list/list-controls'
import {ListAddTaskView} from '../../shared/task-list/list-add-task'
import {ListFrameView} from '../../shared/task-list/list-frame'

interface Options {widgets: ListWidgets, project: IProject, viewId: number}
interface RowsOptions {context: ListContext, allTasks: () => ITask[], canWrite: boolean, collection: Collection}
const TaskRowsView = CollectionView.extend({
	initialize(options: RowsOptions) { void options },
	tagName: 'ul', className: 'tasks', childView: ListTaskRowView, viewComparator: 'order',
	createState() { return {sortable: undefined as Sortable | undefined} },
	onAttach() {
		const touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches
		this.getState().sortable = new Sortable(this.el as HTMLElement, {animation: 100, draggable: '> div', handle: touch ? '.handle' : undefined,
			delayOnTouchOnly: !touch, delay: touch ? 0 : 1000, ghostClass: 'task-ghost', group: {name: 'tasks', put: false},
			onStart: (event: SortableEvent) => this.trigger('drag:start', Number(event.item.dataset.taskId)),
			onEnd: (event: SortableEvent) => this.trigger('drag:finish', event),
		})
	},
	onBeforeDestroy() { this.getState().sortable?.destroy() },
	setDraggable(enabled: boolean) { this.el.classList.toggle('dragging-disabled', !enabled); this.getState().sortable?.option('disabled', !enabled) },
	childViewOptions() { return {context: this.options.context, allTasks: this.options.allTasks, canWrite: this.options.canWrite, draggable: true} },
	childViewEvents: {'task:update': 'taskUpdated'},
	taskUpdated(task: ITask) { this.trigger('task:update', task) },
}).setDataApi(DataApi)

const ListBodyView = View.extend({
	className: 'loader-container is-max-width-desktop list-view native-list-body',
	initialize(options: Options) { void options },
	template: () => html`<div class="card has-overflow"><div class="card-content loader-container p-0"><div>
		<div data-add style="display: contents"></div><div data-empty style="display: contents"></div>
		<div data-rows style="display: contents"></div><div data-pagination style="display: contents"></div>
	</div></div></div>`,
	regions: {add: '[data-add]', empty: '[data-empty]', rows: '[data-rows]', pagination: '[data-pagination]'},
	createState() { return {tasks: [] as ITask[], collection: (new Collection() as Collection<Model>), focusedIndex: -1, revision: 0, query: undefined as ListQuery | undefined,
		keyboard: (event: KeyboardEvent) => this.listKey(event)} },
	onRender() {
		if (!this.options.project.isArchived && Number(this.options.project.maxPermission) > 0) {
			this.showChildView('add', new ListAddTaskView({context: this.options.widgets.context, projectId: this.options.project.id, added: (tasks: ITask[]) => this.trigger('tasks:added', tasks)}))
		}
		const rows = new TaskRowsView({collection: this.getState().collection, context: this.options.widgets.context, allTasks: () => this.getState().tasks, canWrite: Number(this.options.project.maxPermission) > 0})
		this.listenTo(rows, 'task:update', (task: ITask) => this.trigger('task:update', task))
		this.listenTo(rows, 'drag:start', (id: number) => this.trigger('drag:start', id))
		this.listenTo(rows, 'drag:finish', (event: SortableEvent) => this.trigger('drag:finish', event))
		this.showChildView('rows', rows)
	},
	onAttach() { document.addEventListener('keydown', this.getState().keyboard) },
	onBeforeDestroy() { document.removeEventListener('keydown', this.getState().keyboard) },
	setLoading(loading: boolean) { this.el.classList.toggle('is-loading', loading) },
	publish(tasks: ITask[], pages: number, query: ListQuery) {
		this.getState().tasks = tasks
		this.getState().query = query
		const visible = tasks.filter(task => shouldShowTaskInListView(task, tasks))
		const collection = this.getState().collection
		const ids = new Set(visible.map(task => task.id))
		collection.remove(collection.models.filter(model => !ids.has(Number(model.id))))
		for (const [order, task] of visible.entries()) {
			const model = collection.get(task.id)
			if (model) model.set({task, order, revision: ++this.getState().revision})
			else collection.add({id: task.id, task, order})
		}
		const rows = this.getChildView('rows') as InstanceType<typeof TaskRowsView>
		rows.sort()
		rows.setDraggable(Number(this.options.project.maxPermission) > 0 && 'position' in query.sort)
		;(rows.el as HTMLElement).style.display = visible.length ? '' : 'none'
		if (!tasks.length) {
			if (!this.getChildView('empty')) this.showChildView('empty', new ListEmptyView({context: this.options.widgets.context, focus: () => this.focusEntry(), canWrite: Number(this.options.project.maxPermission) > 0}))
		} else this.getRegion('empty')!.empty()
		const pagination = this.getChildView('pagination') as InstanceType<typeof ListPaginationView> | undefined
		if (pagination) pagination.update(pages, query.page)
		else this.showChildView('pagination', new ListPaginationView({context: this.options.widgets.context, pages, page: query.page}))
	},
	setProject(project: IProject) {
		this.options.project = project
		const canWrite = Number(project.maxPermission) > 0
		if (project.isArchived || !canWrite) this.getRegion('add')!.empty()
		else if (!this.getChildView('add')) this.showChildView('add', new ListAddTaskView({context: this.options.widgets.context, projectId: project.id, added: (tasks: ITask[]) => this.trigger('tasks:added', tasks)}))
		const rows = this.getChildView('rows') as InstanceType<typeof TaskRowsView>
		rows.options.canWrite = canWrite
		rows.setDraggable(canWrite && Boolean(this.getState().query && 'position' in this.getState().query!.sort))
		for (const row of rows.children.toArray()) { row.setCanWrite(canWrite); row.render() }
	},
	clearRows() {
		this.getState().tasks = []
		this.getState().collection.reset([])
		this.getRegion('empty')!.empty()
	},
	focusEntry() { (this.getChildView('add') as InstanceType<typeof ListAddTaskView> | undefined)?.focusInput() },
	listKey(event: KeyboardEvent) {
		if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
		const rows = Array.from(this.el.querySelectorAll<HTMLElement>('ul.tasks > div > .single-task'))
		let index = this.getState().focusedIndex
		if (event.code === 'KeyJ') index = Math.min(index + 1, rows.length - 1)
		else if (event.code === 'KeyK') {
			if (index === 0) { event.preventDefault(); this.focusEntry(); this.getState().focusedIndex = -1; return }
			index = index === -1 ? rows.length - 1 : Math.max(index - 1, 0)
		} else if (event.code === 'Enter' && !event.isComposing) {
			if (event.target instanceof HTMLElement && event.target.closest('a, button, [role="button"]')) return
			if (index < 0) return
			event.preventDefault()
			rows[index]?.click()
			return
		} else return
		event.preventDefault()
		this.getState().focusedIndex = index
		rows[index]?.focus()
	},
}).setDomApi(LitDomApi)

export const ProjectListView = View.extend({
	template: false, className: 'native-list-surface',
	attributes: {style: 'display: contents'},
	initialize(options: Options) { void options; this.addRegion('frame', {el: this.el}) },
	createState() { return {query: {sort: {position: 'asc'}, filter: '', s: '', page: 1, explicitSort: false, includeNulls: false} as ListQuery,
		body: undefined as InstanceType<typeof ListBodyView> | undefined, tasks: [] as ITask[], pages: 0, loading: false} },
	onAttach() {
		const frame = new ListFrameView({context: this.options.widgets.context, project: this.options.project, viewId: this.options.viewId})
		this.showChildView('frame', frame)
		frame.showChildView('sort', new ListSortView({context: this.options.widgets.context, sort: this.getState().query.sort, changed: (sort: Sort) => this.trigger('sort:change', sort)}))
		frame.showChildView('filter', new ListFilterView({context: this.options.widgets.filter, project: this.options.project, viewId: this.options.viewId, query: this.getState().query, changed: (params: TaskFilterParams) => this.trigger('filter:change', params)}))
		const body = new ListBodyView({widgets: this.options.widgets, project: this.options.project, viewId: this.options.viewId})
		this.getState().body = body
		this.listenTo(body, 'tasks:added', (tasks: ITask[]) => this.trigger('tasks:added', tasks))
		this.listenTo(body, 'task:update', (task: ITask) => this.trigger('task:update', task))
		this.listenTo(body, 'drag:start', (id: number) => this.trigger('drag:start', id))
		this.listenTo(body, 'drag:finish', (event: SortableEvent) => this.trigger('drag:finish', event))
		frame.showChildView('body', body)
		body.publish(this.getState().tasks, this.getState().pages, this.getState().query)
		body.setLoading(this.getState().loading)
		frame.checkOverflow()
	},
	pending(query: ListQuery, clear: boolean) {
		this.getState().query = query
		if (clear) { this.getState().tasks = []; this.getState().body?.clearRows() }
		const frame = this.getChildView('frame') as InstanceType<typeof ListFrameView> | undefined
		;(frame?.getChildView('sort') as InstanceType<typeof ListSortView> | undefined)?.updateSort(query.sort)
		;(frame?.getChildView('filter') as InstanceType<typeof ListFilterView> | undefined)?.updateQuery(query)
	},
	setLoading(loading: boolean) { this.getState().loading = loading; this.getState().body?.setLoading(loading) },
	publish(tasks: ITask[], pages: number, query: ListQuery) { Object.assign(this.getState(), {tasks, pages, query}); this.getState().body?.publish(tasks, pages, query) },
})

// Metadata readiness has no task-body owner yet; use the same native header.
export const ProjectListPendingView = View.extend({
	template: false, className: 'native-list-surface', attributes: {style: 'display:contents'},
	initialize(options: Options & {query: ListQuery, navigateQuery: (query: QueryPatch) => Promise<unknown>, routeQuery: Query}) { void options; this.addRegion('frame', {el: this.el}) },
	onAttach() {
		const frame = new ListFrameView({context: this.options.widgets.context, project: this.options.project, viewId: this.options.viewId})
		this.showChildView('frame', frame)
		frame.showChildView('sort', new ListSortView({context: this.options.widgets.context, sort: this.options.query.sort, changed: sort => this.changeQuery({sort: Object.entries(sort).map(([field, order]) => `${field}:${order}`).join(',')})}))
		frame.showChildView('filter', new ListFilterView({context: this.options.widgets.filter, project: this.options.project, viewId: this.options.viewId, query: this.options.query, changed: params => this.changeQuery({filter: params.filter || undefined, s: params.s || undefined})}))
		frame.checkOverflow()
	},
	changeQuery(patch: QueryPatch) { void this.options.navigateQuery({...this.options.routeQuery, ...patch, page: undefined}).catch(this.options.widgets.context.reportError) },
	updateQuery(query: ListQuery, routeQuery: Query) {
		this.options.query = query; this.options.routeQuery = routeQuery
		const frame = this.getChildView('frame') as InstanceType<typeof ListFrameView>
		;(frame.getChildView('sort') as InstanceType<typeof ListSortView>).updateSort(query.sort)
		;(frame.getChildView('filter') as InstanceType<typeof ListFilterView>).updateQuery(query)
	},
	setLoading(loading: boolean) { (this.getChildView('frame') as InstanceType<typeof ListFrameView>).el.classList.toggle('is-loading', loading) },
})

export const ProjectMetadataPendingView = View.extend({
	template: false,
	initialize(options: {context: ListContext, projectId: number, available: (project: IProject) => void}) { void options },
	createState() { return {stop: undefined as (() => void) | undefined} },
	onAttach() { this.getState().stop = this.options.context.observeProject(this.options.projectId, project => this.options.available(project)) },
	setLoading(loading: boolean) { void loading },
	onBeforeDestroy() { this.getState().stop?.() },
})
