import {html, nothing} from 'lit-html'
import {live} from 'lit-html/directives/live.js'
import type {Model} from '@mnjs/data'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

type TaskHeadingTaskAttributes = {
	id: number
	title: string
	done: boolean
	hexColor: string
}

export interface TaskHeadingViewLabels {
	title: string
	titleRequired: string
	saving: string
	saved: string
	saveError: string
	copy: string
	close: string
	done: string
}

export interface TaskHeadingViewOptions {
	model: Model<TaskHeadingTaskAttributes>
	canWrite: boolean
	hasClose: boolean
	labels: TaskHeadingViewLabels
	taskUrl: string
	taskIdentifier: string
	onCopy: (taskUrl: string, taskIdentifier: string) => void | Promise<void>
	onCommit: (title: string) => Promise<void> | void
	onClose?: () => void
}

export interface TaskHeadingViewInstance extends ViewInstance {
	el: HTMLDivElement
	save(): Promise<void>
	hasUnsavedChanges(): boolean
}

interface TaskHeadingTemplateData {
	canWrite: boolean
	hasClose: boolean
	taskIdentifier: string
	title: string
	done: boolean
	hexColor: string
	saving: boolean
	saved: boolean
	errormessage: string | null
	statusMessage: string | null
	isDirty: boolean
	errorId: string
	doneLabel: string
	copyLabel: string
	closeLabel: string
	titleLabel: string
	titleHeadingId: string
}

type HeadingStatus = 'idle' | 'saving' | 'saved' | 'error'

interface TaskHeadingViewContext extends ViewInstance {
	_onBeforeUnload(event: BeforeUnloadEvent): string | undefined
	_getCanonicalTitle(): string
	_setDraftFromModel(value: string, clearDirty: boolean): void
	_setStatus(status: HeadingStatus, message?: string | null): void
	_setDirty(dirty: boolean): void
	setDraftToCanonical(): void
	save(): Promise<void>
	_savePromise: Promise<void> | null
	onTitleBlur(): void
	_commitTitle(title: string): Promise<void>
	_errorId: string
	_titleHeadingId: string
	_titleDraft: string
	_isDirty: boolean
	_isSaving: boolean
	_savedMessageTimer: ReturnType<typeof setTimeout> | null
	_status: HeadingStatus
	_statusMessage: string | null
	_beforeUnloadAttached: boolean
	_boundBeforeUnload: (event: BeforeUnloadEvent) => string | undefined
}

let taskHeadingViewId = 0

const SAVED_MESSAGE_TIMEOUT = 2000

export const TaskHeadingView = View.extend({
	className: 'heading',

	_errorId: '',
	_titleHeadingId: '',
	_titleDraft: '',
	_isDirty: false,
	_isSaving: false,
	_savePromise: null,
	_savedMessageTimer: null,
	_status: 'idle',
	_statusMessage: null,
	_beforeUnloadAttached: false,
	_boundBeforeUnload: null as unknown as (event: BeforeUnloadEvent) => string | undefined,

	initialize(this: TaskHeadingViewContext) {
		taskHeadingViewId += 1
		this._errorId = `task-heading-error-${taskHeadingViewId}`
		this._titleHeadingId = `task-heading-${taskHeadingViewId}`
		this._boundBeforeUnload = this._onBeforeUnload.bind(this)
		this._setDraftFromModel(this._getCanonicalTitle(), false)
	},

	hasUnsavedChanges(this: TaskHeadingViewContext): boolean {
		return this._isDirty || this._isSaving
	},

	events: {
		'input h1': 'onTitleInput',
		'focusout h1': 'onTitleBlur',
		'keydown h1': 'onTitleKeydown',
		'click [data-role="task-heading-copy"]': 'onCopy',
		'click [data-role="task-heading-close"]': 'onClose',
	},

	modelEvents: {
		change: 'onModelChange',
	},

	template(data: TaskHeadingTemplateData) {
		const isEditable = data.canWrite && !data.saving
		const titleClass = isEditable ? 'title input' : 'title input disabled'

		return html`
			<div class="task-properties">
				${data.hexColor ? html`<span class="color-bubble" style="background-color: ${data.hexColor}"></span>` : ''}
				<button type="button" class="title task-id" data-role="task-heading-copy" aria-label="${data.copyLabel}">${data.taskIdentifier}</button>
				${data.done ? html`<span class="done-indicator" role="img" aria-label=${data.doneLabel}>✓</span>` : nothing}
				${data.hasClose ? html`
					<button type="button" class="close" data-role="task-heading-close" aria-label="${data.closeLabel}">
						×
					</button>
				` : ''}
			</div>
			<h1
				id="${data.titleHeadingId}"
				class="${titleClass}"
				contenteditable=${isEditable ? 'true' : nothing}
				aria-label=${isEditable ? data.titleLabel : nothing}
				spellcheck="false"
				tabindex=${isEditable ? 0 : nothing}
				aria-invalid=${data.errormessage ? 'true' : nothing}
				aria-describedby=${data.errormessage ? data.errorId : nothing}
			.textContent=${live(data.title)}></h1>
			${data.statusMessage ? html`
				<span class="heading-status" aria-live="polite">${data.statusMessage}</span>
			` : ''}
			${data.errormessage ? html`<p id="${data.errorId}" class="help is-danger">${data.errormessage}</p>` : ''}
		`
	},

	templateContext(this: TaskHeadingViewContext): TaskHeadingTemplateData {
		const opts = this.options as TaskHeadingViewOptions
		const taskModel = this.model as Model<TaskHeadingTaskAttributes>
		const isSaved = this._status === 'saved'
		const isError = this._status === 'error'
		const statusMessage = (() => {
			if (this._status === 'saving') {
				return opts.labels.saving
			}
			if (isSaved) {
				return opts.labels.saved
			}
			if (isError) {
				return this._statusMessage ?? opts.labels.saveError
			}
			return null
		})()

		return {
			canWrite: Boolean(opts.canWrite),
			hasClose: Boolean(opts.hasClose),
			taskIdentifier: opts.taskIdentifier,
			title: this._titleDraft,
			done: Boolean(taskModel.get('done')),
			hexColor: taskModel.get('hexColor') as string,
			saving: this._status === 'saving',
			saved: isSaved,
			errormessage: isError ? statusMessage : null,
			statusMessage,
			errorId: this._errorId,
			isDirty: this._isDirty,
			doneLabel: opts.labels.done,
			copyLabel: opts.labels.copy,
			closeLabel: opts.labels.close,
			titleLabel: opts.labels.title,
			titleHeadingId: this._titleHeadingId,
		}
	},

	onDestroy(this: TaskHeadingViewContext) {
		if (this._beforeUnloadAttached) {
			window.removeEventListener('beforeunload', this._boundBeforeUnload)
			this._beforeUnloadAttached = false
		}
		if (this._savedMessageTimer !== null) {
			clearTimeout(this._savedMessageTimer)
			this._savedMessageTimer = null
		}
	},

	_setStatus(this: TaskHeadingViewContext, status: HeadingStatus, message: string | null = null) {
		if (this._savedMessageTimer !== null) clearTimeout(this._savedMessageTimer)
		this._savedMessageTimer = null
		this._status = status
		this._statusMessage = message
		if (status === 'saved') {
			this._savedMessageTimer = setTimeout(() => {
				this._savedMessageTimer = null
				if (!this.isDestroyed()) {
					this._status = 'idle'
					this.render()
				}
			}, SAVED_MESSAGE_TIMEOUT)
		}
		this.render()
	},

	_setDirty(this: TaskHeadingViewContext, isDirty: boolean) {
		this._isDirty = isDirty
		if (isDirty && !this._beforeUnloadAttached) {
			window.addEventListener('beforeunload', this._boundBeforeUnload)
			this._beforeUnloadAttached = true
		}
		if (!isDirty && this._beforeUnloadAttached) {
			window.removeEventListener('beforeunload', this._boundBeforeUnload)
			this._beforeUnloadAttached = false
		}
	},

	_getCanonicalTitle(this: TaskHeadingViewContext): string {
		const taskModel = this.model as Model<TaskHeadingTaskAttributes>
		return String(taskModel.get('title') ?? '')
	},

	_setDraftFromModel(this: TaskHeadingViewContext, value: string, clearDirty: boolean) {
		this._titleDraft = value
		if (clearDirty) {
			this._setDirty(false)
		}
	},

	onModelChange(this: TaskHeadingViewContext) {
		const canonicalTitle = this._getCanonicalTitle()
		if (!this._isDirty) {
			this._setDraftFromModel(canonicalTitle, false)
			this.render()
			return
		}

		if (this._titleDraft === canonicalTitle) {
			this._setDirty(false)
		}
		this.render()
	},

	_getTitleElement(this: TaskHeadingViewContext): HTMLHeadingElement | null {
		return this.el.querySelector('h1') as HTMLHeadingElement | null
	},

	setDraftToCanonical(this: TaskHeadingViewContext) {
		this._setDraftFromModel(this._getCanonicalTitle(), true)
		this.render()
	},

	onTitleInput(this: TaskHeadingViewContext, event: Event) {
		const opts = this.options as TaskHeadingViewOptions
		if (!opts.canWrite || this._isSaving) {
			return
		}
		const target = event.target as HTMLHeadingElement
		this._titleDraft = target.textContent ?? ''
		this._setDirty(this._titleDraft !== this._getCanonicalTitle())
		if (this._status === 'error' && this._titleDraft.trim() !== '') {
			this._setStatus('idle')
		}
	},

	onTitleBlur(this: TaskHeadingViewContext) {
		if (!this._isSaving) {
			void this.save().catch(() => {})
		}
	},

	async save(this: TaskHeadingViewContext): Promise<void> {
		if (this._savePromise) {
			return this._savePromise
		}
		const opts = this.options as TaskHeadingViewOptions
		if (!opts.canWrite || this._isSaving || this.isDestroyed()) {
			return
		}

		const canonicalTitle = this._getCanonicalTitle()
		const trimmed = this._titleDraft.trim()
		if (trimmed === '') {
			this.setDraftToCanonical()
			this._setStatus('error', opts.labels.titleRequired)
			return
		}
		if (this._titleDraft === canonicalTitle) {
			this._setDraftFromModel(canonicalTitle, false)
			this._setStatus('idle')
			this._setDirty(false)
			return
		}

		this._savePromise = this._commitTitle(this._titleDraft)
		try {
			await this._savePromise
		} finally {
			this._savePromise = null
		}
	},

	onTitleKeydown(this: TaskHeadingViewContext, event: KeyboardEvent) {
		const opts = this.options as TaskHeadingViewOptions
		if (!opts.canWrite || this._isSaving || event.isComposing) {
			return
		}

		if (event.key === 'Enter') {
			event.preventDefault()
			event.stopPropagation()
			this.onTitleBlur()
		}

		if (event.key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			this.setDraftToCanonical()
			this._setStatus('idle')
			;(event.target as HTMLElement).blur()
		}
	},

	async _commitTitle(this: TaskHeadingViewContext, title: string) {
		if (this._isSaving || this.isDestroyed()) {
			return
		}
		const opts = this.options as TaskHeadingViewOptions
		this._isSaving = true
		this._setStatus('saving')
		try {
			await Promise.resolve(opts.onCommit(title))
			if (this.isDestroyed()) {
				return
			}
			this._titleDraft = this._getCanonicalTitle()
			this._setDirty(false)
			this._setStatus('saved')
		} catch (error) {
			if (!this.isDestroyed()) {
				this._setStatus('error', opts.labels.saveError)
				this._setDirty(true)
			}
			throw error
		} finally {
			if (!this.isDestroyed()) {
				this._isSaving = false
				this.render()
			}
		}
	},

	onCopy(this: TaskHeadingViewContext, event: MouseEvent) {
		event.preventDefault()
		const opts = this.options as TaskHeadingViewOptions
		Promise.resolve(opts.onCopy(opts.taskUrl, opts.taskIdentifier))
	},

	onClose(this: TaskHeadingViewContext, event: MouseEvent) {
		event.preventDefault()
		const opts = this.options as TaskHeadingViewOptions
		if (typeof opts.onClose === 'function') {
			opts.onClose()
		}
	},

	_onBeforeUnload(this: TaskHeadingViewContext, event: BeforeUnloadEvent) {
		if (!this._isDirty) {
			return
		}
		event.preventDefault()
		event.returnValue = ''
		return ''
	},
}) as new (options: TaskHeadingViewOptions) => TaskHeadingViewInstance

export default TaskHeadingView
