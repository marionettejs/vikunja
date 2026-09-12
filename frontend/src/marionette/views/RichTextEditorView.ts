import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {Editor} from '@tiptap/core'
import type {Extensions} from '@tiptap/core'
import {View} from '../index'

export interface RichTextEditorViewOptions {
	extensions: Extensions
	content: string
	editable: boolean
	editorId: string
	ariaLabel: string
	onChange: (html: string) => void
}

interface TemplateData {
	editorId: string
	ariaLabel: string
}

export interface RichTextEditorViewInstance extends ViewInstance {
	getContent(): string
	setEditable(editable: boolean): void
}

export const RichTextEditorView = View.extend({
	className: 'rich-text-editor',

	_editor: null as Editor | null,

	template(data: TemplateData) {
		return html`
			<div
				class='rich-text-editor__content'
				id=${data.editorId}
				aria-label=${data.ariaLabel}
			></div>
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as RichTextEditorViewOptions
		return {
			editorId: opts.editorId,
			ariaLabel: opts.ariaLabel,
		}
	},

	onRender() {
		const opts = this.options as RichTextEditorViewOptions
		const mountEl = this.el.querySelector('.rich-text-editor__content')
		if (!mountEl) {
			return
		}

		this._destroyEditor()

		this._editor = new Editor({
			element: mountEl,
			extensions: opts.extensions,
			content: opts.content,
			editable: opts.editable,
			onUpdate: ({editor}) => {
				opts.onChange(editor.getHTML())
			},
		})
	},

	onBeforeDestroy() {
		this._destroyEditor()
	},

	_destroyEditor() {
		if (this._editor) {
			this._editor.destroy()
			this._editor = null
		}
	},

	getContent(): string {
		if (!this._editor) {
			return ''
		}
		return this._editor.getHTML()
	},

	setEditable(editable: boolean): void {
		if (this._editor) {
			this._editor.setEditable(editable)
		}
	},
}) as new (options: RichTextEditorViewOptions) => RichTextEditorViewInstance
