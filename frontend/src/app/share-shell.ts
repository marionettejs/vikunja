import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {LogoView} from '@/shared/logo'
import type {Model} from '@mnjs/data'
import type {IProject} from '@/modelTypes/IProject'
import {POWERED_BY} from '@/urls'
import {t} from '../shared/i18n'
import '../features/auth/sharing.scss'
export const ShareShellView = View.extend({
	initialize(options: {session: Model, logoVisible: boolean, hash: string, navigate: (href: string) => void, retry: () => void}) {void options},
	className: 'native-share-surface native-list-surface',
	ui: {container: '.link-share-container', title: '[data-title]', titleLink: '.project-title-button', failure: '[data-project-error]', retry: '[data-retry]', loading: '[data-project-loading]'},
	regions: {logo: '[data-logo]',background: {el: '[data-background]',replaceElement: true},content: '[data-content]', overlay: '[data-overlay]'},
	createState() {return {hasProject: false, failed: false}},
	templateContext() {return {logoVisible: this.options.logoVisible}},
	template: ({logoVisible}: {logoVisible: boolean}) => html`<div class="link-share-container"><div data-background></div><div class="has-text-centered link-share-view">${logoVisible ? html`<div class="logo"><div data-logo></div></div>` : ''}<div class="message danger mbe-4" data-project-error hidden>${t('sharing.projectLoadError')} <button class="base-button base-button--type-button" type="button" data-retry>${t('sharing.retry')}</button></div><a class="base-button project-title-button ${logoVisible ? '' : 'm-0'}" href="/" data-project-link hidden><h1 class="title clickable-title" data-title>${t('misc.loading')}</h1></a><h1 data-project-loading class="title ${logoVisible ? '' : 'm-0'}">${t('misc.loading')}</h1><div class="card has-text-start view"><div class="card-content loader-container"><main id="main-content" tabindex="-1" data-content style="display:contents"></main><a class="menu-bottom-link" href=${`${POWERED_BY}&utm_medium=link_share`} target="_blank" rel="noopener">${t('misc.poweredBy')}</a></div></div></div></div><div data-overlay></div>`,
	events: {'click @ui.titleLink': 'projectLink', 'click @ui.retry': 'retry'},
	projectLink(event: MouseEvent) {event.preventDefault(); this.options.navigate((this.getUI('titleLink')![0] as HTMLAnchorElement).getAttribute('href')!)},
	retry() {this.options.retry()},
	onRender() {if(this.options.logoVisible)this.showChildView('logo',new LogoView({model:this.options.session}))},
	updateProject(project: IProject | undefined, viewId?: number) {
		this.getState().hasProject = Boolean(project)
		this.updateTitle()
		if (!project) return
		;(this.getUI('title')![0] as HTMLElement).textContent = project.title
		;(this.getUI('titleLink')![0] as HTMLAnchorElement).href = `/projects/${project.id}/${project.views[0]?.id}#share-auth-token=${encodeURIComponent(this.options.hash)}`
		const kind = project.views.find(view => view.id === viewId)?.viewKind
		;(this.getUI('container')![0] as HTMLElement).classList.toggle('link-share-is-fullwidth', kind === 'gantt' || kind === 'kanban')
	},
	projectError(value: boolean) {this.getState().failed = value; (this.getUI('failure')![0] as HTMLElement).hidden = !value; this.updateTitle()},
	updateTitle() {const state = this.getState(); (this.getUI('titleLink')![0] as HTMLElement).hidden = state.failed || !state.hasProject; (this.getUI('loading')![0] as HTMLElement).hidden = state.failed || state.hasProject},
}).setDomApi(LitDomApi)
