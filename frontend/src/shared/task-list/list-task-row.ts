import {View, Region, type RegionInstance, type ViewConfiguration} from 'marionette'
import {DataApi, type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import flatpickr from 'flatpickr'
import type {Instance as FlatpickrInstance} from 'flatpickr/dist/types/instance'
import {computePosition, flip, offset, shift} from '@floating-ui/dom'
import type {ITask} from '@/modelTypes/ITask'
import {getHexColor, getTaskIdentifier} from '@/models/task'
import {getDisplayName, fetchAvatarBlobUrl} from '@/models/user'
import {formatISO, formatDateLong} from '@/shared/dates'
import {isEditorContentEmpty} from '@/helpers/editorContentEmpty'
import {getChecklistStatistics} from '@/helpers/checklistFromText'
import {getTopLayerContainer} from '@/helpers/getTopLayerContainer'
import {getLabelColor} from '@/composables/useLabelStyles'
import {getTextColor} from '@/helpers/color/getTextColor'
import {TASK_REPEAT_MODES} from '@/types/IRepeatMode'
import {setModuleLoading} from '@/stores/helper'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import type {ListContext} from './list-context'
import {listIcon, button} from './list-ui'

export function labels(task: ITask, extra = '') {
	const values = Array.from(new Map(task.labels.map(label => [label.id, label])).values()).sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
	return values.length ? html`<div class="label-wrapper ${extra}">${values.map(label => { const color = getLabelColor(label); return html`<span class="tag" style=${`background:${color || 'var(--grey-200)'};color:${color ? getTextColor(color) : 'var(--grey-800)'}`}><span>${label.title}</span></span>` })}</div>` : nothing
}
function comments(task: ITask, ctx: Pick<ListContext, 't' | 'displayDate'>, extra = '') {
	return (task.commentCount ?? 0) > 0 ? html`<span class="comment-count ${task.isUnread ? 'is-unread' : ''} ${extra}" role="img" aria-label=${ctx.t('task.attributes.comment', task.commentCount)} title=${ctx.t('task.attributes.comment', task.commentCount)}>${listIcon('comments', true)}<span class="comment-count-badge">${task.commentCount}</span>${task.isUnread ? html`<span class="unread-indicator"></span>` : nothing}</span>` : nothing
}
export function checklist(task: ITask, ctx: Pick<ListContext, 't' | 'displayDate'>, extra = '') {
	const stats = getChecklistStatistics(task.description)
	if (!stats.total) return nothing
	const done = stats.checked === stats.total
	return html`<span class="checklist-summary ${extra}"><svg width="12" height="12" class=${done ? 'is-all-done' : ''}><circle stroke-width="2" fill="transparent" cx="50%" cy="50%" r="5"></circle><circle stroke-width="2" stroke-dasharray="31" stroke-dashoffset=${(1 - stats.checked / stats.total) * Math.PI * 10} stroke-linecap="round" fill="transparent" cx="50%" cy="50%" r="5"></circle></svg><span>${ctx.t(done ? 'task.checklistAllDone' : 'task.checklistTotal', {...stats})}</span></span>`
}
function repeating(task: ITask) { const amount = typeof task.repeatAfter === 'number' ? task.repeatAfter : task.repeatAfter.amount; return amount > 0 || (amount === 0 && task.repeatMode === TASK_REPEAT_MODES.REPEAT_MODE_MONTH) }

function waitForDoneAnimation(signal: AbortSignal): Promise<void> {
	if (signal.aborted) return Promise.resolve()
	return new Promise(resolve => {
		const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
		const timer = setTimeout(finish, 300)
		signal.addEventListener('abort', finish, {once: true})
	})
}

export const TaskGlanceView = View.extend({
	ui: {'tooltip': '.task-glance-tooltip'},
	className: 'native-list-surface', attributes: {style: 'display:contents'},
	initialize(options: {context: Pick<ListContext, 't' | 'displayDate'>, task: ITask, id: string, trigger: HTMLElement}) { void options },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const {task, context: ctx} = this.options
		const createdDate = ctx.displayDate(task.created)
		const [createdBefore, createdAfter] = ctx.t('task.detail.created', ['\uFFFC', getDisplayName(task.createdBy)]).split('\uFFFC')
		const text = isEditorContentEmpty(task.description) ? '' : (new DOMParser().parseFromString(task.description, 'text/html').body.textContent || '').trim()
		return html`<div id=${this.options.id} class="task-glance-tooltip" role="tooltip"><div class="task-glance-content">
			<div class="task-glance-header"><div class="task-glance-title-section"><span class="task-identifier">${getTaskIdentifier(task)}</span><span class="task-title">${task.title}</span></div><div class="task-glance-indicators">${task.attachments.length ? html`<span class="task-glance-icon">${listIcon('paperclip')}</span>` : nothing}${comments(task, ctx, 'task-glance-icon')}</div></div>
			${text ? html`<div class="task-glance-description">${text.length > 150 ? text.substring(0, 150) + '…' : text}</div>` : nothing}
			${checklist(task, ctx, 'task-glance-checklist-summary')}${labels(task, 'task-glance-labels')}
			${task.dueDate ? html`<div class="task-glance-due">${listIcon('calendar')}<span>${ctx.t('task.detail.due', {at: ctx.displayDate(task.dueDate)})}</span></div>` : nothing}
			<div class="task-glance-meta"><div class="task-glance-created">${createdBefore}<span>${createdDate}</span>${createdAfter}</div></div>
		</div></div>`
	},
	async onAttach() {
		const popup = (this.getUI('tooltip')![0] as HTMLElement)!
		const position = await computePosition(this.options.trigger, popup, {strategy: 'absolute', placement: 'top', middleware: [offset(8), flip({fallbackPlacements: ['bottom', 'top-start', 'top-end', 'bottom-start', 'bottom-end'], padding: 8}), shift({padding: 8})]})
		if (!this.isDestroyed()) Object.assign(popup.style, {left: `${position.x}px`, top: `${position.y}px`})
	},
}).setDomApi(LitDomApi)

const DeferTaskView = View.extend({
	ui: {'date': '[data-date]', container: '.defer-task'},
	className: 'popup is-open',
	initialize(options: {context: ListContext, task: ITask, save: (date: Date) => Promise<void>}) { void options },
	createState() { return {date: this.options.task.dueDate, last: +new Date(this.options.task.dueDate!), picker: undefined as FlatpickrInstance | undefined, timer: undefined as ReturnType<typeof setInterval> | undefined,
		outside: (event: MouseEvent) => { if (!this.el.contains(event.target as Node) && !(event.target as HTMLElement)?.closest('.dueDate')) this.trigger('close') },
		escape: (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && this.el.contains(event.target as Node)) { event.preventDefault(); this.trigger('close') } }} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const ctx = this.options.context
		return html`<div class="defer-task loading-container" @click=${(event: Event) => event.stopPropagation()} @pointerdown=${(event: Event) => event.stopPropagation()} @mousedown=${(event: Event) => event.stopPropagation()} @touchstart=${(event: Event) => event.stopPropagation()}>
			<label class="label">${ctx.t('task.deferDueDate.title')}</label><div class="defer-days">${[1, 3, 7].map(days => button(ctx.t(`task.deferDueDate.${days === 7 ? '1week' : `${days}day${days === 1 ? '' : 's'}`}`), () => { const date = new Date(this.getState().date!); date.setDate(date.getDate() + days); this.getState().date = date; this.getState().picker?.setDate(date); void this.save() }, 'secondary'))}</div>
			<input class="input" data-date>
		</div>`
	},
	onAttach() {
		this.getState().picker = flatpickr((this.getUI('date')![0] as HTMLInputElement)!, {...this.options.context.flatpickrOptions(), defaultDate: this.getState().date!, onChange: dates => { this.getState().date = dates[0] ?? null }})
		this.getState().timer = setInterval(() => void this.save(), 1000)
		document.addEventListener('click', this.getState().outside); document.addEventListener('keydown', this.getState().escape)
	},
	async save() {
		const state = this.getState(), date = state.date
		if (!date || +date === state.last) return
		state.last = +date
		try { await this.options.save(date) } catch { state.last = +new Date(this.options.task.dueDate!) }
	},
	onBeforeDestroy() { void this.save(); clearInterval(this.getState().timer); this.getState().picker?.destroy(); document.removeEventListener('click', this.getState().outside); document.removeEventListener('keydown', this.getState().escape) },
}).setDomApi(LitDomApi)

interface Options extends ViewConfiguration {model: Model, context: ListContext, allTasks: () => ITask[], canWrite: boolean, draggable?: boolean, showProject?: boolean}
export const ListTaskRowView = View.extend({
	ui: {taskNodes: '[data-task-id]', avatars: '[data-avatar]', times: 'time'},
	initialize(options: Options) { void options },
	modelEvents: {change: 'updateRow'},
	createState() { return {task: this.options.model.get('task') as ITask, overrides: new Map<number, Partial<ITask>>(), requests: new Map<number, AbortController>(), loading: new Set<number>(), life: new AbortController(), avatars: new Map<string, string>(), avatarRequests: new Set<string>(),
		glance: undefined as RegionInstance | undefined, hover: undefined as ReturnType<typeof setTimeout> | undefined, described: null as HTMLElement | null,
		due: undefined as RegionInstance | undefined, dueTask: 0, minute: undefined as ReturnType<typeof setInterval> | undefined,
		escape: (event: KeyboardEvent) => { if (event.key === 'Escape' && this.getState().glance) { event.stopPropagation(); event.preventDefault(); this.hideGlance() } }} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing { return this.taskMarkup(this.getState().task, false, new Set()) },
	taskMarkup(source: ITask, nested: boolean, ancestors: Set<number>): TemplateResult {
		const state = this.getState(), ctx = this.options.context, task = {...source, ...state.overrides.get(source.id)}
		const overdue = !task.done && task.dueDate && +task.dueDate > 0 && +task.dueDate <= Date.now()
		const names = ['unset', 'low', 'medium', 'high', 'urgent', 'doNow']
		const priority = !task.done && task.priority >= (ctx.minimumPriority() || 2)
		ancestors = new Set(ancestors).add(task.id)
		const children = (task.relatedTasks?.subtask ?? []).map(child => this.options.allTasks().find(value => value.id === child.id)).filter((child): child is ITask => Boolean(child && !ancestors.has(child.id)))
		const project = ctx.getProject(task.projectId)
		const parent = this.options.context.getProject(state.task.projectId)
		const content = html`<div class="task loader-container single-task ${state.loading.has(task.id) ? 'is-loading' : ''}" tabindex="-1" data-is-overdue=${overdue ? '' : nothing} @click=${(event: MouseEvent) => this.openTask(event, task)} @keyup=${(event: KeyboardEvent) => { if (event.key === 'Enter') this.openTask(event, task) }}>
				<span class="is-inline-flex is-align-items-center" title=${!this.options.canWrite ? ctx.t('task.readOnlyCheckbox') : ''}><div class="base-checkbox fancy-checkbox ${!this.options.canWrite ? 'is-disabled' : ''}" data-cy="checkbox"><label class="base-checkbox__label" @click=${(event: Event) => event.stopPropagation()}><input type="checkbox" class="is-sr-only" .checked=${task.done} ?disabled=${!this.options.canWrite} aria-label=${ctx.t('task.detail.markAsDone', {task: task.title})} @change=${(event: Event) => void this.markDone(task, (event.target as HTMLInputElement).checked)}>${unsafeHTML(checkboxSvg.replace('<svg ', '<svg class="fancy-checkbox__icon" '))}</label></div></span>
				<div class="tasktext ${this.options.showProject && project ? 'show-project' : ''} ${task.done ? 'done' : ''}"><span>${this.options.showProject && project ? html`<a class="task-project mie-1 ${task.hexColor ? 'mie-2' : ''}" href=${ctx.viewHref(project, project.views[0])} @click=${ctx.navigate}>${project.title}</a>` : nothing}${task.hexColor ? html`<span class="color-bubble mie-1" style=${`background-color:${getHexColor(task.hexColor)}`}></span>` : nothing}${priority ? html`<span class="priority-label pis-2 mie-1 ${task.priority <= 1 ? 'negligible' : task.priority < 3 ? 'not-so-high' : 'high-priority'}"><span class="icon">${listIcon(task.priority >= 3 ? 'exclamation-circle' : 'exclamation')}</span><span>${ctx.t(`task.priority.${names[task.priority]}`)}</span></span>` : nothing}<span class="task-glance-trigger" @mouseenter=${(event: MouseEvent) => { if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) this.scheduleGlance(task, event.currentTarget as HTMLElement) }} @mouseleave=${() => this.hideGlance()} @focusin=${(event: FocusEvent) => { state.described = event.target as HTMLElement; this.scheduleGlance(task, event.currentTarget as HTMLElement) }} @focusout=${() => this.hideGlance()}><a class="task-link" href=${ctx.taskHref(task.id)} @click=${ctx.navigate}>${task.title}</a></span></span>${labels(task, 'labels mis-2 mie-1')}${task.assignees.length ? html`<div class="assignees-list is-inline mis-1">${task.assignees.map(user => html`<span class="assignee"><div class="user" style="--avatar-size:25px"><span class="avatar-wrapper">${state.avatars.has(user.username) ? html`<img class="avatar" src=${state.avatars.get(user.username)!} width="25" height="25" alt="" title=${getDisplayName(user)}>` : html`<span class="avatar user-avatar-placeholder" style="--user-avatar-size:25px" data-avatar=${user.username}></span>`}${(user as unknown as {botOwnerId?: number}).botOwnerId ? html`<span class="bot-badge" aria-label="Bot" title=${ctx.t('user.settings.bots.badge')}>B</span>` : nothing}</span><span class="username">${getDisplayName(user)}</span></div></span>`)}</div>` : nothing}${task.dueDate && +task.dueDate > 0 ? html`<button type="button" class="base-button base-button--type-button dueDate" title=${formatDateLong(task.dueDate)} @click=${(event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); this.toggleDue(task) }}><time datetime=${formatISO(task.dueDate)} class="is-italic" aria-expanded=${state.dueTask === task.id ? 'true' : 'false'}>– ${ctx.t('task.detail.due', {at: ctx.displayDate(task.dueDate)})}</time></button><span data-due-popup=${task.id} style="display:contents"></span>` : nothing}<span>${task.attachments.length ? html`<span class="project-task-icon" role="img" aria-label=${ctx.t('task.attributes.attachment', task.attachments.length)}>${listIcon('paperclip')}</span>` : nothing}${!isEditorContentEmpty(task.description) ? html`<span class="project-task-icon is-mirrored-rtl">${listIcon('align-left')}</span>` : nothing}${repeating(task) ? html`<span class="project-task-icon">${listIcon('history')}</span>` : nothing}${comments(task, ctx, 'project-task-icon')}</span>${checklist(task, ctx)}
				</div>
				${task.percentDone > 0 ? html`<progress class="progress-bar is-small" value=${task.percentDone * 100} max="100">${task.percentDone * 100}%</progress>` : nothing}
				${!this.options.showProject && project && project.id !== parent?.id ? html`${project.hexColor ? html`<span class="color-bubble mie-1" style=${`background-color:${project.hexColor}`}></span>` : nothing}<a class="base-button task-project" href=${ctx.viewHref(project, project.views[0])} @click=${(event: MouseEvent) => { event.stopPropagation(); ctx.navigate(event) }} title=${ctx.t('task.detail.belongsToProject', {project: project.title})}>${project.title}</a>` : nothing}
				<button type="button" class="base-button base-button--type-button favorite ${task.isFavorite ? 'is-favorite' : ''}" @click=${(event: MouseEvent) => { event.stopPropagation(); void this.favorite(task) }}><span class="is-sr-only">${ctx.t(task.isFavorite ? 'task.detail.actions.unfavorite' : 'task.detail.actions.favorite')}</span>${listIcon('star', !task.isFavorite)}</button>
				${!nested && this.options.draggable && this.options.canWrite ? html`<span class="icon handle">${listIcon('grip-lines')}</span>` : nothing}
			</div>${children.map(child => this.taskMarkup(child, true, ancestors))}`
		return nested ? html`<div data-task-id=${task.id} data-project-id=${task.projectId} class="subtask-nested">${content}</div>` : content
	},
	onRender() {
		const task = this.getState().task, el = this.el as HTMLElement
		el.dataset.taskId = String(task.id); el.dataset.projectId = String(task.projectId)
		const present = new Set([task.id, ...Array.from(this.getUI('taskNodes')! as ArrayLike<HTMLElement>).map(row => Number(row.dataset.taskId))])
		for (const [id, request] of this.getState().requests) { if (!present.has(id)) { request.abort(); this.getState().requests.delete(id); this.getState().overrides.delete(id) } }
		const state = this.getState()
		if (state.due && !this.el.querySelector(`[data-due-popup="${state.dueTask}"]`)) this.closeDue()
		for (const user of this.options.allTasks().flatMap(value => value.assignees)) {
			if (state.avatars.has(user.username) || state.avatarRequests.has(user.username) || !Array.from(this.getUI('avatars')! as ArrayLike<HTMLElement>).some(element => element.dataset.avatar === user.username)) continue
			state.avatarRequests.add(user.username)
			void fetchAvatarBlobUrl(user, 25).then(url => {
				if (state.life.signal.aborted || !url) return
				state.avatars.set(user.username, url)
				this.render()
			}).catch(() => {}).finally(() => state.avatarRequests.delete(user.username))
		}
	},
	onAttach() { this.getState().minute = setInterval(() => this.render(), 60000) },
	setCanWrite(canWrite: boolean) { if (this.options.canWrite === canWrite) return; this.options.canWrite = canWrite; if (!canWrite) { for (const request of this.getState().requests.values()) request.abort(); this.getState().requests.clear(); this.getState().overrides.clear() } this.render() },
	updateRow() { const state = this.getState(); state.task = this.options.model.get('task') as ITask; for (const id of state.overrides.keys()) { if (!state.requests.has(id)) state.overrides.delete(id) } this.render()
		const glance = state.glance?.currentView as InstanceType<typeof TaskGlanceView> | undefined
		if (glance) { const task = this.options.allTasks().find(task => task.id === glance.options.task.id); if (task) { glance.options.task = task; glance.render() } else this.hideGlance() }
	},
	openTask(event: MouseEvent | KeyboardEvent, task: ITask) {
		if ((event.target as HTMLElement)?.closest('a, button, label, input[type="checkbox"], .favorite, [role="button"]')) return
		const selection = window.getSelection()?.toString()
		if (selection && selection !== '\n') return
		this.el.querySelector<HTMLAnchorElement>(`a[href="${this.options.context.taskHref(task.id)}"]`)?.click()
	},
	request(task: ITask) { const state = this.getState(); state.requests.get(task.id)?.abort(); const request = new AbortController(); state.requests.set(task.id, request); return request },
	async markDone(task: ITask, checked: boolean, reverted = false) {
		if (!this.options.canWrite) return
		const state = this.getState(), ctx = this.options.context, request = this.request(task)
		let failedUndo = false
		state.overrides.set(task.id, {...(reverted ? task : {}), done: checked}); this.render()
		try {
			const update = ctx.updateTask({...task, done: checked}, request.signal)
			const result = await (checked ? Promise.all([update, waitForDoneAnimation(request.signal)]).then(([saved]) => saved) : update)
			request.signal.throwIfAborted()
			this.trigger('task:update', result)
			if (!reverted) {
				if (checked) this.options.context.playDoneSound?.()
				ctx.success(ctx.t(!result.done && !repeating(result) ? 'task.undoneSuccess' : 'task.doneSuccess'), () => {
					if (!this.isDestroyed()) void this.markDone(repeating(result) ? task : result, !checked, true)
					else void ctx.updateTask({...(repeating(result) ? task : result), done: !checked}, new AbortController().signal).catch(() => {})
				})
			}
		} catch (error) {
			if (!request.signal.aborted && state.requests.get(task.id) === request) {
				// Source Undo keeps its local draft and has no rejection notice.
				if (reverted) failedUndo = true
				else { state.overrides.delete(task.id); this.render(); ctx.reportError(error) }
			}
		} finally {
			if (state.requests.get(task.id) === request) {
				state.requests.delete(task.id)
				if (!failedUndo) state.overrides.delete(task.id)
				if (!this.isDestroyed()) this.render()
			}
		}
	},
	async favorite(task: ITask) {
		const state = this.getState(), request = this.request(task)
		this.getState().overrides.set(task.id, {isFavorite: !task.isFavorite}); this.render()
		try { const updated = await this.options.context.favoriteTask({...task}, request.signal); request.signal.throwIfAborted(); this.trigger('task:update', updated) } catch (error) { if (!request.signal.aborted) this.options.context.reportError(error) } finally { if (state.requests.get(task.id) === request) { state.requests.delete(task.id); state.overrides.delete(task.id); if (!this.isDestroyed()) this.render() } }
	},
	toggleDue(task: ITask) {
		if (this.getState().dueTask === task.id) { this.closeDue(); return }
		this.closeDue(); this.hideGlance()
		const region = new Region({el: this.el.querySelector(`[data-due-popup="${task.id}"]`)!})
		this.getState().due = region; this.getState().dueTask = task.id
		const popup = new DeferTaskView({context: this.options.context, task, save: async (date: Date) => {
			const state = this.getState()
			if (state.life.signal.aborted || !this.options.canWrite || !this.el.querySelector(`[data-due-popup="${task.id}"]`)) return
			task = this.options.allTasks().find(value => value.id === task.id) ?? task
			const request = this.request(task)
			const stop = setModuleLoading(loading => { if (!request.signal.aborted) popup.getUI('container')?.[0]?.classList.toggle('is-loading', loading) })
			try { const saved = await this.options.context.deferTask({...task, dueDate: date}, request.signal); request.signal.throwIfAborted(); this.trigger('task:update', saved) } catch (error) { if (!request.signal.aborted) this.options.context.reportError(error); throw error } finally { stop(); if (state.requests.get(task.id) === request) { state.requests.delete(task.id); state.overrides.delete(task.id); if (!this.isDestroyed()) this.render() } }
		}})
		this.listenTo(popup, 'close', () => this.closeDue()); region.show(popup)
		this.el.querySelector(`[data-due-popup="${task.id}"]`)?.previousElementSibling?.querySelector('time')?.setAttribute('aria-expanded', 'true')
	},
	closeDue() { this.getState().due?.destroy(); this.getState().due = undefined; this.getState().dueTask = 0; for (const time of Array.from(this.getUI('times')!)) time.setAttribute('aria-expanded', 'false') },
	scheduleGlance(task: ITask, trigger: HTMLElement) {
		clearTimeout(this.getState().hover)
		this.getState().hover = setTimeout(() => {
			if (this.isDestroyed()) return
			const el = document.createElement('div'); getTopLayerContainer(trigger).append(el)
			this.getState().glance = new Region({el})
			const id = `task-glance-${crypto.randomUUID()}`
			this.getState().described?.setAttribute('aria-describedby', id)
			this.getState().glance!.show(new TaskGlanceView({context: this.options.context, task, id, trigger}))
			document.addEventListener('keydown', this.getState().escape)
		}, 1000)
	},
	hideGlance() {
		clearTimeout(this.getState().hover)
		const region = this.getState().glance, el = region?.el; region?.destroy(); if (el instanceof Element) el.remove(); this.getState().glance = undefined
		this.getState().described?.removeAttribute('aria-describedby'); this.getState().described = null
		document.removeEventListener('keydown', this.getState().escape)
	},
	onBeforeDestroy() { this.getState().life.abort(); this.closeDue(); this.hideGlance(); clearInterval(this.getState().minute); for (const request of this.getState().requests.values()) request.abort(); this.getState().overrides.clear() },
}).setDomApi(LitDomApi).setDataApi(DataApi)
