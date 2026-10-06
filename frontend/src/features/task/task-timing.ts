import { View, CollectionView } from 'marionette'
import { Collection, DataApi, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import type { ITask } from '@/modelTypes/ITask'
import type { ITaskReminder } from '@/modelTypes/ITaskReminder'
import TaskReminderModel from '@/models/taskReminder'
import type { TaskRecordSession } from '@/features/task/task-record'
import {
	periodToSeconds,
	secondsToPeriod,
	type PeriodUnit,
} from '@/helpers/time/period'
import { TaskDatePickerView } from '@/features/task/task-date-picker'
import type { TaskPorts } from './application'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import './task-timing.scss'
interface Options {
	record: TaskRecordSession
	ports: TaskPorts
}
const reminderTypes = ['due_date', 'start_date', 'end_date'] as const
const reminderFields = {
	due_date: 'dueDate',
	start_date: 'startDate',
	end_date: 'endDate',
} as const
function label(r: ITaskReminder, ports: TaskPorts) {
	if (r.relativeTo === null)
		return r.reminder ? ports.ui.displayDate(r.reminder) : t('task.addReminder')
	const name = reminderFields[r.relativeTo]
	if (!r.relativePeriod)
		return t(`task.reminder.on${name[0].toUpperCase()}${name.slice(1)}`)
	const p = secondsToPeriod(r.relativePeriod),
		amount = Math.abs(p.amount)
	return t(
		r.relativePeriod < 0 ? 'task.reminder.before' : 'task.reminder.after',
		{
			amount,
			unit: t(`time.units.${p.unit}`, amount),
			type: t(`task.attributes.${name}`),
		},
	)
}
const ReminderPopupView = View.extend({
	initialize(options: {
		value: ITaskReminder
		defaultRelativeTo: ITaskReminder['relativeTo']
		ports: TaskPorts
		accepted: (value: ITaskReminder) => void
		closed: () => void
	}) {
		void options
	},
	className: 'card reminder-options-popup',
	regions: { date: '[data-date]' },
	ui: {
		options: '[data-options]',
		form: '[data-form]',
		amount: 'input',
		unit: '[data-unit]',
		direction: '[data-direction]',
		relative: '[data-relative]',
		confirm: '[data-confirm]',
	},
	events: {
		'click [data-preset]': 'preset',
		'click [data-custom]': 'custom',
		'click [data-absolute]': 'absolute',
		'submit @ui.form': 'confirm',
		keydown: 'key',
	},
	templateContext() {
		return { content: this.renderTemplate() }
	},
	template: ({ content }: { content: import('lit-html').TemplateResult }) =>
		content,
	renderTemplate() {
		const r = this.options.value,
			p = secondsToPeriod(r.relativePeriod),
			relative = r.relativeTo ?? this.options.defaultRelativeTo ?? 'due_date'
		return html`<div class="options" data-options>
				${[0, -7200, -86400, -259200, -604800, -2592000].map(
		(value) =>
			html`<button
							type="button"
							class="base-button base-button--type-button option-button"
							data-preset=${value}
						>
							${label(
		new TaskReminderModel({
			relativePeriod: value,
			relativeTo: relative,
		}),
		this.options.ports,
	)}
						</button>`,
	)}<button
					type="button"
					class="base-button base-button--type-button option-button"
					data-custom
				>
					${t('task.reminder.custom')}</button
				><button
					type="button"
					class="base-button base-button--type-button option-button"
					data-absolute
				>
					${t('task.reminder.dateAndTime')}
				</button>
			</div>
			<form data-form hidden>
				<div class="reminder-period control">
					<input
						class="input"
						type="number"
						min="0"
						aria-label=${t('task.reminder.custom')}
						.value=${String(Math.abs(p.amount))}
					/>
					<div class="select">
						<select data-unit aria-label=${t('task.reminder.periodUnit')}>
							${['minutes', 'hours', 'days', 'weeks'].map(
		(unit) =>
			html`<option value=${unit} ?selected=${unit === p.unit}>
										${t(`time.units.${unit}`, Math.abs(p.amount))}
									</option>`,
	)}
						</select>
					</div>
					<div class="select">
						<select
							data-direction
							aria-label=${t('task.reminder.periodDirection')}
						>
							<option value="-1" ?selected=${r.relativePeriod <= 0}>
								${t('task.reminder.beforeShort')}
							</option>
							<option value="1" ?selected=${r.relativePeriod > 0}>
								${t('task.reminder.afterShort')}
							</option>
						</select>
					</div>
					<div class="select">
						<select
							data-relative
							aria-label=${t('task.reminder.periodRelativeTo')}
						>
							${reminderTypes.map(
		(type) =>
			html`<option value=${type} ?selected=${relative === type}>
										${t(`task.attributes.${reminderFields[type]}`)}
									</option>`,
	)}
						</select>
					</div>
				</div>
				<button
					type="submit"
					data-confirm
					class="base-button base-button--type-button button is-primary reminder__close-button"
				>
					${t('misc.confirm')}
				</button>
			</form>
			<div data-date></div>`
	},
	onAttach() {
		if (
			this.options.defaultRelativeTo === null ||
			(this.options.value.relativeTo === null && this.options.value.reminder)
		)
			this.absolute()
	},
	preset(event: Event) {
		this.options.accepted(
			new TaskReminderModel({
				reminder: null,
				relativePeriod: Number(
					(event as Event & { delegateTarget: HTMLElement }).delegateTarget
						.dataset.preset,
				),
				relativeTo:
					this.options.value.relativeTo ??
					this.options.defaultRelativeTo ??
					'due_date',
			}),
		)
	},
	custom() {
		this.getRegion('date')!.empty()
		;(this.getUI('options')![0] as HTMLElement).hidden = true
		;(this.getUI('form')![0] as HTMLElement).hidden = false
		;(this.getUI('amount')![0] as HTMLInputElement).focus()
	},
	confirm(event: Event) {
		event.preventDefault()
		event.stopPropagation()
		const amount = Number((this.getUI('amount')![0] as HTMLInputElement).value),
			unit = (this.getUI('unit')![0] as HTMLSelectElement).value as PeriodUnit,
			direction = Number(
				(this.getUI('direction')![0] as HTMLSelectElement).value,
			),
			relativeTo = (this.getUI('relative')![0] as HTMLSelectElement)
				.value as ITaskReminder['relativeTo']
		if (!Number.isFinite(amount) || amount < 0) return
		this.options.accepted(
			new TaskReminderModel({
				reminder: null,
				relativePeriod: direction * periodToSeconds(amount, unit),
				relativeTo,
			}),
		)
	},
	absolute() {
		;(this.getUI('options')![0] as HTMLElement).hidden = true
		;(this.getUI('form')![0] as HTMLElement).hidden = true
		let date = this.options.value.reminder
		const ports = this.options.ports
		const picker = new TaskDatePickerView({
			context: {
				t,
				flatpickrOptions: ports.ui.flatpickrOptions,
				shortcutDate: (value) => value,
				displayDate: ports.ui.displayDate,
			},
			label: t('task.addReminder'),
			value: date,
			disabled: false,
			changed: (value) => (date = value),
			cancelled: () => this.options.closed(),
			committed: () => {
				if (date)
					this.options.accepted(
						new TaskReminderModel({
							reminder: date,
							relativePeriod: 0,
							relativeTo: null,
						}),
					)
			},
		})
		this.showChildView('date', picker)
		picker.toggle()
	},
	key(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			this.options.closed()
		}
	},
}).setDomApi(LitDomApi)
const ReminderRowView = View.extend({
	initialize(options: {
		model?: Model
		ports: TaskPorts
		disabled: () => boolean
		defaultRelativeTo: () => ITaskReminder['relativeTo']
		changed: (value: ITaskReminder) => void
		remove?: () => void
	}) {
		void options
	},
	className: 'reminder-input',
	regions: { popup: '[data-popup]' },
	ui: { trigger: '[data-trigger]', remove: '[data-remove]' },
	events: { 'click @ui.trigger': 'toggle', 'click @ui.remove': 'remove' },
	createState() {
		return {
			outside: (event: MouseEvent) => {
				if (!this.el.contains(event.target as Node)) this.close(false)
			},
		}
	},
	templateContext() {
		return { content: this.renderTemplate() }
	},
	template: ({ content }: { content: import('lit-html').TemplateResult }) =>
		content,
	renderTemplate() {
		return html`<div class="reminder-detail">
				<button
					type="button"
					class="base-button base-button--type-button simple-button"
					data-trigger
				>
					${t('task.addReminder')}
				</button>
				<div data-popup></div>
			</div>
			${this.options.remove
		? html`<button
						type="button"
						data-remove
						class="base-button base-button--type-button remove"
						aria-label=${t('task.removeReminder')}
					>
						${listIcon('times')}
					</button>`
		: ''}`
	},
	onRender() {
		this.refresh()
	},
	onAttach() {
		document.addEventListener('click', this.getState().outside)
		if (this.options.model)
			this.listenTo(this.options.model, 'change', () => this.refresh())
	},
	refresh() {
		const reminder = this.options.model?.get('reminder') as
				| ITaskReminder
				| undefined,
			button = this.getUI('trigger')![0] as HTMLButtonElement
		button.textContent = reminder
			? label(reminder, this.options.ports)
			: t('task.addReminder')
		button.disabled = this.options.disabled()
		const remove = this.getUI('remove')?.[0] as HTMLButtonElement | undefined
		if (remove) remove.hidden = this.options.disabled()
	},
	toggle(event: Event) {
		event.preventDefault()
		event.stopPropagation()
		if (this.options.disabled()) return
		if (this.getChildView('popup')) {
			this.close(true)
			return
		}
		this.showChildView(
			'popup',
			new ReminderPopupView({
				value:
					(this.options.model?.get('reminder') as ITaskReminder | undefined) ??
					new TaskReminderModel(),
				ports: this.options.ports,
				defaultRelativeTo: this.options.defaultRelativeTo(),
				accepted: (value) => {
					this.options.changed(value)
					this.close(true)
				},
				closed: () => this.close(true),
			}),
		)
	},
	remove(event: Event) {
		event.preventDefault()
		if (!this.options.disabled()) this.options.remove?.()
	},
	close(focus: boolean) {
		this.getRegion('popup')!.empty()
		if (focus) (this.getUI('trigger')![0] as HTMLButtonElement).focus()
	},
	onBeforeDestroy() {
		document.removeEventListener('click', this.getState().outside)
	},
}).setDomApi(LitDomApi)
const ReminderRowsView = CollectionView.extend({
	childView: ReminderRowView,
}).setDataApi(DataApi)
export const TaskRemindersView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'column native-task-timing',
	regions: { rows: '[data-rows]', add: '[data-add]' },
	ui: { error: '[data-error]', status: '[data-status]' },
	createState() {
		const task = this.options.record.task
		return {
			task,
			items: (new Collection(
				task.reminders.map((reminder: ITaskReminder, id: number) => ({
					id,
					reminder,
				})),
			) as Collection<Model>),
			next: task.reminders.length,
			version: 0,
			pending: 0,
			dirty: false,
			life: new AbortController(),
		}
	},
	template() {
		return html`<div class="detail-title">
				${listIcon('clock')}${t('task.attributes.reminders')}
			</div>
			<span data-status role="status"></span>
			<div data-error role="alert" class="message danger" hidden></div>
			<div class="reminders">
				<div data-rows></div>
				<div data-add></div>
			</div>`
	},
	canWrite() {
		return Number(this.getState().task.maxPermission) > 0
	},
	defaultRelativeTo() {
		const task = this.getState().task
		return task.dueDate
			? 'due_date'
			: task.startDate
				? 'start_date'
				: task.endDate
					? 'end_date'
					: null
	},
	onRender() {
		const state = this.getState(),
			items = state.items,
			options = {
				ports: this.options.ports,
				disabled: () => !this.canWrite(),
				defaultRelativeTo: () => this.defaultRelativeTo(),
			}
		this.showChildView(
			'rows',
			new ReminderRowsView({
				collection: items,
				childViewOptions: (model: Model) => ({
					...options,
					model,
					changed: (reminder: ITaskReminder) => {
						model.set('reminder', reminder)
						void this.save()
					},
					remove: () => {
						items.remove(model)
						void this.save()
					},
				}),
			}),
		)
		this.showChildView(
			'add',
			new ReminderRowView({
				...options,
				changed: (reminder: ITaskReminder) => {
					items.add({ id: state.next++, reminder })
					void this.save()
				},
			}),
		)
	},
	updateTask(task: ITask) {
		const state = this.getState()
		state.task = task
		if (!state.pending && !state.dirty) this.resolve(task.reminders)
		;(
			this.getChildView('add') as InstanceType<typeof ReminderRowView>
		)?.refresh()
	},
	resolve(reminders: ITaskReminder[]) {
		const items = this.getState().items
		reminders.forEach((reminder, index) => {
			const model = items.at(index)
			if (model) model.set('reminder', reminder)
			else items.add({ id: this.getState().next++, reminder })
		})
		while (items.length > reminders.length)
			items.remove(items.at(items.length - 1)!)
	},
	async save() {
		const state = this.getState()
		if (!this.canWrite()) return
		const reminders = state.items.models.map(
				(model) => model.get('reminder') as ITaskReminder,
			),
			version = ++state.version,
			signal = state.life.signal
		state.pending++
		state.dirty = true
		;(this.getUI('error')![0] as HTMLElement).hidden = true
		;(this.getUI('status')![0] as HTMLElement).textContent = t('misc.saving')
		try {
			const saved = await this.options.record.save({ reminders }, signal)
			signal.throwIfAborted()
			if (version === state.version) {
				state.dirty = false
				this.resolve(saved.reminders)
			}
			success(t('task.detail.updateSuccess'))
		} catch (error) {
			if (!signal.aborted) {
				const el = this.getUI('error')![0] as HTMLElement
				el.hidden = false
				el.textContent = errorText(error)
			}
		} finally {
			state.pending--
			if (!this.isDestroyed())
				(this.getUI('status')![0] as HTMLElement).textContent = state.pending
					? t('misc.saving')
					: ''
		}
	},
	onBeforeDestroy() {
		this.getState().life.abort()
	},
}).setDomApi(LitDomApi)
export const TaskRepeatView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'column native-task-timing',
	ui: {
		amount: 'input',
		type: '[data-type]',
		mode: '[data-mode]',
		interval: '[data-interval]',
		error: '[data-error]',
		status: '[data-status]',
		remove: '[data-remove]',
	},
	events: {
		'input @ui.amount': function () {
			this.getState().dirty = true
			this.getState().draftRevision++
		},
		'change @ui.amount': 'save',
		'change @ui.type': 'save',
		'change @ui.mode': 'save',
		'click [data-preset]': 'preset',
		'click @ui.remove': 'remove',
	},
	createState() {
		return {
			task: this.options.record.task,
			version: 0,
			draftRevision: 0,
			pending: 0,
			dirty: false,
			life: new AbortController(),
		}
	},
	template() {
		return html`<div class="is-flex is-justify-content-space-between">
				<div class="detail-title">
					${listIcon('history')}${t('task.attributes.repeat')}
				</div>
				<button
					type="button"
					class="base-button base-button--type-button remove"
					data-remove
					aria-label=${t('task.detail.removeRepeat')}
				>
					${listIcon('times')}
				</button>
			</div>
			<span data-status role="status"></span>
			<div data-error class="message danger" role="alert" hidden></div>
			<div class="control repeat-after-input">
				<div class="button-group mbs-2">
					${[
		['everyDay', 1, 'days'],
		['everyWeek', 1, 'weeks'],
		['every30d', 30, 'days'],
	].map(
		([name, amount, type]) =>
			html`<button
								type="button"
								class="base-button base-button--type-button button is-outlined is-small"
								data-preset=${amount}
								data-unit=${type}
							>
								${t(`task.repeat.${name}`)}
							</button>`,
	)}
				</div>
				<div class="is-flex is-align-items-center mbe-2">
					<label for="repeatMode" class="is-fullwidth"
						>${t('task.repeat.mode')}:</label
					>
					<div class="control select">
						<select id="repeatMode" data-mode>
							<option value="0">${t('misc.default')}</option>
							<option value="1">${t('task.repeat.monthly')}</option>
							<option value="2">${t('task.repeat.fromCurrentDate')}</option>
						</select>
					</div>
				</div>
				<div class="is-flex" data-interval>
					<p class="pis-4">${t('task.repeat.each')}</p>
					<div class="field has-addons is-fullwidth">
						<div class="control">
							<input
								class="input"
								type="number"
								min="0"
								placeholder=${t('task.repeat.specifyAmount')}
							/>
						</div>
						<div class="control select">
							<select data-type aria-label=${t('task.attributes.repeat')}>
								${['hours', 'days', 'weeks'].map(
		(type) =>
			html`<option value=${type}>
											${t(`task.repeat.${type}`)}
										</option>`,
	)}
							</select>
						</div>
					</div>
				</div>
			</div>`
	},
	onRender() {
		this.publish()
	},
	canWrite() {
		return Number(this.getState().task.maxPermission) > 0
	},
	focusInput() {
		;(this.getUI('amount')![0] as HTMLInputElement).focus()
	},
	updateTask(task: ITask) {
		this.getState().task = task
		if (!this.getState().dirty && !this.getState().pending) this.publish()
	},
	publish() {
		const state = this.getState(),
			repeat =
				typeof state.task.repeatAfter === 'object'
					? state.task.repeatAfter
					: { amount: 0, type: 'days' },
			write = this.canWrite()
		;(this.getUI('amount')![0] as HTMLInputElement).value = String(
			repeat.amount,
		)
		;(this.getUI('type')![0] as HTMLSelectElement).value = repeat.type
		;(this.getUI('mode')![0] as HTMLSelectElement).value = String(
			state.task.repeatMode,
		)
		for (const input of this.el.querySelectorAll<
			HTMLInputElement | HTMLSelectElement | HTMLButtonElement
		>('input,select,button'))
			input.disabled = !write
		;(this.getUI('remove')![0] as HTMLElement).hidden = !write
		this.modeVisibility()
	},
	modeVisibility() {
		;(this.getUI('interval')![0] as HTMLElement).hidden =
			(this.getUI('mode')![0] as HTMLSelectElement).value === '1'
	},
	preset(event: Event) {
		const target = (event as Event & { delegateTarget: HTMLElement })
			.delegateTarget
		;(this.getUI('amount')![0] as HTMLInputElement).value =
			target.dataset.preset!
		;(this.getUI('type')![0] as HTMLSelectElement).value = target.dataset.unit!
		void this.save()
	},
	remove() {
		this.getState().draftRevision++
		void this.write(
			{
				repeatAfter: { amount: 0, type: 'days' },
				repeatMode: 0,
				repeatFromCurrentDate: false,
			},
			true,
		)
	},
	save() {
		this.modeVisibility()
		const amount = Number((this.getUI('amount')![0] as HTMLInputElement).value),
			type = (this.getUI('type')![0] as HTMLSelectElement).value as
				| 'hours'
				| 'days'
				| 'weeks',
			repeatMode = Number(
				(this.getUI('mode')![0] as HTMLSelectElement).value,
			) as ITask['repeatMode']
		this.getState().dirty = true
		this.getState().draftRevision++
		if (amount < 0 || !Number.isFinite(amount)) {
			const el = this.getUI('error')![0] as HTMLElement
			el.hidden = false
			el.textContent = t('task.repeat.invalidAmount')
			return
		}
		if (amount === 0 && repeatMode !== 1) return
		void this.write({
			repeatAfter: { amount, type },
			repeatMode,
			repeatFromCurrentDate: repeatMode === 2,
		})
	},
	async write(patch: Partial<ITask>, remove = false) {
		const state = this.getState()
		if (!this.canWrite()) return
		const version = ++state.version,
			draftRevision = state.draftRevision,
			signal = state.life.signal
		state.pending++
		state.dirty = true
		;(this.getUI('error')![0] as HTMLElement).hidden = true
		;(this.getUI('status')![0] as HTMLElement).textContent = t('misc.saving')
		try {
			const saved = await this.options.record.save(patch, signal)
			signal.throwIfAborted()
			if (version === state.version && draftRevision === state.draftRevision) {
				state.task = saved
				state.dirty = false
				this.publish()
				if (remove) this.trigger('removed')
			}
			success(t('task.detail.updateSuccess'))
		} catch (error) {
			if (!signal.aborted) {
				const el = this.getUI('error')![0] as HTMLElement
				el.hidden = false
				el.textContent = errorText(error)
			}
		} finally {
			state.pending--
			if (!this.isDestroyed())
				(this.getUI('status')![0] as HTMLElement).textContent = state.pending
					? t('misc.saving')
					: ''
		}
	},
	onBeforeDestroy() {
		this.getState().life.abort()
	},
}).setDomApi(LitDomApi)
