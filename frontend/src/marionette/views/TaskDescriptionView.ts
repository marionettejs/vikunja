import {html, nothing, render} from 'lit-html'
import type {TaskRecord} from '../data/TaskRecords'
import type {ViewInstance} from 'marionette'
import type {Editor, Extensions} from '@tiptap/core'
import {View} from '../index'
import {RichTextEditorView} from './RichTextEditorView'
import type {RichTextEditorViewInstance} from './RichTextEditorView'
import {createEditorControls, type EditorControls} from './createEditorControls'
import {saveEditorDraft, loadEditorDraft, clearEditorDraft} from '@/helpers/editorDraftStorage'

export interface TaskDescriptionViewLabels {
	description: string
	save: string
	saving: string
	saved: string
	error: string
}

export interface TaskDescriptionViewOptions {
	model: TaskRecord
	extensions: Extensions
	canWrite: boolean
	labels: TaskDescriptionViewLabels
	t: (key: string) => string
	onCommit: (description: string) => Promise<void>
}

export interface TaskDescriptionViewInstance extends ViewInstance {
	save(): Promise<void>
	getEditor(): Editor | undefined
	hasUnsavedChanges(): boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface TaskDescriptionViewContext extends ViewInstance {
	_editorView: RichTextEditorViewInstance | null
	_editorControls: EditorControls | null
	_destroyEditorControls(): void
	_descriptionDraft: string
	_isDirty: boolean
	_isSaving: boolean
	_savePromise: Promise<void> | null
	_performSave(): Promise<void>
	_saveStatus: SaveStatus
	_saveError: string | null
	_autosaveTimer: ReturnType<typeof setTimeout> | null
	_savedMessageTimer: ReturnType<typeof setTimeout> | null
	_beforeUnloadAttached: boolean
	_boundBeforeUnload: (e: BeforeUnloadEvent) => string | undefined
	_storageKey: string
	_viewId: string
	_getTaskId(): number
	_getCanonicalDescription(): string
	_setDirty(dirty: boolean): void
	_setStatus(status: SaveStatus, message?: string | null): void
	_persistDraft(content: string): void
	_scheduleAutosave(): void
	_cancelAutosave(): void
	_onBeforeUnload(e: BeforeUnloadEvent): string | undefined
	_ensureEditorView(): void
	_renderControls(): void
	save(): Promise<void>
	getEditor(): Editor | undefined
}

let taskDescriptionViewId = 0
const AUTOSAVE_DELAY = 5000
const SAVED_MESSAGE_TIMEOUT = 2000
const STORAGE_KEY_PREFIX = 'editorDraft'

function controlsTemplate(data: {
		canWrite: boolean
		saveStatus: SaveStatus
		saveError: string | null
		labels: TaskDescriptionViewLabels
		statusId: string
	}) {
	const {canWrite, saveStatus, saveError, labels, statusId} = data
	const isSaving = saveStatus === 'saving'
	const isSaved = saveStatus === 'saved'
	const isError = saveStatus === 'error'

	const statusMessage = (() => {
		if (isSaving) return labels.saving
		if (isSaved) return labels.saved
		if (isError) return saveError ?? labels.error
		return null
	})()

	return html`
			${canWrite ? html`
				<div class="task-description__footer">
					<button
						type="button"
						data-role="description-save"
						class="button is-primary"
						?disabled=${isSaving}
					>${isSaving ? labels.saving : labels.save}</button>
					<span
						id=${statusId}
						role="status"
						aria-live="polite"
						class="task-description__status"
					>${statusMessage ?? nothing}</span>
				</div>
			` : nothing}
			${isError && saveError ? html`
				<p class="help is-danger">${saveError}</p>
			` : nothing}
		`
}

export const TaskDescriptionView = View.extend({
	className: 'task-description',

	regions: {
		toolbar: '[data-region="description-toolbar"]',
		editor: '[data-region="description-editor"]',
	},

	_editorView: null as RichTextEditorViewInstance | null,
	_editorControls: null as EditorControls | null,
	_descriptionDraft: '',
	_isDirty: false,
	_isSaving: false,
	_savePromise: null as Promise<void> | null,
	_saveStatus: 'idle' as SaveStatus,
	_saveError: null as string | null,
	_autosaveTimer: null as ReturnType<typeof setTimeout> | null,
	_savedMessageTimer: null as ReturnType<typeof setTimeout> | null,
	_beforeUnloadAttached: false,
	_boundBeforeUnload: null as unknown as (e: BeforeUnloadEvent) => string | undefined,
	_storageKey: '',
	_viewId: '',

	initialize(this: TaskDescriptionViewContext) {
		taskDescriptionViewId += 1
		this._viewId = `task-description-${taskDescriptionViewId}`
		this._boundBeforeUnload = this._onBeforeUnload.bind(this)

		const opts = this.options as TaskDescriptionViewOptions
		const taskId = this._getTaskId()
		this._storageKey = `task-description-${taskId}`

		const canonical = this._getCanonicalDescription()
		if (opts.canWrite) {
			const draft = loadEditorDraft(this._storageKey)
			this._descriptionDraft = draft !== null ? draft : canonical
			this._isDirty = draft !== null && draft !== canonical
		} else {
			this._descriptionDraft = canonical
			this._isDirty = false
		}
		this._setDirty(this._isDirty)
	},

	hasUnsavedChanges(this: TaskDescriptionViewContext): boolean {
		return this._isDirty || this._isSaving
	},

	events: {
		'click [data-role="description-save"]': '_onSaveClick',
	},

	template() {
		return html`<div data-region="description-toolbar"></div><div class="task-description__editor" data-region="description-editor"></div><div data-region="description-controls"></div>`
	},

	_renderControls(this: TaskDescriptionViewContext) {
		const container = this.el.querySelector<HTMLDivElement>('[data-region="description-controls"]')
		if (!container) return
		const opts = this.options as TaskDescriptionViewOptions
		render(controlsTemplate({canWrite:opts.canWrite,saveStatus:this._saveStatus,saveError:this._saveError,labels:opts.labels,statusId:`${this._viewId}-status`}), container)
	},

	onBeforeRender(this: TaskDescriptionViewContext) {
		if (this.isRendered()) {
			this.detachChildView('editor')
			if (this._editorControls) {
				this.detachChildView('toolbar')
			}
		}
	},

	onRender(this: TaskDescriptionViewContext) {
		this._ensureEditorView()
		this._renderControls()
	},

	_ensureEditorView(this: TaskDescriptionViewContext) {
		const opts = this.options as TaskDescriptionViewOptions

		if (this._editorView && !this._editorView.isDestroyed()) {
			// Re-attach existing editor without re-creating TipTap instance
			this.showChildView('editor', this._editorView)
			if (this._editorControls) {
				this.showChildView('toolbar', this._editorControls.toolbarView)
			}
			return
		}

		this._editorView = new RichTextEditorView({
			extensions: opts.extensions,
			content: this._descriptionDraft,
			editable: Boolean(opts.canWrite),
			editorId: `${this._viewId}-editor`,
			ariaLabel: opts.labels.description,
			onChange: (html: string) => {
				if (this.isDestroyed() || !opts.canWrite) {
					return
				}
				this._descriptionDraft = html
				const canonical = this._getCanonicalDescription()
				const dirty = html !== canonical
				this._setDirty(dirty)
				this._persistDraft(html)
				if (opts.canWrite) {
					this._scheduleAutosave()
				}
			},
		})

		this.showChildView('editor', this._editorView)

		if (opts.canWrite) {
			const ownedEditorView = this._editorView
			this._editorControls = createEditorControls({
				getEditor: () => ownedEditorView.getEditor(),
				t: opts.t,
				pluginKeyPrefix: this._viewId,
				isActive: () => !this.isDestroyed()
					&& this._editorView === ownedEditorView
					&& !ownedEditorView.isDestroyed(),
			})
			this.showChildView('toolbar', this._editorControls.toolbarView)
		}
	},

	_destroyEditorControls(this: TaskDescriptionViewContext) {
		if (!this._editorControls) {
			return
		}
		// Before the editor goes: the controls unregister their plugins through it.
		this._editorControls.destroy()
		this._editorControls = null
	},

	onBeforeDestroy(this: TaskDescriptionViewContext) {
		this._cancelAutosave()

		if (this._savedMessageTimer !== null) {
			clearTimeout(this._savedMessageTimer)
			this._savedMessageTimer = null
		}

		if (this._beforeUnloadAttached) {
			window.removeEventListener('beforeunload', this._boundBeforeUnload)
			this._beforeUnloadAttached = false
		}

		// Persist unsaved draft on destroy (do not fire async save)
		if (this._isDirty && this._descriptionDraft !== undefined) {
			this._persistDraft(this._descriptionDraft)
		}

		this._destroyEditorControls()

		if (this._editorView && !this._editorView.isDestroyed()) {
			this._editorView.destroy()
			this._editorView = null
		}
	},

	_getTaskId(this: TaskDescriptionViewContext): number {
		const opts = this.options as TaskDescriptionViewOptions
		return Number((opts.model as TaskRecord).get('id') ?? 0)
	},

	_getCanonicalDescription(this: TaskDescriptionViewContext): string {
		const opts = this.options as TaskDescriptionViewOptions
		return String((opts.model as TaskRecord).get('description') ?? '')
	},

	_persistDraft(this: TaskDescriptionViewContext, content: string) {
		const key = this._storageKey
		if (!key) {
			return
		}
		// saveEditorDraft removes the key if content is empty.
		// For an empty editor we want to explicitly mark "no draft" so refresh
		// doesn't restore the old server description. Write an empty-string
		// sentinel under the exact same localStorage key the helper uses,
		// bypassing the helper's empty-removal logic only for the empty case.
		if (!content || content.trim() === '' || content === '<p></p>') {
			try {
				localStorage.setItem(`${STORAGE_KEY_PREFIX}-${key}`, content)
			} catch (_e) {
				// ignore
			}
			return
		}
		saveEditorDraft(key, content)
	},

	_setDirty(this: TaskDescriptionViewContext, dirty: boolean) {
		this._isDirty = dirty
		if (dirty && !this._beforeUnloadAttached) {
			window.addEventListener('beforeunload', this._boundBeforeUnload)
			this._beforeUnloadAttached = true
		}
		if (!dirty && this._beforeUnloadAttached) {
			window.removeEventListener('beforeunload', this._boundBeforeUnload)
			this._beforeUnloadAttached = false
		}
	},

	_setStatus(this: TaskDescriptionViewContext, status: SaveStatus, message: string | null = null) {
		if (this._savedMessageTimer !== null) {
			clearTimeout(this._savedMessageTimer)
			this._savedMessageTimer = null
		}
		this._saveStatus = status
		this._saveError = message
		if (status === 'saved') {
			this._savedMessageTimer = setTimeout(() => {
				this._savedMessageTimer = null
				if (!this.isDestroyed()) {
					this._saveStatus = 'idle'
					this._renderControls()
				}
			}, SAVED_MESSAGE_TIMEOUT)
		}
		if (!this.isDestroyed() && this.isRendered()) {
			this._renderControls()
		}
	},

	_scheduleAutosave(this: TaskDescriptionViewContext) {
		if (this._autosaveTimer !== null) {
			clearTimeout(this._autosaveTimer)
		}
		this._autosaveTimer = setTimeout(() => {
			this._autosaveTimer = null
			if (!this.isDestroyed() && this._isDirty && !this._isSaving) {
				void this.save().catch(() => {})
			}
		}, AUTOSAVE_DELAY)
	},

	_cancelAutosave(this: TaskDescriptionViewContext) {
		if (this._autosaveTimer !== null) {
			clearTimeout(this._autosaveTimer)
			this._autosaveTimer = null
		}
	},

	_onBeforeUnload(this: TaskDescriptionViewContext, event: BeforeUnloadEvent) {
		if (!this._isDirty) {
			return
		}
		event.preventDefault()
		event.returnValue = ''
		return ''
	},

	_onSaveClick(this: TaskDescriptionViewContext) {
		void this.save().catch(() => {})
	},

	save(this: TaskDescriptionViewContext): Promise<void> {
		if (this._savePromise) return this._savePromise
		if (this.isDestroyed()) return Promise.reject(new Error('Description view is destroyed'))
		this._savePromise = this._performSave().finally(() => { this._savePromise = null })
		return this._savePromise
	},

	async _performSave(this: TaskDescriptionViewContext): Promise<void> {
		const opts = this.options as TaskDescriptionViewOptions
		if (!opts.canWrite || !this._isDirty) return
		this._cancelAutosave()
		this._isSaving = true
		this._setStatus('saving')
		try {
			while (this._isDirty && !this.isDestroyed()) {
				const submitted = this._descriptionDraft
				await opts.onCommit(submitted)
				if (this.isDestroyed()) return
				if (this._descriptionDraft === submitted) {
					clearEditorDraft(this._storageKey)
					this._setDirty(false)
				}
			}
			this._setStatus('saved')
		} catch (error) {
			if (!this.isDestroyed()) this._setStatus('error', opts.labels.error)
			throw error
		} finally {
			this._isSaving = false
		}
	},

	getEditor(this: TaskDescriptionViewContext): Editor | undefined {
		if (this._editorView && !this._editorView.isDestroyed()) {
			return this._editorView.getEditor()
		}
		return undefined
	},
}) as new (options: TaskDescriptionViewOptions) => TaskDescriptionViewInstance

export default TaskDescriptionView
