import SavedFilterService, { getSavedFilterIdFromProjectId } from '@/services/savedFilterCore'
import SavedFilterModel from '@/models/savedFilter'
import { View } from 'marionette'
import type { Collection } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render, type TemplateResult } from 'lit-html'
import { repeat } from 'lit-html/directives/repeat.js'
import Sortable from 'sortablejs'
import type { IProject } from '@/modelTypes/IProject'
import type { SessionApplication } from './session'
import ProjectService from '@/services/project'
import UserSettingsService from '@/services/userSettings'
import { getProjectTitle } from '@/helpers/getProjectTitle'
import { calculateItemPosition } from '@/helpers/calculateItemPosition'
import { install, uninstall } from '@/helpers/shortcut'
import { SHORTCUTS } from '@/constants/shortcuts'
import { POWERED_BY } from '@/urls'
import {LogoView} from '@/shared/logo'
import { ProjectMenuView } from '../features/projects/project-cards'
import { listIcon } from '@/shared/task-list/list-ui'
import { interceptLink } from './routes'
import { t } from '../shared/i18n'
import { errorText } from '../shared/notifications'
import './navigation.scss'
interface Options {
    projects: Collection;
    navigate: (href: string) => void;
    session: InstanceType<typeof SessionApplication>;
    admin?: boolean;
    time?: boolean;
    backgroundEnabled?: boolean;
}
export const NavigationView = View.extend({
	initialize(options: Options) { void options }, className: 'menu-container is-active native-navigation',
	events: { 'click [data-collapse]': 'collapse', 'click [data-favorite]': 'favorite', 'mousedown [data-resize]': 'resizeStart', 'touchstart [data-resize]': 'resizeStart' },
	createState() { let open: Record<number, boolean>; try {
		open = JSON.parse(localStorage.getItem('navigation-child-projects-open') ?? '{}')
	}
	catch {
		open = {}
	} ; return { life: new AbortController(), open, busy: new Set<number>(), errors: new Map<number, string>(), menus: new Set<string>(), sortables: [] as Sortable[], taskDrag: false, taskDragMove: (event: MouseEvent) => this.taskDragMove(event), widthTail:Promise.resolve() as Promise<void>,width: 300, resizing: false, userSelect: '', cursor: '', path: location.pathname, projectId: 0, drag: undefined as {
            parent: HTMLElement;
            next: Node | null;
        } | undefined, resizeMove: (event: MouseEvent | TouchEvent) => this.resizeMove(event), resizeStop: () => this.resizeStop() } },
	template: () => html `<div data-navigation-content></div><div class="resize-handle" data-resize></div>`,
	projects() { return this.options.projects.models.map(model => model.get('project') as IProject).sort((a, b) => a.position - b.position) },
	onRender() { this.publish() },
	onAttach() { this.listenTo(this.options.projects, { update: () => this.publish(), change: () => this.publish() }); this.listenTo(this.options.session, 'profile:changed', () => this.syncWidth()); this.syncWidth(); for (const [name, path] of Object.entries({ overview: '/', upcoming: '/tasks/by', projects: '/projects', labels: '/labels', teams: '/teams' })) {
		const link = this.el.querySelector<HTMLAnchorElement>(`a[href="${path}"]`)!
		install(link, SHORTCUTS.navigation[name as keyof typeof SHORTCUTS.navigation])
	} },
	onRouteUpdated(path: string, projectId: number) { this.updateRoute(path, projectId) },
	updateRoute(path: string, projectId: number) { this.getState().path = path; this.getState().projectId = projectId; this.publish() },
	publish() { const state = this.getState(), all = this.projects(), visible = all.filter(p => !p.isArchived), ids = new Set(all.map(p => p.id)); state.sortables.forEach(sortable => sortable.destroy()); state.sortables = []; const top = (path: string, key: string, icon: string) => html `<li><a href=${path} class=${state.path === path ? 'router-link-exact-active' : ''} @click=${(event: MouseEvent) => interceptLink(event, this.options.navigate)}><span class="menu-item-icon icon">${listIcon(icon, icon === 'calendar-alt')}</span>${t(key)}</a></li>`; render(html `${state.errors.has(0) ? html `<div class="message danger" role="alert">${state.errors.get(0)}</div>` : nothing}<nav class="menu top-menu" aria-label=${t('navigation.main')}><a class="logo" href="/" aria-label=${t('navigation.home')} @click=${(event: MouseEvent) => interceptLink(event, this.options.navigate)}><div data-navigation-logo></div></a><menu class="menu-list other-menu-items">${top('/', 'navigation.overview', 'calendar')}${top('/tasks/by', 'navigation.upcoming', 'calendar-alt')}${top('/projects', 'project.projects', 'layer-group')}${top('/labels', 'label.title', 'tags')}${top('/teams', 'team.title', 'users')}${this.options.time ? top('/time-tracking', 'timeTracking.title', 'clock') : nothing}${this.options.admin ? top('/admin', 'admin.title', 'cog') : nothing}</menu></nav>${visible.some(p => p.isFavorite) ? html `<nav class="menu" aria-label=${t('project.pseudo.favorites.title')}>${this.tree(visible.filter(p => p.isFavorite), 'favorites', false, 0, new Set())}</nav>` : nothing}${visible.some(p => p.id < -1) ? html `<nav class="menu" aria-label=${t('navigation.savedFilters')}>${this.tree(visible.filter(p => p.id < -1).sort((a, b) => a.title.localeCompare(b.title)), 'filters', false, 0, new Set())}</nav>` : nothing}<nav class="menu" aria-label=${t('project.projects')}>${this.tree(visible.filter(p => p.id > 0 && (!p.parentProjectId || !ids.has(p.parentProjectId))), 'projects', true, 0, new Set())}</nav><a class="menu-bottom-link" href=${`${POWERED_BY}&utm_medium=navigation`} target="_blank" rel="noopener">${t('misc.poweredBy')}</a>`, this.el.querySelector('[data-navigation-content]')!); const logoHost = this.el.querySelector<HTMLElement>('[data-navigation-logo]')!; if (!this.hasRegion('logo') || this.getRegion('logo')!.el !== logoHost) { if (this.hasRegion('logo')) this.removeRegion('logo'); this.addRegion('logo', {el: logoHost}); this.showChildView('logo', new LogoView({model: this.options.session.getState()})) }; const current = new Set<string>(); for (const host of this.el.querySelectorAll<HTMLElement>('[data-project-menu-host]')) {
		const key = host.dataset.projectMenuHost!, project = all.find(p => p.id === Number(host.dataset.projectId))!
		current.add(key)
		if (!this.hasRegion(key))
			this.addRegion(key, { el: host })
		if (!this.getChildView(key))
			this.showChildView(key, new ProjectMenuView({ project, navigate: this.options.navigate, backgroundEnabled: this.options.backgroundEnabled }))
		else
			(this.getChildView(key) as InstanceType<typeof ProjectMenuView>).updateProject(project)
	} for (const key of state.menus)
		if (!current.has(key))
			this.removeRegion(key); state.menus = current; for (const menu of this.el.querySelectorAll<HTMLElement>('[data-sortable]'))
		state.sortables.push(new Sortable(menu, { group: 'projects', animation: 100, fallbackOnBody: true, invertSwap: true, swapThreshold: .65, handle: '.handle', draggable: '> .list-menu', filter: '.drag-disabled', onStart: event => { state.drag = { parent: event.from, next: event.item.nextSibling } }, onEnd: event => { const sibling = event.item.previousElementSibling?.getAttribute('data-project-id'), after = event.item.nextElementSibling?.getAttribute('data-project-id'), parentId = Number(event.to.dataset.parentId), id = Number(event.item.dataset.projectId); state.drag?.parent.insertBefore(event.item, state.drag.next); state.drag = undefined; void this.move(id, parentId, Number(sibling) || undefined, Number(after) || undefined) } })) },
	tree(projects: IProject[], section: string, recursive: boolean, parentId: number, ancestors: Set<number>): TemplateResult { return html `<menu class="menu-list can-be-hidden ${recursive ? '' : 'dragging-disabled'}" data-parent-id=${parentId} data-sortable=${recursive ? true : nothing}>${repeat(projects, p => p.id, project => { if (ancestors.has(project.id))
		return nothing; const state = this.getState(), children = recursive ? this.projects().filter(p => p.parentProjectId === project.id && !p.isArchived) : [], open = state.open[project.id] ?? true, write = Number(project.maxPermission) > 0, next = new Set([...ancestors, project.id]); return html `<li class="list-menu loader-container is-loading-small ${state.busy.has(project.id) ? 'is-loading' : ''} ${write && project.id > 0 ? '' : 'drag-disabled'}" data-project-id=${project.id}><div class="navigation-item">${children.length ? html `<button type="button" class="base-button base-button--type-button collapse-project-button" data-collapse=${project.id} aria-label=${t('navigation.toggleChildProjects')} aria-expanded=${open}>${listIcon(open ? 'chevron-down' : 'chevron-right')}</button>` : nothing}<a class="base-button list-menu-link ${state.projectId === project.id ? 'router-link-exact-active' : ''}" href=${`/projects/${project.id}`} @click=${(event: MouseEvent) => interceptLink(event, this.options.navigate)}>${!children.length ? html `<span class="collapse-project-button-placeholder"></span>` : nothing}<div class="color-bubble-wrapper">${project.hexColor ? html `<span class="color-bubble" style=${`background-color:${project.hexColor}`} aria-label=${t('project.color')}></span>` : project.id < -1 ? listIcon('filter') : nothing}${recursive && write && project.id > 0 ? html `<span class="icon menu-item-icon handle drag-handle" @click=${(event: Event) => event.preventDefault()}>${listIcon('grip-lines')}</span>` : nothing}</div><span class="project-menu-title">${getProjectTitle(project)}</span></a>${(project.id > 0 && write) || project.id < -1 ? html `<button type="button" class="base-button base-button--type-button favorite ${project.isFavorite ? 'is-favorite' : ''}" data-favorite=${project.id} aria-label=${t(project.isFavorite ? 'project.unfavorite' : 'project.favorite')} ?disabled=${state.busy.has(project.id)}>${listIcon('star', !project.isFavorite)}</button>` : nothing}${write ? html `<div class="menu-list-dropdown" data-project-menu-host=${`${section}-${project.id}`} data-project-id=${project.id}></div>` : nothing}</div>${state.errors.has(project.id) ? html `<div role="alert" class="message danger">${state.errors.get(project.id)}</div>` : nothing}${recursive && open ? this.tree(children, section, true, project.id, next) : nothing}</li>` })}</menu>` },
	collapse(event: Event) { const id = Number((event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget.dataset.collapse); this.getState().open[id] = !(this.getState().open[id] ?? true); localStorage.setItem('navigation-child-projects-open', JSON.stringify(this.getState().open)); this.publish() },
	favorite(event: Event) { const id = Number((event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget.dataset.favorite), project = this.projects().find(p => p.id === id); if (project)
		void this.save({ ...project, isFavorite: !project.isFavorite }) },
	async save(project: IProject) { const state = this.getState(); if (state.busy.has(project.id))
		return; state.busy.add(project.id); state.errors.delete(project.id); this.publish(); try {
		let saved: IProject
		if (project.id < -1) {
			const service = new SavedFilterService(), filter = await service.get(new SavedFilterModel({ id: getSavedFilterIdFromProjectId(project.id) }), state.life.signal)
			state.life.signal.throwIfAborted()
			await service.update({ ...filter, isFavorite: project.isFavorite }, state.life.signal)
			saved = project
		}
		else
			saved = await new ProjectService().update(project, state.life.signal)
		state.life.signal.throwIfAborted()
		this.options.projects.get(project.id)?.set('project', saved)
	}
	catch (error) {
		if (!state.life.signal.aborted)
			state.errors.set(project.id, errorText(error))
	}
	finally {
		state.busy.delete(project.id)
		if (!state.life.signal.aborted)
			this.publish()
	} },
	async move(id: number, parentId: number, before?: number, after?: number) { const all = this.projects(), project = all.find(p => p.id === id); if (!project || id <= 0 || Number(project.maxPermission) <= 0)
		return; const target = all.find(p => p.id === parentId); if (parentId && (!target || Number(target.maxPermission) <= 0))
		return; let cursor = target; while (cursor) {
		if (cursor.id === id)
			return
		cursor = all.find(p => p.id === cursor!.parentProjectId)
	} if (!parentId && project.parentProjectId && !all.some(p => p.id === project.parentProjectId))
		parentId = project.parentProjectId; await this.save({ ...project, parentProjectId: parentId, position: calculateItemPosition(all.find(p => p.id === before)?.position ?? null, all.find(p => p.id === after)?.position ?? null) }) },
	setTaskDragging(active: boolean) {
		const state = this.getState()
		if (state.taskDrag === active) return
		state.taskDrag = active
		for (const name of ['mousemove', 'dragover'] as const) {
			if (active) document.addEventListener(name, state.taskDragMove, true)
			else document.removeEventListener(name, state.taskDragMove, true)
		}
		if (!active) this.clearTaskDropTargets()
	},
	clearTaskDropTargets() {
		for (const item of this.el.querySelectorAll('.is-drop-target')) item.classList.remove('is-drop-target')
	},
	taskDragMove(event: MouseEvent) {
		const id = this.projectAtPoint(event), project = this.projects().find(project => project.id === id)
		this.clearTaskDropTargets()
		if (!this.getState().taskDrag || !project || !(Number(project.maxPermission) > 0)) return
		for (const item of this.el.querySelectorAll<HTMLElement>('li[data-project-id]')) {
			if (Number(item.dataset.projectId) === id) item.classList.add('is-drop-target')
		}
	},
	projectAtPoint(event: MouseEvent) { if (!event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
		return null; for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
		if (!this.el.contains(element))
			continue
		const id = Number(element.closest<HTMLElement>('[data-project-id]')?.dataset.projectId)
		if (Number.isInteger(id) && id > 0)
			return id
	} return null },
	syncWidth() { const state = this.getState(); if (!state.resizing)
		state.width = Math.max(200, Math.min(500, this.options.session.getState().get('user')!.settings.frontendSettings.sidebarWidth ?? 300)); this.applyWidth() },
	applyWidth() { const value = `${this.getState().width}px`; (this.el as HTMLElement).style.setProperty('--sidebar-width', value); this.el.closest('.native-content-auth')?.querySelector<HTMLElement>('.app-content')?.style.setProperty('--sidebar-width', value) },
	resizeStart(event: MouseEvent | TouchEvent) { if (window.innerWidth <= 768)
		return; event.preventDefault(); const state = this.getState(); state.resizing = true; state.userSelect = document.body.style.userSelect; state.cursor = document.body.style.cursor; document.body.style.userSelect = 'none'; document.body.style.cursor = 'ew-resize'; this.el.classList.add('is-resizing'); document.addEventListener('mousemove', state.resizeMove); document.addEventListener('mouseup', state.resizeStop); document.addEventListener('touchmove', state.resizeMove); document.addEventListener('touchend', state.resizeStop) },
	resizeMove(event: MouseEvent | TouchEvent) { const x = 'touches' in event ? event.touches[0]?.clientX : event.clientX; if (x === undefined)
		return; this.getState().width = Math.max(200, Math.min(500, document.dir === 'rtl' ? window.innerWidth - x : x)); this.applyWidth() },
	resizeStop(save = true) { const state = this.getState(); if (!state.resizing)
		return; state.resizing = false; document.body.style.userSelect = state.userSelect; document.body.style.cursor = state.cursor; this.el.classList.remove('is-resizing'); document.removeEventListener('mousemove', state.resizeMove); document.removeEventListener('mouseup', state.resizeStop); document.removeEventListener('touchmove', state.resizeMove); document.removeEventListener('touchend', state.resizeStop); if (save)
		void this.saveWidth() },

	saveWidth(){const state=this.getState(),session=this.options.session,width=state.width,user=session.getState().get('user')!;const save=state.widthTail.then(async()=>{state.life.signal.throwIfAborted();const settings={...user.settings,frontendSettings:{...user.settings.frontendSettings,sidebarWidth:width}};try{await new UserSettingsService().update(settings,state.life.signal);state.life.signal.throwIfAborted();user.settings=settings;if(state.width===width){state.errors.delete(0);session.trigger('profile:changed')}}catch(error){if(!state.life.signal.aborted&&state.width===width){state.errors.set(0,errorText(error));this.syncWidth();this.publish()}}});state.widthTail=save.catch(()=>{});return save},
	onBeforeDestroy() { const state = this.getState(); this.resizeStop(false); this.setTaskDragging(false); state.life.abort(); state.sortables.forEach(sortable => sortable.destroy()); for (const link of this.el.querySelectorAll<HTMLElement>('.top-menu a'))
		uninstall(link) },
}).setDomApi(LitDomApi)
