import TaskService from '@/services/task'
import TaskModel from '@/models/task'
import { TaskRecordSession } from '@/features/task/task-record'
import { ProjectGanttView } from '@/features/projects/project-gantt'
import { ProjectGanttResultsApplication } from '@/features/projects/project-gantt-results'
import { defaultGanttQuery, shiftedDate } from '@/features/projects/gantt-query'
import type { SortableEvent } from 'sortablejs'
import TaskPositionService from '@/services/taskPosition'
import TaskPositionModel from '@/models/taskPosition'
import { calculateItemPosition } from '@/helpers/calculateItemPosition'
import { Application, type LifecycleContext, type RegionInstance } from 'marionette'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import type { IProject } from '@/modelTypes/IProject'
import type { ListWidgets } from '@/shared/task-list/list-context'
import { ProjectListResultsApplication } from '@/features/projects/project-list-results'
import { ProjectListView } from '@/features/projects/project-list-view'
import { ProjectTableView, tableDefaultSort } from '@/features/projects/project-table'
import SavedFilterService, { isSavedFilter, getSavedFilterIdFromProjectId } from '@/services/savedFilterCore'
import SavedFilterModel from '@/models/savedFilter'
import type { ISavedFilter } from '@/modelTypes/ISavedFilter'
import type { IBucket } from '@/modelTypes/IBucket'
import { ProjectKanbanView, type KanbanPorts } from '@/features/projects/project-kanban'
import type { ITask } from '@/modelTypes/ITask'
import type { TaskFilterParams } from '@/services/taskCollection'
import type { ListQuery, Sort } from '@/shared/task-list/task-list-query'
import type { Route, QueryPatch } from '../../app/routes'
import { TaskApplication, type TaskPorts } from '../task/application'
interface Options {
    kanban: Omit<KanbanPorts, 'reload'>;
    taskPorts: TaskPorts;
    widgets: ListWidgets;
    commitProject: (project: IProject) => void;
    timezone: () => string;
    navigateQuery: (query: QueryPatch) => Promise<unknown>;
    reportError: (error: unknown) => void;
}
export const ProjectApplication = Application.extend({
	initialize(options: Options) {
		this.addChildApp('task', new TaskApplication({ ports: options.taskPorts, recordFor: task => this.getState().kind === 'gantt' ? this.ganttRecord(task, true) : undefined }))
		this.addChildApp('results', new ProjectListResultsApplication({ ...options, defaultSort: () => this.getState().defaultSort, expand: ['comment_count', 'is_unread'],
			getStoredQuery: id => {
				try {
					return JSON.parse(localStorage.getItem('viewFilters') ?? '{}')[id] ?? {}
				}
				catch {
					return {}
				}
			},
			setStoredQuery: (id, query) => {
				let queries: Record<number, QueryPatch> = {}
				try {
					queries = JSON.parse(localStorage.getItem('viewFilters') ?? '{}')
				}
				catch { /* Ignore malformed persisted queries. */ }
				;
				queries[id] = query
				localStorage.setItem('viewFilters', JSON.stringify(queries))
			},
			pending: (query: ListQuery, clear: boolean) => (this.getView() as InstanceType<typeof ProjectTableView>).pending(query, clear),
			loading: (value: boolean) => (this.getView() as InstanceType<typeof ProjectTableView>).setLoading(value),
			publish: (items: (ITask | IBucket)[], pages: number, query: ListQuery) => {
				if (this.getState().kind === 'kanban') {
					(this.getView() as InstanceType<typeof ProjectKanbanView>).publish(items as IBucket[], pages, query)
				}
				else {
					const tasks = items as ITask[]
					Object.assign(this.getState(), { tasks, pages });
					(this.getView() as InstanceType<typeof ProjectTableView>).publish(tasks, pages, query)
				}
			},
		}))
		this.addChildApp('ganttResults', new ProjectGanttResultsApplication({
			...options,
			getStoredQuery: id => { try {
				return JSON.parse(localStorage.getItem('viewFilters') ?? '{}')[id] ?? {}
			}
			catch {
				return {}
			} },
			setStoredQuery: (id, query) => { let queries: Record<number, QueryPatch> = {}; try {
				queries = JSON.parse(localStorage.getItem('viewFilters') ?? '{}')
			}
			catch { /* malformed saved query */ } ; queries[id] = query; localStorage.setItem('viewFilters', JSON.stringify(queries)) },
			pending: query => (this.getView() as InstanceType<typeof ProjectGanttView>).pending(query),
			loading: loading => (this.getView() as InstanceType<typeof ProjectGanttView>).setLoading(loading),
			publish: (tasks, query) => { this.getState().tasks = tasks; (this.getView() as InstanceType<typeof ProjectGanttView>).publish(tasks, query) },
		}))
	},
	ganttRecord(task: ITask, fresh = false) {
		const records = this.getState().ganttRecords
		let record = records.get(task.id)
		if (!record) {
			record = new TaskRecordSession(task, (value, signal) => new TaskService().update(value, signal))
			record.observe(value => this.taskUpdated(value))
			records.set(task.id, record)
		}
		else if (fresh)
			record.acceptFields(task)
		return record
	},
	createState() { return { ganttRecords: new Map<number, TaskRecordSession>(), createRequest: undefined as AbortController | undefined, kind: 'list', modalKey: '', modalRequest: undefined as object | undefined, defaultSort: tableDefaultSort(), tasks: [] as ITask[], pages: 0, positionRequest: undefined as AbortController | undefined, route: undefined as Route | undefined, project: undefined as IProject | undefined } },
	viewEvents: { 'filter:change': 'filterChanged', 'sort:change': 'sortChanged', 'tasks:added': 'tasksAdded', 'task:update': 'taskUpdated', 'drag:start': 'dragStarted', 'drag:finish': 'dragFinished' },
	dragStarted() { this.options.kanban.setTaskDragging(true); this.getState().positionRequest?.abort() },
	async dragFinished(event: SortableEvent) {
		const state = this.getState(), request = new AbortController()
		state.positionRequest?.abort()
		state.positionRequest = request
		try {
			const draggedId = Number(event.item.dataset.taskId), task = state.tasks.find(task => task.id === draggedId)
			const destination = this.options.kanban.dropProject((event as SortableEvent & {originalEvent: MouseEvent}).originalEvent)
			if (task && destination && destination !== task.projectId) {
				try {
					await new TaskService().update({...task, projectId: destination}, request.signal)
					request.signal.throwIfAborted()
					state.tasks = state.tasks.filter(task => task.id !== draggedId)
					const query = (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).getState().query
					if (query) (this.getView() as InstanceType<typeof ProjectListView>).publish(state.tasks, state.pages, query)
					this.options.widgets.context.success(this.options.widgets.context.t('task.movedToProject', {project: this.options.widgets.context.getProject(destination)?.title ?? ''}))
					return
				} catch (error) {
					if (request.signal.aborted) throw error
					this.options.reportError(error)
				} finally {
					if (!request.signal.aborted) this.options.kanban.setTaskDragging(false)
				}
			}
			this.options.kanban.setTaskDragging(false)
			if (event.to !== event.from) return
			const order = Array.from(event.to.children).map(element => Number((element as HTMLElement).dataset.taskId)), ordered = order.map(id => state.tasks.find(task => task.id === id)).filter((task): task is ITask => Boolean(task)), id = Number(event.item.dataset.taskId), index = ordered.findIndex(task => task.id === id)
			if (index < 0)
				return
			const position = calculateItemPosition(ordered[index - 1]?.position ?? null, ordered[index + 1]?.position ?? null)
			await new TaskPositionService().update(new TaskPositionModel({ taskId: id, projectViewId: Number(state.route?.params.viewId), position }), request.signal)
			request.signal.throwIfAborted()
			state.tasks = [...ordered.map(task => task.id === id ? { ...task, position } : task), ...state.tasks.filter(task => !order.includes(task.id))]
			const query = (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).getState().query
			if (query)
				(this.getView() as InstanceType<typeof ProjectListView>).publish(state.tasks, state.pages, query)
		}
		catch (error) {
			if (!request.signal.aborted)
				this.options.reportError(error)
		}
	},
	tasksAdded(tasks: ITask[]) {
		const results = this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>, query = results.getState().query
		if (!query)
			return
		if ('position' in query.sort) {
			this.getState().tasks = [...tasks, ...this.getState().tasks];
			(this.getView() as InstanceType<typeof ProjectListView>).publish(this.getState().tasks, this.getState().pages, query)
		}
		else
			void results.loadRoute({ route: this.getState().route!, project: this.getState().project! }, true)
	},
	taskUpdated(task: ITask) {
		if (this.getState().kind === 'gantt') {
			this.getState().tasks = this.getState().tasks.map(value => value.id === task.id ? task : value);
			(this.getView() as InstanceType<typeof ProjectGanttView>).taskUpdated(task)
			return
		}
		;
		if (this.getState().kind === 'kanban') {
			(this.getView() as InstanceType<typeof ProjectKanbanView>).taskUpdated(task)
			return
		}
		;
		const query = (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).getState().query
		if (!query)
			return
		this.getState().tasks = this.getState().tasks.map(value => value.id === task.id ? task : value);
		(this.getView() as InstanceType<typeof ProjectListView>).publish(this.getState().tasks, this.getState().pages, query)
	},
	filterChanged(params: TaskFilterParams) { (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).filterChanged(params) },
	sortChanged(sort: Sort) { (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).sortChanged(sort) },
	onBeforeStart(_app: unknown, route: Route) { this.getState().route = route; this.getState().defaultSort = tableDefaultSort() },
	async prepareStart(route: Route, { signal }: LifecycleContext) { const id = Number(route.params.projectId); const [project, savedFilter] = await Promise.all([new ProjectService().get(new ProjectModel({ id }), {}, signal), isSavedFilter({ id } as IProject) ? new SavedFilterService().get(new SavedFilterModel({ id: getSavedFilterIdFromProjectId(id) }), {}, signal) : Promise.resolve(undefined)]); return { project, savedFilter } },
	onStart(_app: unknown, route: Route, { project, savedFilter }: {
        project: IProject;
        savedFilter?: ISavedFilter;
    }) {
		this.getState().project = project;
		(this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).options.savedSearch = savedFilter?.filters.s ?? '';
		(this.getChildApp('ganttResults') as InstanceType<typeof ProjectGanttResultsApplication>).options.savedSearch = savedFilter?.filters.s ?? ''
		this.options.commitProject(project)
		const view = project.views.find(view => view.id === Number(route.params.viewId))
		if (view?.viewKind !== 'table' && view?.viewKind !== 'list' && view?.viewKind !== 'kanban' && view?.viewKind !== 'gantt')
			throw new Error(`Native ${view?.viewKind ?? 'unknown'} project view is not integrated in this batch`);
		(this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).options.expand = view.viewKind === 'list' ? ['subtasks', 'comment_count', 'is_unread'] : ['comment_count', 'is_unread']
		this.getState().kind = view.viewKind;
		(this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).options.perPage = view.viewKind === 'kanban' ? 25 : undefined
		this.getState().defaultSort = view.viewKind === 'table' ? tableDefaultSort() : { position: 'asc' }
		const options = { widgets: this.options.widgets, project, viewId: view.id, savedFilter }
		const surface = view.viewKind === 'gantt' ? new ProjectGanttView({ ...options, openTask: this.options.kanban.openTask, changeQuery: query => { void this.options.navigateQuery({ ...this.getState().route!.query, ...query }).catch(this.options.reportError) }, save: (task, patch) => this.ganttRecord(task).save(patch, undefined, false), create: async (title) => { const request = new AbortController(); this.getState().createRequest = request; const startDate = new Date(); startDate.setHours(0, 0, 0, 0); const endDate = shiftedDate(startDate, 7); endDate.setHours(23, 59, 0, 0); const task = await new TaskService().create(new TaskModel({ title, projectId: project.id, startDate, endDate }), request.signal); request.signal.throwIfAborted(); this.getState().tasks.push(task); return task } }) : view.viewKind === 'table' ? new ProjectTableView(options) : view.viewKind === 'kanban' ? new ProjectKanbanView({ ...options, ports: { ...this.options.kanban, reload: () => Promise.resolve((this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).loadRoute({ route: this.getState().route!, project: this.getState().project! }, true)) } }) : new ProjectListView(options)
		if (view.viewKind === 'gantt')
			(surface as InstanceType<typeof ProjectGanttView>).pending(defaultGanttQuery())
		else
			(surface as InstanceType<typeof ProjectListView>).pending({ sort: this.getState().defaultSort, filter: '', s: '', page: 1, explicitSort: false, includeNulls: false }, true)
		this.setView(surface)
		this.showView()
		this.updateRoute(this.getState().route!)
	},
	updateRoute(route: Route) {
		if (JSON.stringify(this.getState().route?.query) !== JSON.stringify(route.query))
			this.getState().positionRequest?.abort()
		this.getState().route = route
		if (this.isRunning() && this.getState().project)
			return this.getState().kind === 'gantt' ? (this.getChildApp('ganttResults') as InstanceType<typeof ProjectGanttResultsApplication>).loadRoute({ route, project: this.getState().project! }) : (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).loadRoute({ route, project: this.getState().project! })
	},
	reload() {
		const {route, project, kind} = this.getState()
		if (!this.isRunning() || !route || !project)
			return
		return kind === 'gantt'
			? (this.getChildApp('ganttResults') as InstanceType<typeof ProjectGanttResultsApplication>).loadRoute({route, project}, true)
			: (this.getChildApp('results') as InstanceType<typeof ProjectListResultsApplication>).loadRoute({route, project}, true)
	},
	async showTask(route: Route, region: RegionInstance) {
		const state = this.getState()
		const task = this.getChildApp('task') as InstanceType<typeof TaskApplication>
		if (!this.isRunning())
			return
		if (state.modalKey === route.key && (task.isRunning() || state.modalRequest))
			return
		task.stop()
		const request = {}
		state.modalKey = route.key
		state.modalRequest = request
		try {
			await task.start({ ...route, modal: true, region })
		}
		catch (error) {
			if (this.isRunning() && state.modalRequest === request) {
				task.stop()
				state.modalKey = ''
				this.options.reportError(error)
			}
		}
		finally {
			if (state.modalRequest === request)
				state.modalRequest = undefined
		}
	},
	closeTask() {
		const state = this.getState()
		state.modalKey = ''
		state.modalRequest = undefined
        this.getChildApp('task')!.stop()
	},
	flushTask() { return (this.getChildApp('task') as InstanceType<typeof TaskApplication>).flush() },
	onBeforeStop() { this.options.kanban.setTaskDragging(false); this.getState().createRequest?.abort(); for (const record of this.getState().ganttRecords.values())
		record.close(); this.getState().ganttRecords.clear(); this.getState().modalKey = ''; this.getState().modalRequest = undefined; this.getState().positionRequest?.abort(); this.getState().route = undefined; this.getState().project = undefined },
})
