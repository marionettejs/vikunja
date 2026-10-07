import UserModel from '@/models/user'
import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import flatpickr from 'flatpickr'
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance'
import { useTimeEntryService } from '@/services/timeEntry'
import TaskService from '@/services/task'
import TaskModel from '@/models/task'
import UserService from '@/services/user'
import { DATE_RANGES } from '@/components/date/dateRanges'
import type { ITimeEntry } from '@/modelTypes/ITimeEntry'
import type { ITask } from '@/modelTypes/ITask'
import type { IProject } from '@/modelTypes/IProject'
import { TimeEntryFormView, type TimePorts } from './time-form'
import { RemoteSearchView } from '../../shared/remote-search'
import { SettingsSearchView } from '../settings/settings-search'
import { t } from '../../shared/i18n'
import { formatDate } from '../../shared/dates'
import { errorText } from '../../shared/notifications'
import { interceptLink, queryHref } from '../../app/routes'
import { listIcon } from '@/shared/task-list/list-ui'
import './application.scss'
export interface TimeFilter {
	from: string | null;
	to: string | null;
	project?: { id: number; title: string };
	task?: { id: number; title: string };
	user?: { id: number; username: string };
}
const dateValue = (value: Date) => formatDate(value, 'YYYY-MM-DD')
function filterText(filter: TimeFilter) {
	return [
		filter.from ? `start_time > ${filter.from}` : '',
		filter.to ? `start_time < ${filter.to}` : '',
		filter.user ? `user_id = ${filter.user.id}` : '',
		filter.task ? `task_id = ${filter.task.id}` : '',
		filter.project ? `project_id = ${filter.project.id}` : '',
	]
		.filter(Boolean)
		.join(' && ')
}
function rangeLabel(filter: TimeFilter) {
	const preset = Object.entries(DATE_RANGES).find(
		([, range]) => range[0] === filter.from && range[1] === filter.to,
	)
	return preset
		? t(`input.datepickerRange.ranges.${preset[0]}`)
		: filter.from && filter.to
			? t('input.datepickerRange.fromto', { from: filter.from, to: filter.to })
			: t('timeTracking.browse.selectRange')
}
export const TimeEntriesView = View.extend({
	initialize(options: {
		ports: TimePorts;
		taskId?: number;
		filter?: TimeFilter;
	}) {
		void options
		this.listenTo(options.ports.timer(), 'entry:updated', this.updated)
		this.listenTo(options.ports.timer(), 'entry:deleted', this.deleted)
	},
	className: 'native-time-tracking',
	regions: { form: '[data-form]', filters: '[data-filters]' },
	ui: {
		results: '[data-results]',
		loading: '[data-loading]',
		error: '[data-error]',
		range: '[data-range]',
		add: '[data-add]',
		filters: '[data-open-filters]',
	},
	events: {
		'click @ui.add': 'toggleForm',
		'click @ui.filters': 'filters',
		'click [data-edit]': 'edit',
		'click [data-delete]': 'remove',
		'click [data-retry]': 'load',
	},
	createState() {
		return {
			entries: [] as ITimeEntry[],
			tasks: new Map<number, ITask>(),
			request: undefined as AbortController | undefined,
			writes: new Map<number, AbortController>(),
			showForm: false,
			editing: null as ITimeEntry | null,
			filter: this.options.filter ?? { from: null, to: null },
			loaded: false,
		}
	},
	templateContext() {
		return this.options
	},
	template: ({ taskId }: { taskId?: number }) =>
		html`${taskId
			? html`<div class="task-time-tracking">
						<button
							type="button"
							class="button is-outlined is-pulled-right"
							data-add
							data-cy="addTaskTimeEntry"
							aria-label=${t('timeTracking.logTime')}
							hidden
						>
							${listIcon('plus')}
						</button>
						<h3 class="title is-5">${t('timeTracking.title')}</h3>
					</div>`
			: html`<div class="time-tracking__actions">
						<span class="time-tracking__range" data-range></span>
						<div class="time-tracking__buttons">
							<button
								type="button"
								class="button is-outlined"
								data-add
								data-cy="addTimeEntry"
							>
								${listIcon('plus')} ${t('timeTracking.logTime')}</button
							><button
								type="button"
								class="button is-outlined"
								data-open-filters
								data-cy="openTimeTrackingFilters"
							>
								${listIcon('filter')} ${t('filters.title')}
							</button>
						</div>
					</div>`}
			<div data-form></div>
			<p data-loading>${t('misc.loading')}</p>
			<div class="message danger" data-error role="alert" hidden></div>
			<button type="button" class="button is-outlined" data-retry hidden>
				${t('misc.retry')}
			</button>
			<div data-results></div>
			<div data-filters></div>`,
	onAttach() {
		this.heading()
		void this.load()
	},
	heading() {
		if (this.options.taskId) return;
		(this.getUI('range')![0] as HTMLElement).textContent = rangeLabel(
			this.getState().filter,
		);
		(this.getUI('filters')![0] as HTMLElement).classList.toggle(
			'has-filters',
			filterText(this.getState().filter) !==
				'start_time > now/d && start_time < now/d+1d',
		)
	},
	feedback(message: string) {
		const node = this.getUI('error')![0] as HTMLElement
		node.textContent = message
		node.hidden = !message
	},
	async load() {
		const state = this.getState()
		state.request?.abort()
		const request = new AbortController()
		state.request = request;
		(this.getUI('loading')![0] as HTMLElement).hidden = false
		this.feedback('');
		(this.el.querySelector('[data-retry]') as HTMLElement).hidden = true
		try {
			const { items } = await useTimeEntryService().getAll(
				{
					filter: this.options.taskId
						? `task_id = ${this.options.taskId}`
						: filterText(state.filter),
					filterTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					perPage: 250,
				},
				request.signal,
			)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || !this.options.ports.current()) return
			state.entries = items
			state.loaded = true
			this.publish()
			if (this.options.taskId) {
				(this.getUI('add')![0] as HTMLElement).hidden = !items.length
				if (!items.length && !this.getRegion('form')!.hasView()) this.form()
			}
			await Promise.all(
				[...new Set(items.map((e) => e.taskId).filter(Boolean))].map(
					async (id) => {
						if (state.tasks.has(id)) return
						try {
							const task = await new TaskService().get(
								new TaskModel({ id }),
								request.signal,
							)
							request.signal.throwIfAborted()
							if (
								!this.isDestroyed() &&
								this.options.ports.current() &&
								state.request === request
							) {
								state.tasks.set(id, task)
								this.publish()
							}
						} catch {
							/* A deleted or inaccessible task keeps the entry ID label. */
						}
					},
				),
			)
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.ports.current()
			) {
				this.feedback(errorText(error));
				(this.el.querySelector('[data-retry]') as HTMLElement).hidden = false
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed())
				(this.getUI('loading')![0] as HTMLElement).hidden = true
		}
	},
	updated(entry: ITimeEntry) {
		const state = this.getState(),
			index = state.entries.findIndex((e) => e.id === entry.id)
		if (index >= 0) {
			state.entries[index] = entry
			this.publish()
		}
	},
	deleted(id: number) {
		this.getState().entries = this.getState().entries.filter(
			(e) => e.id !== id,
		)
		this.publish()
	},
	publish() {
		const entries = this.getState().entries,
			taskOnly = Boolean(this.options.taskId),
			seconds = (e: ITimeEntry) =>
				e.endTime ? Math.floor((+e.endTime - +e.startTime) / 1000) : 0,
			duration = (n: number) =>
				Math.floor(n / 3600) > 0
					? `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`
					: `${Math.floor(n / 60)}m`,
			clock = (date: Date) =>
				formatDate(
					date,
					this.options.ports.user().settings.frontendSettings.timeFormat ===
						'24h'
						? 'HH:mm'
						: 'hh:mm A',
				),
			link = (href: string, label: string) =>
				html`<a
					href=${href}
					@click=${(event: MouseEvent) =>
		interceptLink(event, this.options.ports.navigate)}
					>${label}</a
				>`
		render(
			entries.length
				? html`<div class=${taskOnly ? '' : 'card'}>
						<div class="has-horizontal-overflow">
							<table class="table has-actions is-hoverable is-fullwidth mbe-0">
								<thead>
									<tr>
										${!taskOnly
		? html`<th>${t('task.attributes.project')}</th>
													<th>${t('timeTracking.form.task')}</th>`
		: nothing}
										<th>${t('task.comment.comment')}</th>
										<th class="nowrap">${t('timeTracking.list.time')}</th>
										<th class="nowrap has-text-right">
											${t('timeTracking.list.duration')}
										</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									${entries.map((entry) => {
		const task = this.getState().tasks.get(entry.taskId),
			projects = this.options.ports.projects(),
			chain: IProject[] = [],
			seen = new Set<number>()
		let project = projects.find(
			(p) => p.id === (task?.projectId ?? entry.projectId),
		)
		while (project && !seen.has(project.id)) {
			chain.unshift(project)
			seen.add(project.id)
			project = projects.find(
				(p) => p.id === project?.parentProjectId,
			)
		}
		return html`<tr data-cy="timeEntry">
											<td ?hidden=${taskOnly}>
												${chain.map(
		(p, i) =>
			html`${i ? ' > ' : ''}${link(
				`/projects/${p.id}`,
				p.title,
			)}`,
	)}
											</td>
											<td ?hidden=${taskOnly}>
												${entry.taskId
		? link(
			`/tasks/${entry.taskId}`,
			`${task?.identifier || `#${task?.index ?? entry.taskId}`}${task?.title ? ` - ${task.title}` : ''}`,
		)
		: nothing}
											</td>
											<td class="has-text-grey">${entry.comment}</td>
											<td class="nowrap has-text-grey">
												${clock(entry.startTime)} –
												${entry.endTime ? clock(entry.endTime) : '…'}
											</td>
											<td
												class="nowrap has-text-right has-text-weight-semibold"
											>
												${entry.endTime ? duration(seconds(entry)) : ''}
											</td>
											<td class="nowrap has-text-right">
												${entry.userId === this.options.ports.user().id
		? html`<button
																type="button"
																class="base-button entry-action"
																data-edit=${entry.id}
																data-cy="editTimeEntry"
																aria-label=${t('menu.edit')}
															>
																${listIcon('pen')}</button
															><button
																type="button"
																class="base-button entry-action entry-delete"
																data-delete=${entry.id}
																data-cy="deleteTimeEntry"
																aria-label=${t('misc.delete')}
																?disabled=${this.getState().writes.has(
		entry.id,
	)}
															>
																${listIcon('trash-alt')}
															</button>`
		: nothing}
											</td>
										</tr>`
	})}
								</tbody>
								<tfoot>
									<tr>
										<td
											colspan=${taskOnly ? 2 : 4}
											class="has-text-weight-bold"
										>
											${t('timeTracking.list.total')}
										</td>
										<td class="nowrap has-text-right has-text-weight-bold">
											${duration(
		entries.reduce((sum, e) => sum + seconds(e), 0),
	)}
										</td>
										<td></td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>`
				: html`<p class="has-text-centered has-text-grey is-italic">
						${t(
		taskOnly
			? 'timeTracking.list.emptyTask'
			: 'timeTracking.list.emptyFiltered',
	)}
					</p>`,
			this.getUI('results')![0] as HTMLElement,
		)
	},
	toggleForm() {
		const state = this.getState()
		state.showForm = !state.showForm
		if (state.showForm || state.editing) this.form()
		else if (!this.options.taskId || state.entries.length)
			this.getRegion('form')!.empty()
	},
	edit(event: Event) {
		this.getState().editing =
			this.getState().entries.find(
				(e) =>
					e.id ===
					Number(
						(event as Event & { delegateTarget: HTMLElement }).delegateTarget
							.dataset.edit,
					),
			) ?? null
		this.form()
	},
	form() {
		const state = this.getState()
		this.showChildView(
			'form',
			new TimeFormCardView({
				taskOnly: Boolean(this.options.taskId),
				entry: state.editing ?? undefined,
				form: () =>
					new TimeEntryFormView({
						ports: this.options.ports,
						taskId: this.options.taskId,
						entry: state.editing ?? undefined,
						recent: () => state.entries,
						saved: () => {
							state.editing = null
							state.showForm = false
							this.getRegion('form')!.empty()
							void this.load()
						},
						cancel: () => {
							state.editing = null
							if (
								state.showForm ||
								(this.options.taskId && !state.entries.length)
							)
								this.form()
							else this.getRegion('form')!.empty()
						},
					}),
			}),
		)
	},
	async remove(event: Event) {
		const state = this.getState(),
			id = Number(
				(event as Event & { delegateTarget: HTMLElement }).delegateTarget
					.dataset.delete,
			)
		if (state.writes.has(id)) return
		const request = new AbortController()
		state.writes.set(id, request)
		this.publish()
		try {
			await useTimeEntryService().remove(id, request.signal)
			request.signal.throwIfAborted()
			if (!this.isDestroyed() && this.options.ports.current())
				this.options.ports.timer().deleted(id)
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.ports.current()
			)
				this.feedback(errorText(error))
		} finally {
			state.writes.delete(id)
			if (!this.isDestroyed()) this.publish()
		}
	},
	filters() {
		this.showChildView(
			'filters',
			new TimeFiltersView({
				ports: this.options.ports,
				filter: this.getState().filter,
				close: () => this.getRegion('filters')!.empty(),
				changed: () => {
					const f = this.getState().filter
					history.replaceState(
						history.state,
						'',
						queryHref('/time-tracking', {
							from: f.from === 'now/d' ? undefined : (f.from ?? undefined),
							to: f.to === 'now/d+1d' ? undefined : (f.to ?? undefined),
							project: f.project?.id,
							task: f.task?.id,
							user: f.user?.username,
						}),
					)
					this.heading()
					void this.load()
				},
			}),
		)
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		for (const request of this.getState().writes.values()) request.abort()
	},
}).setDomApi(LitDomApi)
const TimeFormCardView = View.extend({
	initialize(options: {
		taskOnly: boolean;
		entry?: ITimeEntry;
		form: () => InstanceType<typeof TimeEntryFormView>;
	}) {
		void options
	},
	regions: { form: '[data-inner-form]' },
	templateContext() {
		return this.options
	},
	template: ({ taskOnly, entry }: { taskOnly: boolean; entry?: ITimeEntry }) =>
		html`<div class=${taskOnly ? '' : 'card'}>
			${!taskOnly
		? html`<header class="card-header">
						<p class="card-header-title">
							${t(entry ? 'timeTracking.editEntry' : 'timeTracking.logTime')}
						</p>
					</header>`
		: nothing}
			<div class=${taskOnly ? '' : 'card-content'} data-inner-form></div>
		</div>`,
	onAttach() {
		this.showChildView('form', this.options.form())
	},
}).setDomApi(LitDomApi)
const TimeFiltersView = View.extend({
	initialize(options: {
		ports: TimePorts;
		filter: TimeFilter;
		close: () => void;
		changed: () => void;
	}) {
		void options
	},
	tagName: 'dialog',
	className: 'modal-dialog hint-modal native-time-tracking native-settings',
	regions: {
		project: '[data-project]',
		task: '[data-task]',
		user: '[data-user]',
	},
	events: {
		cancel: 'close',
		'click [data-close]': 'close',
		'click [data-range]': 'range',
		'input [data-range-input]': 'dateInput',
	},
	createState() {
		return { picker: undefined as FlatpickrInstance | undefined, overflow: '' }
	},
	template: () =>
		html`<div class="modal-container">
			<div class="modal-content">
				<div class="card has-overflow">
					<header class="card-header">
						<p class="card-header-title">${t('filters.title')}</p>
						<button
							type="button"
							class="base-button"
							data-close
							aria-label=${t('misc.close')}
						>
							${listIcon('times')}
						</button>
					</header>
					<div class="card-content">
						<div class="field">
							<label class="label">${t('misc.dateRange')}</label>
							<details class="time-range-picker">
								<summary class="button is-outlined">
									${t('timeTracking.browse.selectRange')}
								</summary>
								<div class="datepicker-with-range">
									<div class="datepicker-with-range-presets">
										${Object.keys(DATE_RANGES).map(
		(key) =>
			html`<button class="base-button" data-range=${key}>
													${t(`input.datepickerRange.ranges.${key}`)}
												</button>`,
	)}<button class="base-button" data-range="custom">
											${t('misc.custom')}
										</button>
									</div>
									<div class="flatpickr-container input-group">
										${(['from', 'to'] as const).map(
		(key) =>
			html`<label class="label"
													>${t(`input.datepickerRange.${key}`)}<input
														class="input"
														type="text"
														data-range-input=${key}
												/></label>`,
	)}<input class="input" data-calendar />
									</div>
								</div>
							</details>
						</div>
						<div class="filter-columns">
							<div class="field">
								<label class="label">${t('task.attributes.project')}</label>
								<div data-project></div>
							</div>
							<div class="field">
								<label class="label">${t('timeTracking.form.task')}</label>
								<div data-task></div>
							</div>
						</div>
						<div class="field">
							<label class="label">${t('misc.user')}</label>
							<div data-user></div>
						</div>
					</div>
				</div>
			</div>
		</div>`,
	onAttach() {
		const f = this.options.filter
		this.getState().overflow = document.body.style.overflow
		document.body.style.overflow = 'hidden';
		(this.el as HTMLDialogElement).showModal()
		this.showChildView(
			'project',
			new SettingsSearchView({
				id: 'time-filter-project',
				label: t('task.attributes.project'),
				placeholder: t('task.attributes.project'),
				items: this.options.ports
					.projects()
					.map((p) => ({ value: p.id, label: p.title })),
				selected: f.project?.id,
				changed: (value) => {
					f.project = this.options.ports
						.projects()
						.find((p) => p.id === Number(value))
					this.options.changed()
				},
			}),
		)
		this.showChildView(
			'task',
			new RemoteSearchView({
				id: 'time-filter-task',
				label: t('timeTracking.form.task'),
				placeholder: t('timeTracking.form.taskSearch'),
				items: f.task ? [{ value: f.task.id, label: f.task.title }] : [],
				selected: f.task?.id,
				changed: (value) => {
					const view = this.getChildView('task') as InstanceType<
							typeof RemoteSearchView
						>,
						item = view.options.items.find((i) => i.value === value)
					f.task = item ? { id: Number(value), title: item.label } : undefined
					this.options.changed()
				},
				search: async (query, signal) =>
					query
						? (
							await new TaskService().getAll(
								new TaskModel(),
								{ s: query, sort_by: 'done' },
								1,
								signal,
							)
						).map((task) => ({ value: task.id, label: task.title }))
						: [],
				error: (error) => {
					void error
				},
			}),
		)
		this.showChildView(
			'user',
			new RemoteSearchView({
				id: 'time-filter-user',
				label: t('misc.user'),
				placeholder: t('timeTracking.browse.userSearch'),
				items: f.user ? [{ value: f.user.id, label: f.user.username }] : [],
				selected: f.user?.id,
				changed: (value) => {
					const view = this.getChildView('user') as InstanceType<
							typeof RemoteSearchView
						>,
						item = view.options.items.find((i) => i.value === value)
					f.user = item
						? { id: Number(value), username: item.label }
						: undefined
					this.options.changed()
				},
				search: async (query, signal) =>
					query
						? (
							await new UserService().getAll(
								new UserModel(),
								{ s: query },
								1,
								signal,
							)
						).map((user) => ({ value: user.id, label: user.username }))
						: [],
				error: (error) => {
					void error
				},
			}),
		)
		this.syncRange()
		this.getState().picker = flatpickr(
			this.el.querySelector('[data-calendar]') as HTMLInputElement,
			{
				mode: 'range',
				inline: true,
				dateFormat: 'Y-m-d',
				defaultDate: [f.from, f.to].filter((v): v is string =>
					Boolean(v && !v.startsWith('now')),
				),
				onChange: (dates) => {
					f.from = dates[0] ? dateValue(dates[0]) : null
					f.to = dates[1] ? dateValue(dates[1]) : null
					this.options.changed()
				},
			},
		)
	},
	syncRange() {
		const f = this.options.filter;
		(this.el.querySelector('summary') as HTMLElement).textContent =
			rangeLabel(f)
		for (const key of ['from', 'to'] as const) {
			const node = this.el.querySelector(
				`[data-range-input=${key}]`,
			) as HTMLInputElement
			if (node && node !== document.activeElement) node.value = f[key] ?? ''
		}
	},
	dateInput(event: Event) {
		const node = (event as Event & { delegateTarget: HTMLInputElement })
				.delegateTarget,
			key = node.dataset.rangeInput as 'from' | 'to'
		this.options.filter[key] = node.value || null
		this.syncRange()
		this.options.changed()
	},

	range(event: Event) {
		const key = (event as Event & { delegateTarget: HTMLElement })
			.delegateTarget.dataset.range!,
			range = DATE_RANGES[key as keyof typeof DATE_RANGES]
		this.options.filter.from = range?.[0] ?? null
		this.options.filter.to = range?.[1] ?? null
		this.getState().picker?.clear(false)
		this.syncRange()
		this.options.changed()
		if (range)
			(this.el.querySelector('details') as HTMLDetailsElement).open = false
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		this.getState().picker?.destroy();
		(this.el as HTMLDialogElement).close()
		document.body.style.overflow = this.getState().overflow
	},
}).setDomApi(LitDomApi)
