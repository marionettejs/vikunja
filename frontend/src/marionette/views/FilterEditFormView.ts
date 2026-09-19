import {html, nothing} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {RichTextEditorView, type RichTextEditorViewInstance} from './RichTextEditorView'
import {FilterInputView, type FilterInputViewInstance} from './FilterInputView'
import {createEditorControls, type EditorControls} from './createEditorControls'
import {createEditorExtensions} from '@/components/input/editor/editorExtensions'
import type {Extensions} from '@tiptap/core'
import type {Label} from '@/client/generated'

export interface FilterEditFormViewOptions {
	t: (key: string) => string
	labels: Label[]
	labelsPending: boolean
	getLabelByExactTitle: (title: string) => Label | undefined
	getLabelById: (id: number) => Label | undefined
	findProjectByExactname: (title: string) => {id: number; title: string} | undefined
	getProjectTitle: (id: number) => string | undefined
	flatpickrLocale: object
	weekStart?: number
	onTitleChange: (title: string) => void
	onTitleValidate: () => void
	onDescriptionChange: (description: string) => void
	onQueryChange: (query: string) => void
	onSave: () => void
	loading: boolean
	titleValid: boolean
	initialTitle: string
	initialDescription: string
	initialQuery: string
}

interface TemplateData {
	t: (key: string) => string
	loading: boolean
	titleValid: boolean
	initialTitle: string
	LABEL_TITLE: string
	LABEL_DESCRIPTION: string
	LABEL_QUERY: string
	PLACEHOLDER_TITLE: string
	ERROR_TITLE_REQUIRED: string
}

interface FilterEditFormViewContext extends ViewInstance {
	_titleInput: HTMLInputElement | null
	_descriptionEditorView: RichTextEditorViewInstance | null
	_queryInputView: FilterInputViewInstance | null
	_editorControls: EditorControls | null
	_editorGeneration: number
	_loading: boolean
	_titleValid: boolean
	_options(): FilterEditFormViewOptions
	_initExtensions(): Extensions
	_createDescriptionEditor(): void
	_createQueryInput(): void
	_destroyDescriptionEditor(): void
	_destroyQueryInput(): void
	_applyDisabled(): void
	setTitle(value: string): void
	setDescription(value: string): void
	setQuery(value: string): void
	setLoading(loading: boolean): void
	setTitleValid(valid: boolean): void
	updateLabels(labels: Label[], pending: boolean): void
	onFormSubmit(event: Event): void
}

const LABEL_TITLE = 'filters.attributes.title'
const LABEL_DESCRIPTION = 'filters.attributes.description'
const LABEL_QUERY = 'filters.title'
const PLACEHOLDER_TITLE = 'filters.attributes.titlePlaceholder'
const PLACEHOLDER_DESCRIPTION = 'filters.attributes.descriptionPlaceholder'
const ERROR_TITLE_REQUIRED = 'filters.create.titleRequired'

export const FilterEditFormView = View.extend({
	className: 'filter-edit-form',

	_titleInput: null as HTMLInputElement | null,
	_descriptionEditorView: null as RichTextEditorViewInstance | null,
	_queryInputView: null as FilterInputViewInstance | null,
	_editorControls: null as EditorControls | null,
	_editorGeneration: 0,
	_loading: false,
	_titleValid: true,

	regions: {
		toolbar: '[data-region="toolbar"]',
		descriptionEditor: '[data-region="description-editor"]',
		queryInput: '[data-region="query-input"]',
	},

	events: {
		'submit form': 'onFormSubmit',
	},

	templateContext(this: FilterEditFormViewContext): TemplateData {
		const opts = this._options()
		return {
			t: opts.t,
			loading: opts.loading,
			titleValid: opts.titleValid,
			initialTitle: opts.initialTitle,
			LABEL_TITLE,
			LABEL_DESCRIPTION,
			LABEL_QUERY,
			PLACEHOLDER_TITLE,
			ERROR_TITLE_REQUIRED,
		}
	},

	template(data: TemplateData) {
		const {t, loading, titleValid, initialTitle, LABEL_TITLE, LABEL_DESCRIPTION, LABEL_QUERY, PLACEHOLDER_TITLE, ERROR_TITLE_REQUIRED} = data
		return html`
			<form>
				<div class="field">
					<label class="label" for="Title">${t(LABEL_TITLE)}</label>
					<div class="control">
						<input
							id="Title"
							class="input ${!titleValid ? 'is-danger' : ''}"
							type="text"
							placeholder="${t(PLACEHOLDER_TITLE)}"
							value="${initialTitle}"
							?disabled="${loading}"
							?aria-invalid="${!titleValid}"
						>
					</div>
					${!titleValid ? html`
						<p class="help is-danger">${t(ERROR_TITLE_REQUIRED)}</p>
					` : nothing}
				</div>

				<div class="field">
					<label class="label">${t(LABEL_DESCRIPTION)}</label>
					<div class="control" data-region="toolbar"></div>
					<div class="control" data-region="description-editor"></div>
				</div>

				<div class="field">
					<label class="label">${t(LABEL_QUERY)}</label>
					<div class="control" data-region="query-input"></div>
				</div>
				<button
					type="submit"
					class="is-hidden"
					tabindex="-1"
				></button>
			</form>
		`
	},

	initialize(this: FilterEditFormViewContext) {
		this._initExtensions()
	},

	onRender(this: FilterEditFormViewContext) {
		this._loading = this._options().loading
		this._titleValid = this._options().titleValid
		this._titleInput = this.el.querySelector('#Title')
		if (this._titleInput) {
			this._titleInput.value = this._options().initialTitle
			this._titleInput.addEventListener('focusout', this._options().onTitleValidate)
			this._titleInput.addEventListener('input', (e) => {
				const target = e.target as HTMLInputElement
				this._options().onTitleChange(target.value)
			})
			this._titleInput.focus()
		}

		this._createDescriptionEditor()
		this._createQueryInput()
	},

	onBeforeDestroy(this: FilterEditFormViewContext) {
		if (this._titleInput) {
			this._titleInput.removeEventListener('focusout', this._options().onTitleValidate)
			this._titleInput = null
		}
		this._destroyDescriptionEditor()
		this._destroyQueryInput()
	},

	_options(this: FilterEditFormViewContext): FilterEditFormViewOptions {
		return this.options as FilterEditFormViewOptions
	},

	_initExtensions(this: FilterEditFormViewContext): Extensions {
		const opts = this._options()
		return createEditorExtensions({
			t: opts.t,
			isEditing: () => true,
			isEditEnabled: () => !opts.loading,
			placeholder: () => opts.t(PLACEHOLDER_DESCRIPTION),
			contentHasChanged: () => false,
			bubbleSave: () => {},
			getEditor: () => this._descriptionEditorView?.getEditor(),
			uploadCallback: () => undefined,
			uploadAndInsertFiles: () => {},
		})
	},

	_createDescriptionEditor(this: FilterEditFormViewContext) {
		const opts = this._options()
		const extensions = this._initExtensions()

		this._editorGeneration += 1
		const generation = this._editorGeneration

		this._descriptionEditorView = new RichTextEditorView({
			extensions,
			content: opts.initialDescription,
			editable: !opts.loading,
			editorId: `filter-edit-description-editor-${generation}`,
			ariaLabel: opts.t('input.editor.label'),
			onChange: (html: string) => {
				if (generation !== this._editorGeneration) return
				opts.onDescriptionChange(html)
			},
		}) as RichTextEditorViewInstance

		this.showChildView('descriptionEditor', this._descriptionEditorView)

		const editor = this._descriptionEditorView.getEditor()
		if (editor) {
			this._editorControls = createEditorControls({
				getEditor: () => editor,
				t: opts.t,
				pluginKeyPrefix: `filterEditDescription${generation}`,
				isActive: () => generation === this._editorGeneration,
			})
			this.showChildView('toolbar', this._editorControls.toolbarView)
		}
	},

	_destroyDescriptionEditor(this: FilterEditFormViewContext) {
		this._editorControls?.destroy()
		this._editorControls = null
		this._descriptionEditorView?.destroy()
		this._descriptionEditorView = null
	},

	_createQueryInput(this: FilterEditFormViewContext) {
		const opts = this._options()

		this._queryInputView = new FilterInputView({
			projectId: undefined,
			modelValue: opts.initialQuery,
			onUpdate: (value: string) => {
				opts.onQueryChange(value)
			},
			t: opts.t,
			getLabelByExactTitle: opts.getLabelByExactTitle,
			getLabelById: opts.getLabelById,
			labels: opts.labels,
			labelsPending: opts.labelsPending,
			findProjectByExactname: opts.findProjectByExactname,
			getProjectTitle: opts.getProjectTitle,
			flatpickrLocale: opts.flatpickrLocale,
			weekStart: opts.weekStart,
		}) as FilterInputViewInstance

		this.showChildView('queryInput', this._queryInputView)
	},

	_destroyQueryInput(this: FilterEditFormViewContext) {
		this._queryInputView?.destroy()
		this._queryInputView = null
	},

	setTitle(this: FilterEditFormViewContext, value: string): void {
		if (this._titleInput && this._titleInput.value !== value) {
			this._titleInput.value = value
		}
	},

	setDescription(this: FilterEditFormViewContext, value: string): void {
		const editor = this._descriptionEditorView?.getEditor()
		if (editor && editor.getHTML() !== value) {
			editor.commands.setContent(value, {emitUpdate: false})
		}
	},

	setQuery(this: FilterEditFormViewContext, value: string): void {
		this._queryInputView?.setModelValue(value)
	},

	_applyDisabled(this: FilterEditFormViewContext): void {
		if (this._titleInput) {
			this._titleInput.disabled = this._loading
		}
	},

	setLoading(this: FilterEditFormViewContext, loading: boolean): void {
		this._loading = loading
		this._applyDisabled()
		this._descriptionEditorView?.setEditable(!loading)
		this._queryInputView?.setEditable(!loading)
	},

	setTitleValid(this: FilterEditFormViewContext, valid: boolean): void {
		this._titleValid = valid
		if (this._titleInput) {
			this._titleInput.setAttribute('aria-invalid', String(!valid))
			this._titleInput.classList.toggle('is-danger', !valid)
			this._applyDisabled()
		}
		const helpEl = this.el.querySelector('.help.is-danger')
		if (helpEl) {
			helpEl.remove()
		}
		if (!valid) {
			const controlEl = this._titleInput?.parentElement
			if (controlEl) {
				const help = document.createElement('p')
				help.className = 'help is-danger'
				help.textContent = this._options().t(ERROR_TITLE_REQUIRED)
				controlEl.appendChild(help)
			}
		}
	},

	updateLabels(this: FilterEditFormViewContext, labels: Label[], pending: boolean): void {
		this._queryInputView?.updateLabels(labels, pending)
	},

	onFormSubmit(this: FilterEditFormViewContext, event: Event): void {
		event.preventDefault()
		this._options().onSave()
	},
}) as new (options: FilterEditFormViewOptions) => FilterEditFormViewContext & {
	setTitle: (value: string) => void
	setDescription: (value: string) => void
	setQuery: (value: string) => void
	setLoading: (loading: boolean) => void
	setTitleValid: (valid: boolean) => void
	updateLabels: (labels: Label[], pending: boolean) => void
}
