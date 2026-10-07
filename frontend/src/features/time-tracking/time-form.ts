import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import type { ITimeEntry } from '@/modelTypes/ITimeEntry'
import type { IProject } from '@/modelTypes/IProject'
import type { IUser } from '@/modelTypes/IUser'
import TaskService from '@/services/task'
import TaskModel from '@/models/task'
import { useTimeEntryService } from '@/services/timeEntry'
import { smartFillStart } from '@/helpers/time/smartFillStart'
import {
	TaskDatePickerView,
	type TaskDateContext,
} from '@/features/task/task-date-picker'
import { RemoteSearchView } from '../../shared/remote-search'
import { SettingsSearchView } from '../settings/settings-search'
import type { TimerApplication } from '../timer/application'
import { t } from '../../shared/i18n'
import { errorText } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
export interface TimePorts {
	user: () => IUser;
	projects: () => IProject[];
	navigate: (href: string) => void;
	dates: TaskDateContext;
	timer: () => InstanceType<typeof TimerApplication>;
	current: () => boolean;
}
export const TimeEntryFormView = View.extend({
	initialize(options: {
		ports: TimePorts;
		taskId?: number;
		entry?: ITimeEntry;
		recent: () => ITimeEntry[];
		saved: () => void;
		cancel: () => void;
	}) {
		void options
	},
	tagName: 'form',
	className: 'time-entry-form',
	attributes: { 'data-cy': 'timeEntryForm' },
	regions: {
		project: '[data-project]',
		task: '[data-task]',
		from: '[data-from]',
		to: '[data-to]',
	},
	ui: {
		comment: '[name=comment]',
		error: '[data-error]',
		save: '[data-save]',
		start: '[data-start]',
	},
	events: {
		submit: 'save',
		'click [data-save]': 'save',
		'click [data-start]': 'start',
		'click [data-cancel]': 'cancel',
		'click [data-smart]': 'smart',
	},
	createState() {
		const entry = this.options.entry
		return {
			from: entry?.startTime ?? new Date(),
			to: entry?.endTime ?? null,
			projectId: entry?.projectId ?? 0,
			taskId: this.options.taskId ?? entry?.taskId ?? 0,
			request: undefined as AbortController | undefined,
			lookup: undefined as AbortController | undefined,
			targetRevision: 0,
		}
	},
	templateContext() {
		return this.options
	},
	template: ({ taskId, entry }:{taskId?:number,entry?:ITimeEntry}) =>
		html`${taskId === undefined
			? html`<div class="field-columns">
						<div class="field">
							<label class="label">${t('task.attributes.project')}</label>
							<div data-project></div>
						</div>
						<div class="field">
							<label class="label">${t('timeTracking.form.task')}</label>
							<div data-task></div>
						</div>
					</div>`
			: ''}
			<div class="field">
				<label class="label" for="time-comment"
					>${t('task.comment.comment')}</label
				><input
					class="input"
					id="time-comment"
					name="comment"
					data-cy="timeEntryComment"
					type="text"
					placeholder=${t('timeTracking.form.commentPlaceholder')}
					.value=${entry?.comment ?? ''}
				/>
			</div>
			<div class="field is-grouped from-to-row">
				<div class="control is-expanded">
					<label class="label">${t('input.datepickerRange.from')}</label>
					<div data-from></div>
				</div>
				<div class="control is-expanded">
					<label class="label">${t('input.datepickerRange.to')}</label>
					<div data-to></div>
				</div>
				<div class="control">
					<button
						type="button"
						class="base-button smart-fill"
						data-smart
						data-cy="smartFill"
						aria-label=${t('timeTracking.form.smartFill')}
					>
						${listIcon('clock', true)}
					</button>
				</div>
			</div>
			<div class="message danger" role="alert" data-error hidden></div>
			<div class="field form-actions">
				<button
					class="button"
					type="submit"
					data-save
					data-cy=${entry ? 'updateTimeEntry' : 'saveTimeEntry'}
				>
					${t(entry ? 'timeTracking.form.update' : 'timeTracking.form.save')}</button
				>${entry
		? html`<button class="button is-outlined" type="button" data-cancel>
							${t('misc.cancel')}
						</button>`
		: html`<button
							class="button is-outlined"
							type="button"
							data-start
							data-cy="startTimer"
						>
							${t('timeTracking.form.startTimer')}
						</button>`}
			</div>`,
	onAttach() {
		this.date('from')
		this.date('to')
		if (this.options.taskId === undefined) {
			this.project()
			this.task()
			if (this.getState().taskId) {
				const request = new AbortController(),
					revision = this.getState().targetRevision
				this.getState().lookup = request
				void new TaskService()
					.get(new TaskModel({ id: this.getState().taskId }), request.signal)
					.then((task) => {
						if (
							!request.signal.aborted &&
							!this.isDestroyed() &&
							revision === this.getState().targetRevision
						)
							this.task([{ value: task.id, label: task.title }])
					})
					.catch(() => {})
			}
		}
		this.refresh()
		if (this.options.entry) this.el.scrollIntoView({ block: 'center' })
	},
	date(key: 'from' | 'to') {
		this.showChildView(
			key,
			new TaskDatePickerView({
				context: this.options.ports.dates,
				label: t('misc.notSet'),
				value: this.getState()[key],
				disabled: false,
				showShortcuts: false,
				changed: (value) => {
					this.getState()[key] = value
				},
				committed: () => {},
			}),
		)
	},
	project() {
		this.showChildView(
			'project',
			new SettingsSearchView({
				id: 'time-project',
				label: t('task.attributes.project'),
				placeholder: t('task.attributes.project'),
				items: this.options.ports
					.projects()
					.map((p) => ({ value: p.id, label: p.title })),
				selected: this.getState().projectId || null,
				changed: (value) => {
					this.getState().targetRevision++
					this.getState().projectId = Number(value) || 0
					if (value) {
						this.getState().taskId = 0
						this.task()
					}
					this.refresh()
				},
			}),
		)
	},
	task(items = [] as { value: number; label: string }[]) {
		this.showChildView(
			'task',
			new RemoteSearchView({
				id: 'time-task',
				label: t('timeTracking.form.task'),
				placeholder: t('timeTracking.form.taskSearch'),
				items,
				selected: this.getState().taskId || null,
				changed: (value) => {
					this.getState().targetRevision++
					this.getState().taskId = Number(value) || 0
					if (value) {
						this.getState().projectId = 0
						this.project()
					}
					this.refresh()
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
						)
							.filter(
								(task) =>
									!this.getState().projectId ||
										task.projectId === this.getState().projectId,
							)
							.map((task) => ({ value: task.id, label: task.title }))
						: [],
				error: (error) => this.feedback(errorText(error)),
			}),
		)
	},
	refresh() {
		const state = this.getState(),
			disabled =
				Boolean(state.request) ||
				!(this.options.entry || state.taskId || state.projectId)
		for (const key of ['save', 'start']) {
			const node = this.getUI(key)?.[0] as HTMLButtonElement | undefined
			if (node) node.disabled = disabled
		}
	},
	feedback(message: string) {
		const node = this.getUI('error')![0] as HTMLElement
		node.hidden = !message
		node.textContent = message
	},
	smart() {
		const state = this.getState(),
			now = new Date()
		state.from = smartFillStart(
			this.options.recent(),
			this.options.ports.user().settings.frontendSettings
				.timeTrackingDefaultStart ?? '09:00',
			now,
		)
		state.to = now
		for (const key of ['from', 'to'] as const)
			(
				this.getChildView(key) as InstanceType<typeof TaskDatePickerView>
			).update(state[key], false)
	},
	save(event: Event) {
		event.preventDefault()
		void this.submit(false)
	},
	start(event: Event) {
		event.preventDefault()
		void this.submit(true)
	},
	cancel(event: Event) {
		event.preventDefault()
		this.options.cancel()
	},
	async submit(timer: boolean) {
		const state = this.getState(),
			entry = this.options.entry
		if (
			state.request ||
			!this.options.ports.current() ||
			!(entry || state.taskId || state.projectId)
		)
			return
		const request = new AbortController()
		state.request = request
		this.refresh()
		this.el.setAttribute('aria-busy', 'true')
		this.feedback('')
		const payload: Partial<ITimeEntry> = {
			comment: (this.getUI('comment')![0] as HTMLInputElement).value,
			startTime: timer
				? new Date()
				: (state.from ?? entry?.startTime ?? new Date()),
			...(entry ? { id: entry.id, taskId: 0, projectId: 0 } : {}),
			...(state.taskId
				? { taskId: state.taskId }
				: state.projectId
					? { projectId: state.projectId }
					: {}),
			...(!timer
				? {
					endTime: entry
						? entry.endTime === null
							? state.to
							: (state.to ?? entry.endTime)
						: (state.to ?? new Date()),
				}
				: {}),
		}
		try {
			const service = useTimeEntryService(),
				accepted = entry
					? await service.update({ ...payload, id: entry.id }, request.signal)
					: await service.create(payload, request.signal)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || !this.options.ports.current()) return
			this.options.ports.timer().accept(accepted)
			this.options.saved()
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.ports.current()
			)
				this.feedback(errorText(error))
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				this.refresh()
				this.el.setAttribute('aria-busy', 'false')
			}
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.getState().lookup?.abort()
	},
}).setDomApi(LitDomApi)
