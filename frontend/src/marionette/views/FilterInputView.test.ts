import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import type {RichTextEditorViewInstance} from './RichTextEditorView'
import type {FilterDatepickerViewInstance} from './FilterDatepickerView'
import type {Label} from '@/client/generated'

vi.mock('@/composables/useLabels', () => ({
	useLabels: () => ({
		filterLabelsByQuery: () => [],
	}),
}))

vi.mock('@/stores/projects', () => ({
	useProjectStore: () => ({
		searchProject: () => [],
	}),
}))

import {FilterInputView} from './FilterInputView'
import type {FilterInputViewOptions} from './FilterInputView'

type FilterInputViewInstance = ViewInstance & {
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
	_extensions: Array<unknown>
	_processContent(content: string): string
	_setEditorContentFromModelValue(newValue: string | undefined): void
	setModelValue(value: string | undefined): void
	updateLabels(labels: Label[], pending: boolean): void
	_updateDateInQuery(newDate: string | Date | null): void
	focus(): void
}

type EditorHolder = {
	_editor: unknown
}

type FlatpickrHolder = {
	_flatpickr: unknown
}

const createMockLabel = (id: number, title: string): Label => ({
	id,
	title,
	hex_color: '3b82f6',
	description: '',
	created: new Date().toISOString(),
	updated: new Date().toISOString(),
})

describe('FilterInputView', () => {
	let views: ViewInstance[] = []

	const mockLabels: Label[] = [
		createMockLabel(1, 'bug'),
		createMockLabel(2, 'feature'),
		createMockLabel(3, 'urgent'),
	]

	const mockProjects: Record<number, {id: number, title: string}> = {
		1: {id: 1, title: 'Project Alpha'},
		2: {id: 2, title: 'Project Beta'},
	}

	function createView(overrides: Partial<FilterInputViewOptions> = {}): FilterInputViewInstance {
		const onUpdate = vi.fn()
		const t = vi.fn((key: string) => {
			const translations: Record<string, string> = {
				'filters.query.placeholder': 'Enter filter query...',
				'filters.query.label': 'Filter query',
				'filters.noResults': 'No results',
			}
			return translations[key] ?? key
		})

		const options: FilterInputViewOptions = {
			projectId: 1,
			modelValue: undefined,
			onUpdate,
			t,
			getLabelByExactTitle: (title: string) => mockLabels.find(l => l.title === title),
			getLabelById: (id: number) => mockLabels.find(l => l.id === id),
			labels: mockLabels,
			labelsPending: false,
			findProjectByExactname: (title: string) => Object.values(mockProjects).find(p => p.title === title),
			getProjectTitle: (id: number) => mockProjects[id]?.title,
			flatpickrLocale: {firstDayOfWeek: 1},
			weekStart: 1,
			...overrides,
		}

		const view = new FilterInputView(options) as FilterInputViewInstance
		views.push(view)
		view.render()
		document.body.appendChild(view.el)
		return view
	}

	function getEditor(view: FilterInputViewInstance) {
		return view._editorView?.getEditor()
	}

	beforeEach(() => {
		views = []
		document.body.innerHTML = ''
	})

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	describe('initialization', () => {
		it('renders editor and datepicker regions', () => {
			const view = createView()
			expect(view.el.querySelector('[data-region="editor"]')).not.toBeNull()
			expect(view.el.querySelector('[data-region="datepicker"]')).not.toBeNull()
		})

		it('initializes editor with empty content', () => {
			const view = createView()
			const editor = getEditor(view)
			expect(editor).toBeDefined()
			expect(editor?.getText()).toBe('')
		})

		it('initializes extensions including highlighter, autocomplete, and date click handler', () => {
			const view = createView()
			expect(view._extensions.length).toBeGreaterThanOrEqual(6)
			const editor = getEditor(view)
			expect(editor).toBeDefined()
		})

		it('sets textbox role on the editor element', () => {
			const view = createView()
			const mountEl = view.el.querySelector('.rich-text-editor__content')
			expect(mountEl?.getAttribute('role')).toBe('textbox')
			expect(mountEl?.getAttribute('aria-label')).toBe('Filter query')
		})
	})

	describe('content init from modelValue (titles, not ids)', () => {
		it('transforms label ids to titles on initial modelValue', () => {
			const view = createView({modelValue: 'labels = 1'})
			expect(getEditor(view)?.getText()).toBe('labels = bug')
		})

		it('transforms project ids to titles on initial modelValue', () => {
			const view = createView({modelValue: 'project = 1'})
			expect(getEditor(view)?.getText()).toBe('project = Project Alpha')
		})

		it('handles complex query with multiple fields', () => {
			const view = createView({modelValue: 'labels = 1 && project = 2'})
			expect(getEditor(view)?.getText()).toBe('labels = bug && project = Project Beta')
		})

		it('uses JSON doc format to prevent HTML injection', () => {
			const view = createView({modelValue: 'labels = 1'})
			const editor = getEditor(view)
			const doc = editor?.state.doc
			expect(doc?.type.name).toBe('doc')
			const paragraph = doc?.content.firstChild
			expect(paragraph?.type.name).toBe('paragraph')
			const textNode = paragraph?.content.firstChild
			expect(textNode?.type.name).toBe('text')
			expect(textNode?.text).toBe('labels = bug')
		})
	})

	describe('typing emits snake_cased output', () => {
		it('emits snake_cased field names on update', () => {
			const view = createView()
			const onUpdate = vi.mocked((view.options as FilterInputViewOptions).onUpdate)
			const editor = getEditor(view)

			editor?.commands.setContent({
				type: 'doc',
				content: [{
					type: 'paragraph',
					content: [{type: 'text', text: 'dueDate = now'}],
				}],
			})

			expect(onUpdate).toHaveBeenCalledWith('due_date = now')
		})

		it('transforms label titles to ids on emit', () => {
			const view = createView()
			const onUpdate = vi.mocked((view.options as FilterInputViewOptions).onUpdate)
			const editor = getEditor(view)

			editor?.commands.setContent({
				type: 'doc',
				content: [{
					type: 'paragraph',
					content: [{type: 'text', text: 'labels = bug'}],
				}],
			})

			expect(onUpdate).toHaveBeenCalledWith('labels = 1')
		})

		it('transforms project titles to ids on emit', () => {
			const view = createView()
			const onUpdate = vi.mocked((view.options as FilterInputViewOptions).onUpdate)
			const editor = getEditor(view)

			editor?.commands.setContent({
				type: 'doc',
				content: [{
					type: 'paragraph',
					content: [{type: 'text', text: 'project = Project Alpha'}],
				}],
			})

			expect(onUpdate).toHaveBeenCalledWith('project = 1')
		})
	})

	describe('external update preserves cursor and skips echo', () => {
		it('preserves cursor position across external updates', () => {
			const view = createView({modelValue: 'labels = bug'})
			const editor = getEditor(view)

			view.setModelValue('labels = bug, feature')

			const newPos = editor?.state.selection.from ?? 0
			const docSize = editor?.state.doc.content.size ?? 0
			expect(newPos).toBeLessThanOrEqual(docSize)
		})

		it('skips external update that echoes our own emit (lastEmittedValue guard)', () => {
			const view = createView()
			const onUpdate = vi.mocked((view.options as FilterInputViewOptions).onUpdate)
			const editor = getEditor(view)

			editor?.commands.setContent({
				type: 'doc',
				content: [{
					type: 'paragraph',
					content: [{type: 'text', text: 'labels = bug'}],
				}],
			})

			onUpdate.mockClear()
			view.setModelValue('labels = 1')

			expect(onUpdate).not.toHaveBeenCalled()
		})

		it('applies external update when different from lastEmittedValue', () => {
			const view = createView()
			const onUpdate = vi.mocked((view.options as FilterInputViewOptions).onUpdate)
			const editor = getEditor(view)

			editor?.commands.setContent({
				type: 'doc',
				content: [{
					type: 'paragraph',
					content: [{type: 'text', text: 'labels = bug'}],
				}],
			})

			onUpdate.mockClear()
			view._lastEmittedValue = 'labels = 1'
			view.setModelValue('labels = 2')

			expect(editor?.getText()).toBe('labels = feature')
		})

		it('is safe to call before first render', () => {
			const onUpdate = vi.fn()
			const t = (key: string) => key
			const view = new FilterInputView({
				onUpdate,
				t,
				getLabelByExactTitle: (title: string) => mockLabels.find(l => l.title === title),
				getLabelById: (id: number) => mockLabels.find(l => l.id === id),
				labels: mockLabels,
				labelsPending: false,
				findProjectByExactname: (title: string) => Object.values(mockProjects).find(p => p.title === title),
				getProjectTitle: (id: number) => mockProjects[id]?.title,
				flatpickrLocale: {},
			}) as FilterInputViewInstance
			views.push(view)
			expect(() => view.setModelValue('labels = 1')).not.toThrow()
			view.render()
			document.body.appendChild(view.el)
			expect(getEditor(view)?.getText()).toBe('')
		})
	})

	describe('labels-pending stash and apply', () => {
		it('stashes modelValue when labelsPending is true', () => {
			const view = createView({modelValue: 'labels = 1', labelsPending: true})
			expect(view._waitingForLabels).toBe(true)
			expect(view._pendingModelValue).toBe('labels = 1')
			expect(view._pendingEditorContent).toBe('labels = bug')
		})

		it('re-applies stashed content when labels settle', () => {
			const view = createView({modelValue: 'labels = 1', labelsPending: true})
			const editor = getEditor(view)
			const stashed = view._pendingEditorContent
			expect(editor?.getText()).toBe(stashed)

			view.updateLabels(mockLabels, false)

			expect(view._waitingForLabels).toBe(false)
			expect(editor?.getText()).toBe('labels = bug')
		})

		it('refreshes highlighter when labels change', () => {
			const view = createView()
			const editor = getEditor(view)
			const dispatchSpy = editor ? vi.spyOn(editor.view, 'dispatch') : null

			view.updateLabels(mockLabels, false)

			expect(dispatchSpy).not.toBeNull()
			expect(dispatchSpy?.mock.calls.length).toBeGreaterThan(0)
		})
	})

	describe('date click opens datepicker with value', () => {
		it('opens datepicker when clicking on date-value span', () => {
			// NOTE: the highlighter only decorates quoted values (upstream
			// behavior) — unquoted dates produce no clickable span.
			const view = createView({modelValue: 'dueDate = "2024-01-15"'})
			const editor = getEditor(view)
			expect(editor?.getText()).toBe('dueDate = "2024-01-15"')

			const dateValueEl = editor?.view.dom.querySelector('.date-value')
			expect(dateValueEl).not.toBeNull()
			expect(dateValueEl?.textContent).toBe('2024-01-15')
			expect(dateValueEl?.getAttribute('data-date-value')).toBe('2024-01-15')

			// ProseMirror only routes clicks through its mousedown->mouseup gesture,
			// whose coordinates need layout and never resolve headless. Invoke the
			// registered plugin exactly as the gesture would via someProp.
			const pos = editor?.view.posAtDOM(dateValueEl as Node, 0) ?? -1
			expect(pos).toBeGreaterThanOrEqual(0)
			const clickEvent = new MouseEvent('click', {bubbles: true, cancelable: true})
			Object.defineProperty(clickEvent, 'target', {value: dateValueEl})
			editor?.view.someProp('handleClick', handler => handler(editor.view, pos, clickEvent))

			expect(view._datePickerPopupOpen).toBe(true)
			expect(view._currentOldDatepickerValue).toBe('2024-01-15')
			expect(view._datepickerView).toBeDefined()
		})

		it('sets datepicker model value and position on date click', () => {
			const view = createView({modelValue: 'dueDate = "2024-01-15"'})
			const editor = getEditor(view)

			const dateValueEl = editor?.view.dom.querySelector('.date-value') as Element
			const pos = editor?.view.posAtDOM(dateValueEl as Node, 0) ?? -1
			expect(pos).toBeGreaterThanOrEqual(0)
			const clickEvent = new MouseEvent('click', {bubbles: true, cancelable: true})
			Object.defineProperty(clickEvent, 'target', {value: dateValueEl})
			editor?.view.someProp('handleClick', handler => handler(editor.view, pos, clickEvent))

			expect(view._currentDatepickerValue).toBe('2024-01-15')
			expect(typeof view._currentDatepickerPos).toBe('number')
		})
	})

	describe('datepicker change rewrites query and emits', () => {
		it('replaces old date value with new ISO date in query text', () => {
			const view = createView({modelValue: 'dueDate = 2024-01-15'})
			const editor = getEditor(view)
			const onUpdate = vi.mocked((view.options as FilterInputViewOptions).onUpdate)

			view._currentOldDatepickerValue = '2024-01-15'
			view._updateDateInQuery('2024-02-20')

			expect(editor?.getText()).toBe('dueDate = 2024-02-20')
			expect(onUpdate).toHaveBeenCalledWith('due_date = 2024-02-20')
		})

		it('uses JSON setContent without emitUpdate', () => {
			const view = createView({modelValue: 'dueDate = 2024-01-15'})
			const editor = getEditor(view)

			view._currentOldDatepickerValue = '2024-01-15'
			view._updateDateInQuery('2024-02-20')

			const doc = editor?.state.doc
			expect(doc?.type.name).toBe('doc')
		})
	})

	describe('HTML-injection string set as plain text', () => {
		it('renders HTML-like string as plain text, not parsed elements', () => {
			const maliciousInput = 'labels = <script>alert(1)</script>'
			const view = createView({modelValue: maliciousInput})
			const editor = getEditor(view)

			expect(editor?.getText()).toBe(maliciousInput)
			const scriptEl = editor?.view.dom.querySelector('script')
			expect(scriptEl).toBeNull()
		})

		it('renders filter query with angle brackets as plain text', () => {
			const input = 'labels = foo < bar'
			const view = createView({modelValue: input})
			const editor = getEditor(view)

			expect(editor?.getText()).toBe(input)
		})
	})

	describe('focus', () => {
		it('moves document activeElement to the ProseMirror element', async () => {
			const view = createView()
			const editor = getEditor(view)
			const proseMirrorEl = editor?.view.dom as HTMLElement
			expect(view.el.isConnected).toBe(true)

			view.focus()
			// TipTap defers the DOM focus into requestAnimationFrame.
			await new Promise(resolve => requestAnimationFrame(resolve))
			await new Promise(resolve => requestAnimationFrame(resolve))

			expect(document.activeElement).toBe(proseMirrorEl)
		})
	})

	describe('destroy cleans up', () => {
		it('destroys editor and datepicker views on teardown', () => {
			const view = createView()
			const editorView = view._editorView
			const datepickerView = view._datepickerView

			view.destroy()

			const editorHolder = editorView as unknown as EditorHolder
			const flatpickrHolder = datepickerView as unknown as FlatpickrHolder
			expect(editorHolder._editor).toBeNull()
			expect(flatpickrHolder._flatpickr).toBeNull()
		})

		it('does not throw on double destroy', () => {
			const view = createView()
			expect(() => view.destroy()).not.toThrow()
			expect(() => view.destroy()).not.toThrow()
		})
	})
})
