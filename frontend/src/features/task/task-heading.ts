import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing} from 'lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import {icon} from '@fortawesome/fontawesome-svg-core'
import {faCheck, faTimes} from '@fortawesome/free-solid-svg-icons'
import {setModuleLoading} from '@/stores/helper'
import type {ITask} from '@/modelTypes/ITask'


interface Inputs {
	task: ITask
	canWrite: boolean
	hasClose: boolean
	identifier: string
	color: string | undefined
}

interface Options extends Inputs {
	t: (key: string) => string
	saveTask: (task: ITask, signal: AbortSignal) => Promise<ITask>
	accepted: (task: ITask) => void
	close: () => void
	reportError: (error: unknown) => void
	copyUrl: () => Promise<unknown>
}
type TemplateInputs = Inputs & {saving: boolean, saved: boolean, t: Options['t']}

export const TaskHeadingView = View.extend({
	className: 'heading',
	ui: {title: 'h1', status: '[data-save-status]'},
	events: {
		'input @ui.title': 'edit',
		'blur @ui.title': 'save',
		'keydown @ui.title': 'key',
		'click [data-close]': 'close',
		'click [data-copy]': 'copyUrl',
	},
	initialize(options: Options) { void options },
	createState(options: Options) {
		return {
			inputs: options as Inputs, dirty: false, saving: false, loading: false, saved: false,
			stopLoading: undefined as (() => void) | undefined,
			request: undefined as AbortController | undefined,
			savedTimer: undefined as ReturnType<typeof setTimeout> | undefined,
			beforeUnload: (event: BeforeUnloadEvent) => {
				if (!this.getState().dirty) return
				event.preventDefault()
				event.returnValue = ''
			},
		}
	},
	onAttach() {
		window.addEventListener('beforeunload', this.getState().beforeUnload)
	},
	templateContext() {
		return {...this.getState().inputs, saving: this.getState().loading, saved: this.getState().saved, t: this.getOption('t')}
	},
	template: ({task, canWrite, hasClose, identifier, color, saving, saved, t}: TemplateInputs) => html`
		<div class="tw:flex tw:items-center md:tw:items-stretch tw:flex-col tw:gap-1 task-properties">
			<div class="tw:flex tw:items-center tw:gap-2">
				${task.hexColor !== '' ? html`<span class="color-bubble" style=${`background-color: ${color}`} ></span>` : nothing}
				<button type="button" class="base-button base-button--type-button" data-copy><span class="title task-id">${identifier}</span></button>
			</div>
			${task.done ? html`<div class="is-done">${t('task.attributes.done')}</div>` : nothing}
			${hasClose ? html`<button type="button" class="base-button base-button--type-button close d-print-none" data-close aria-label=${t('task.detail.closeTaskDetail')}>${unsafeHTML(icon(faTimes).html.join(''))}</button>` : nothing}
		</div>
		<h1 class=${`title input${canWrite ? '' : ' disabled'}`} contenteditable=${canWrite ? 'true' : nothing} tabindex=${canWrite ? 0 : nothing} aria-label=${canWrite ? t('task.attributes.title') : nothing} spellcheck="false"></h1>
		${hasClose ? html`<button type="button" class="base-button base-button--type-button close d-print-none" data-close aria-label=${t('task.detail.closeTaskDetail')}>${unsafeHTML(icon(faTimes).html.join(''))}</button>` : nothing}
		<span data-save-status>
			${saving ? html`<span class="is-inline-flex is-align-items-center"><span class="loader is-inline-block mie-2"></span>${t('misc.saving')}</span>` : saved ? html`<span class="has-text-success is-inline-flex is-align-content-center">${unsafeHTML(icon(faCheck, {classes: ['mie-2']}).html.join(''))}${t('misc.saved')}</span>` : nothing}
		</span>`,
	onRender() {
		const title = (this.getUI('title')![0] as HTMLElement)
		if (!this.getState().dirty && !this.getState().saving && title.textContent !== this.getState().inputs.task.title.trim()) {
			title.textContent = this.getState().inputs.task.title.trim()
		}
	},
	updateInputs(inputs: Inputs) {
		if (inputs.task.id !== this.getState().inputs.task.id || (this.getState().inputs.canWrite && !inputs.canWrite)) {
			this.getState().request?.abort()
			this.getState().stopLoading?.()
			this.getState().request = undefined
			clearTimeout(this.getState().savedTimer)
			this.getState().dirty = false
			this.getState().saving = false
			this.getState().saved = false
		}
		this.getState().inputs = inputs
		this.render()
	},
	edit() {
		this.getState().dirty = (this.getUI('title')![0] as HTMLElement).textContent !== this.getState().inputs.task.title
	},
	key(event: KeyboardEvent) {
		if (event.isComposing || !['Enter', 'Escape'].includes(event.key)) return
		event.preventDefault()
		event.stopPropagation()
		const title = (this.getUI('title')![0] as HTMLElement)
		if (event.key === 'Escape') {
			title.textContent = this.getState().inputs.task.title
			this.getState().dirty = false
		}
		title.blur()
	},
	async save() {
		if (!this.getState().inputs.canWrite || this.isDestroyed()) return
		const title = (this.getUI('title')![0] as HTMLElement).textContent ?? ''
		if (!title.trim()) {
			this.getState().dirty = false
			this.render()
			this.getOption('reportError')({message: this.getOption('t')('task.detail.titleRequired')})
			return
		}
		if (title === this.getState().inputs.task.title) return
		const previous = this.getState().request
		this.getState().request = undefined
		previous?.abort()
		this.getState().stopLoading?.()
		const request = new AbortController()
		this.getState().request = request
		this.getState().saving = true
		this.getState().stopLoading = setModuleLoading(loading => {
			this.getState().loading = loading
			if (this.getState().request === request && !this.isDestroyed()) this.render()
		})
		this.getState().saved = false
		this.render()
		try {
			const task = await this.getOption('saveTask')({...this.getState().inputs.task, title}, request.signal)
			if (this.getState().request !== request || this.isDestroyed()) return
			this.getState().inputs = {...this.getState().inputs, task}
			// Typing during the save retains the newer draft.
			this.getState().dirty = (this.getUI('title')![0] as HTMLElement).textContent !== title
			this.getState().saved = true
			this.getOption('accepted')(task)
			clearTimeout(this.getState().savedTimer)
			this.getState().savedTimer = setTimeout(() => {
				if (this.isDestroyed()) return
				this.getState().saved = false
				this.render()
			}, 2000)
		} catch (error) {
			if (this.getState().request === request && !this.isDestroyed() && !request.signal.aborted) this.getOption('reportError')(error)
		} finally {
			if (this.getState().request === request && !this.isDestroyed()) {
				this.getState().request = undefined
				this.getState().saving = false
				this.getState().stopLoading?.()
				this.render()
			}
		}
	},
	close() { this.getOption('close')() },
	copyUrl() { void this.getOption('copyUrl')() },
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.getState().stopLoading?.()
		this.getState().request = undefined
		clearTimeout(this.getState().savedTimer)
		window.removeEventListener('beforeunload', this.getState().beforeUnload)
	},
})

TaskHeadingView.setDomApi(LitDomApi)
