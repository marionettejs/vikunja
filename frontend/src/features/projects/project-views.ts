import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, render, nothing } from 'lit-html'
import ProjectViewModel from '@/models/projectView'
import ProjectModel from '@/models/project'
import ProjectViewService from '@/services/projectViews'
import ProjectService from '@/services/project'
import type { IProject } from '@/modelTypes/IProject'
import type { IProjectView } from '@/modelTypes/IProjectView'
import type { IFilters } from '@/modelTypes/ISavedFilter'
import type { FilterContext } from '@/shared/filters/filter-context'
import { FilterInputView } from '@/shared/filters/filter-input'
import { FilterDocsView } from '@/shared/filters/filter-docs'
import { hasFilterQuery } from '@/helpers/filters'
import { calculateItemPosition } from '@/helpers/calculateItemPosition'
import { ConfirmationView } from './project-sharing'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import './project-views.scss'

function normalizedFilter(input?: IFilters): IFilters {
	const filter = input as
		| (IFilters & {
				sortBy?: IFilters['sort_by'];
				orderBy?: IFilters['order_by'];
				filterIncludeNulls?: boolean;
		  })
		| undefined
	return {
		sort_by: filter?.sort_by ?? filter?.sortBy ?? [],
		order_by: filter?.order_by ?? filter?.orderBy ?? [],
		filter: filter?.filter ?? '',
		s: filter?.s ?? '',
		filter_include_nulls:
			filter?.filter_include_nulls ?? filter?.filterIncludeNulls ?? false,
	}
}
interface FormOptions {
	view: IProjectView;
	context: FilterContext;
	submit: (view: IProjectView, revision: number) => void;
	cancel: () => void;
	create: boolean;
}
const ViewForm = View.extend({
	initialize(options: FormOptions) {
		void options
	},
	className: 'native-view-form',
	regions: {
		filter: '[data-filter]',
		docs: '[data-docs]',
		buckets: '[data-buckets]',
	},
	ui: {
		title: '[data-title]',
		kind: '[data-kind]',
		nulls: '[data-nulls]',
		mode: 'input[name=configMode]',
		config: '[data-config]',
		bucketList: '[data-buckets]',
		save: '[data-save]',
		error: '[data-error]',
	},
	events: {
		'submit form': 'submit',
		'input @ui.title': 'changed',
		'change @ui.kind': 'kindChanged',
		'change @ui.nulls': 'changed',
		'change @ui.mode': 'modeChanged',
		'click [data-add-bucket]': 'addBucket',
		'click [data-cancel]': 'cancel',
	},
	createState() {
		return {
			draft: new ProjectViewModel(structuredClone(this.options.view)),
			revision: 0,
			buckets: [] as InstanceType<typeof BucketForm>[],
			busy: false,
		}
	},
	templateContext() {
		return this.options
	},
	template({ view, create }: FormOptions) {
		return html`<form>
			<div data-error role="alert" class="message danger" hidden></div>
			<div class="field">
				<label class="label" for="view-title">${t('project.views.title')}</label
				><input
					id="view-title"
					data-title
					class="input"
					.value=${view.title}
					required
				/>
			</div>
			<div class="field">
				<label class="label" for="view-kind">${t('project.views.kind')}</label>
				<div class="select">
					<select id="view-kind" data-kind>
						${['list', 'gantt', 'table', 'kanban'].map(
		(kind) =>
			html`<option value=${kind} ?selected=${view.viewKind === kind}>
									${t(`project.${kind}.title`)}
								</option>`,
	)}
					</select>
				</div>
			</div>
			<label class="label">${t('project.views.filter')}</label>
			<div data-filter></div>
			<div data-docs></div>
			<label class="checkbox mbe-3"
				><input
					data-nulls
					type="checkbox"
					.checked=${normalizedFilter(view.filter).filter_include_nulls}
				/>
				${t('filters.attributes.includeNulls')}</label
			>
			<div data-config>
				<label class="label">${t('project.views.bucketConfigMode')}</label>${[
	'manual',
	'filter',
].map(
	(mode) =>
		html`<label class="radio"
							><input
								type="radio"
								name="configMode"
								value=${mode}
								?checked=${view.bucketConfigurationMode === mode}
							/>
							${t(
		mode === 'manual'
			? 'project.views.bucketConfigManual'
			: 'project.views.filter',
	)}</label
						>`,
)}
				<div data-bucket-panel>
					<label class="label">${t('project.views.bucketConfig')}</label>
					<div data-buckets></div>
					<button type="button" class="button is-outlined" data-add-bucket>
						${t('project.kanban.addBucket')}
					</button>
				</div>
			</div>
			<div class="is-flex is-justify-content-end mbe-4">
				<button type="button" class="button is-outlined" data-cancel>
					${t('misc.cancel')}</button
				><button type="submit" class="button is-primary" data-save>
					${t(create ? 'project.views.create' : 'misc.save')}
				</button>
			</div>
		</form>`
	},
	onAttach() {
		const d = this.getState().draft
		this.showChildView(
			'filter',
			new FilterInputView({
				autofocus: false,
				context: this.options.context,
				projectId: d.projectId,
				value: d.filter?.filter || d.filter?.s || '',
				changed: (value: string) => {
					d.filter = {sort_by: [], order_by: [], filter_include_nulls: true, ...d.filter, filter: value, s: ''}
					this.changed()
				},
			}),
		)
		this.showChildView(
			'docs',
			new FilterDocsView({ context: this.options.context.ui }),
		)
		for (const b of d.bucketConfiguration) this.addBucket(undefined, b)
		this.visibility();
		(this.getUI('title')![0] as HTMLInputElement).focus()
	},
	changed() {
		this.getState().revision++
	},
	kindChanged() {
		const d = this.getState().draft
		d.viewKind = (this.getUI('kind')![0] as HTMLSelectElement)
			.value as IProjectView['viewKind']
		if (d.viewKind === 'kanban' && d.bucketConfigurationMode === 'none')
			d.bucketConfigurationMode = 'manual'
		this.changed()
		this.visibility()
	},
	modeChanged() {
		this.getState().draft.bucketConfigurationMode = (
			Array.from(this.getUI('mode')!).find(
				(el) => (el as HTMLInputElement).checked,
			) as HTMLInputElement
		).value
		this.changed()
		this.visibility()
	},
	visibility() {
		const d = this.getState().draft;
		(this.getUI('config')![0] as HTMLElement).hidden = d.viewKind !== 'kanban';
		(this.el.querySelector('[data-bucket-panel]') as HTMLElement).hidden =
			d.bucketConfigurationMode !== 'filter'
		const radio = this.el.querySelector<HTMLInputElement>(
			`input[value="${d.bucketConfigurationMode}"]`,
		)
		if (radio) radio.checked = true
	},
	addBucket(
		event?: Event,
		bucket?: IProjectView['bucketConfiguration'][number],
	) {
		event?.preventDefault()
		const host = document.createElement('div');
		(this.getUI('bucketList')![0] as HTMLElement).append(host)
		const name = `bucket-${this.getState().buckets.length}-${this.getState().revision}`
		const child = new BucketForm({
			bucket: bucket ?? {
				title: '',
				filter: {
					filter: '',
					s: '',
					sort_by: [],
					order_by: [],
					filter_include_nulls: false,
				},
			},
			context: this.options.context,
			projectId: this.options.view.projectId,
			changed: () => this.changed(),
			remove: () => {
				this.getState().buckets = this.getState().buckets.filter(
					(v) => v !== child,
				)
				this.removeRegion(name)
				host.remove()
				this.changed()
			},
		})
		this.addRegion(name, { el: host })
		this.showChildView(name, child)
		this.getState().buckets.push(child)
		if (event) this.changed()
	},
	values() {
		const state = this.getState(),
			view: IProjectView = new ProjectViewModel(structuredClone(state.draft))
		view.title = (this.getUI('title')![0] as HTMLInputElement).value
		const query = view.filter?.filter || view.filter?.s || ''
		view.filter = {
			...normalizedFilter(view.filter),
			filter: hasFilterQuery(query) ? query : '',
			s: hasFilterQuery(query) ? '' : query,
			filter_include_nulls: (this.getUI('nulls')![0] as HTMLInputElement)
				.checked,
		}
		view.bucketConfiguration = state.buckets.map((b) => b.values())
		if (view.viewKind !== 'kanban') view.bucketConfigurationMode = 'none'
		return view
	},
	submit(event: Event) {
		event.preventDefault()
		if (!this.getState().busy)
			this.options.submit(this.values(), this.getState().revision)
	},
	cancel() {
		this.options.cancel()
	},
	loading(busy: boolean) {
		this.getState().busy = busy;
		(this.getUI('save')![0] as HTMLButtonElement).disabled = busy
		this.el.setAttribute('aria-busy', String(busy))
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = errorText(error)
	},
}).setDomApi(LitDomApi)
const BucketForm = View.extend({
	initialize(options: {
		bucket: IProjectView['bucketConfiguration'][number];
		context: FilterContext;
		projectId: number;
		changed: () => void;
		remove: () => void;
	}) {
		void options
	},
	className: 'filter-bucket-form',
	regions: { filter: '[data-filter]' },
	ui: { title: 'input[type=text]', nulls: 'input[type=checkbox]' },
	events: {
		'input @ui.title': 'changed',
		'change @ui.nulls': 'changed',
		'click [data-remove]': 'remove',
	},
	createState() {
		return {
			filter:
				this.options.bucket.filter.filter || this.options.bucket.filter.s || '',
		}
	},
	templateContext() {
		return this.options
	},
	template({
		bucket,
	}: {
		bucket: IProjectView['bucketConfiguration'][number];
	}) {
		return html`<div class="field">
				<label class="label"
					>${t('project.views.title')}<input
						class="input"
						type="text"
						.value=${bucket.title}
				/></label>
			</div>
			<div data-filter></div>
			<label class="checkbox"
				><input
					type="checkbox"
					.checked=${normalizedFilter(bucket.filter).filter_include_nulls}
				/>
				${t('filters.attributes.includeNulls')}</label
			><button
				type="button"
				class="base-button base-button--type-button is-danger"
				data-remove
				aria-label=${t('project.kanban.deleteHeaderBucket')}
			>
				${listIcon('trash-alt')}
			</button>`
	},
	onAttach() {
		this.showChildView(
			'filter',
			new FilterInputView({
				autofocus: false,
				context: this.options.context,
				projectId: this.options.projectId,
				value: this.getState().filter,
				changed: (value: string) => {
					this.getState().filter = value
					this.changed()
				},
			}),
		)
	},
	changed() {
		this.options.changed()
	},
	remove() {
		this.options.remove()
	},
	values() {
		const q = this.getState().filter
		return {
			title: (this.getUI('title')![0] as HTMLInputElement).value,
			filter: {
				...normalizedFilter(this.options.bucket.filter),
				filter: hasFilterQuery(q) ? q : '',
				s: hasFilterQuery(q) ? '' : q,
				filter_include_nulls: (this.getUI('nulls')![0] as HTMLInputElement)
					.checked,
			},
		}
	},
}).setDomApi(LitDomApi)
export const ProjectViewsView = View.extend({
	initialize(options: {
		project: IProject;
		context: FilterContext;
		commit: (project: IProject) => void;
		close: () => void;
	}) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog scrolling native-project-dialog native-project-views native-list-surface',
	regions: { form: '[data-form]', confirmation: '[data-confirmation]' },
	ui: { rows: 'tbody', create: '[data-create]', error: '[data-error]' },
	events: {
		cancel: 'close',
		'click [data-close]': 'close',
		'click @ui.create': 'create',
		'click [data-edit]': 'edit',
		'click [data-delete]': 'confirmDelete',
		'dragstart [draggable]': 'dragStart',
		'dragover [draggable]': 'dragOver',
		'drop [draggable]': 'drop',
	},
	createState() {
		return {
			project: this.options.project,
			request: undefined as AbortController | undefined,
			drag: 0,
			life: new AbortController(),
			focus: document.activeElement as HTMLElement | null,
		}
	},
	templateContext() {
		return this.options
	},
	template() {
		return html`<div class="modal-container">
				<div class="modal-content">
					<div class="card">
						<header class="card-header">
							<h2 class="card-header-title">${t('project.views.header')}</h2>
							<button
								type="button"
								class="base-button"
								data-close
								aria-label=${t('misc.closeDialog')}
							>
								${listIcon('times')}
							</button>
						</header>
						<div class="card-content">
							<div data-error role="alert" class="message danger" hidden></div>
							<div data-form></div>
							<div class="is-flex is-justify-content-end mbe-4">
								<button type="button" class="button is-primary" data-create>
									${t('project.views.create')}
								</button>
							</div>
							<div data-readonly class="message" hidden>
								${t('project.views.onlyAdminsCanEdit')}
							</div>
							<table
								class="table has-actions is-striped is-hoverable is-fullwidth"
							>
								<thead>
									<tr>
										<th>${t('project.views.title')}</th>
										<th>${t('project.views.kind')}</th>
										<th>${t('project.views.actions')}</th>
									</tr>
								</thead>
								<tbody></tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
			<div data-confirmation></div>`
	},
	onAttach() {
		(this.el as HTMLDialogElement).showModal()
		this.publish()
	},
	admin() {
		return Number(this.getState().project.maxPermission) === 2
	},
	publish() {
		const admin = this.admin();
		(this.getUI('create')![0] as HTMLElement).hidden = !admin;
		(this.el.querySelector('[data-readonly]') as HTMLElement).hidden = admin
		render(
			html`${this.getState().project.views.map(
				(v: IProjectView) =>
					html`<tr data-id=${v.id} draggable=${admin ? 'true' : 'false'}>
						<td>${v.title}</td>
						<td>${v.viewKind}</td>
						<td>
							${admin
		? html`<button
											type="button"
											class="button is-danger"
											data-delete=${v.id}
											aria-label=${t('project.views.delete')}
										>
											${listIcon('trash-alt')}</button
										><button
											type="button"
											class="button"
											data-edit=${v.id}
											aria-label=${t('project.views.edit')}
										>
											${listIcon('pen')}</button
										><span class="icon handle">${listIcon('grip-lines')}</span>`
		: nothing}
						</td>
					</tr>`,
			)}`,
			this.getUI('rows')![0] as HTMLElement,
		)
	},
	openForm(view: IProjectView, create: boolean) {
		if (!this.admin() || this.getState().request) return
		this.showChildView(
			'form',
			new ViewForm({
				view,
				context: this.options.context,
				create,
				cancel: () => this.getRegion('form')!.empty(),
				submit: (submitted: IProjectView, revision: number) =>
					void this.write(
						submitted,
						submitted.id ? 'update' : 'create',
						revision,
					),
			}),
		)
	},
	create() {
		this.openForm(
			ProjectViewModel.createWithDefaultFilter({
				projectId: this.getState().project.id,
			}),
			true,
		)
	},
	edit(event: Event) {
		const id = Number(
				(event.target as Element).closest<HTMLElement>('[data-edit]')?.dataset
					.edit,
			),
			view = this.getState().project.views.find(
				(v: IProjectView) => v.id === id,
			)
		if (view) this.openForm(view, false)
	},
	confirmDelete(event: Event) {
		if (!this.admin() || this.getState().request) return
		const id = Number(
				(event.target as Element).closest<HTMLElement>('[data-delete]')?.dataset
					.delete,
			),
			view = this.getState().project.views.find(
				(v: IProjectView) => v.id === id,
			)
		if (view)
			this.showChildView(
				'confirmation',
				new ConfirmationView({
					title: t('project.views.delete'),
					text: t('project.views.deleteText'),
					close: () => this.getRegion('confirmation')!.empty(),
					submit: () => void this.write(view, 'delete'),
				}),
			)
	},
	async write(
		view: IProjectView,
		action: 'create' | 'update' | 'delete',
		revision?: number,
	) {
		const state = this.getState()
		if (state.request || !this.admin()) return
		const projectId = state.project.id,
			submitted = new ProjectViewModel({ ...view, projectId }),
			request = (state.request = new AbortController()),
			form = this.getChildView('form') as
				| InstanceType<typeof ViewForm>
				| undefined,
			confirmation = this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		form?.loading(true)
		confirmation?.loading(true)
		try {
			const service = new ProjectViewService()
			if (action === 'delete') await service.delete(submitted, request.signal)
			else if (action === 'create') {
				const accepted = await service.create(submitted, request.signal)
				request.signal.throwIfAborted()
				if (form && this.getChildView('form') === form)
					form.getState().draft.id = accepted.id
			} else await service.update(submitted, request.signal)
			const project = await new ProjectService().get(
				new ProjectModel({ id: projectId }),
				{},
				request.signal,
			)
			request.signal.throwIfAborted()
			state.project = project
			this.options.commit(project)
			this.publish()
			if (
				form &&
				this.getChildView('form') === form &&
				form.getState().revision === revision
			)
				this.getRegion('form')!.empty()
			this.getRegion('confirmation')!.empty()
			success(
				t(
					action === 'create'
						? 'project.views.createSuccess'
						: 'project.views.updateSuccess',
				),
			)
		} catch (error) {
			if (!request.signal.aborted) {
				if (confirmation) confirmation.feedback(errorText(error))
				else if (form) form.feedback(error)
				else this.feedback(error)
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				if (form && !form.isDestroyed()) form.loading(false)
				if (confirmation && !confirmation.isDestroyed())
					confirmation.loading(false)
			}
		}
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = errorText(error)
	},
	dragStart(event: DragEvent) {
		if (!this.admin()) return
		this.getState().drag = Number(
			(event.target as Element).closest<HTMLElement>('tr[data-id]')?.dataset.id,
		)
		event.dataTransfer?.setData('text/plain', String(this.getState().drag))
	},
	dragOver(event: DragEvent) {
		if (this.admin()) event.preventDefault()
	},
	drop(event: DragEvent) {
		event.preventDefault()
		const state = this.getState(),
			rows = [...state.project.views],
			from = rows.findIndex((v) => v.id === state.drag),
			to = rows.findIndex(
				(v) =>
					v.id ===
					Number(
						(event.target as Element).closest<HTMLElement>('tr[data-id]')
							?.dataset.id,
					),
			)
		if (!this.admin() || from < 0 || to < 0 || from === to) return
		const [view] = rows.splice(from, 1)
		rows.splice(to, 0, view)
		void this.write(
			{
				...view,
				position: calculateItemPosition(
					rows[to - 1]?.position,
					rows[to + 1]?.position,
				),
			},
			'update',
		)
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.getState().life.abort();
		(this.el as HTMLDialogElement).close()
		const focus = this.getState().focus
		if (focus?.isConnected) focus.focus({ preventScroll: true })
	},
}).setDomApi(LitDomApi)
