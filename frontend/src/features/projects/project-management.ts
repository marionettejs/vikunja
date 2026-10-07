import {ProjectWebhookDialogView,readWebhooks,type WebhookData} from '../webhooks/application'
import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import { html, nothing } from 'lit-html'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import TaskService from '@/services/task'
import type { IProject } from '@/modelTypes/IProject'
import type { Route } from '../../app/routes'
import { interceptLink } from '../../app/routes'
import { ProjectCardsView } from './project-cards'
import { SettingsSearchView } from '../settings/settings-search'
import {
	NativeEditorView,
	type NativeEditorOptions,
} from '@/shared/editor/editor'
import { ProjectViewsView } from './project-views'
import { ProjectBackgroundDialogView } from './project-background-management'
import { ProjectInfoView } from './project-info'
import { ProjectDuplicateView } from './project-duplicate'
import { SavedFilterDialogView } from './saved-filter-management'
import SavedFilterService, {
	getSavedFilterIdFromProjectId,
} from '@/services/savedFilterCore'
import SavedFilterModel from '@/models/savedFilter'
import type { ISavedFilter } from '@/modelTypes/ISavedFilter'
import type { FilterContext } from '@/shared/filters/filter-context'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'

export async function loadProjects(signal: AbortSignal) {
	const service = new ProjectService(),
		projects: IProject[] = []
	let page = 1
	do {
		projects.push(
			...(await service.getAll(
				undefined,
				{ is_archived: true, expand:'permissions' },
				page++,
				signal,
			)),
		)
	} while (page <= service.totalPages)
	signal.throwIfAborted()
	return projects
}
export function projectDescendants(projects: IProject[], id: number) {
	const ids = new Set([id])
	let changed = true
	while (changed) {
		changed = false
		for (const project of projects)
			if (ids.has(project.parentProjectId) && !ids.has(project.id)) {
				ids.add(project.id)
				changed = true
			}
	}
	return [...ids]
}
interface Options {
	config: () => Record<string, unknown>;
	filter: FilterContext;
	navigate: (href: string, replace?: boolean) => void;
	commit: (project: IProject) => void;
	remove: (ids: number[]) => void;
	editor: NativeEditorOptions['context'];
}
const DirectoryView = View.extend({
	initialize(options: {
		projects: IProject[];
		navigate: Options['navigate'];
		favorite: (project: IProject) => void;
	}) {
		void options
	},
	className:
		'content loader-container native-project-directory native-list-surface',
	regions: { cards: '[data-cards]' },
	ui: { archived: '[data-archived]', error: '[data-error]' },
	events: { 'change @ui.archived': 'updateCards' },
	templateContext() {
		return { navigate: this.options.navigate }
	},
	template({ navigate }: { navigate: Options['navigate'] }) {
		return html`<header class="project-header">
				<div class="base-checkbox fancy-checkbox"><label class="base-checkbox__label"><input type="checkbox" class="is-sr-only" data-archived ?checked=${localStorage.getItem('showArchived') === 'true'}>${unsafeHTML(checkboxSvg.replace('<svg ', '<svg class="fancy-checkbox__icon" '))}<span class="fancy-checkbox__content">${t('project.showArchived')}</span></label></div>
				<div class="action-buttons">
					<a
						class="button is-primary"
						href="/filters/new"
						@click=${(event: MouseEvent) => interceptLink(event, navigate)}
						><span class="icon">${listIcon('filter')}</span>${t('filters.create.title')}</a
					><a
						class="button is-primary"
						href="/projects/new"
						@click=${(event: MouseEvent) => interceptLink(event, navigate)}
						><span class="icon">${listIcon('plus')}</span>${t('project.create.header')}</a
					>
				</div>
			</header>
			<div role="alert" data-error hidden></div>
			<div data-cards></div>`
	},
	onRender() {
		this.updateCards()
	},
	updateCards() {
		const archived = (this.getUI('archived')![0] as HTMLInputElement).checked
		localStorage.setItem('showArchived', String(archived))
		this.showChildView(
			'cards',
			new ProjectCardsView({
				...this.options,
				projects: this.options.projects.filter(
					(p) => archived || !p.isArchived,
				),
			}),
		)
	},
	publish(project: IProject) {
		this.options.projects = this.options.projects.map((p) =>
			p.id === project.id ? project : p,
		)
		this.updateCards()
	},
	feedback(message: string) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = message
	},
}).setDomApi(LitDomApi)
const ProjectDialogView = View.extend({
	initialize(options: {
		project: IProject;
		projects: IProject[];
		page: string;
		total: number;
		ids: number[];
		editor: Options['editor'];
		submit: (project: IProject) => void;
		close: () => void;
	}) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog scrolling native-project-dialog native-list-surface native-settings',
	regions: { parent: '[data-parent]', description: '[data-description]' },
	ui: {
		title: '[data-title]',
		identifier: '[data-identifier]',
		color: '[data-color]',
		submit: '[data-submit]',
		error: '[data-error]',
		inputs: 'input',
		form: 'form',
	},
	events: {
		'keydown @ui.title': 'key',
		'keydown @ui.identifier': 'key',
		'submit @ui.form': 'submit',
		'click @ui.submit': 'submit',
		cancel: 'cancel',
		'click [data-close]': 'cancel',
	},
	createState() {
		return {
			draft: new ProjectModel(this.options.project),
			focus: document.activeElement as HTMLElement | null,
			overflow: document.body.style.overflow,
		}
	},
	templateContext() {
		return this.options
	},
	template({
		project,
		page,
		total,
		ids,
	}: {
		project: IProject;
		page: string;
		total: number;
		ids: number[];
	}) {
		const form = page === 'new' || page === 'edit'
		return html`<div class="modal-container">
			<button
				type="button"
				class="base-button close"
				data-close
				aria-label=${t('misc.closeDialog')}
			>
				${listIcon('times')}
			</button>
			<div class="modal-content">
				<div class="card">
					<header class="card-header">
						<h2 class="card-header-title">
							${t(
		page === 'new'
			? 'project.create.header'
			: page === 'edit'
				? 'project.edit.header'
				: page === 'delete'
					? 'project.delete.header'
					: project.isArchived
						? 'project.archive.unarchive'
						: 'project.archive.archive',
	)}
						</h2>
					</header>
					<div class="card-content">
						<div data-error role="alert" class="message danger" hidden></div>
						${form
		? html`<form>
									${html`<div class="field">
										<label class="label" for="project-title"
											>${t('project.title')}</label
										><input
											id="project-title"
											data-title
											name="projectTitle"
											class="input"
											placeholder=${t(
		page === 'new'
			? 'project.create.titlePlaceholder'
			: 'project.edit.titlePlaceholder',
	)}
											.value=${project.title}
										/>
									</div>`}
									<div class="field">
										<label class="label">${t('project.parent')}</label>
										<div data-parent></div>
									</div>
									${page === 'edit'
		? html`<div class="field">
													<label class="label"
														>${t('project.edit.description')}</label
													>
													<div data-description></div>
												</div>
												<div class="field">
													<label class="label" for="project-identifier"
														>${t('project.edit.identifier')}</label
													><input
														id="project-identifier"
														data-identifier
														class="input"
														maxlength="10"
														.value=${project.identifier}
													/>
												</div>`
		: nothing}
									<div class="field">
										<label class="label" for="project-color"
											>${t('project.color')}</label
										><input
											id="project-color"
											data-color
											class="input"
											.value=${project.hexColor}
										/>
									</div>
								</form>`
		: page === 'delete'
			? html`<p>${t('project.delete.text1')}</p>
										<p class="has-text-weight-bold">
											${total
		? t(
			ids.length > 1
				? 'project.delete.tasksAndChildProjectsToDelete'
				: 'project.delete.tasksToDelete',
			ids.length > 1
				? { tasks: total, projects: ids.length }
				: { count: total },
		)
		: t('project.delete.noTasksToDelete')}
										</p>
										<p>${t('misc.cannotBeUndone')}</p>`
			: html`<p>
										${t(
		project.isArchived
			? 'project.archive.unarchiveText'
			: 'project.archive.archiveText',
	)}
									</p>`}
					</div>
					<footer class="card-footer">
						<button type="button" class="button is-outlined" data-close>
							${t('misc.cancel')}</button
						><button type="button" class="button is-primary" data-submit>
							${t(
		page === 'new'
			? 'misc.create'
			: page === 'edit'
				? 'misc.save'
				: 'misc.doit',
	)}
						</button>
					</footer>
				</div>
			</div>
		</div>`
	},
	onRender() {
		const { page, projects, editor } = this.options,
			project = this.getState().draft
		if (['new', 'edit'].includes(page)) {
			const forbidden = new Set(
				project.id > 0 ? projectDescendants(projects, project.id) : [],
			)
			this.showChildView(
				'parent',
				new SettingsSearchView({
					id: 'project-parent',
					label: t('project.parent'),
					placeholder: t('project.search'),
					items: projects
						.filter((p) => p.id > 0 && !p.isArchived && !forbidden.has(p.id))
						.map((p) => ({ value: p.id, label: p.title })),
					selected: project.parentProjectId,
					changed: (value) => {
						project.parentProjectId = Number(value ?? 0)
					},
				}),
			)
			if (page === 'edit')
				this.showChildView(
					'description',
					new NativeEditorView({
						value: project.description,
						canWrite: true,
						projectId: project.id,
						storageKey: `project-${project.id}-description`,
						placeholder: t('project.edit.descriptionPlaceholder'),
						context: editor,
						changed: (value) => {
							project.description = value
						},
						save: async (value) => {
							project.description = value
							return value
						},
						showSave: false,
						enableDiscard: false,
						editShortcut: '',
					}),
				)
		}
	},
	onAttach() {
		document.body.style.overflow = 'hidden';
		(this.el as HTMLDialogElement).showModal();
		(this.getUI('title')?.[0] as HTMLInputElement | undefined)?.focus()
	},
	values() {
		const project = new ProjectModel(this.getState().draft)
		if (['new', 'edit'].includes(this.options.page)) {
			project.title = (this.getUI('title')![0] as HTMLInputElement).value
			project.hexColor = (this.getUI('color')![0] as HTMLInputElement).value
			project.identifier =
				(this.getUI('identifier')?.[0] as HTMLInputElement | undefined)
					?.value ?? project.identifier
		}
		return project
	},
	key(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.isComposing) this.submit(event)
	},
	submit(event: Event) {
		event.preventDefault()
		const project = this.values()
		if (['new', 'edit'].includes(this.options.page) && !project.title.trim()) {
			this.feedback(t('project.create.addTitleRequired'))
			return
		}
		this.options.submit(project)
	},
	loading(value: boolean) {
		(this.getUI('submit')![0] as HTMLButtonElement).disabled = value
		this.el.classList.toggle('is-loading', value)
		this.el.setAttribute('aria-busy', String(value))
		if (this.options.page === 'new')
			for (const input of Array.from(this.getUI('inputs') ?? []))
				(input as HTMLInputElement).disabled = value
	},
	feedback(message: string) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = message
	},
	cancel(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		(this.el as HTMLDialogElement).close()
		document.body.style.overflow = this.getState().overflow
		const focus = this.getState().focus
		if (focus?.isConnected) focus.focus({ preventScroll: true })
	},
}).setDomApi(LitDomApi)
export const ProjectManagementApplication = Application.extend({
	initialize(options: Options) {
		void options
	},
	createState() {
		return {
			route: undefined as Route | undefined,
			request: undefined as AbortController | undefined,
			projects: [] as IProject[],
			ids: [] as number[],
		}
	},
	onBeforeStart(_app: unknown, route: Route) {
		this.getState().route = route
	},
	async prepareStart(route: Route, { signal }: LifecycleContext) {
		const projects = await loadProjects(signal),
			id = Number(route.params.projectId),
			page = route.params.page
		if (route.params.family === 'filter') {
			const filter =
				page === 'new'
					? new SavedFilterModel()
					: await new SavedFilterService().get(
						new SavedFilterModel({ id: getSavedFilterIdFromProjectId(id) }),
						{},
						signal,
					)
			return { projects, filter, ids: [], total: 0 }
		}
		const project =
			page === 'new'
				? new ProjectModel({ parentProjectId: id || 0 })
				: page
					? await new ProjectService().get(new ProjectModel({ id }), {}, signal)
					: undefined
		const ids = projectDescendants(projects, id)
		let total = 0
		if (page === 'delete') {
			const tasks = new TaskService()
			await tasks.getAll(
				undefined,
				{ filter: `project in ${ids.join(',')}` },
				1,
				signal,
			)
			total = tasks.resultCount * tasks.totalPages
		}
		let webhooks:WebhookData|undefined
		if(page==='webhooks'){try {webhooks=await readWebhooks(id,signal)}catch(error){signal.throwIfAborted();webhooks={error}}}
		return { projects, project, ids, total,webhooks }
	},
	onStart(
		_app: unknown,
		_route: unknown,
		data: {
			projects: IProject[];
			project?: IProject;
			filter?: ISavedFilter;
			ids: number[];
			total: number;
			webhooks?:WebhookData;
		},
	) {
		const state = this.getState()
		state.projects = data.projects
		state.ids = data.ids
		for (const p of data.projects) this.options.commit(p)
		const route = state.route!
		this.setView(
			route.params.family === 'filter'
				? new SavedFilterDialogView({
					filter: data.filter!,
					page: route.params.page,
					context: this.options.filter,
					editor: this.options.editor,
					commit: this.options.commit,
					remove: this.options.remove,
					navigate: this.options.navigate,
					close: () => this.close(),
				})
				: route.params.page === 'webhooks'
					? new ProjectWebhookDialogView({projectId:data.project!.id,editable:(data.project!.maxPermission??0)>0,data:data.webhooks??{},current:()=>this.isRunning()&&this.getState().route===route,close:()=>this.close()})
					: route.params.page === 'info'
						? new ProjectInfoView({ project: data.project!, close: () => this.close() })
						: route.params.page === 'background'
							? new ProjectBackgroundDialogView({ project: data.project!, providers: (this.options.config().enabled_background_providers ?? []) as string[], commit: this.options.commit, close: () => this.close() })
							: route.params.page === 'duplicate'
								? new ProjectDuplicateView({ project: data.project!, projects: data.projects, refresh: loadProjects, commit: this.options.commit, navigate: this.options.navigate, close: () => this.close() })
								: route.params.page === 'views'
									? new ProjectViewsView({
										project: data.project!,
										context: this.options.filter,
										commit: this.options.commit,
										close: () => this.close(),
									})
									: route.params.page
										? new ProjectDialogView({
											...data,
											project: data.project!,
											page: route.params.page,
											editor: this.options.editor,
											close: () => this.close(),
											submit: (project: IProject) => void this.write(project),
										})
										: new DirectoryView({
											projects: data.projects,
											navigate: this.options.navigate,
											favorite: (project: IProject) =>
												void this.write(project, 'favorite'),
										}),
		)
		this.showView()
		document.title = `${t(route.params.page === 'new' ? 'project.create.header' : route.params.page === 'edit' ? 'project.edit.header' : 'project.projects')} | Vikunja`
	},
	removeProjects(ids: number[]) {
		const view = this.getView()
		if (!(view instanceof DirectoryView) || !this.isRunning()) return
		view.options.projects = view.options.projects.filter(project => !ids.includes(project.id))
		this.getState().projects = view.options.projects
		view.updateCards()
	},
	close() {
		const route = this.getState().route!
		if (history.state?.backdropView) history.back()
		else
			this.options.navigate(
				Number(route.params.projectId)
					? `/projects/${route.params.projectId}`
					: '/projects',
				true,
			)
	},
	async write(project: IProject, action?: string) {
		const state = this.getState()
		if (state.request) return
		const request = (state.request = new AbortController()),
			view = this.getView() as
				| InstanceType<typeof ProjectDialogView>
				| InstanceType<typeof DirectoryView>,
			page = action ?? state.route!.params.page
		const current = () => {
			request.signal.throwIfAborted()
			if (!this.isRunning() || this.getView() !== view)
				throw new DOMException('Route changed', 'AbortError')
		}
		if (view instanceof ProjectDialogView) view.loading(true)
		try {
			const service = new ProjectService()
			if (page === 'delete') {
				await service.delete(project, request.signal)
				current()
				this.options.remove(state.ids)
				success(t('project.delete.success'))
				this.options.navigate('/')
			} else {
				const submitted =
					page === 'archive'
						? new ProjectModel({ ...project, isArchived: !project.isArchived })
						: page === 'favorite'
							? new ProjectModel({
								...project,
								isFavorite: !project.isFavorite,
							})
							: project
				const updated =
					page === 'new'
						? await service.create(submitted, request.signal)
						: await service.update(submitted, request.signal)
				current()
				this.options.commit(updated)
				success(
					t(
						page === 'new'
							? 'project.create.createdSuccess'
							: page === 'archive'
								? 'project.archive.success'
								: 'project.edit.success',
					),
				)
				if (view instanceof DirectoryView) view.publish(updated)
				else if (page === 'new')
					this.options.navigate(`/projects/${updated.id}`)
				else {
					const dialog = view as InstanceType<typeof ProjectDialogView>
					if (
						page === 'edit' &&
						JSON.stringify(dialog.values()) !== JSON.stringify(project)
					)
						dialog.getState().draft = new ProjectModel({
							...updated,
							...dialog.values(),
						})
					else this.close()
				}
			}
		} catch (error) {
			if (!request.signal.aborted && this.isRunning())
				view.feedback(errorText(error))
		} finally {
			if (state.request === request) {
				state.request = undefined
				if (!request.signal.aborted && view instanceof ProjectDialogView)
					view.loading(false)
			}
		}
	},
	onBeforeStop() {
		this.getState().request?.abort()
		this.getState().request = undefined
		this.getState().route = undefined
		this.getState().projects = []
	},
})
