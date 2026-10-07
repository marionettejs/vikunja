import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {Editor, Extension} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {Placeholder} from '@tiptap/extensions'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {createFilterHighlighter, filterHighlighterKey} from '@/components/input/filter/highlighter'
import {transformFilterStringForApi, transformFilterStringFromApi} from '@/helpers/filters'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'
import FilterAutocomplete from './filter-autocomplete'
import {FilterDatePopupView} from './filter-date-popup'
import type {FilterContext} from './filter-context'

export const FilterInputView = View.extend({
	ui: {'editor': '[data-editor]'},
	className: 'filter-input mbe-2',
	initialize(options: {context: FilterContext, projectId?: number, autofocus?: boolean, value: string, changed: (value: string) => void}) { void options },
	regions: {date: '[data-date-popup]'},
	template: () => html`<div class="editor-wrapper"><div class="editor-content" data-editor></div></div><div data-date-popup style="display:contents"></div>`,
	createState() { return {editor: undefined as Editor | undefined, lastEmitted: undefined as string | undefined, pendingContent: undefined as string | undefined, pendingValue: undefined as string | undefined, waitingLabels: false, oldDate: '', stopLabels: undefined as (() => void) | undefined} },
	onAttach() {
		const ctx = this.options.context
		const highlighter = Extension.create({name: 'filterHighlighter', addProseMirrorPlugins: () => [createFilterHighlighter(ctx.labels)]})
		const dateClick = Extension.create({name: 'dateClickHandler', addProseMirrorPlugins: () => [new Plugin({key: new PluginKey('dateClickHandler'), props: {handleClick: (_view, _position, event) => {
			const target = event.target as HTMLElement
			if (!target.classList.contains('date-value')) return false
			event.preventDefault(); event.stopPropagation()
			this.openDate(target.getAttribute('data-date-value') || '')
			return true
		}}})]})
		const enter = Extension.create({name: 'enterHandler', addKeyboardShortcuts: () => ({Enter: () => {
			const popup = this.el.closest('dialog')?.querySelector<HTMLElement>('#filter-autocomplete-popup')
			return !(popup && popup.style.display !== 'none')
		}})})
		this.getState().editor = new Editor({element: (this.getUI('editor')![0] as HTMLElement)!, editorProps: {attributes: {role: 'textbox', 'aria-label': ctx.ui.t('filters.query.label')}},
			extensions: [StarterKit.configure({history: false} as Parameters<typeof StarterKit.configure>[0]), Placeholder.configure({placeholder: ctx.ui.t('filters.query.placeholder')}), highlighter, dateClick, FilterAutocomplete.configure({context: ctx, projectId: this.options.projectId}), enter], content: '',
			onUpdate: ({editor}) => { const value = this.process(editor.getText()); this.getState().lastEmitted = value; this.options.changed(value) },
		})
		this.setModelValue(this.options.value)
		this.getState().stopLabels = ctx.observeLabels(() => {
			if (this.isDestroyed()) return
			const state = this.getState(), editor = state.editor!
			editor.view.dispatch(editor.state.tr.setMeta(filterHighlighterKey, true))
			if (!ctx.labelsPending() && state.waitingLabels && editor.getText() === state.pendingContent) { state.waitingLabels = false; this.setModelValue(state.pendingValue ?? '') }
		})
		if(this.options.autofocus !== false) this.focus()
	},
	process(content: string) { const ctx = this.options.context; return transformFilterStringForApi(content, title => ctx.labelByTitle(title)?.id || null, title => ctx.projectByTitle(title)?.id || null) },
	setModelValue(value: string) {
		const state = this.getState(), editor = state.editor, ctx = this.options.context
		this.options.value = value
		if (!editor || value === state.lastEmitted) return
		const content = value ? transformFilterStringFromApi(value, id => ctx.labelById(id)?.title || null, id => ctx.ui.getProject(id)?.title || null) : ''
		if (editor.getText() !== content) { const position = editor.state.selection.from; this.setPlainContent(content); editor.commands.setTextSelection(Math.min(position, editor.state.doc.content.size)) }
		state.lastEmitted = undefined
		if (ctx.labelsPending()) { state.pendingContent = content; state.pendingValue = value; state.waitingLabels = true }
	},
	setPlainContent(content: string) { this.getState().editor?.commands.setContent(content ? {type: 'doc', content: [{type: 'paragraph', content: [{type: 'text', text: content}]}]} : '', {emitUpdate: false}) },
	openDate(value: string) {
		this.getState().oldDate = value
		this.showChildView('date', new FilterDatePopupView({context: this.options.context.ui, value, changed: (date: string | null) => this.updateDate(date), closed: () => this.getRegion('date')!.empty()}))
	},
	updateDate(date: string | Date | null) {
		if (!date) return
		const value = typeof date === 'string' ? date : toISOStringOrNull(date)?.split('T')[0]
		if (!value) return
		const state = this.getState(), text = state.editor!.getText().replace(state.oldDate, value)
		state.oldDate = value; this.setPlainContent(text)
		state.lastEmitted = this.process(text); this.options.changed(state.lastEmitted)
	},
	focus() { this.getState().editor?.commands.focus() },
	onBeforeDestroy() { this.getState().stopLabels?.(); this.getState().editor?.destroy() },
}).setDomApi(LitDomApi)
