import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {
	Application,
	View,
	CollectionView,
	type LifecycleContext,
} from 'marionette'
import { Collection, DataApi, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import llamaCool from '@/assets/llama-cool.svg?url'
import TaskService from '@/services/task'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import TaskCollectionService from '@/services/taskCollection'
import type { IProject } from '@/modelTypes/IProject'
import type { ITask } from '@/modelTypes/ITask'
import type { IUser } from '@/modelTypes/IUser'
import type { Route } from '../../app/routes'
import { queryHref } from '../../app/routes'
import { listIcon } from '@/shared/task-list/list-ui'
import type { ListWidgets } from '@/shared/task-list/list-context'
import { ListTaskRowView } from '@/shared/task-list/list-task-row'
import { ListAddTaskView } from '@/shared/task-list/list-add-task'
import { ListPaginationView } from '@/shared/task-list/list-controls'
import { getHistory } from '@/modules/projectHistory'
import { ProjectCardsView } from '../projects/project-cards'
import { loadProjects } from '../projects/project-management'
import {
	UpcomingControlsView,
	upcomingRange,
	upcomingTitle,
} from './upcoming-controls'
import { displayDate } from '../../shared/dates'
import { salutation } from './salutation'
import { t } from '../../shared/i18n'
import { errorText } from '../../shared/notifications'
const OverviewRows = CollectionView.extend({
	tagName: 'ul',
	className: 'tasks',
	childView: ListTaskRowView,
}).setDataApi(DataApi)
interface Options {
	user: () => IUser;
	widgets: ListWidgets;
	navigate: (href: string) => void;
	config: () => Record<string, unknown>;
	commit: (project: IProject) => void;
}
const DailyEntryView = View.extend({
	initialize(
		options: Options & {
			projects: IProject[];
			route: Route;
			reload: () => void;
		},
	) {
		void options
	},
	className:
		'content has-text-centered native-daily-entry native-list-surface native-list-body',
	regions: {
		controls: '[data-controls]',
		add: '[data-add]',
		history: '[data-history]',
		rows: '[data-rows]',
		pagination: '[data-pagination]',
	},
	ui: {
		results: '[data-results]',
		empty: '[data-empty]',
		retry: '[data-retry]',
		error: '[data-error]',
		history: '[data-recent]',
		heading: '[data-heading]',
		labels: '[data-label-notice]',
		import: '[data-import]',
		rowHost: '[data-rows]',
	},
	events: {
		'click @ui.retry': 'retry',
		'click [data-clear-labels]': 'clearLabels',
	},
	createState() {
		return {
			tasks: [] as ITask[],
			collection: new Collection(),
			stopLabels: undefined as (() => void) | undefined,
		}
	},
	templateContext() {
		return { ...this.options, greeting: salutation(this.options.user()) }
	},
	template(options: Options & { route: Route; greeting: string; projects: IProject[] }) {
		const { greeting } = options
		const upcoming = options.route.params.page === 'upcoming',
			user = options.user(), scheduled = parseDateOrNull(user.deletionScheduledAt)
		return html`${upcoming
			? nothing
			: html`<h1>${greeting}</h1>
						${scheduled
		? html`<div class="message danger mbe-4">
									${t('user.deletion.scheduled', {
		date: options.widgets.context.displayDate(scheduled!),
		dateSince: displayDate(scheduled!),
	})}<a href="/user/settings/deletion"
										>${t('user.deletion.scheduledCancel')}</a
									>
								</div>`
		: nothing}`}
			<div class="is-max-width-desktop" data-add></div>
			<div data-import hidden>
				<p>${t('home.project.importText')}</p>
				<a class="button" href="/user/settings/migrate">${t('home.project.import')}</a>
			</div>
			<section
				class="is-max-width-desktop has-text-start mbs-4"
				data-recent
				hidden
			>
				<h2>${t('home.lastViewed')}</h2>
				<div data-history></div>
			</section>
			<section
				class="is-max-width-desktop has-text-start show-tasks"
				data-results
				?hidden=${!upcoming && !options.projects.length}
				aria-busy="true"
			>
				<h2 data-heading class="mbe-2 title">
					${upcoming
		? upcomingTitle(options.route)
		: t('task.show.titleCurrent')}
				</h2>
				<div data-label-notice></div>
				<div data-controls></div>
				<div class="message danger" role="alert" data-error hidden></div>
				<button type="button" class="button" data-retry hidden>
					${t('sharing.retry')}
				</button>
				<div class="card has-overflow" data-rows></div>
				<div data-empty hidden><h3 class="has-text-centered mbs-6">${t('task.show.noTasks')}</h3><img class="llama-cool" src=${llamaCool} alt=""/></div>
				<div data-pagination></div>
			</section>
`
	},
	onRender() {
		if (this.options.route.params.page === 'upcoming')
			this.showChildView(
				'controls',
				new UpcomingControlsView({
					route: this.options.route,
					context: this.options.widgets.context,
					changed: (query) =>
						this.options.navigate(
							queryHref(this.options.route.path, {
								...this.options.route.query,
								...query,
							}),
						),
				}),
			)
		else
			this.showChildView(
				'add',
				new ListAddTaskView({
					context: this.options.widgets.context,
					projectId: 0,
					added: () => this.options.reload(),
				}),
			)
		let history: IProject[] = []
		try {
			history = getHistory()
				.map((item) => this.options.projects.find((p) => p.id === item.id))
				.filter((p): p is IProject => Boolean(p && !p.isArchived))
		} catch {
			/* malformed old history should not prevent entry */
		}
		const visible =
			this.options.route.params.page !== 'upcoming' &&
			this.options.user().settings.frontendSettings.showLastViewed !== false &&
			history.length > 0;
		(this.getUI('history')![0] as HTMLElement).hidden = !visible
		if (visible)
			this.showChildView(
				'history',
				new ProjectCardsView({
					projects: history,
					navigate: this.options.navigate,
					even: true,
				}),
			)
		const rows = new OverviewRows({
			collection: this.getState().collection,
			childViewOptions: (model: Model) => ({
				model, showProject: true, tagName: 'li',
				context: this.options.widgets.context,
				allTasks: () => this.getState().tasks,
				canWrite:
					Number(
						this.options.widgets.context.getProject(
							(model.get('task') as ITask).projectId,
						)?.maxPermission,
					) > 0,
			}),
		})
		this.listenTo(rows, 'childview:task:update', (task: ITask) => {
			(this.getState().collection.get(task.id) as Model | undefined)?.set({
				task,
			})
		})
		this.showChildView('rows', rows)
		this.updateRoute(this.options.route)
		this.getState().stopLabels = this.options.widgets.filter.observeLabels(() =>
			this.labelNotice(),
		)
	},
	updateRoute(route: Route) {
		this.options.route = route;
		(this.getUI('heading')![0] as HTMLElement).textContent =
			route.params.page === 'upcoming'
				? upcomingTitle(route)
				: t('task.show.titleCurrent');
		(
			this.getChildView('controls') as
				| InstanceType<typeof UpcomingControlsView>
				| undefined
		)?.updateRoute(route)
		this.labelNotice()
	},
	labelNotice() {
		const query = this.options.route.query.labels,
			ids = (Array.isArray(query) ? query : [query])
				.filter((value) => /^\d+$/.test(String(value)))
				.map(Number),
			labels = ids
				.map((id) => this.options.widgets.filter.labelById(id))
				.filter(Boolean)
		const saved =
			this.options.user().settings.frontendSettings.filterIdUsedOnOverview
		const host = this.getUI('labels')![0] as HTMLElement
		render(
			labels.length
				? html`<div class="message info label-filter-info">
							<span
								>${t('task.show.filterByLabel', {
		label: labels.map((label) => label!.title).join(', '),
	})}</span
							><button
								type="button"
								data-clear-labels
								class="base-button base-button--type-button"
								aria-label=${t('task.show.clearLabelFilter')}
							>
								${listIcon('times')}
							</button>
						</div>
						${saved && this.options.projects.some((p) => p.id === saved)
		? html`<div class="message info">
									${t('task.show.savedFilterIgnored')}
								</div>`
		: nothing}`
				: nothing,
			host,
		)
	},
	clearLabels() {
		this.options.navigate(
			queryHref(this.options.route.path, {
				...this.options.route.query,
				labels: undefined,
				page: undefined,
			}),
		)
	},
	onBeforeDestroy() {
		this.getState().stopLabels?.()
	},
	retry() {
		this.options.reload()
	},
	loading(value: boolean) {
		(this.getUI('results')![0] as HTMLElement).classList.toggle(
			'is-loading',
			value,
		);
		(this.getUI('results')![0] as HTMLElement).setAttribute(
			'aria-busy',
			String(value),
		)
	},
	publish(tasks: ITask[], pages: number, page: number) {
		this.getState().tasks = tasks
		this.getState().collection.reset(
			tasks.map((task) => ({ id: task.id, task })),
		);
		(this.getUI('empty')![0] as HTMLElement).hidden = tasks.length > 0;
		(this.getUI('rowHost')![0] as HTMLElement).hidden = tasks.length === 0;
		(this.getUI('error')![0] as HTMLElement).hidden = true;
		(this.getUI('retry')![0] as HTMLElement).hidden = true
		this.showChildView(
			'pagination',
			new ListPaginationView({
				context: this.options.widgets.context,
				pages,
				page,
			}),
		)
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = errorText(error)
		el.hidden = false;
		(this.getUI('retry')![0] as HTMLElement).hidden = false
	},
}).setDomApi(LitDomApi)
export const DailyEntryApplication = Application.extend({
	initialize(options: Options) {
		void options
	},
	createState() {
		return {
			route: undefined as Route | undefined,
			request: undefined as AbortController | undefined,
		}
	},
	onBeforeStart(_app: unknown, route: Route) {
		this.getState().route = route
	},
	async prepareStart(_route: Route, { signal }: LifecycleContext) {
		return loadProjects(signal)
	},
	onStart(_app: unknown, _route: unknown, projects: IProject[]) {
		for (const project of projects) this.options.commit(project)
		this.setView(
			new DailyEntryView({
				...this.options,
				projects,
				route: this.getState().route!,
				reload: () => void this.load(),
			}),
		)
		this.showView()
		document.title = `${t('navigation.overview')} | Vikunja`
		void this.load()
	},
	async load() {
		const state = this.getState()
		state.request?.abort()
		const request = (state.request = new AbortController()),
			view = this.getView() as InstanceType<typeof DailyEntryView>,
			user = this.options.user(),
			route = state.route!,
			page = Math.max(1, Number(route.query.page) || 1)
		view.updateRoute(route)
		view.loading(true)
		if (route.params.page !== 'upcoming' && !view.options.projects.length) {
			view.loading(false)
			return
		}
		try {
			const labels = Array.isArray(route.query.labels)
				? route.query.labels
				: [route.query.labels]
			const ids = labels
				.filter((value) => /^\d+$/.test(String(value)))
				.map(Number)
			const filterId = user.settings.frontendSettings.filterIdUsedOnOverview
			const upcoming = route.params.page === 'upcoming',
				range = upcoming ? upcomingRange(route) : undefined
			const saved =
				!upcoming &&
				filterId &&
				view.options.projects.some((p) => p.id === filterId) &&
				!ids.length
			const service = saved ? new TaskCollectionService() : new TaskService()
			const getTasks = service instanceof TaskCollectionService ? service.getTasks.bind(service) : service.getAll.bind(service)
			const tasks = await getTasks(
				saved ? ({ projectId: filterId } as unknown as ITask) : undefined,
				{
					sort_by: ['due_date', 'id'],
					order_by: ['asc', 'desc'],
					filter: `done = false${range ? ` && due_date < '${range.to}'${route.query.showOverdue === 'true' ? '' : ` && due_date > '${range.from}'`}` : ''}${ids.length ? ` && labels in ${ids.join(', ')}` : ''}`,
					filter_include_nulls: route.query.showNulls === 'true',
					filter_timezone: user.settings.timezone,
					s: '',
					expand: ['comment_count', 'is_unread'],
				},
				page,
				request.signal,
			)
			request.signal.throwIfAborted()
			const projects = await Promise.all(
				[...new Set(tasks.map((task) => task.projectId))]
					.filter(
						(id) =>
							id > 0 &&
							this.options.widgets.context.getProject(id)?.maxPermission ==
								null,
					)
					.map((id) =>
						new ProjectService().get(
							new ProjectModel({ id }),
							{},
							request.signal,
						),
					),
			)
			request.signal.throwIfAborted()
			if (
				!this.isRunning() ||
				this.options.user() !== user ||
				state.request !== request
			)
				return
			for (const project of projects) this.options.commit(project)
			view.publish(tasks, service.totalPages, page)
			if (
				!upcoming &&
				!tasks.length &&
				((this.options.config().available_migrators ?? []) as unknown[]).length
			) {
				const all = await new TaskService().getAll(
					undefined,
					{ per_page: 1 },
					1,
					request.signal,
				)
				request.signal.throwIfAborted()
				if (state.request === request)
					(view.getUI('import')![0] as HTMLElement).hidden = all.length > 0
			}
		} catch (error) {
			if (
				!request.signal.aborted &&
				this.isRunning() &&
				state.request === request
			)
				view.feedback(error)
		} finally {
			if (state.request === request && !request.signal.aborted)
				view.loading(false)
		}
	},
	onBeforeStop() {
		this.getState().request?.abort()
		this.getState().request = undefined
		this.getState().route = undefined
	},
})
