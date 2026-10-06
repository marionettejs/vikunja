import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js'
import TaskService from '@/services/task'
import TaskModel, { getTaskIdentifier } from '@/models/task'
import TaskRelationService from '@/services/taskRelation'
import TaskRelationModel from '@/models/taskRelation'
import { RELATION_KINDS, type IRelationKind } from '@/types/IRelationKind'
import type { ITask } from '@/modelTypes/ITask'
import type { TaskRecordSession } from '@/features/task/task-record'
import type { TaskPorts } from './application'
import { SettingsSearchView, type SettingsChoice } from '../settings/settings-search'
import { ConfirmationView } from '../projects/project-sharing'
import { createTasks } from '../../shared/quick-add'
import { parseTaskText } from '@/modules/quickAddMagic/quickAddMagicCore'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import { t } from '../../shared/i18n'
import { interceptLink } from '../../app/routes'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import './task-relations.scss'
interface Options {
	record: TaskRecordSession
	ports: TaskPorts
}
const RelationSearchView = SettingsSearchView.extend({
	initialize(options: {
		items: SettingsChoice[]
		changed: (value: string | number | null) => void
		search: (query: string) => Promise<ITask[]>
		describe: (task: ITask) => string
		create: (query: string) => void
	}) {
		void options
	},
	filtered() {
		const query = this.getState().query
		return [
			...this.options.items,
			...(query
				? [
					{
						value: 'create',
						label: `${query} — ${t('task.relation.createPlaceholder')}`,
					},
				]
				: []),
		]
	},
	async search() {
		this.getState().selected = undefined
		this.options.changed(null)
		SettingsSearchView.prototype.search.call(this)
		const query = (this.getUI('input')![0] as HTMLInputElement).value
		this.options.items = []
		this.publish()
		this.el.classList.add('is-loading')
		try {
			const tasks = await this.options.search(query)
			if (
				this.isDestroyed() ||
				(this.getUI('input')![0] as HTMLInputElement).value !== query
			)
				return
			this.options.items = tasks.map((task) => ({
				value: task.id,
				label: this.options.describe(task),
			}))
			this.publish()
		} catch (error) {
			if (!this.isDestroyed() && (error as Error).name !== 'AbortError')
				this.trigger('search:error', error)
		} finally {
			if (
				!this.isDestroyed() &&
				(this.getUI('input')![0] as HTMLInputElement).value === query
			)
				this.el.classList.remove('is-loading')
		}
	},
	choose(index: number) {
		const item = this.filtered()[index]
		if (item?.value === 'create') {
			this.options.create((this.getUI('input')![0] as HTMLInputElement).value)
			this.close()
			return
		}
		SettingsSearchView.prototype.choose.call(this, index)
	},
	query() {
		return (this.getUI('input')![0] as HTMLInputElement).value
	},
	focus() {
		;(this.getUI('input')![0] as HTMLInputElement).focus()
	},
}).setDomApi(LitDomApi)
export const TaskRelationsView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'content details mbe-0 native-task-relations native-list-surface',
	regions: { search: '[data-search]', confirmation: '[data-confirmation]' },
	ui: {
		form: '[data-form]',
		kind: 'select',
		rows: '[data-rows]',
		error: '[data-error]',
		toggle: '[data-toggle]',
		add: '[data-add]',
		saving: '[data-saving]',
		empty: '[data-empty]',
	},
	events: {
		'click @ui.toggle': 'toggleForm',
		'click @ui.add': 'add',
		'submit @ui.form': 'add',
		'click [data-remove]': 'confirmRemove',
		'change [data-done]': 'toggleDone',
	},
	createState() {
		return {
			task: this.options.record.task,
			selected: undefined as ITask | undefined,
			found: [] as ITask[],
			open: false,
			request: undefined as AbortController | undefined,
			search: undefined as AbortController | undefined,
			savedTimer: undefined as ReturnType<typeof setTimeout> | undefined,
		}
	},
	template() {
		return html`<h2 class="task-section-title">
				<span class="icon is-grey">${listIcon('sitemap')}</span>${t(
	'task.attributes.relatedTasks',
)}
			</h2>
			<div class="task-relations">
				<button
					id="showRelatedTasksFormButton"
					data-toggle
					type="button"
					class="base-button base-button--type-button button is-outlined is-pulled-end add-task-relation-button d-print-none"
					aria-label=${t('task.relation.add')}
				>
					${listIcon('plus')}
				</button>
				<div data-error role="alert" class="message danger" hidden></div>
				<form data-form>
					<label class="label"
						>${t('task.relation.new')} <span data-saving role="status"></span
					></label>
					<div class="field task-relation-search-field" data-search></div>
					<div class="field has-addons mbe-4">
						<div class="control is-expanded">
							<div class="select is-fullwidth has-defaults">
								<select aria-label=${t('task.relation.select')}>
									<option value="unset">${t('task.relation.select')}</option>
									${RELATION_KINDS.map(
		(kind) =>
			html`<option value=${kind}>
												${t(`task.relation.kinds.${kind}`, 1)}
											</option>`,
	)}
								</select>
							</div>
						</div>
						<div class="control">
							<button type="submit" data-add class="button is-primary">
								${t('task.relation.add')}
							</button>
						</div>
					</div>
				</form>
				<div data-rows></div>
				<p data-empty class="none">${t('task.relation.noneYet')}</p>
				<div data-confirmation></div>
			</div>`
	},
	onRender() {
		;(this.getUI('kind')![0] as HTMLSelectElement).value =
			this.options.ports.user().settings.frontendSettings
				.defaultTaskRelationType ?? 'related'
		const search = new RelationSearchView({
			id: `task-${this.getState().task.id}-relation`,
			label: t('task.relation.searchPlaceholder'),
			placeholder: t('task.relation.searchPlaceholder'),
			items: [],
			selected: null,
			changed: (value) => {
				this.getState().selected = this.getState().found.find(
					(task) => task.id === Number(value),
				)
			},
			search: (query) => this.searchTasks(query),
			describe: (task) => this.describe(task),
			create: (query) => void this.write('add', undefined, undefined, query),
		})
		this.listenTo(search, 'search:error', (error) => this.feedback(error))
		this.showChildView('search', search)
		this.publish()
	},
	canWrite() {
		return Number(this.getState().task.maxPermission) > 0
	},
	searchView() {
		return this.getChildView('search') as InstanceType<
			typeof RelationSearchView
		>
	},
	focusInput() {
		this.getState().open = true
		this.publish()
		this.searchView().focus()
	},
	describe(task: ITask) {
		const project =
			task.projectId === this.getState().task.projectId
				? ''
				: this.options.ports.getProject(task.projectId)?.title
		return `${project ? `${project} > ` : ''}${getTaskIdentifier(task)} ${task.title}`
	},
	async searchTasks(query: string) {
		const state = this.getState()
		state.search?.abort()
		const request = (state.search = new AbortController())
		const tasks = await new TaskService().getAll(
			undefined,
			{ s: query, sort_by: 'done' },
			1,
			request.signal,
		)
		request.signal.throwIfAborted()
		state.found = tasks
			.filter((task) => task.id !== state.task.id)
			.sort(
				(a, b) =>
					Number(a.done) - Number(b.done) ||
					Number(b.projectId === state.task.projectId) -
						Number(a.projectId === state.task.projectId),
			)
		return state.found
	},
	updateTask(task: ITask) {
		this.getState().task = task
		this.publish()
	},
	publish() {
		const state = this.getState(),
			task = state.task,
			groups = (
				Object.entries(task.relatedTasks) as [
					IRelationKind,
					ITask[] | undefined,
				][]
			).filter(([, tasks]) => tasks?.length),
			has = groups.length > 0,
			canWrite = this.canWrite()
		;(this.getUI('form')![0] as HTMLElement).hidden =
			!canWrite || (has && !state.open)
		;(this.getUI('toggle')![0] as HTMLElement).hidden = !canWrite || !has
		;(this.getUI('toggle')![0] as HTMLElement).classList.toggle(
			'is-active',
			state.open,
		)
		;(this.getUI('empty')![0] as HTMLElement).hidden = has
		render(
			html`${groups.map(
				([kind, tasks]) =>
					html`<div class="related-tasks">
						<span class="title"
							>${t(`task.relation.kinds.${kind}`, tasks!.length)}</span
						>
						<div class="tasks">
							${tasks!.map(
	(related) =>
		html`<div class="task">
										<div class="is-flex is-align-items-center">
											<div
												class="base-checkbox fancy-checkbox task-done-checkbox"
											>
												<label class="base-checkbox__label"
													><input
														type="checkbox"
														class="is-sr-only"
														data-done=${related.id}
														.checked=${related.done}
														?disabled=${!canWrite || Boolean(state.request)}
														aria-label=${t('task.detail.markAsDone', {
		task: related.title,
	})}
													/>${unsafeHTML(
		checkboxSvg.replace(
			'<svg ',
			'<svg class="fancy-checkbox__icon" ',
		),
	)}</label
												>
											</div>
											<a
												href=${this.options.ports.ui.taskHref(related.id)}
												class=${related.done ? 'is-strikethrough' : ''}
												@click=${(event: MouseEvent) =>
		interceptLink(event, () =>
			this.options.ports.editor.openTask(related),
		)}
												><span class="different-project"
													>${related.projectId !== task.projectId &&
													this.options.ports.getProject(related.projectId)
														?.title
		? `${this.options.ports.getProject(related.projectId)!.title} > `
		: ''}</span
												><span class="task-identifier"
													>${getTaskIdentifier(related)}</span
												>${related.title}</a
											>
										</div>
										${canWrite
		? html`<button
													type="button"
													class="base-button base-button--type-button remove"
													data-remove=${related.id}
													data-kind=${kind}
													aria-label=${t('task.relation.delete')}
												>
													${listIcon('trash-alt')}
												</button>`
		: nothing}
									</div>`,
)}
						</div>
					</div>`,
			)}`,
			this.getUI('rows')![0] as HTMLElement,
		)
		;(this.getUI('add')![0] as HTMLButtonElement).disabled =
			Boolean(state.request) || !canWrite
	},
	toggleForm() {
		this.getState().open = !this.getState().open
		this.publish()
		if (this.getState().open) this.searchView().focus()
	},
	add(event: Event) {
		event.preventDefault()
		void this.write(
			'add',
			this.getState().selected,
			undefined,
			this.searchView().query(),
		)
	},
	confirmRemove(event: Event) {
		const target = (event as Event & { delegateTarget: HTMLElement })
			.delegateTarget
		this.showChildView(
			'confirmation',
			new ConfirmationView({
				title: t('task.relation.delete'),
				text: `${t('task.relation.deleteText1')} ${t('misc.cannotBeUndone')}`,
				close: () => this.getRegion('confirmation')!.empty(),
				submit: () =>
					void this.write(
						'remove',
						new TaskModel({ id: Number(target.dataset.remove) }),
						target.dataset.kind as IRelationKind,
					),
			}),
		)
	},
	toggleDone(event: Event) {
		const input = (event as Event & { delegateTarget: HTMLInputElement })
			.delegateTarget
		void this.write(
			'done',
			new TaskModel({ id: Number(input.dataset.done), done: input.checked }),
		)
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = errorText(error)
		;(
			this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		)?.feedback(error)
	},
	async write(
		action: string,
		selected?: ITask,
		kind?: IRelationKind,
		query = '',
	) {
		const state = this.getState()
		if (state.request || !this.canWrite()) return
		kind ??= (this.getUI('kind')![0] as HTMLSelectElement)
			.value as IRelationKind
		if (action === 'add' && !selected && !query.trim()) {
			this.feedback(t('task.relation.taskRequired'))
			return
		}
		const request = (state.request = new AbortController()),
			taskId = state.task.id,
			projectId = state.task.projectId,
			search = this.searchView(),
			submittedQuery = search.query()
		;(this.getUI('error')![0] as HTMLElement).hidden = true
		clearTimeout(state.savedTimer)
		;(this.getUI('saving')![0] as HTMLElement).textContent = t('misc.saving')
		;(
			this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		)?.loading(true)
		this.publish()
		try {
			if (action === 'add' && !selected) {
				const settings = this.options.ports.user().settings
				const parsed = parseTaskText(
					query,
					settings.frontendSettings.quickAddMagicMode,
				)
				const labels = await this.options.ports.ui.ensureLabels(
					parsed.labels,
					request.signal,
				)
				request.signal.throwIfAborted()
				const result = await createTasks(
					[{ title: query, projectId }],
					{
						settings,
						labels,
						reportError: (error) => {
							if (!request.signal.aborted) this.feedback(error)
						},
					},
					request.signal,
				)
				request.signal.throwIfAborted()
				if (result.error) throw result.error
				selected = result.tasks[0] ?? undefined
				if (!selected) throw new Error('Task was not created')
				if (search.query() === submittedQuery) state.selected = selected
			}
			const service = new TaskRelationService()
			if (action === 'add')
				await service.create(
					new TaskRelationModel({
						taskId,
						otherTaskId: selected!.id,
						relationKind: kind,
					}),
					request.signal,
				)
			else if (action === 'remove')
				await service.delete(
					new TaskRelationModel({
						taskId,
						otherTaskId: selected!.id,
						relationKind: kind,
					}),
					request.signal,
				)
			else {
				const service = new TaskService(),
					current = await service.get(
						new TaskModel({ id: selected!.id }),
						{},
						request.signal,
					)
				request.signal.throwIfAborted()
				await service.update(
					{ ...current, done: selected!.done },
					request.signal,
				)
			}
			request.signal.throwIfAborted()
			const current = await new TaskService().get(
				new TaskModel({ id: taskId }),
				{},
				request.signal,
			)
			request.signal.throwIfAborted()
			if (this.isDestroyed()) return
			this.options.record.acceptFields({ relatedTasks: current.relatedTasks })
			if (
				action === 'add' &&
				search.query() === submittedQuery &&
				(this.getUI('kind')![0] as HTMLSelectElement).value === kind
			) {
				state.selected = undefined
				search.clear(new Event('clear'))
				;(this.getUI('kind')![0] as HTMLSelectElement).value =
					this.options.ports.user().settings.frontendSettings
						.defaultTaskRelationType ?? 'related'
				state.open = false
			}
			this.getRegion('confirmation')!.empty()
			;(this.getUI('saving')![0] as HTMLElement).textContent = t('misc.saved')
			state.savedTimer = setTimeout(() => {
				if (!this.isDestroyed())
					(this.getUI('saving')![0] as HTMLElement).textContent = ''
			}, 2000)
			if (action === 'done') {
				if (selected!.done) this.options.ports.ui.playDoneSound?.()
				success(t('task.detail.updateSuccess'))
			}
		} catch (error) {
			if (!request.signal.aborted && !this.isDestroyed()) {
				this.feedback(error)
				;(this.getUI('saving')![0] as HTMLElement).textContent = ''
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				;(
					this.getChildView('confirmation') as
						| InstanceType<typeof ConfirmationView>
						| undefined
				)?.loading(false)
				this.publish()
			}
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.getState().search?.abort()
		clearTimeout(this.getState().savedTimer)
	},
}).setDomApi(LitDomApi)
