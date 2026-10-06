import {computePosition, autoPlacement, offset, shift} from '@floating-ui/dom'
import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import type {IProject} from '@/modelTypes/IProject'
import type {IProjectView} from '@/modelTypes/IProjectView'
import type {IBucket} from '@/modelTypes/IBucket'
import type {ITaskBucket} from '@/modelTypes/ITaskBucket'
import {TaskRecordSession} from './task-record'
import type {NativeEditorOptions} from '../../shared/editor/editor'
import {listIcon} from '../../shared/task-list/list-ui'
import './task-bucket.scss'
interface Options {
	record: TaskRecordSession
	project: () => IProject | undefined
	activeView: () => number
	load: (projectId: number, viewId: number, signal: AbortSignal) => Promise<IBucket[]>
	move: (bucket: IBucket, signal: AbortSignal) => Promise<ITaskBucket>
	t: NativeEditorOptions['context']['t']
	reportError: (error: unknown) => void
	success: () => void
}
export const TaskBucketView = View.extend({
	initialize(options: Options) { void options },
	className: 'native-task-bucket',
	ui: {items: '[data-bucket-item]', trigger: '.bucket-name'},
	createState() { return {life: new AbortController(), lookup: undefined as AbortController | undefined, request: undefined as AbortController | undefined, view: undefined as IProjectView | undefined, key: '', buckets: [] as IBucket[], open: false, failed: false} },
	templateContext() { return {content: this.content()} },
	template: ({content}: {content: TemplateResult}) => content,
	content() {
		const state = this.getState(), task = this.options.record.task, t = this.options.t
		if (!state.view) return nothing
		const current = task.buckets?.find(bucket => bucket.projectViewId === state.view!.id), title = current?.title || t('task.detail.noBucket')
		return html`<span class="has-text-grey-light"> &gt; </span>${Number(task.maxPermission) > 0 ? html`<span class="dropdown ${state.open ? 'is-active' : ''}"><span class="dropdown-trigger"><button type="button" class="base-button base-button--type-button bucket-name" aria-label=${t('task.detail.bucketSelectLabel', {bucket: title})} aria-expanded=${String(state.open)} ?disabled=${Boolean(state.request)} @click=${(event: MouseEvent) => {event.stopPropagation(); state.open = !state.open; this.render(); if (state.open && state.failed) void this.load()} }>${title}<span class="change-indicator d-print-none">${listIcon('pencil-alt')}</span></button></span><div class="dropdown-menu" ?hidden=${!state.open}><div class="dropdown-content">${state.buckets.map(bucket => html`<button type="button" data-bucket-item=${bucket.id} class="base-button base-button--type-button dropdown-item ${bucket.id === current?.id ? 'is-active' : ''}" ?disabled=${Boolean(state.request)} @click=${() => void this.select(bucket)}>${bucket.title}</button>`)}</div></div></span>` : html`<span class="bucket-name">${title}</span>`}`
	},
	updateInputs() {
		const state = this.getState(), task = this.options.record.task
		const manual = this.options.project()?.views.filter(view => view.viewKind === 'kanban' && view.bucketConfigurationMode === 'manual') ?? []
		const view = manual.length === 1 ? manual[0] : manual.find(view => view.id === this.options.activeView())
		const key = view ? `${task.projectId}:${view.id}` : ''
		if (key !== state.key) { state.lookup?.abort(); state.request?.abort(); state.request = undefined; state.view = view; state.key = key; state.buckets = []; state.open = false; state.failed = false; if (view) void this.load() }
		if (Number(task.maxPermission) <= 0) { state.request?.abort(); state.request = undefined; state.open = false }
		this.render()
	},
	async load() {
		const state = this.getState(); if (!state.view || state.life.signal.aborted) return
		state.lookup?.abort(); const request = new AbortController(), key = state.key; state.lookup = request
		try { const buckets = await this.options.load(this.options.record.task.projectId, state.view.id, request.signal); request.signal.throwIfAborted(); if (state.key !== key) return; state.buckets = buckets; state.failed = false }
		catch (error) { if (!request.signal.aborted) {state.failed = true; this.options.reportError(error)} }
		finally { if (state.lookup === request) state.lookup = undefined; if (!this.isDestroyed()) this.render() }
	},
	async select(bucket: IBucket) {
		const state = this.getState(), task = this.options.record.task, viewId = state.view?.id
		if (!viewId || state.request || state.life.signal.aborted || Number(task.maxPermission) <= 0 || task.buckets?.some(value => value.projectViewId === viewId && value.id === bucket.id)) return
		const request = new AbortController(), key = state.key, restoreFocus = this.el.contains(document.activeElement) && document.activeElement?.matches('[data-bucket-item]'); state.request = request; this.render()
		try {
			const saved = await this.options.move({...bucket, projectViewId: viewId}, request.signal); request.signal.throwIfAborted()
			if (state.key !== key || Number(this.options.record.task.maxPermission) <= 0) return
			const current = this.options.record.task, buckets = (current.buckets ?? []).filter(value => value.projectViewId !== viewId)
			buckets.push({...bucket, projectViewId: viewId})
			this.options.record.acceptFields({buckets, bucketId: bucket.id, done: saved.task?.done ?? current.done, doneAt: saved.task?.doneAt ?? current.doneAt})
			this.options.success()
		} catch (error) { if (!request.signal.aborted) this.options.reportError(error) }
		finally { if (state.request === request) state.request = undefined; if (!this.isDestroyed()) {this.render(); if (document.activeElement === document.body) {if (state.open && restoreFocus) (Array.from(this.getUI('items') ?? []) as HTMLElement[]).find(item => Number(item.dataset.bucketItem) === bucket.id)?.focus(); else if (!state.open) (this.getUI('trigger')?.[0] as HTMLElement | undefined)?.focus()}} }
	},
	onRender() {
		if (!this.getState().open) return
		const trigger = this.el.querySelector<HTMLElement>('.dropdown')!, menu = this.el.querySelector<HTMLElement>('.dropdown-menu')!
		void computePosition(trigger, menu, {placement: 'bottom-end', strategy: 'absolute', middleware: [offset(4), autoPlacement({allowedPlacements: ['bottom-end', 'top-end', 'bottom-start', 'top-start'], padding: 8}), shift({padding: 8})]}).then(({x, y}) => {if (!this.isDestroyed() && this.getState().open && menu.isConnected) {menu.style.left = `${x}px`; menu.style.top = `${y}px`}})
	},
	onAttach() {
		const state = this.getState(); this.updateInputs()
		document.addEventListener('click', event => {if (state.open && !event.composedPath().includes(this.el)) {state.open = false; this.render()}}, {signal: state.life.signal})
		;(this.el as HTMLElement).addEventListener('keydown', event => {if (event.key === 'Escape' && state.open) {event.preventDefault(); event.stopPropagation(); state.open = false; this.render(); this.el.querySelector<HTMLElement>('.bucket-name')?.focus()}}, {signal: state.life.signal})
	},
	onBeforeDestroy() { const state = this.getState(); state.life.abort(); state.lookup?.abort(); state.request?.abort() },
}).setDomApi(LitDomApi)
