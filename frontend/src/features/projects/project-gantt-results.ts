import {Application, type LifecycleContext} from 'marionette'
import type {Route, QueryPatch} from '@/app/routes'
import type {IProject} from '@/modelTypes/IProject'
import type {ITask} from '@/modelTypes/ITask'
import TaskCollectionService from '@/services/taskCollection'
import TaskModel from '@/models/task'
import {setModuleLoading} from '@/stores/helper'
import {parseGanttQuery, ganttRequestParams, ganttQueryPatch, type GanttQuery} from './gantt-query'

interface Destination {route: Route, project: IProject}
interface Options {
	savedSearch?: string
	getStoredQuery: (id: number) => QueryPatch
	setStoredQuery: (id: number, query: QueryPatch) => void
	navigateQuery: (query: QueryPatch) => Promise<unknown>
	pending: (query: GanttQuery) => void
	loading: (loading: boolean) => void
	publish: (tasks: ITask[], query: GanttQuery) => void
	reportError: (error: unknown) => void
}
export const ProjectGanttResultsApplication = Application.extend({
	initialize(options: Options) {void options},
	createState() {return {destination: undefined as Destination | undefined, key: '', request: undefined as Promise<boolean> | undefined}},
	onBeforeStart(_app: unknown, destination: Destination) {
		this.getState().destination = destination
		this.options.pending(parseGanttQuery(destination.route.query))
	},
	async prepareStart(destination: Destination, {signal}: LifecycleContext) {
		const query = parseGanttQuery(destination.route.query)
		const service = new TaskCollectionService()
		const stopLoading = setModuleLoading(loading => {if (!signal.aborted) this.options.loading(loading)})
		try {
			const tasks: ITask[] = []
			let page = 1
			do {
				const model = Object.assign(new TaskModel(), {projectId: destination.project.id, viewId: Number(destination.route.params.viewId)})
				tasks.push(...await service.getTasks(model, {...ganttRequestParams(query), s: this.options.savedSearch || ''}, page++, signal))
				signal.throwIfAborted()
			} while (page <= service.totalPages)
			return {tasks, query}
		} finally {stopLoading()}
	},
	onStart(_app: unknown, _destination: Destination, result: {tasks: ITask[], query: GanttQuery}) {this.options.publish(result.tasks, result.query)},
	loadRoute(destination: Destination, force = false) {
		const state = this.getState()
		const stored = this.options.getStoredQuery(Number(destination.route.params.viewId))
		if (!state.destination && !destination.route.query.dateFrom && !destination.route.query.dateTo && !destination.route.query.showTasksWithoutDates && Object.keys(stored).length) {
			void this.options.navigateQuery({...destination.route.query, ...stored}).catch(this.options.reportError)
			return Promise.resolve(false)
		}
		this.options.setStoredQuery(Number(destination.route.params.viewId), ganttQueryPatch(parseGanttQuery(destination.route.query)))
		const key = JSON.stringify([destination.project.id, destination.route.params.viewId, destination.route.query])
		if (!force && state.key === key && (this.isRunning() || state.request)) return state.request ?? Promise.resolve(true)
		state.key = key
		const operation = state.destination ? this.restart({...destination}) : this.start({...destination})
		const readiness = operation.catch(error => {
			if (state.request === readiness && state.key === key) {
				state.key = ''
				this.options.loading(false)
				this.options.reportError(error)
			}
			return false
		}).finally(() => {if (state.request === readiness) state.request = undefined})
		state.request = readiness
		return readiness
	},
	onBeforeStop() {Object.assign(this.getState(), {destination: undefined, key: '', request: undefined})},
})
