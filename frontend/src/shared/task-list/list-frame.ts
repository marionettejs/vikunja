import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {computePosition, autoPlacement, offset, shift} from '@floating-ui/dom'
import type {IProject} from '@/modelTypes/IProject'
import type {IProjectView} from '@/modelTypes/IProjectView'
import {getProjectTitle} from '@/helpers/getProjectTitle'
import type {ListContext} from './list-context'
import {listIcon} from './list-ui'

const ListTabsView = View.extend({
	ui: {'dropdown': '.switch-view-dropdown', 'trigger': '.switch-view-dropdown-trigger', 'tabs': '[data-view-tabs]', 'menu': '.dropdown-menu', links: '[data-view-tabs] a'},
	attributes: {style: 'display:contents'},
	initialize(options: {context: ListContext, project: IProject, viewId: number}) { void options },
	createState() { return {observer: undefined as ResizeObserver | undefined, frame: 0, open: false,
		outside: (event: MouseEvent) => { if (!(this.getUI('dropdown')![0] as HTMLElement)?.contains(event.target as Node)) this.closeDropdown() }} },
	viewTitle(view: IProjectView) {
		const key = {List: 'list', Gantt: 'gantt', Table: 'table', Kanban: 'kanban'}[view.title as 'List']
		return key ? this.options.context.t(`project.${key}.title`) : view.title
	},
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const {project, viewId, context: ctx} = this.options
		const views = project.views, current = views.find(view => view.id === viewId)
		const link = (view: IProjectView, dropdown = false) => html`<a class="base-button ${dropdown ? 'dropdown-item' : 'switch-view-button'} ${view.id === viewId ? 'is-active' : ''}" href=${ctx.viewHref(project, view)} @click=${(event: MouseEvent) => { ctx.navigate(event); this.closeDropdown() }}>${dropdown ? html`<span>${this.viewTitle(view)}</span>` : this.viewTitle(view)}</a>`
		return html`${views.length > 1 ? html`<div class="dropdown switch-view-dropdown" style="display:none" @keydown=${(event: KeyboardEvent) => { if (event.key === 'Escape' && this.getState().open) { event.stopPropagation(); this.closeDropdown(); (this.getUI('trigger')![0] as HTMLButtonElement)?.focus() } }}>
					<button type="button" class="base-button base-button--type-button switch-view switch-view-dropdown-trigger" aria-expanded="false" @click=${() => this.toggleDropdown()}>${current ? this.viewTitle(current) : ''}<span class="dropdown-icon">${listIcon('chevron-down')}</span></button>
					<div class="dropdown-menu" style="display:none"><div class="dropdown-content">${views.map(view => link(view, true))}</div></div>
				</div><div class="switch-view switch-view--hidden" data-view-tabs>${views.map(view => link(view))}</div>` : nothing}`
	},
	onAttach() {
		this.getState().observer = new ResizeObserver(() => { cancelAnimationFrame(this.getState().frame); this.getState().frame = requestAnimationFrame(() => this.checkOverflow()) })
		this.getState().observer!.observe(this.el.closest('.switch-view-container')!)
		this.checkOverflow()
		document.addEventListener('click', this.getState().outside)
	},
	checkOverflow() {
		const tabs = (this.getUI('tabs')![0] as HTMLElement)
		if (!tabs) return
		const overflow = tabs.scrollWidth > this.el.closest<HTMLElement>('.switch-view-container')!.clientWidth
		tabs.classList.toggle('switch-view--hidden', overflow)
		if (overflow) tabs.setAttribute('aria-hidden', 'true'); else tabs.removeAttribute('aria-hidden')
		for (const link of Array.from(this.getUI('links')! as ArrayLike<HTMLAnchorElement>)) { if (overflow) link.tabIndex = -1; else link.removeAttribute('tabindex') }
		;(this.getUI('dropdown')![0] as HTMLElement)!.style.display = overflow ? '' : 'none'
		if (!overflow) this.closeDropdown()
	},
	async toggleDropdown() {
		if (this.getState().open) { this.closeDropdown(); return }
		this.getState().open = true
		const trigger = (this.getUI('trigger')![0] as HTMLButtonElement)!, menu = (this.getUI('menu')![0] as HTMLElement)!
		trigger.setAttribute('aria-expanded', 'true'); menu.style.display = ''
		const position = await computePosition(trigger.parentElement!, menu, {strategy: 'absolute', middleware: [offset(4), autoPlacement({allowedPlacements: ['bottom-end', 'top-end', 'bottom-start', 'top-start'], padding: 8}), shift({padding: 8})]})
		if (this.isDestroyed() || !this.getState().open) return
		Object.assign(menu.style, {left: `${position.x}px`, top: `${position.y}px`})
		menu.style.setProperty('--hover-offset', '4px')
	},
	closeDropdown() {
		this.getState().open = false
		;(this.getUI('trigger')![0] as HTMLButtonElement)?.setAttribute('aria-expanded', 'false')
		const menu = (this.getUI('menu')![0] as HTMLElement)
		if (menu) menu.style.display = 'none'
	},
	updateProject(project: IProject) { this.options.project = project; this.render(); this.checkOverflow() },
	onBeforeDestroy() { this.getState().observer?.disconnect(); cancelAnimationFrame(this.getState().frame); document.removeEventListener('click', this.getState().outside) },
}).setDomApi(LitDomApi)

export const ListFrameView = View.extend({
	ui: {'title': '.project-title-print', 'archived': '[data-archived]', 'controls': '.switch-view-container', 'archivedMessage': '[data-archived] .message'},
	className: 'loader-container project-list native-list-frame',
	initialize(options: {context: ListContext, project: IProject, viewId: number}) { void options },
	regions: {tabs: '[data-tabs]', sort: '[data-sort]', filter: '[data-filter]', body: '[data-body]'},
	createState() { return {stopProject: undefined as (() => void) | undefined, viewsKey: ''} },
	templateContext() { return {project: this.options.project} },
	template: ({project}: {project: IProject}) => html`<h1 class="project-title-print">${getProjectTitle(project)}</h1>
		<div class="switch-view-container d-print-none ${project.views.length === 1 ? 'is-justify-content-flex-end' : ''}">
			<div data-tabs style="display:contents"></div><div class="filter-container native-list-filters"><div data-sort style="display:contents"></div><div data-filter style="display:contents"></div></div>
		</div><div class="message-wrapper mbe-4" data-archived style=${project.isArchived ? '' : 'display:none'}><div class="message warning"></div></div><div data-body style="display:contents"></div>`,
	onAttach() {
		this.showChildView('tabs', new ListTabsView(this.options))
		this.updateProject(this.options.project)
		this.getState().stopProject = this.options.context.observeProject(this.options.project.id, project => this.updateProject(project))
	},
	checkOverflow() { (this.getChildView('tabs') as InstanceType<typeof ListTabsView>)?.checkOverflow() },
	updateProject(project: IProject) {
		this.options.project = project
		document.title = `${getProjectTitle(project)} | Vikunja`
		this.el.classList.toggle('is-archived', project.isArchived)
		;(this.getUI('title')![0] as HTMLElement)!.textContent = getProjectTitle(project)
		const archived = (this.getUI('archived')![0] as HTMLElement)!
		archived.style.display = project.isArchived ? '' : 'none'; this.getUI('archivedMessage')![0].textContent = this.options.context.t('project.archivedMessage')
		;(this.getUI('controls')![0] as HTMLElement)!.classList.toggle('is-justify-content-flex-end', project.views.length === 1)
		const tabs = this.getChildView('tabs') as InstanceType<typeof ListTabsView>
		const viewsKey = JSON.stringify(project.views)
		if (this.getState().viewsKey !== viewsKey) { this.getState().viewsKey = viewsKey; tabs.updateProject(project) }
		const body = this.getChildView('body') as InstanceType<typeof View> & {setProject?: (project: IProject) => void}
		body?.setProject?.(project)
	},
	onBeforeDestroy() { this.getState().stopProject?.() },
}).setDomApi(LitDomApi)
