import { View } from 'marionette'
import {computePosition, autoPlacement, offset, shift} from '@floating-ui/dom'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, type TemplateResult } from 'lit-html'
import type { IProject } from '@/modelTypes/IProject'
import { isSavedFilter } from '@/services/savedFilterCore'
import { getProjectTitle } from '@/helpers/getProjectTitle'
import { interceptLink } from '../../app/routes'
import { t } from '../../shared/i18n'
import { listIcon } from '@/shared/task-list/list-ui'
import './project-management.scss'

export const ProjectCardsView = View.extend({
	initialize(options: {
		projects: IProject[];
		navigate: (href: string) => void;
		favorite?: (project: IProject) => void;
		even?: boolean;
	}) {
		void options
	},
	templateContext() {
		return this.options
	},
	template({
		projects,
		navigate,
		favorite,
		even,
	}: {
		projects: IProject[];
		navigate: (href: string) => void;
		favorite?: (project: IProject) => void;
		even?: boolean;
	}) {
		return html`<ul
			class="project-grid ${even ? 'show-even-number-of-projects' : ''}"
		>
			${projects.map(
		(project) =>
			html`<li class="project-grid-item">
						<div
							class="project-card"
							style=${project.hexColor
		? `border-inline-start:.25rem solid ${project.hexColor}`
		: ''}
						>
							${project.isArchived
		? html`<span class="is-archived"
										>${t('project.archived')}</span
									>`
		: nothing}
							<div class="project-title" aria-hidden="true">
								${getProjectTitle(project)}
							</div>
							<a
								class="base-button project-button"
								href=${`/projects/${project.id}`}
								aria-label=${project.title}
								@click=${(event: MouseEvent) => interceptLink(event, navigate)}
							></a
							>${favorite && !project.isArchived && project.id > 0
		? html`<button
										type="button"
										class="base-button favorite ${project.isFavorite
		? 'is-favorite'
		: ''}"
										aria-label=${t(
		project.isFavorite
			? 'project.unfavorite'
			: 'project.favorite',
	)}
										@click=${() => favorite(project)}
									>
										${listIcon('star', !project.isFavorite)}
									</button>`
		: nothing}
						</div>
					</li>`,
	)}
		</ul>`
	},
}).setDomApi(LitDomApi)

export const ProjectMenuView = View.extend({
	className: 'native-project-menu native-list-frame',
	ui: { menu: 'details', trigger: 'summary', popup: '.dropdown-menu' } as Record<string, string | ArrayLike<Element>>,
	createState() {return {outside: (event: MouseEvent) => {if (!this.el.contains(event.target as Node)) this.closeMenu()}}},
	onAttach() {document.addEventListener('click', this.getState().outside)},
	onBeforeDestroy() {document.removeEventListener('click', this.getState().outside)},
	closeMenu() {const menu = this.ui.menu; if (typeof menu !== 'string') menu?.[0]?.removeAttribute('open')},
	async positionMenu() {
		const details = this.getUI('menu')![0] as HTMLDetailsElement, popup = this.getUI('popup')![0] as HTMLElement
		if (!details.open) return
		const {x, y} = await computePosition(details, popup, {placement: 'bottom-end', strategy: 'absolute', middleware: [offset(4), autoPlacement({allowedPlacements: ['bottom-end', 'top-end', 'bottom-start', 'top-start'], padding: 8}), shift({padding: 8})]})
		if (this.isDestroyed() || !details.open || !popup.isConnected) return
		Object.assign(popup.style, {left: `${x}px`, top: `${y}px`}); popup.style.setProperty('--hover-offset', '4px')
	},
	initialize(options: { project: IProject; backgroundEnabled?: boolean; beforeDelete?: TemplateResult; navigate: (href: string) => void }) {
		void options
	},
	templateContext() {
		return {
			project: this.options.project,
			backgroundEnabled: this.options.backgroundEnabled,
			positionMenu: () => this.positionMenu(),
			key: (event: KeyboardEvent) => {if (event.key === 'Escape') {event.stopPropagation(); this.closeMenu(); (this.getUI('trigger')![0] as HTMLElement).focus()}},
			navigate: (href: string) => {
				(this.getUI('menu')![0] as HTMLDetailsElement).open = false;
				(this.getUI('trigger')![0] as HTMLElement).focus()
				this.options.navigate(href)
			},
		}
	},
	updateProject(project: IProject) {
		const changed =
			project.maxPermission !== this.options.project.maxPermission ||
			project.isArchived !== this.options.project.isArchived
		this.options.project = project
		if (changed) this.render()
	},
	template({
		project,
		navigate,
		backgroundEnabled,
		beforeDelete,
		positionMenu,
		key,
	}: {
		project: IProject;
		backgroundEnabled?: boolean;
		beforeDelete?: TemplateResult;
		navigate: (href: string) => void;
		positionMenu?: () => void;
		key?: (event: KeyboardEvent) => void;
	}) {
		const link = (page: string, label: string) =>
			html`<a
				class="dropdown-item"
				href=${`/projects/${project.id}/${page}`}
				@click=${(event: MouseEvent) => interceptLink(event, navigate)}
				>${t(label)}</a
			>`
		return html`<details class="dropdown project-dropdown" @toggle=${positionMenu} @keydown=${key} >
			<summary
				class="base-button base-button--type-button project-title-button"
				role="button"
				aria-label=${t('project.openSettingsMenu')}
			>
				${listIcon('ellipsis-h')}
			</summary>
			<div class="dropdown-menu">
				<div class="dropdown-content">
					${isSavedFilter(project)
		? html`${link('settings/edit', 'menu.edit')}${link(
			'settings/views',
			'menu.views',
		)}${link('settings/delete', 'misc.delete')}`
		: html`${link('settings/duplicate', 'menu.duplicate')}${Number(project.maxPermission) > 0 && !project.isArchived
			? html`${link('settings/edit', 'project.edit.header')}${backgroundEnabled?link('settings/background', 'menu.setBackground'):nothing}`
			: nothing}${Number(project.maxPermission) > 1
			? html`${link('settings/share', 'menu.share')}${link(
				'settings/views',
				'project.views.header',
			)}${link('new', 'project.create.header')}${link(
				'settings/archive',
				project.isArchived
					? 'project.archive.unarchive'
					: 'project.archive.archive',
			)}${beforeDelete??nothing}${link('settings/delete', 'project.delete.header')}`
			: nothing}`}
				</div>
			</div>
		</details>`
	},
}).setDomApi(LitDomApi)
