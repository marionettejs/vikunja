import {View, CollectionView, type ViewConfiguration} from 'marionette'
import {Collection, DataApi, type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import {icon} from '@fortawesome/fontawesome-svg-core'
import type {Label} from '@/client/generated/index'
import type {IUser} from '@/modelTypes/IUser'
import {getDisplayName} from '@/models/user'
import {getLabelColor} from '@/composables/useLabelStyles'
import {getTextColor} from '@/helpers/color/getTextColor'
import {closeWhenClickedOutside} from '@/helpers/closeWhenClickedOutside'
import {listIcon} from '../../shared/task-list/list-ui'
import {TaskMembershipUserView} from './task-membership-user'
import './task-membership.scss'

export type MembershipKind = 'labels' | 'assignees'
export type TaskMember = Label | IUser
export interface MembershipInputs {taskId: number, projectId: number, items: TaskMember[], canWrite: boolean, canCreate: boolean}
export interface MembershipContext {
	t: (key: string, values?: Record<string, unknown>) => string
	labels: (hidden: Label[], query: string) => Label[]
	users: (projectId: number, query: string, signal: AbortSignal) => Promise<IUser[]>
	currentUser: () => number | undefined
	add: (kind: MembershipKind, taskId: number, item: TaskMember, signal: AbortSignal) => Promise<unknown>
	remove: (kind: MembershipKind, taskId: number, item: TaskMember, signal: AbortSignal) => Promise<unknown>
	createLabel: (title: string, signal: AbortSignal) => Promise<Label>
	observeLabels: (changed: () => void) => () => void
	observeLoading: (changed: (loading: boolean) => void) => () => void
	observeAvatar: (username: string, changed: () => void) => () => void
	success: (key: string) => void
	reportError: (error: unknown) => void
}
interface Options extends MembershipInputs {kind: MembershipKind, context: MembershipContext, accepted: (items: TaskMember[]) => void}
function createIcon() { const svg = icon({prefix: 'fas', iconName: 'plus'}, {classes: ['create-icon']}); return svg ? unsafeHTML(svg.html.join('')) : nothing }
function labelStyle(label: Label) { const color = getLabelColor(label); return `background:${color || 'var(--grey-200)'};color:${color ? getTextColor(color) : 'var(--grey-800)'}` }
function memberName(kind: MembershipKind, item: TaskMember) { return kind === 'labels' ? (item as Label).title ?? '' : getDisplayName(item as IUser) }
interface MemberOptions extends ViewConfiguration {model: Model, kind: MembershipKind, context: MembershipContext, canWrite: boolean, removed: (item: TaskMember) => void}
const SelectedMemberView = View.extend({
	initialize(options: MemberOptions) { void options }, tagName: 'span',
	className() { return this.options.kind === 'labels' ? 'tag' : 'assignee' },
	attributes() { return this.options.kind === 'labels' ? {style: labelStyle(this.options.model.get('item') as Label)} : {} },
	regions: {user: '[data-user]'},
	templateContext() { return {content: this.renderTemplate()} }, template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const item = this.options.model.get('item') as TaskMember, {kind, context, canWrite} = this.options
		if (kind === 'labels') return html`<span>${(item as Label).title}</span>${canWrite ? html`<button type="button" class="base-button base-button--type-button delete is-small" data-cy="taskDetail.removeLabel" aria-label=${context.t('task.label.removeLabel', {label: (item as Label).title})} @click=${() => this.options.removed(item)}></button>` : nothing}`
		return html`<div data-user style="display:contents"></div>${canWrite ? html`<button type="button" class="base-button base-button--type-button remove-assignee" aria-label=${context.t('task.detail.removeAssignee', {user: getDisplayName(item as IUser)})} @click=${() => this.options.removed(item)}>${listIcon('times')}</button>` : nothing}`
	},
	onRender() { if (this.options.kind === 'assignees') { const user = new TaskMembershipUserView({user: this.options.model.get('item') as IUser, size: 30, t: this.options.context.t, observeAvatar: this.options.context.observeAvatar}); if (this.options.canWrite) user.el.classList.add('m-2'); this.showChildView('user', user) } },
	update(item: TaskMember, canWrite: boolean) { this.options.model.set('item', item); this.options.canWrite = canWrite; this.render() },
}).setDomApi(LitDomApi).setDataApi(DataApi)
const SelectedMembersView = CollectionView.extend({
	initialize(options: Omit<MemberOptions, 'model'> & {collection: Collection}) { void options },
	className() { return this.options.kind === 'assignees' ? 'assignees-list' : '' },
	attributes() { return this.options.kind === 'labels' ? {style: 'display:contents'} : {} }, childView: SelectedMemberView,
	childViewOptions() { return {kind: this.options.kind, context: this.options.context, canWrite: this.options.canWrite, removed: this.options.removed} },
	publish(items: TaskMember[], canWrite: boolean) {
		this.options.canWrite = canWrite
		const collection = this.options.collection, ids = new Set(items.map(item => item.id))
		collection.remove(collection.models.filter(model => !ids.has(Number(model.id))))
		for (const item of items) if (!collection.get(item.id!)) collection.add({id: item.id, item})
		for (const child of this.children.toArray()) child.update(items.find(item => item.id === child.options.model.id)!, canWrite)
	},
}).setDataApi(DataApi)

interface ResultOptions extends ViewConfiguration {model: Model, kind: MembershipKind, context: MembershipContext, choose: (item: TaskMember) => void, create: () => void, keyboard: (event: KeyboardEvent, index: number) => void}
const MemberResultView = View.extend({
	initialize(options: ResultOptions) { void options }, tagName() { return this.options.model.get('hint') ? 'div' : 'button' }, className() { return this.options.model.get('hint') ? 'search-result-hint' : 'base-button base-button--type-button search-result-button is-fullwidth' }, attributes() { return this.options.model.get('hint') ? {role: 'option', 'aria-disabled': 'true'} : {type: 'button', role: 'option'} },
	regions: {user: '[data-user]'}, events: {keydown: 'key', click: 'select'},
	templateContext() { return {content: this.renderTemplate()} }, template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		if (this.options.model.get('hint')) return html`${this.options.context.t('task.label.linkShareCannotCreate')}`
		const item = this.options.model.get('item') as TaskMember, create = this.options.model.get('create'), {kind, context} = this.options
		return html`<span>${create ? html`${createIcon()}<span class="tag search-result"><span>${this.options.model.get('title')}</span></span>` : kind === 'labels' ? html`<span class="tag search-result" style=${labelStyle(item as Label)}><span>${(item as Label).title}</span></span>` : html`<div data-user style="display:contents"></div>`}</span>${create || kind === 'assignees' ? html`<span class="hint-text ${create ? 'is-always-visible' : ''}">${context.t(create ? 'task.label.createPlaceholder' : 'task.assignee.selectPlaceholder')}</span>` : nothing}`
	},
	onRender() { this.el.classList.toggle('is-create-option', Boolean(this.options.model.get('create'))); if (this.options.kind === 'assignees') this.showChildView('user', new TaskMembershipUserView({user: this.options.model.get('item') as IUser, size: 24, t: this.options.context.t, observeAvatar: this.options.context.observeAvatar})) },
	key(event: KeyboardEvent) { this.options.keyboard(event, this.options.model.get('order') as number) },
	select(event: Event) { if (this.options.model.get('hint')) return; event.preventDefault(); event.stopPropagation(); if (this.options.model.get('create')) this.options.create(); else this.options.choose(this.options.model.get('item') as TaskMember) },
}).setDomApi(LitDomApi).setDataApi(DataApi)
const MemberResultsView = CollectionView.extend({
	initialize(options: Omit<ResultOptions, 'model'> & {collection: Collection, id: string, label: string}) { void options },
	className: 'search-results', attributes() { return {role: 'listbox', id: this.options.id, 'aria-label': this.options.label} }, childView: MemberResultView, viewComparator: 'order',
	childViewOptions() { return {kind: this.options.kind, context: this.options.context, choose: this.options.choose, create: this.options.create, keyboard: this.options.keyboard} },
	publish(items: TaskMember[], query: string, create: boolean, hint: boolean) { this.options.collection.reset([...items.map((item, order) => ({id: item.id, item, order})), ...(create ? [{id: 'create', create: true, title: query, order: items.length}] : []), ...(hint ? [{id: 'hint', hint: true, order: items.length + 1}] : [])]) },
	focus(index: number) { (this.children.toArray()[index]?.el as HTMLElement | undefined)?.focus() },
}).setDataApi(DataApi)

export const TaskMembershipView = View.extend({
	ui: {'input': 'input', 'wrapper': '.input-wrapper', 'control': '.control'},
	className: 'multiselect', attributes: {tabindex: '-1'}, regions: {selected: '[data-selected]', results: '[data-results]'},
	initialize(options: Options) { void options },
	createState() { return {taskId: this.options.taskId, items: [...this.options.items], accepted: [...this.options.items], pending: new Set<number>(), failed: new Set<number>(), query: '', results: [] as TaskMember[], show: false, hasPreloaded: false, suppressFocus: false, ignoreKeyup: false, localLoading: false, lookupLoading: false, externalLoading: false, creating: false, lookup: undefined as AbortController | undefined, requests: new Set<AbortController>(), timers: new Set<ReturnType<typeof setTimeout>>(), searchTimer: undefined as ReturnType<typeof setTimeout> | undefined, stops: [] as (() => void)[], outside: (event: MouseEvent) => closeWhenClickedOutside(event, this.el as HTMLElement, () => this.close())} },
	template: () => html`<div class="control"><div class="input-wrapper input"><div data-selected style="display:contents"></div><input type="text" class="input" role="combobox" aria-autocomplete="list" aria-haspopup="listbox"></div></div><div data-results style="display:contents"></div>`,
	events: {'focus': 'focusRoot', 'focus @ui.input': 'focusInput', 'input @ui.input': 'keyup', 'keyup input': 'keyup', 'keydown @ui.input': 'keydown'},
	onRender() {
		const {kind, context} = this.options, label = context.t(kind === 'labels' ? 'task.label.placeholder' : 'task.assignee.placeholder')
		this.el.classList.toggle('edit-assignees', kind === 'assignees'); this.el.classList.toggle('task-member-labels', kind === 'labels')
		const input = this.input(); input.placeholder = label; input.setAttribute('aria-label', label)
		if (kind === 'assignees') { input.autocomplete = 'off'; input.spellcheck = false }
		this.showChildView('selected', new SelectedMembersView({kind, context, canWrite: this.options.canWrite, collection: new Collection(), removed: item => void this.remove(item)}))
		this.showChildView('results', new MemberResultsView({kind, context, collection: new Collection(), id: `member-results-${this.cid}`, label, choose: item => void this.select(item), create: () => void this.createLabel(), keyboard: (event, index) => this.resultKey(event, index)}))
		this.publishSelected(); this.refreshResults(); this.refreshInput()
	},
	onAttach() { const state = this.getState(); document.addEventListener('click', state.outside); state.stops.push(this.options.context.observeLabels(() => { if (this.options.kind === 'labels') { state.results = this.options.context.labels(state.items as Label[], state.query); this.refreshResults() } })); if (this.options.kind === 'labels') state.stops.push(this.options.context.observeLoading(loading => { state.externalLoading = loading; this.refreshInput() })) },
	input() { return (this.getUI('input')![0] as HTMLInputElement)! },
	selected() { return this.getChildView('selected') as InstanceType<typeof SelectedMembersView> },
	resultView() { return this.getChildView('results') as InstanceType<typeof MemberResultsView> },
	delay(ms: number, callback: () => void) { const timer = setTimeout(() => { this.getState().timers.delete(timer); if (!this.isDestroyed()) callback() }, ms); this.getState().timers.add(timer); return timer },
	exactMatch() { return [...this.getState().results, ...this.getState().items].some(item => memberName(this.options.kind, item) === this.getState().query) },
	createAvailable() { return this.options.kind === 'labels' && this.options.canCreate && this.getState().query !== '' && !this.exactMatch() },
	refreshInput() {
		const state = this.getState(), readonlyUsers = this.options.kind === 'assignees' && !this.options.canWrite
		this.el.setAttribute('aria-disabled', String(!this.options.canWrite)); this.el.classList.toggle('is-disabled', !this.options.canWrite); this.el.classList.toggle('has-assignees', this.options.kind === 'assignees' && state.items.length > 0); this.el.classList.toggle('readonly-assignees', readonlyUsers)
		this.input().hidden = !this.options.canWrite; this.input().disabled = !this.options.canWrite
		;(this.getUI('wrapper')![0] as HTMLElement)!.classList.toggle('has-multiple', state.items.length > 0)
		;(this.getUI('control')![0] as HTMLElement)!.classList.toggle('is-loading', state.localLoading || state.lookupLoading || state.externalLoading || state.creating)
	},
	publishSelected() { this.selected().publish(this.getState().items, this.options.canWrite); this.refreshInput() },
	refreshResults() {
		const state = this.getState(); const visibleResults = state.results.filter(item => !state.items.some(selected => selected.id === item.id))
		const hint = this.options.kind === 'labels' && !this.options.canCreate && state.query !== '' && !this.exactMatch(), visible = this.options.canWrite && state.show && (state.query !== '' || this.options.kind === 'assignees') && (visibleResults.length > 0 || this.options.kind === 'labels' && this.options.canCreate && state.query !== '' || hint)
		this.el.classList.toggle('has-search-results', visible); this.input().setAttribute('aria-expanded', String(visible)); this.input().setAttribute('aria-controls', visible ? `member-results-${this.cid}` : '')
		this.resultView().publish(visibleResults, state.query, this.createAvailable(), hint); (this.resultView().el as HTMLElement).hidden = !visible
	},
	focusRoot(event: FocusEvent) { if (event.target !== this.el || !this.options.canWrite) return; this.input().focus(); const state = this.getState(); if (this.options.kind === 'assignees' && !state.hasPreloaded) { state.hasPreloaded = true; this.delay(10, () => { void this.search('') }) } },
	focusInput() { const state = this.getState(); if (state.suppressFocus || !this.options.canWrite) return; this.delay(10, () => { state.show = true; this.refreshResults() }) },
	keydown(event: KeyboardEvent) { this.getState().ignoreKeyup = false; if (event.key === 'ArrowDown') { event.preventDefault(); this.resultView().focus(0) } if (event.key === 'Escape' && this.input().getAttribute('aria-expanded') === 'true') { event.preventDefault(); event.stopPropagation(); this.close() } },
	keyup(event: KeyboardEvent) {
		const state = this.getState(); if (event.type === 'keyup' && event.key !== 'Enter' || event.key === 'Escape' || state.ignoreKeyup || event.isComposing) return
		state.query = this.input().value; state.lookup?.abort(); clearTimeout(state.searchTimer); state.localLoading = true; this.refreshInput()
		state.searchTimer = this.delay(this.options.kind === 'labels' ? 10 : 200, () => { state.show = true; void this.search(state.query); this.delay(100, () => { state.localLoading = false; this.refreshInput() }) })
		if (event.key === 'Enter') { const exact = state.results.find(item => memberName(this.options.kind, item) === state.query); if (this.createAvailable()) void this.createLabel(); else if (exact || state.results.length === 1) void this.select(exact ?? state.results[0]) }
	},
	async search(query: string) {
		const state = this.getState(); state.lookup?.abort(); const request = new AbortController(), taskId = state.taskId; state.lookup = request; state.requests.add(request)
		try {
			if (this.options.kind === 'labels') state.results = this.options.context.labels(state.items as Label[], query)
			else { this.delay(100, () => { if (state.lookup === request && !request.signal.aborted) { state.lookupLoading = true; this.refreshInput() } }); const users = await this.options.context.users(this.options.projectId, query, request.signal); request.signal.throwIfAborted(); if (this.isDestroyed() || state.taskId !== taskId) return; const current = this.options.context.currentUser(); state.results = users.filter(user => !state.items.some(item => item.id === user.id)).sort((a, b) => a.id === current ? -1 : b.id === current ? 1 : getDisplayName(a).localeCompare(getDisplayName(b))) }
			if (!request.signal.aborted && !this.isDestroyed()) this.refreshResults()
		} catch (error) { if (!request.signal.aborted && !this.isDestroyed()) this.options.context.reportError(error) }
		finally { state.requests.delete(request); if (state.lookup === request) { state.lookup = undefined; state.lookupLoading = false; if (!this.isDestroyed()) this.refreshInput() } }
	},
	refocus() { this.getState().ignoreKeyup = true; this.getState().suppressFocus = true; this.input().focus(); this.getState().suppressFocus = false },
	close() { const state = this.getState(); state.show = false; state.lookup?.abort(); state.localLoading = false; clearTimeout(state.searchTimer); this.refreshResults(); this.refreshInput() },
	resultKey(event: KeyboardEvent, index: number) { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const next = index + (event.key === 'ArrowDown' ? 1 : -1); if (next < 0) this.input().focus(); else this.resultView().focus(next) } if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); this.refocus() } },
	async select(item: TaskMember, created = false) {
		const state = this.getState(); if (!this.options.canWrite || state.items.some(selected => selected.id === item.id)) return
		const request = new AbortController(), taskId = state.taskId; state.requests.add(request); state.pending.add(item.id!); state.items.push(item); state.query = ''; this.input().value = ''; this.publishSelected(); clearTimeout(state.searchTimer); state.localLoading = false
		if (this.options.kind === 'assignees') state.show = false
		this.refreshResults(); this.refocus()
		try { await this.options.context.add(this.options.kind, taskId, item, request.signal); request.signal.throwIfAborted(); if (this.isDestroyed() || state.taskId !== taskId || !this.options.canWrite) return; state.accepted = [...state.accepted.filter(existing => existing.id !== item.id), item]; this.options.accepted([...state.accepted]); this.options.context.success(created ? 'task.label.addCreateSuccess' : this.options.kind === 'labels' ? 'task.label.addSuccess' : 'task.assignee.assignSuccess') }
		catch (error) { if (!request.signal.aborted && !this.isDestroyed()) { state.failed.add(item.id!); this.options.context.reportError(error) } }
		finally { if (!request.signal.aborted) state.pending.delete(item.id!); state.requests.delete(request) }
	},
	async remove(item: TaskMember) {
		if (!this.options.canWrite) return
		const state = this.getState(), request = new AbortController(), taskId = state.taskId; state.requests.add(request)
		try { await this.options.context.remove(this.options.kind, taskId, item, request.signal); request.signal.throwIfAborted(); if (this.isDestroyed() || state.taskId !== taskId || !this.options.canWrite) return; state.items = state.items.filter(existing => existing.id !== item.id); state.accepted = state.accepted.filter(existing => existing.id !== item.id); state.failed.delete(item.id!); this.options.accepted([...state.accepted]); this.publishSelected(); this.refreshResults(); this.options.context.success(this.options.kind === 'labels' ? 'task.label.removeSuccess' : 'task.assignee.unassignSuccess') }
		catch (error) { if (!request.signal.aborted && !this.isDestroyed()) this.options.context.reportError(error) } finally { state.requests.delete(request) }
	},
	async createLabel() {
		const state = this.getState(); if (!this.options.canWrite || !this.createAvailable() || state.creating) return
		const request = new AbortController(), taskId = state.taskId, query = state.query; state.requests.add(request); state.creating = true; state.show = false; state.query = ''; this.input().value = ''; clearTimeout(state.searchTimer); state.localLoading = false; this.refreshInput(); this.refreshResults(); this.refocus()
		try { const label = await this.options.context.createLabel(query, request.signal); request.signal.throwIfAborted(); if (!this.isDestroyed() && state.taskId === taskId && this.options.canWrite) { state.creating = false; this.refreshInput(); await this.select(label, true) } }
		catch (error) { if (!request.signal.aborted && !this.isDestroyed()) this.options.context.reportError(error) } finally { state.requests.delete(request); if (!request.signal.aborted) { state.creating = false; if (!this.isDestroyed()) this.refreshInput() } }
	},
	updateInputs(inputs: MembershipInputs) {
		const state = this.getState(), changedTask = inputs.taskId !== state.taskId || inputs.projectId !== this.options.projectId
		if (changedTask || !inputs.canWrite) { for (const request of state.requests) request.abort(); for (const timer of state.timers) clearTimeout(timer); state.timers.clear(); state.show = false; state.localLoading = false; state.lookupLoading = false; state.creating = false; state.lookup = undefined; state.pending.clear(); state.requests.clear() }
		Object.assign(this.options, inputs)
		if (changedTask) { state.taskId = inputs.taskId; state.pending.clear(); state.failed.clear(); state.query = ''; this.input().value = ''; state.items = [...inputs.items]; state.accepted = [...inputs.items]; state.results = []; state.hasPreloaded = false }
		else if (JSON.stringify(inputs.items) !== JSON.stringify(state.items)) { state.accepted = [...inputs.items]; const local = state.items.filter(item => state.pending.has(item.id!) || state.failed.has(item.id!)); state.items = [...inputs.items, ...local.filter(item => !inputs.items.some(accepted => accepted.id === item.id))] }
		this.publishSelected(); this.refreshResults(); this.refreshInput()
	},
	onBeforeDestroy() { const state = this.getState(); for (const request of state.requests) request.abort(); for (const timer of state.timers) clearTimeout(timer); state.timers.clear(); state.requests.clear(); state.pending.clear(); state.lookup = undefined; for (const stop of state.stops) stop(); document.removeEventListener('click', state.outside) },
}).setDomApi(LitDomApi)
