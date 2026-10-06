import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js'
import DOMPurify from 'dompurify'
import type { IProject } from '@/modelTypes/IProject'
import { t } from '../../shared/i18n'
import { listIcon } from '@/shared/task-list/list-ui'
export const ProjectInfoView = View.extend({
	initialize(options: { project: IProject; close: () => void }) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog default native-project-info native-project-dialog native-list-surface',
	events: { 'click [data-close]': 'close', cancel: 'close' },
	createState() {
		return { focus: document.activeElement as HTMLElement | null }
	},
	templateContext() {
		return this.options
	},
	template({ project }: { project: IProject }) {
		const description =
			project.id === -1
				? t('project.favoriteDescription')
				: project.description
		const sanitized = DOMPurify.sanitize(description || '', {
			ADD_ATTR: ['target'],
			RETURN_DOM_FRAGMENT: true,
		})
		for (const link of sanitized.querySelectorAll('[target]'))
			link.setAttribute('rel', 'noopener noreferrer')
		const host = document.createElement('div')
		host.append(sanitized)
		return html`<div class="modal-container">
			<div class="modal-content">
				<div class="card">
					<header class="card-header">
						<h2 class="card-header-title">${project.title}</h2>
						<button
							data-close
							type="button"
							class="base-button base-button--type-button card-header-icon"
							aria-label=${t('misc.closeDialog')}
						>
							${listIcon('times')}
						</button>
					</header>
					<div class="card-content has-text-start">
						${description
		? unsafeHTML(host.innerHTML)
		: html`<p class="is-italic">
									${t('project.noDescriptionAvailable')}
								</p>`}
					</div>
				</div>
			</div>
		</div>`
	},
	onAttach() {
		(this.el as HTMLDialogElement).showModal()
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		(this.el as HTMLDialogElement).close()
		const focus = this.getState().focus
		if (focus?.isConnected) focus.focus({ preventScroll: true })
	},
}).setDomApi(LitDomApi)
