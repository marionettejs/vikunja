import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import ProjectDuplicateService from '@/services/projectDuplicateService'
import ProjectDuplicateModel from '@/models/projectDuplicateModel'
import type { IProject } from '@/modelTypes/IProject'
import { SettingsSearchView } from '../settings/settings-search'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'

interface Options {
	project: IProject;
	projects: IProject[];
	refresh: (signal: AbortSignal) => Promise<IProject[]>;
	commit: (project: IProject) => void;
	navigate: (href: string) => void;
	close: () => void;
}
export const ProjectDuplicateView = View.extend({
	initialize(options: Options) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog default native-project-duplicate native-project-dialog native-list-surface native-settings',
	regions: { parent: '[data-parent]' },
	ui: {
		fields: '[data-fields]',
		submit: '[data-submit]',
		shares: '[data-shares]',
		error: '[data-error]',
	},
	events: {
		'click @ui.submit': 'submit',
		'click [data-close]': 'close',
		cancel: 'close',
	},
	createState() {
		return {
			parentId: this.options.project.parentProjectId,
			request: undefined as AbortController | undefined,
			accepted: undefined as IProject | undefined,
			focus: document.activeElement as HTMLElement | null,
		}
	},
	template() {
		return html`<div class="modal-container">
			<div class="modal-content">
				<div class="card">
					<header class="card-header">
						<h2 class="card-header-title">${t('project.duplicate.title')}</h2>
						<button
							type="button"
							class="base-button base-button--type-button card-header-icon"
							data-close
							aria-label=${t('misc.closeDialog')}
						>
							${listIcon('times')}
						</button>
					</header>
					<div class="card-content">
						<div data-error role="alert" class="message danger" hidden></div>
						<p>${t('project.duplicate.text')}</p>
						<fieldset data-fields>
							<div data-parent></div>
							<label class="checkbox mbs-2"
								><input type="checkbox" data-shares checked /> ${t(
		'project.duplicate.shares',
	)}</label
							>
						</fieldset>
					</div>
					<footer class="card-footer">
						<button type="button" class="button is-outlined" data-close>
							${t('misc.cancel')}</button
						><button type="button" class="button is-primary" data-submit>
							${t('project.duplicate.label')}
						</button>
					</footer>
				</div>
			</div>
		</div>`
	},
	onRender() {
		this.showChildView(
			'parent',
			new SettingsSearchView({
				id: 'duplicate-parent',
				label: t('project.parent'),
				placeholder: t('project.search'),
				items: this.options.projects
					.filter(
						(p) => p.id > 0 && !p.isArchived,
					)
					.map((p) => ({ value: p.id, label: p.title })),
				selected: this.getState().parentId,
				changed: (value) => {
					this.getState().parentId = Number(value ?? 0)
				},
			}),
		)
	},
	onAttach() {
		(this.el as HTMLDialogElement).showModal();
		(
			this.getChildView('parent') as InstanceType<typeof SettingsSearchView>
		).focus()
	},
	async submit(event: Event) {
		event.preventDefault()
		const state = this.getState()
		if (state.request) return
		const request = (state.request = new AbortController());
		(this.getUI('submit')![0] as HTMLButtonElement).disabled = true
		this.el.setAttribute('aria-busy', 'true');
		(this.getUI('fields')![0] as HTMLFieldSetElement).disabled = true
		try {
			if (!state.accepted) {
				const submitted = new ProjectDuplicateModel({
					projectId: this.options.project.id,
					parentProjectId: state.parentId,
					duplicateShares: (this.getUI('shares')![0] as HTMLInputElement)
						.checked,
				})
				const result = await new ProjectDuplicateService().create(
					submitted,
					request.signal,
				)
				request.signal.throwIfAborted()
				if (!result.duplicatedProject) throw new Error(t('misc.error'))
				state.accepted = result.duplicatedProject
			}
			const projects = await this.options.refresh(request.signal)
			request.signal.throwIfAborted()
			for (const project of projects) this.options.commit(project)
			this.options.commit(state.accepted)
			success(t('project.duplicate.success'))
			this.options.navigate(`/projects/${state.accepted.id}`)
		} catch (error) {
			if (!request.signal.aborted) {
				const el = this.getUI('error')![0] as HTMLElement
				el.hidden = false
				el.textContent = errorText(error)
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				(this.getUI('submit')![0] as HTMLButtonElement).disabled = false
				this.el.setAttribute('aria-busy', 'false');
				(this.getUI('fields')![0] as HTMLFieldSetElement).disabled = Boolean(
					state.accepted,
				)
			}
		}
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
