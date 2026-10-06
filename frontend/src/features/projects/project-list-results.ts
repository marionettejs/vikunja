import {Application, type LifecycleContext} from 'marionette'
import type {Route as RouteLocationNormalizedGeneric, QueryPatch as LocationQueryRaw} from '@/app/routes'
import type {IProject} from '@/modelTypes/IProject'
import type {IBucket} from '@/modelTypes/IBucket'
import type {ITask} from '@/modelTypes/ITask'
import type {TaskFilterParams} from '@/services/taskCollection'
import TaskCollectionService from '@/services/taskCollection'
import TaskModel from '@/models/task'
import {setModuleLoading} from '@/stores/helper'
import {parseListQuery, storedListQuery, listRequestParams, type ListQuery, type Sort} from '../../shared/task-list/task-list-query'

interface Destination {route: RouteLocationNormalizedGeneric, project: IProject, retainRows?: boolean}
interface Options {
	savedSearch?: string
	defaultSort?: () => Sort
	expand?: string[]
	perPage?: number
	timezone: () => string
	getStoredQuery: (id: number) => LocationQueryRaw
	setStoredQuery: (id: number, query: LocationQueryRaw) => void
	navigateQuery: (query: LocationQueryRaw) => Promise<unknown>
	pending: (query: ListQuery, clear: boolean) => void
	loading: (loading: boolean) => void
	publish: (tasks: (ITask | IBucket)[], pages: number, query: ListQuery) => void
	reportError: (error: unknown) => void
}

export const ProjectListResultsApplication = Application.extend({
	initialize(options: Options) { void options },
	createState() { return {destination: undefined as Destination | undefined, query: undefined as ListQuery | undefined, key: '', includeNulls: false, request: undefined as Promise<boolean> | undefined} },
	onBeforeStart(_app: unknown, destination: Destination) {
		this.getState().destination = destination
		const query = {...parseListQuery(destination.route.query, this.options.defaultSort?.()), includeNulls: this.getState().includeNulls}
		this.getState().query = query
		this.options.pending(query, !destination.retainRows)
	},
	async prepareStart(destination: Destination, {signal}: LifecycleContext) {
		const query = {...parseListQuery(destination.route.query, this.options.defaultSort?.()), includeNulls: this.getState().includeNulls}
		const service = new TaskCollectionService()
		const stopLoading = setModuleLoading(loading => { if (!signal.aborted) this.options.loading(loading) })
		try {
			const model = Object.assign(new TaskModel(), {projectId: destination.project.id, viewId: Number(destination.route.params.viewId)})
			const tasks = await service.getAll(model, {...listRequestParams(query, this.options.timezone()), s: query.s || this.options.savedSearch || '', ...(this.options.expand ? {expand: this.options.expand} : {}), ...(this.options.perPage ? {per_page: this.options.perPage} : {})}, query.page, signal)
			signal.throwIfAborted()
			return {tasks, pages: service.totalPages, query}
		} finally { stopLoading() }
	},
	onStart(_app: unknown, _options: Destination, result: {tasks: (ITask | IBucket)[], pages: number, query: ListQuery}) {
		this.options.publish(result.tasks, result.pages, result.query)
	},
	loadRoute(destination: Destination, force = false) {
		const query = {...parseListQuery(destination.route.query, this.options.defaultSort?.()), includeNulls: this.getState().includeNulls}
		const stored = this.options.getStoredQuery(Number(destination.route.params.viewId))
		if (!this.getState().destination && !query.explicitSort && !query.filter && !query.s && (!Number.isInteger(query.page) || query.page === 1) && Object.keys(stored).length) {
			void this.options.navigateQuery({...destination.route.query, ...stored}).catch(this.options.reportError)
			return
		}
		this.options.setStoredQuery(Number(destination.route.params.viewId), storedListQuery(query))
		const key = JSON.stringify([destination.project.id, destination.route.params.viewId, destination.route.query])
		if (!force && this.getState().key === key && (this.isRunning() || this.getState().request)) return this.getState().request ?? Promise.resolve(true)
		this.getState().key = key
		const request = this.getState().destination ? this.restart({...destination}) : this.start({...destination})
		// This feature is the error boundary. Observe failure here and return a settled
		// readiness result so route/view callers cannot create an unhandled rejection.
		const readiness = request.catch(error => {
			if (this.getState().request !== readiness || this.getState().key !== key) return false
			this.getState().key = ''
			this.options.loading(false)
			this.options.reportError(error)
			return false
		}).finally(() => {
			if (this.getState().request === readiness) this.getState().request = undefined
		})
		this.getState().request = readiness
		return readiness
	},
	onBeforeStop() { this.getState().destination = undefined; this.getState().query = undefined; this.getState().key = ''; this.getState().includeNulls = false; this.getState().request = undefined },
	filterChanged(params: TaskFilterParams) {
		const destination = this.getState().destination
		if (!destination) return
		this.getState().includeNulls = params.filter_include_nulls
		const previous = parseListQuery(destination.route.query, this.options.defaultSort?.())
		if (previous.filter === params.filter && previous.s === params.s && previous.page === 1) {
			this.loadRoute(destination, true)
		} else this.changeQuery({filter: params.filter || undefined, s: params.s || undefined})
	},
	changeQuery(patch: LocationQueryRaw) {
		const destination = this.getState().destination
		if (!destination) return
		void this.options.navigateQuery({...destination.route.query, ...patch, page: undefined}).catch(this.options.reportError)
	},
	sortChanged(sort: Sort) {
		this.changeQuery({sort: JSON.stringify(sort) === JSON.stringify(this.options.defaultSort?.() ?? {position: 'asc'}) ? undefined : Object.entries(sort).map(([key, order]) => `${key}:${order}`).join(',')})
	},
})
