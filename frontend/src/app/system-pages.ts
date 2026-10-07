import { Application, View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import { VERSION } from '@/version.json'
import { listIcon } from '@/shared/task-list/list-ui'
import type { Route } from './routes'
import { t } from '../shared/i18n'
import './system-pages.scss'
export const NotFoundView = View.extend({
	className: 'content has-text-centered',
	template: () =>
		html`<h1>${t('404.title')}</h1>
			<p>${t('404.text')}</p>`,
}).setDomApi(LitDomApi)
const AboutView = View.extend({
	initialize(options: { apiVersion: string; close: () => void }) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog hint-modal native-about native-settings native-list-surface',
	ui: { close: '[data-close]' },
	events: { 'click @ui.close': 'close', cancel: 'close', click: 'backdrop' },
	templateContext() {
		return this.options
	},
	template({ apiVersion }: { apiVersion: string }) {
		return html`<button
				data-close
				class="base-button base-button--type-button close"
				aria-label=${t('misc.closeDialog')}
			>
				${listIcon('times')}
			</button>
			<div class="modal-container">
				<div class="modal-content">
					<div class="card has-no-shadow">
						<header class="card-header">
							<p class="card-header-title">${t('about.title')}</p>
							<button
								data-close
								class="base-button base-button--type-button card-header-icon close"
								aria-label=${t('misc.close')}
							>
								${listIcon('times')}
							</button>
						</header>
						<div class="p-4">
							${apiVersion === VERSION
		? html`<p>${t('about.version', { version: apiVersion })}</p>`
		: html`<p>
											${t('about.frontendVersion', { version: VERSION })}
										</p>
										<p>${t('about.apiVersion', { version: apiVersion })}</p>`}
						</div>
						<footer class="card-footer">
							<button data-close class="button is-outlined">
								${t('misc.close')}
							</button>
						</footer>
					</div>
				</div>
			</div>`
	},
	onAttach() {
		document.body.style.overflow = 'hidden';
		(this.el as HTMLDialogElement).showModal()
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	backdrop(event: MouseEvent) {
		if (event.target === this.el) this.close(event)
	},
	onDomRemove() {
		(this.el as HTMLDialogElement).close()
		document.body.style.overflow = ''
	},
	onBeforeDestroy() {
		(this.el as HTMLDialogElement).close()
		document.body.style.overflow = ''
	},
}).setDomApi(LitDomApi)
export const SystemPagesApplication = Application.extend({
	initialize(options: {
		config: () => Record<string, unknown>;
		navigate: (href: string, replace?: boolean) => void;
	}) {
		void options
	},
	onStart(_app: unknown, route: Route) {
		this.setView(
			route.kind === 'about'
				? new AboutView({
					apiVersion: String(this.options.config().version ?? ''),
					close: () => {
						history.back()
					},
				})
				: new NotFoundView(),
		)
		this.showView()
		if (route.kind === 'not-found') document.title = '404 | Vikunja'
	},
})
