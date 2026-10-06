import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import SavedFilterService, { getProjectId } from '@/services/savedFilterCore'
import SavedFilterModel from '@/models/savedFilter'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import type { ISavedFilter } from '@/modelTypes/ISavedFilter'
import type { IProject } from '@/modelTypes/IProject'
import type { FilterContext } from '@/shared/filters/filter-context'
import { FilterInputView } from '@/shared/filters/filter-input'
import { FilterDocsView } from '@/shared/filters/filter-docs'
import {
	NativeEditorView,
	type NativeEditorOptions,
} from '@/shared/editor/editor'
import { clearEditorDraft } from '@/helpers/editorDraftStorage'
import { hasFilterQuery } from '@/helpers/filters'
import { listIcon } from '@/shared/task-list/list-ui'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
interface Options {
	filter: ISavedFilter;
	page: string;
	context: FilterContext;
	editor: NativeEditorOptions['context'];
	commit: (project: IProject) => void;
	remove: (ids: number[]) => void;
	navigate: (href: string, replace?: boolean) => void;
	close: () => void;
}
export const SavedFilterDialogView = View.extend({
	initialize(options: Options) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog scrolling native-saved-filter native-project-dialog native-list-surface',
	regions: {
		description: '[data-description]',
		query: '[data-query]',
		docs: '[data-docs]',
	},
	ui: {
		title: '[data-title]',
		includeNulls: '[data-nulls]',
		save: '[data-save]',
		error: '[data-error]',
		delete: '[data-delete]',
	},
	events: {
		'input @ui.title': 'changed',
		'change @ui.includeNulls': 'changed',
		'click @ui.save': 'submit',
		'submit form': 'submit',
		'click @ui.delete': 'deleteRoute',
		cancel: 'close',
		'click [data-close]': 'close',
	},
	createState() {
		return {
			draft: new SavedFilterModel(structuredClone(this.options.filter)),
			revision: 0,
			request: undefined as AbortController | undefined,
			focus: document.activeElement as HTMLElement | null,
		}
	},
	templateContext() {
		return this.options
	},
	template({ filter, page }: Options) {
		const deleting = page === 'delete'
		return html`<div class="modal-container">
			<div class="modal-content">
				<div class="card">
					<header class="card-header">
						<h2 class="card-header-title">
							${t(
		deleting
			? 'filters.delete.header'
			: page === 'new'
				? 'filters.create.title'
				: 'filters.edit.title',
	)}
						</h2>
						<button
							type="button"
							data-close
							class="base-button base-button--type-button card-header-icon"
							aria-label=${t('misc.closeDialog')}
						>
							${listIcon('times')}
						</button>
					</header>
					<div class="card-content">
						<div data-error role="alert" class="message danger" hidden></div>
						${deleting
		? html`<p>${t('filters.delete.text')}</p>`
		: html`<form>
									${page === 'new'
		? html`<p>${t('filters.create.description')}</p>`
		: nothing}
									<div class="field">
										<label class="label" for="saved-filter-title"
											>${t('filters.attributes.title')}</label
										><input
											id="saved-filter-title"
											data-title
											class="input"
											.value=${filter.title}
											placeholder=${t('filters.attributes.titlePlaceholder')}
											required
										/>
									</div>
									<div class="field">
										<label class="label"
											>${t('filters.attributes.description')}</label
										>
										<div data-description></div>
									</div>
									<div class="field">
										<label class="label">${t('filters.title')}</label>
										<div data-query></div>
										<label class="checkbox"
											><input
												type="checkbox"
												data-nulls
												.checked=${filter.filters.filter_include_nulls}
											/>
											${t('filters.attributes.includeNulls')}</label
										>
										<div data-docs></div>
									</div>
								</form>`}
					</div>
					<footer class="card-footer">
						${page === 'edit'
		? html`<button type="button" class="button is-danger" data-delete>
									${t('misc.delete')}
								</button>`
		: nothing}<button
							type="button"
							class="button is-outlined"
							data-close
						>
							${t('misc.cancel')}</button
						><button type="button" class="button is-primary" data-save>
							${t(
		deleting
			? 'misc.doit'
			: page === 'new'
				? 'filters.create.action'
				: 'misc.save',
	)}
						</button>
					</footer>
				</div>
			</div>
		</div>`
	},
	onRender() {
		if (this.options.page === 'delete') return
		const d = this.getState().draft
		this.showChildView(
			'description',
			new NativeEditorView({
				value: d.description,
				canWrite: true,
				projectId: 0,
				storageKey: `saved-filter-${d.id}-description`,
				placeholder: t('filters.attributes.descriptionPlaceholder'),
				context: this.options.editor,
				variant: 'tiptap__saved-filter-description',
				showSave: false,
				enableDiscard: false,
				editShortcut: '',
				changed: (value: string) => {
					d.description = value
					this.changed()
				},
				save: async (value) => value,
			}),
		)
		this.showChildView(
			'query',
			new FilterInputView({
				autofocus: false,
				context: this.options.context,
				value: d.filters.filter || d.filters.s || '',
				changed: (value: string) => {
					d.filters = { ...d.filters, filter: value, s: '' }
					this.changed()
				},
			}),
		)
		this.showChildView(
			'docs',
			new FilterDocsView({ context: this.options.context.ui }),
		)
	},
	onAttach() {
		(this.el as HTMLDialogElement).showModal();
		(this.getUI('title')?.[0] as HTMLInputElement | undefined)?.focus()
	},
	changed() {
		this.getState().revision++
	},
	values() {
		const d = new SavedFilterModel(structuredClone(this.getState().draft))
		if (this.options.page !== 'delete') {
			d.title = (this.getUI('title')![0] as HTMLInputElement).value
			const query = d.filters.filter || d.filters.s || ''
			d.filters = {
				...d.filters,
				filter: hasFilterQuery(query) ? query : '',
				s: hasFilterQuery(query) ? '' : query,
				filter_include_nulls: (
					this.getUI('includeNulls')![0] as HTMLInputElement
				).checked,
			}
		}
		return d
	},
	loading(busy: boolean) {
		(this.getUI('save')![0] as HTMLButtonElement).disabled = busy
		this.el.setAttribute('aria-busy', String(busy))
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = errorText(error)
	},
	async submit(event: Event) {
		event.preventDefault()
		const state = this.getState()
		if (state.request) return
		const submitted = this.values(),
			revision = state.revision,
			creating = this.options.page === 'new',
			deleting = this.options.page === 'delete',
			filterId = submitted.id
		if (!deleting && !submitted.title.trim()) {
			this.feedback(t('filters.create.titleRequired'))
			return
		}
		const request = (state.request = new AbortController())
		this.loading(true)
		try {
			const service = new SavedFilterService()
			if (deleting) {
				await service.delete(
					new SavedFilterModel({ id: filterId }),
					request.signal,
				)
				request.signal.throwIfAborted()
				this.options.remove([getProjectId(submitted)])
				success(t('filters.delete.success'))
				this.options.navigate('/projects')
				return
			}
			const accepted = submitted.id === 0
				? await service.create(submitted, request.signal)
				: await service.update(submitted, request.signal)
			request.signal.throwIfAborted()
			state.draft.id = accepted.id
			const projectId = getProjectId(accepted),
				project = await new ProjectService().get(
					new ProjectModel({ id: projectId }),
					{},
					request.signal,
				)
			request.signal.throwIfAborted()
			this.options.commit(project)
			if (state.revision === revision) {
				clearEditorDraft(`saved-filter-${this.options.filter.id}-description`)
				if (creating) this.options.navigate(`/projects/${projectId}`)
				else {
					success(t('filters.edit.success'))
					this.options.close()
				}
			}
		} catch (error) {
			if (!request.signal.aborted) this.feedback(error)
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) this.loading(false)
		}
	},
	deleteRoute() {
		this.options.navigate(
			`/projects/${getProjectId(this.getState().draft)}/settings/delete`,
		)
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		this.getState().request?.abort();
		(this.el as HTMLDialogElement).close()
		const focus = this.getState().focus
		if (focus?.isConnected) focus.focus({ preventScroll: true })
	},
}).setDomApi(LitDomApi)
