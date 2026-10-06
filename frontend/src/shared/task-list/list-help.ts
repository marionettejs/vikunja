import {View, type ViewInstance} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {PREFIXES} from '@/modules/quickAddMagic/prefixes'
import type {ListContext} from './list-context'
import {listIcon} from './list-ui'

export const HintDialogView = View.extend({
	ui: {'dialog': 'dialog'},
	className: 'native-list-surface native-list-help',
	regions: {content: '[data-dialog-content]'},
	initialize(options: {context: Pick<ListContext,'t'|'quickAddMode'>, content?: ViewInstance<object>, ariaLabel?: string}) { void options },
	createState() { return {previous: document.activeElement as HTMLElement | null, overflow: document.body.style.overflow,
		closeTimer: undefined as ReturnType<typeof setTimeout> | undefined, beforePrint: () => this.beforePrint(), afterPrint: () => this.afterPrint(), wasModal: false} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const ctx = this.options.context, t = ctx.t, prefixes = PREFIXES[ctx.quickAddMode()]!
		const paragraph = (...keys: string[]) => html`<p>${keys.map(key => t(`task.quickAddMagic.${key}`, {prefix: prefixes[key.startsWith('label') ? 'label' : key.startsWith('project') ? 'project' : key.startsWith('priority') ? 'priority' : 'assignee']})).join(' ')}</p>`
		return html`<dialog class="modal-dialog has-overflow hint-modal" aria-label=${this.options.ariaLabel || nothing} @cancel=${(event: Event) => { event.preventDefault(); this.close() }}>
			<div class="modal-container" @mousedown=${(event: MouseEvent) => { if (event.target === event.currentTarget) { event.preventDefault(); event.stopPropagation(); this.close() } }}>
				<button type="button" class="base-button base-button--type-button close d-print-none" aria-label=${t('misc.closeDialog')} @click=${() => this.close()}>${listIcon('times')}</button>
				<div class="modal-content has-overflow">${this.options.content ? html`<div data-dialog-content></div>` : html`<div class="card has-no-shadow"><header class="card-header"><p class="card-header-title">${t('task.quickAddMagic.title')}</p><button type="button" class="base-button base-button--type-button card-header-icon close" aria-label=${t('misc.close')} @click=${() => this.close()}><span class="icon">${listIcon('times')}</span></button></header>
				<div class="card-content loader-container"><div class="content"><p>${t('task.quickAddMagic.intro')}</p>
					<h3>${t('task.attributes.labels')}</h3>${paragraph('label1', 'label2', 'multiple')}${paragraph('label3', 'label4')}
					<h3>${t('task.attributes.priority')}</h3>${paragraph('priority1', 'priority2')}
					<h3>${t('task.attributes.assignees')}</h3>${paragraph('assignees', 'multiple')}
					<h3>${t('quickActions.projects')}</h3>${paragraph('project1', 'project2')}${paragraph('project3', 'project4')}
					<h3>${t('task.quickAddMagic.dateAndTime')}</h3>${paragraph('date')}
					<ul>${['Today', 'Tonight', 'Tomorrow', 'Next monday', 'This weekend', 'Later this week', 'Later next week', 'Next week', 'Next month', 'End of month', 'In 5 days [hours/weeks/months]', `Tuesday (${t('task.quickAddMagic.dateWeekday')})`, '02/17/2021', '2021-02-17', '17.02.2021', `Feb 17 (${t('task.quickAddMagic.dateCurrentYear')})`, `17th (${t('task.quickAddMagic.dateNth', {day: '17'})})`].map(value => html`<li>${value}</li>`)}</ul>
					<p>${t('task.quickAddMagic.dateTime', {time: 'at 17:00', timePM: '5pm'})}</p>
					<h3>${t('task.quickAddMagic.repeats')}</h3><p>${t('task.quickAddMagic.repeatsDescription', {suffix: 'every {amount} {type}'})}</p><p>${t('misc.forExample')}</p>
					<ul>${['Every day', 'Every 3 days', 'Every week', 'Every 2 weeks', 'Every month'].map(value => html`<li>${value}</li>`)}</ul>
				</div></div></div>`}</div>
			</div></dialog>`
	},
	onAttach() { (this.getUI('dialog')![0] as HTMLDialogElement)!.showModal(); if (this.options.content) this.showChildView('content', this.options.content); document.body.style.overflow = 'hidden'; window.addEventListener('beforeprint', this.getState().beforePrint); window.addEventListener('afterprint', this.getState().afterPrint) },
	close() { if (this.getState().closeTimer) return; (this.getUI('dialog')![0] as HTMLDialogElement)!.dataset.closing = ''; document.body.style.overflow = this.getState().overflow; this.getState().closeTimer = setTimeout(() => this.destroy(), 150) },
	beforePrint() { const dialog = (this.getUI('dialog')![0] as HTMLDialogElement)!; this.getState().wasModal = dialog.matches(':modal'); if (this.getState().wasModal) { dialog.close(); dialog.show() } },
	afterPrint() { const dialog = (this.getUI('dialog')![0] as HTMLDialogElement)!; if (this.getState().wasModal && dialog.open) { dialog.close(); dialog.showModal() } },
	onBeforeDestroy() { clearTimeout(this.getState().closeTimer); (this.getUI('dialog')![0] as HTMLDialogElement)?.close(); document.body.style.overflow = this.getState().overflow; window.removeEventListener('beforeprint', this.getState().beforePrint); window.removeEventListener('afterprint', this.getState().afterPrint); if (this.getState().previous?.isConnected) this.getState().previous!.focus() },
}).setDomApi(LitDomApi)

export const ListHelpView = HintDialogView
