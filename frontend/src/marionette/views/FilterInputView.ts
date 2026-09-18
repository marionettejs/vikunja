import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {RichTextEditorView, type RichTextEditorViewInstance} from './RichTextEditorView'
import {FilterDatepickerView, type FilterDatepickerViewInstance} from './FilterDatepickerView'
import type {Extensions} from '@tiptap/core'
import {Extension} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {Placeholder} from '@tiptap/extensions'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {createFilterHighlighter, filterHighlighterKey} from '@/components/input/filter/highlighter'
import FilterAutocomplete from '@/components/input/filter/FilterAutocomplete'
import type {Label} from '@/client/generated'
import {transformFilterStringForApi, transformFilterStringFromApi} from '@/helpers/filters'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'

export interface FilterInputViewOptions {
	projectId?: number
	modelValue?: string
	onUpdate: (value: string) => void
	t: (key: string) => string
	getLabelByExactTitle: (title: string) => Label | undefined
	getLabelById: (id: number) => Label | undefined
	labels: Label[]
	labelsPending: boolean
	findProjectByExactname: (title: string) => {id: number; title: string} | undefined
	getProjectTitle: (id: number) => string | undefined
	flatpickrLocale: object
	weekStart?: number
}

interface FilterInputViewContext extends ViewInstance {
	_editorView: RichTextEditorViewInstance | null
	_datepickerView: FilterDatepickerViewInstance | null
	_currentOldDatepickerValue: string
	_currentDatepickerValue: string | Date | null
	_currentDatepickerPos: number
	_datePickerPopupOpen: boolean
	_lastEmittedValue: string | undefined
	_pendingEditorContent: string | undefined
	_pendingModelValue: string | undefined
	_waitingForLabels: boolean
	_labels: Label[]
	_extensions: Extensions
	_options(): FilterInputViewOptions
	_initExtensions(): void
	_processContent(content: string): string
	_setEditorContentFromModelValue(newValue: string | undefined): void
	setModelValue(value: string | undefined): void
	updateLabels(labels: Label[], pending: boolean): void
	_updateDateInQuery(newDate: string | Date | null): void
	focus(): void
}

const PLACEHOLDER_KEY = 'filters.query.placeholder'
const LABEL_KEY = 'filters.query.label'
const NO_RESULTS_KEY = 'filters.noResults'

export const FilterInputView = View.extend({
	className: 'filter-input',

	_editorView: null as RichTextEditorViewInstance | null,
	_datepickerView: null as FilterDatepickerViewInstance | null,
	_currentOldDatepickerValue: '',
	_currentDatepickerValue: null as string | Date | null,
	_currentDatepickerPos: 0,
	_datePickerPopupOpen: false,
	_lastEmittedValue: undefined as string | undefined,
	_pendingEditorContent: undefined as string | undefined,
	_pendingModelValue: undefined as string | undefined,
	_waitingForLabels: false,
	_labels: [] as Label[],
	_extensions: [] as Extensions,

	regions: {
		editor: '[data-region="editor"]',
		datepicker: '[data-region="datepicker"]',
	},

	template() {
		return html`
			<div class="editor-wrapper" data-region="editor"></div>
			<div data-region="datepicker"></div>
		`
	},

	initialize(this: FilterInputViewContext) {
		const opts = this.options as FilterInputViewOptions
		this._labels = opts.labels
		this._initExtensions()
	},

	onRender(this: FilterInputViewContext) {
		const opts = this.options as FilterInputViewOptions

		this._editorView = new RichTextEditorView({
			extensions: this._extensions,
			content: '',
			editable: true,
			editorId: `${this.cid}-filter-editor`,
			ariaLabel: opts.t(LABEL_KEY),
			role: 'textbox',
			onChange: () => {
				if (!this._editorView) return
				const editor = this._editorView.getEditor()
				if (!editor) return
				const content = editor.getText()
				const processed = this._processContent(content)
				this._lastEmittedValue = processed
				opts.onUpdate(processed)
			},
		}) as RichTextEditorViewInstance
		this.showChildView('editor', this._editorView)

		this._datepickerView = new FilterDatepickerView({
			modelValue: this._currentDatepickerValue,
			onChange: this._updateDateInQuery.bind(this),
			open: this._datePickerPopupOpen,
			onOpenChange: (open: boolean) => {
				this._datePickerPopupOpen = open
			},
			ignoreClickClasses: ['date-value'],
			t: opts.t,
			flatpickrLocale: opts.flatpickrLocale,
			weekStart: opts.weekStart,
		}) as FilterDatepickerViewInstance
		this.showChildView('datepicker', this._datepickerView)

		this._setEditorContentFromModelValue(opts.modelValue)
	},

	onBeforeDestroy(this: FilterInputViewContext) {
		this._editorView?.destroy()
		this._editorView = null
		this._datepickerView?.destroy()
		this._datepickerView = null
	},

	_options(this: FilterInputViewContext): FilterInputViewOptions {
		return this.options as FilterInputViewOptions
	},

	_initExtensions(this: FilterInputViewContext) {
		const opts = this._options()

		// Raw ProseMirror plugins are ignored in the extensions array — each
		// needs an Extension wrapper exposing it via addProseMirrorPlugins,
		// exactly like FilterInput.vue does.
		const highlighterPlugin = createFilterHighlighter(() => this._labels)

		const FilterHighlightExtension = Extension.create({
			name: 'filterHighlighter',
			addProseMirrorPlugins() {
				return [highlighterPlugin]
			},
		})

		const dateClickPlugin = new Plugin({
			key: new PluginKey('dateClickHandler'),
			props: {
				handleClick: (view, _pos, event) => {
					const target = event.target as HTMLElement
					if (target.classList.contains('date-value')) {
						event.preventDefault()
						event.stopPropagation()

						const dateValue = target.getAttribute('data-date-value') || ''
						const position = parseInt(target.getAttribute('data-position') || '0', 10)

						this._currentOldDatepickerValue = dateValue
						this._currentDatepickerValue = dateValue
						this._currentDatepickerPos = position
						this._datePickerPopupOpen = true
						this._datepickerView?.setModelValue(dateValue)
						this._datepickerView?.setOpen(true)

						return true
					}
					return false
				},
			},
		})

		const DateClickExtension = Extension.create({
			name: 'dateClickHandler',
			addProseMirrorPlugins() {
				return [dateClickPlugin]
			},
		})

		const EnterHandler = new Plugin({
			key: new PluginKey('enterHandler'),
			props: {
				handleKeyDown: (_view, event) => {
					if (event.key !== 'Enter') {
						return false
					}
					const popup = document.getElementById('filter-autocomplete-popup')
					const isAutocompleteVisible = popup && popup.style.display !== 'none'

					if (isAutocompleteVisible) {
						return false
					}

					return true
				},
			},
		})

		const EnterExtension = Extension.create({
			name: 'enterHandler',
			addProseMirrorPlugins() {
				return [EnterHandler]
			},
		})

		this._extensions = [
			StarterKit.configure({
				history: false,
			}),
			Placeholder.configure({
				placeholder: opts.t(PLACEHOLDER_KEY),
			}),
			FilterHighlightExtension,
			DateClickExtension,
			FilterAutocomplete.configure({
				get projectId() {
					return opts.projectId
				},
				emptyLabel: opts.t(NO_RESULTS_KEY),
			}),
			EnterExtension,
		]
	},

	_processContent(this: FilterInputViewContext, content: string): string {
		const opts = this._options()
		return transformFilterStringForApi(
			content,
			labelTitle => opts.getLabelByExactTitle(labelTitle)?.id ?? null,
			projectTitle => {
				const found = opts.findProjectByExactname(projectTitle)
				return found?.id ?? null
			},
		)
	},

	_setEditorContentFromModelValue(this: FilterInputViewContext, newValue: string | undefined) {
		if (!this._editorView) return

		const opts = this._options()
		const editor = this._editorView.getEditor()
		if (!editor) return

		const content = newValue
			? transformFilterStringFromApi(
				newValue,
				labelId => opts.getLabelById(labelId)?.title ?? null,
				projectId => opts.getProjectTitle(projectId) ?? null,
			)
			: ''

		if (editor.getText() !== content) {
			const currentPosition = editor.state.selection.from

			editor.commands.setContent(
				content
					? {
						type: 'doc',
						content: [{
							type: 'paragraph',
							content: [{type: 'text', text: content}],
						}],
					}
					: '',
				{emitUpdate: false},
			)

			const maxPosition = editor.state.doc.content.size
			const safePosition = Math.min(currentPosition, maxPosition)
			editor.commands.setTextSelection(safePosition)
		}

		if (opts.labelsPending) {
			this._pendingEditorContent = content
			this._pendingModelValue = newValue
			this._waitingForLabels = true
		}
	},

	setModelValue(this: FilterInputViewContext, value: string | undefined) {
		if (value === this._lastEmittedValue) {
			return
		}
		this._setEditorContentFromModelValue(value)
		this._lastEmittedValue = undefined
	},

	updateLabels(this: FilterInputViewContext, labels: Label[], pending: boolean) {
		this._labels = labels
		const opts = this._options()
		opts.labels = labels
		opts.labelsPending = pending

		if (!pending && this._waitingForLabels) {
			const editor = this._editorView?.getEditor()
			if (editor && editor.getText() === this._pendingEditorContent) {
				this._waitingForLabels = false
				this._setEditorContentFromModelValue(this._pendingModelValue)
			}
		}

		const editor = this._editorView?.getEditor()
		if (!editor) {
			return
		}
		editor.view.dispatch(editor.state.tr.setMeta(filterHighlighterKey, true))
	},

	_updateDateInQuery(this: FilterInputViewContext, newDate: string | Date | null) {
		if (!this._editorView || !newDate) return

		const editor = this._editorView.getEditor()
		if (!editor) return

		const dateStr = typeof newDate === 'string' ? newDate : toISOStringOrNull(newDate)?.split('T')[0]
		if (!dateStr) return

		const currentText = editor.getText()
		const newText = currentText.replace(this._currentOldDatepickerValue, dateStr)
		this._currentOldDatepickerValue = dateStr

		editor.commands.setContent(
			newText
				? {
					type: 'doc',
					content: [{
						type: 'paragraph',
						content: [{type: 'text', text: newText}],
					}],
				}
				: '',
			{emitUpdate: false},
		)

		const processed = this._processContent(newText)
		this._lastEmittedValue = processed
		this._options().onUpdate(processed)
	},

	focus(this: FilterInputViewContext): void {
		this._editorView?.getEditor()?.commands.focus()
	},
}) as new (options: FilterInputViewOptions) => FilterInputViewContext