import {Application, type LifecycleContext} from 'marionette'
import TaskService from '@/services/task'
import TaskModel from '@/models/task'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import UserService from '@/services/user'
import UserModel from '@/models/user'
import type {SessionApplication} from '../../app/session'
import {PRO_FEATURE} from '@/constants/proFeatures'
import {featureEnabled} from '../../shared/feature-enabled'
import {NotFoundView} from '../../app/system-pages'
import {TimeEntriesView, type TimeFilter} from './entries-view'
import type {TimePorts} from './time-form'
import {t} from '../../shared/i18n'
import type {Route} from '../../app/routes'
export {TimeEntriesView} from './entries-view'
export const TimeTrackingApplication = Application.extend({
	initialize(options: {
		session: InstanceType<typeof SessionApplication>;
		ports: () => TimePorts;
	}) {
		void options
	},
	async prepareStart(route: Route, { signal }: LifecycleContext) {
		if (!featureEnabled(this.options.session, PRO_FEATURE.TIME_TRACKING))
			return null
		const q = route.query,
			filter: TimeFilter = {
				from: typeof q.from === 'string' ? q.from : 'now/d',
				to: typeof q.to === 'string' ? q.to : 'now/d+1d',
			}
		await Promise.all([
			typeof q.project === 'string'
				? new ProjectService()
					.get(new ProjectModel({ id: Number(q.project) }), signal)
					.then((project) => {
						filter.project = project
					})
					.catch(() => {})
				: undefined,
			typeof q.task === 'string'
				? new TaskService()
					.get(new TaskModel({ id: Number(q.task) }), signal)
					.then((task) => {
						filter.task = task
					})
					.catch(() => {})
				: undefined,
			typeof q.user === 'string'
				? new UserService()
					.getAll(new UserModel(), { s: q.user }, 1, signal)
					.then((users) => {
						filter.user = users.find((user) => user.username === q.user)
					})
					.catch(() => {})
				: undefined,
		])
		signal.throwIfAborted()
		return filter
	},
	onStart(_app: unknown, _route: Route, filter: TimeFilter | null) {
		document.title = `${t(filter ? 'timeTracking.title' : '404.title')} | Vikunja`
		this.setView(
			filter
				? new TimeEntriesView({ ports: this.options.ports(), filter })
				: new NotFoundView(),
		)
		this.showView()
	},
})
