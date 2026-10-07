import {ShortcutHelpView} from '../shared/shortcut-help'
import {install, uninstall} from '@/helpers/shortcut'
import {SHORTCUTS} from '@/constants/shortcuts'
import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {listIcon} from '@/shared/task-list/list-ui'
import {t} from '../shared/i18n'
import {isEditorContentEmpty} from '@/helpers/editorContentEmpty'
import type {IProject} from '@/modelTypes/IProject'
import {LogoView} from '@/shared/logo'
import type {Model} from '@mnjs/data'
export const ShellView = View.extend({
	initialize(options: {routeName: () => string; session: Model}) {void options},
	events: {'click @ui.help': 'openShortcuts'},
	ui: {
		content: '.app-content',
		menuToggle: '[data-menu]',
		info: '[data-info]',
		title: '[data-title]', help: '[data-help]',
	},
	templateContext() {
		return { toggle: () => this.toggleMenu() }
	},
	template: ({ toggle }: { toggle: () => void }) =>
		html`<header class="navbar d-print-none" aria-label="main navigation">
				<a href="/" class="logo-link" aria-label=${t('navigation.home')}
					><div data-logo></div></a
				><button
					type="button"
					class="base-button base-button--type-button menu-show-button menu-button"
					data-menu
					@click=${toggle}
				>
				</button>
				<div class="project-title-wrapper">
					<span class="project-title" data-title></span>
					<a data-info href="" hidden class="base-button base-button--type-button project-title-button" aria-label=${t('project.description')}>${listIcon('info-circle')}</a><div data-project-menu></div>
				</div>
				<div class="navbar-end"><div data-search></div><div data-timer></div><div data-notifications></div><div data-account></div></div>
			</header>
			<div class="content-auth native-content-auth">
				<div class="app-container">
					<div data-background></div>
					<div data-navigation style="display:contents"></div>
					<main
						id="main-content"
						tabindex="-1"
						class="app-content is-menu-enabled"
					>
						<div data-content style="display:contents"></div><button type="button" class="base-button base-button--type-button keyboard-shortcuts-button d-print-none" data-help aria-label=${t('keyboardShortcuts.title')}>${listIcon('keyboard')}</button>
					</main>
					<div data-overlay></div><div data-quick-actions></div>
				</div>
			</div>
			<div data-help-dialog></div>`,
	regions: {
		logo: '[data-logo]',
		background: {el: '[data-background]', replaceElement: true},
		projectMenu: '[data-project-menu]',
		search: '[data-search]',
		quickActions: '[data-quick-actions]',
		timer: '[data-timer]',
		notifications: '[data-notifications]',
		account: '[data-account]',
		navigation: '[data-navigation]',
		content: '[data-content]',
		overlay: '[data-overlay]',
		help: '[data-help-dialog]',
	},
	createState() {
		return {
			narrow: window.innerWidth <= 1024,
			menuActive: window.innerWidth > 1024,
			resize: () => {
				const narrow = window.innerWidth <= 1024
				if (narrow !== this.getState().narrow) {
					this.getState().narrow = narrow
					this.getState().menuActive = !narrow
					this.updateMenu()
				}
			},
		}
	},
	openShortcuts() {this.showChildView('help', new ShortcutHelpView({routeName:this.options.routeName(),close:()=>this.getRegion('help')!.empty()}))},
	onRender() {this.showChildView('logo', new LogoView({model: this.options.session}))},
	onAttach() {
		install(this.getUI('help')![0] as HTMLElement,SHORTCUTS.showKeyboardShortcuts)
		window.addEventListener('resize', this.getState().resize)
		this.updateMenu()
	},
	toggleMenu() {
		this.getState().menuActive = !this.getState().menuActive
		this.updateMenu()
	},
	updateMenu() {
		const active = this.getState().menuActive
		this.getChildView('navigation')?.el.classList.toggle('is-active', active)
		;(this.getUI('content')![0] as HTMLElement)?.classList.toggle(
			'is-menu-enabled',
			active,
		)
		const button = this.getUI('menuToggle')![0] as HTMLButtonElement
		button?.setAttribute('aria-expanded', String(active))
		button?.setAttribute(
			'aria-label',
			t(active ? 'misc.hideMenu' : 'misc.showMenu'),
		)
	},
	projectInfo(project: IProject | undefined, title: string) {
		(this.getUI('title')![0] as HTMLElement).textContent = title
		const info = this.getUI('info')![0] as HTMLAnchorElement
		info.hidden = !project?.description || isEditorContentEmpty(project.description)
		if (project) info.href = `/projects/${project.id}/info`
	},
	onBeforeDestroy() {
		uninstall(this.getUI('help')![0] as HTMLElement)
		window.removeEventListener('resize', this.getState().resize)
	},
}).setDomApi(LitDomApi)
