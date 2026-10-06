import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, render} from 'lit-html'
import {getHexColor} from '@/models/task'
import type {TaskRecordSession} from '@/features/task/task-record'
import type {TaskPorts} from './application'
import type {TaskActionsApplication} from './task-actions-application'
import {ConfirmationView} from '../projects/project-sharing'
import {errorText, reportError} from '../../shared/notifications'
import {install, uninstall} from '@/helpers/shortcut'
import {SHORTCUTS} from '@/constants/shortcuts'
import {AUTH_TYPES} from '@/modelTypes/IUser'
import {listIcon} from '@/shared/task-list/list-ui'
import {t} from '../../shared/i18n'
import {getDisplayName} from '@/models/user'
import {formatISO, formatDateLong, displayDate} from '../../shared/dates'
export const TaskActionsView = View.extend({
	className: 'native-task-actions',
	regions: { confirmation: '[data-confirmation]' },
	ui: { toggles: '[data-toggle]', fields: '[data-fields]', buttons:'[data-action]', error:'[data-action-error]' },
	initialize(options: {
        record: TaskRecordSession;
        workflow: InstanceType<typeof TaskActionsApplication>;
        timeTracking?: boolean;
        ports: TaskPorts;
        active: (field: string) => void;
    }) {
		void options
		this.listenTo(options.workflow, 'deleted', () => this.getRegion('confirmation')!.empty())
		this.listenTo(options.workflow,'busy:changed',this.busyChanged)
	},
	createState() {
		return { life: new AbortController(), busy: false,restoreFocus:undefined as string|undefined }
	},
	template: () => html `<div data-toggle></div>
			<span class="action-heading">${t('task.detail.organization')}</span>
			<div data-fields></div><div data-confirmation></div><div data-action-error class="message danger" role="alert" hidden></div>`,
	updateTask() { this.onRender() },
	onRender() {
		const focus = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-action]')
		const focused = this.el.contains(focus??null) ? focus?.dataset.action : undefined
		for (const button of Array.from(this.getUI('buttons') ?? []) as HTMLElement[])
			uninstall(button)
		const shortcuts=Number(this.options.record.task.maxPermission)>0&&!this.getChildView('confirmation')
		const task = this.options.record.task, host = (this.getUI('toggles')![0] as HTMLElement)!
		host.replaceChildren()
		const done = document.createElement('button')
		done.className = `base-button base-button--type-button button is-outlined button--mark-done ${task.done ? '' : 'is-pending'}`
		render(html `<span class="icon">${listIcon('check-double')}</span>${t(task.done ? 'task.detail.undone' : 'task.detail.done')}`, done)
		done.disabled = this.getState().busy
		done.onclick = () => {
			void this.toggle('done')
		}
		done.dataset.action = 'done'
		if(shortcuts)install(done, SHORTCUTS.taskDetail.done)
		host.append(done)
		if (this.options.ports.user().type !== AUTH_TYPES.LINK_SHARE) {
			const button = document.createElement('button')
			button.type = 'button'
			button.dataset.action = 'subscribe'
			button.className = 'base-button button is-outlined'
			button.disabled = this.getState().busy
			render(html `<span class="icon">${listIcon(task.subscription ? 'bell-slash' : 'bell')}</span>${t(task.subscription ? 'task.subscription.unsubscribe' : 'task.subscription.subscribe')}`, button)
			button.onclick = () => void this.run('subscribe')
			host.append(button)
		}
		const favorite = document.createElement('button')
		favorite.className =
            'base-button base-button--type-button button is-outlined'
		const favoriteLabel = t(task.isFavorite
			? 'task.detail.actions.unfavorite'
			: 'task.detail.actions.favorite')
		render(html `<span class="icon">${listIcon('star', !task.isFavorite)}</span>${favoriteLabel}`, favorite)
		favorite.disabled = this.getState().busy
		favorite.onclick = () => {
			void this.toggle('isFavorite')
		}
		favorite.dataset.action = 'favorite'
		if(shortcuts)install(favorite, SHORTCUTS.taskDetail.favorite)
		host.append(favorite)
		const fields = (this.getUI('fields')![0] as HTMLElement)!
		let dateHeading: HTMLElement | undefined
		fields.replaceChildren()
		for (const [field, label, icon] of [
			['labels', 'label', 'tags'],
			['priority', 'priority', 'exclamation-circle'],
			['percentDone', 'percentDone', 'percent'],
			['color','color','fill-drip'],
			['assignees', 'assign', 'users'],
			['attachments', 'attachments', 'paperclip'],
			['relatedTasks', 'relatedTasks', 'sitemap'],
			['moveProject','moveProject','list'],
			...(this.options.timeTracking ? [['timeTracking', 'timeTracking', 'clock']] : []),
			['dueDate', 'dueDate', 'calendar'],
			['startDate', 'startDate', 'play'],
			['endDate', 'endDate', 'stop'],
			['reminders', 'reminders', 'bell'],
			['repeatAfter', 'repeatAfter', 'history'],
		]) {
			if (field === 'assignees' || field === 'dueDate') {
				const heading = document.createElement('span')
				heading.className = 'action-heading'
				heading.textContent = t(field === 'assignees' ? 'task.detail.management' : 'task.detail.dateAndTime')
				fields.append(heading)
				if (field === 'dueDate') dateHeading = heading
			}
			const element = document.createElement('button')
			element.className =
                'base-button base-button--type-button button is-outlined'
			render(html `<span class="icon" style=${field === 'color' ? `color:${getHexColor(task.hexColor) ?? ''}` : ''}>${listIcon(icon as 'calendar')}</span>${t(`task.detail.actions.${label}`)}`, element)
			element.dataset.action = field
			const shortcut = SHORTCUTS.taskDetail[field === 'reminders' ? 'reminder' : field as keyof typeof SHORTCUTS.taskDetail]
			if (shortcut&&shortcuts)
				install(element, shortcut)
			element.onclick = () => this.options.active(field)
			fields.append(element)
		}
		for (const action of ['duplicate', 'delete'] as const) {
			const button = document.createElement('button')
			button.type = 'button'
			button.dataset.action = action
			button.className = `base-button button is-outlined ${action === 'delete' ? 'is-danger has-text-danger has-no-border has-no-shadow' : ''}`
			button.disabled = this.getState().busy
			render(html `<span class="icon">${listIcon(action === 'delete' ? 'trash-alt' : 'copy')}</span>${t(`task.detail.actions.${action}`)}`, button)
			button.onclick = () => action === 'delete' ? this.confirmDelete() : void this.run(action)
			if (action === 'delete'&&shortcuts)
				install(button, SHORTCUTS.taskDetail.delete)
			if (action === 'duplicate') fields.insertBefore(button, dateHeading ?? null)
			else fields.append(button)
		}
		const metadata = document.createElement('p')
		metadata.className = 'created'
		const displayed = (value: Date) => displayDate(value, this.options.ports.user().settings.frontendSettings)
		const date = (value: Date, text: string) => html`<time datetime=${formatISO(value)} title=${formatDateLong(value)}>${text}</time>`
		render(html`${date(task.created, t('task.detail.created', [displayed(task.created), getDisplayName(task.createdBy)]))}${+task.created !== +task.updated ? html`<br>${date(task.updated, t('task.detail.updated', [displayed(task.updated)]))}` : ''}${task.done && task.doneAt ? html`<br>${date(task.doneAt, t('task.detail.doneAt', [displayed(task.doneAt)]))}` : ''}`, metadata)
		fields.append(metadata)
		this.bindUIElements()
		if (focused && !this.getChildView('confirmation'))
			(Array.from(this.getUI('buttons') ?? []) as HTMLElement[]).find(button => button.dataset.action === focused)?.focus()
	},
	feedback(error?: unknown) { const element = this.getUI('error')![0] as HTMLElement; element.hidden = !error; element.textContent = error ? errorText(error) : '' },
	confirmDelete(){
		if(this.getState().busy)return
		const request=new AbortController()
		for(const button of Array.from(this.getUI('buttons') ?? []) as HTMLElement[])uninstall(button)
		this.showChildView('confirmation',new ConfirmationView({
			title:t('task.detail.delete.header'),
			text:`${t('task.detail.delete.text1')} ${t('task.detail.delete.text2')}`,
			close:()=>{request.abort();this.getState().restoreFocus='delete';this.getRegion('confirmation')!.empty();this.onRender();if(!this.getState().busy)this.restoreFocus()},
			submit:()=>void this.run('delete',request.signal),
		}))
	},
	restoreFocus(){const action=this.getState().restoreFocus;this.getState().restoreFocus=undefined;if(action&&document.activeElement===document.body)(Array.from(this.getUI('buttons') ?? []) as HTMLElement[]).find(button => button.dataset.action === action)?.focus()},
	busyChanged(busy: boolean) {
		this.getState().busy = busy
		this.onRender()
		;(this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.loading(busy)
	},
	async run(action: 'subscribe' | 'duplicate' | 'delete', signal?: AbortSignal) {
		const state = this.getState(), focused = this.el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.action : undefined
		if (state.busy || Number(this.options.record.task.maxPermission) <= 0) return
		this.feedback()
		const dialog = this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined
		try { await this.options.workflow.run(action,state.life.signal,signal) }
		catch (error) { if (!state.life.signal.aborted && !signal?.aborted) {if (dialog && !dialog.isDestroyed()) dialog.feedback(error); else this.feedback(error)} }
		finally {
			if (!state.life.signal.aborted) {
				state.restoreFocus ??= focused
				this.restoreFocus()
			}
		}
	},
	async toggle(field: 'done' | 'isFavorite') {
		const state = this.getState()
		if (state.busy || Number(this.options.record.task.maxPermission) <= 0)
			return
		state.busy = true
		this.onRender()
		try {
			await this.options.record.save({ [field]: !this.options.record.task[field] }, state.life.signal)
		}
		catch (error) {
			if (!state.life.signal.aborted)
				reportError(error)
		}
		finally {
			state.busy = false
			if (!state.life.signal.aborted)
				this.onRender()
		}
	},
	onBeforeDestroy() {
		this.getState().life.abort()
		for (const button of Array.from(this.getUI('buttons') ?? []) as HTMLElement[])
			uninstall(button)
	},
}).setDomApi(LitDomApi)
