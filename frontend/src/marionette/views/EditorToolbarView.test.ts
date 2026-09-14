import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {Editor} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {Table, TableCell, TableHeader, TableRow} from '@tiptap/extension-table'
import {EditorToolbarView} from './EditorToolbarView'
import type {EditorToolbarViewInstance, EditorToolbarViewOptions} from './EditorToolbarView'

describe('EditorToolbarView', () => {
	let editor: Editor | null = null
	let editorElement: HTMLElement | null = null
	const views: EditorToolbarViewInstance[] = []

	const defaultLabels = {
		toolbarLabel: 'Editor toolbar',
		heading1: 'Heading 1',
		heading2: 'Heading 2',
		heading3: 'Heading 3',
		bold: 'Bold',
		italic: 'Italic',
		underline: 'Underline',
		strikethrough: 'Strikethrough',
		code: 'Code block',
		quote: 'Quote',
		bulletList: 'Bullet list',
		orderedList: 'Ordered list',
		taskList: 'Task list',
		image: 'Image',
		link: 'Link',
		text: 'Paragraph',
		horizontalRule: 'Horizontal rule',
		undo: 'Undo',
		redo: 'Redo',
		table: {
			title: 'Table',
			insert: 'Insert table',
			addColumnBefore: 'Add column before',
			addColumnAfter: 'Add column after',
			deleteColumn: 'Delete column',
			addRowBefore: 'Add row before',
			addRowAfter: 'Add row after',
			deleteRow: 'Delete row',
			deleteTable: 'Delete table',
			mergeCells: 'Merge cells',
			splitCell: 'Split cell',
			toggleHeaderColumn: 'Toggle header column',
			toggleHeaderRow: 'Toggle header row',
			toggleHeaderCell: 'Toggle header cell',
			mergeOrSplit: 'Merge or split',
			fixTables: 'Fix tables',
		},
	}

	beforeEach(() => {
		document.body.innerHTML = ''
		editorElement = document.createElement('div')
		document.body.appendChild(editorElement)
		editor = new Editor({
			element: editorElement,
		extensions: [
			StarterKit,
			Underline,
			Table,
			TableRow,
				TableHeader,
				TableCell,
			],
			content: '<p>Hello world</p>',
		})
	})

	afterEach(() => {
		views.forEach(view => {
			view.destroy()
		})
		views.length = 0
		if (editor) {
			editor.destroy()
			editor = null
		}
		if (editorElement && editorElement.parentNode) {
			editorElement.parentNode.removeChild(editorElement)
			editorElement = null
		}
		document.body.innerHTML = ''
	})

	function createView(overrides: Partial<EditorToolbarViewOptions> = {}): EditorToolbarViewInstance {
		const options: EditorToolbarViewOptions = {
			getEditor: () => editor ?? undefined,
			labels: defaultLabels,
			onImageUpload: vi.fn(),
			onLink: vi.fn(),
			...overrides,
		}
		const view = new EditorToolbarView(options)
		views.push(view)
		return view
	}

	it('renders the full collapsed command set in the expected order', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const commands = Array.from(view.el.querySelectorAll<HTMLButtonElement>('.mn-editor-toolbar__button[data-command]'))
			.map(button => button.getAttribute('data-command'))
		expect(commands).toEqual([
			'heading1',
			'heading2',
			'heading3',
			'bold',
			'italic',
			'underline',
			'strikethrough',
			'code',
			'quote',
			'bulletList',
			'orderedList',
			'taskList',
			'image',
			'link',
			'text',
			'horizontalRule',
			'undo',
			'redo',
			'table',
		])

		expect(commands).toHaveLength(19)
	})

	it('toggles bold command state when clicked', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		editor!.commands.selectAll()

		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(editor!.isActive('bold')).toBe(true)
		expect(boldButton.getAttribute('aria-pressed')).toBe('true')
		expect(boldButton.classList.contains('is-active')).toBe(true)
	})

	it('invokes the link callback with placement rect and does not mutate editor HTML', () => {
		const onLink = vi.fn()
		const view = createView({onLink})
		view.render()
		document.body.appendChild(view.el)

		const beforeHtml = editor!.getHTML()
		const linkButton = view.el.querySelector('[data-command="link"]') as HTMLButtonElement
		linkButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onLink).toHaveBeenCalledTimes(1)
		expect(onLink.mock.calls[0][0]).toBeInstanceOf(DOMRect)
		expect(editor!.getHTML()).toBe(beforeHtml)
	})

	it('invokes image upload callback when image is clicked', () => {
		const onImageUpload = vi.fn()
		const view = createView({onImageUpload})
		view.render()
		document.body.appendChild(view.el)

		const imageButton = view.el.querySelector('[data-command="image"]') as HTMLButtonElement
		const rect = new DOMRect(25, 40, 30, 20)
		vi.spyOn(imageButton, 'getBoundingClientRect').mockReturnValue(rect)
		imageButton.querySelector('svg')!.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onImageUpload).toHaveBeenCalledTimes(1)
		expect(onImageUpload).toHaveBeenCalledWith(rect)
	})

	it('supports arrow-key and home/end roving-focus navigation', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const buttons = Array.from(view.el.querySelectorAll<HTMLButtonElement>('.mn-editor-toolbar__button[data-command]:not([disabled])'))
		expect(buttons[0].getAttribute('tabindex')).toBe('0')
		expect(buttons[1].getAttribute('tabindex')).toBe('-1')

		const first = buttons[0]
		first.focus()
		first.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'ArrowRight'}))
		expect(document.activeElement).toBe(buttons[1])
		expect(buttons[1].tabIndex).toBe(0)
		expect(buttons[0].tabIndex).toBe(-1)

		buttons[1].dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'End'}))
		const endButton = buttons[buttons.length - 1]
		expect(document.activeElement).toBe(endButton)
		expect(endButton.tabIndex).toBe(0)
	})

	it('shows table controls after toggling table mode and inserts a table', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const tableButton = view.el.querySelector('[data-command="table"]') as HTMLButtonElement
		expect(tableButton.getAttribute('aria-expanded')).toBe('false')
		tableButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(tableButton.getAttribute('aria-expanded')).toBe('true')
		expect(document.getElementById(tableButton.getAttribute('aria-controls')!)).not.toBeNull()

		const tableCommands = Array.from(view.el.querySelectorAll<HTMLButtonElement>('.mn-editor-toolbar__button[data-command]'))
			.map(button => button.getAttribute('data-command'))
		expect(tableCommands).toEqual([
			'heading1',
			'heading2',
			'heading3',
			'bold',
			'italic',
			'underline',
			'strikethrough',
			'code',
			'quote',
			'bulletList',
			'orderedList',
			'taskList',
			'image',
			'link',
			'text',
			'horizontalRule',
			'undo',
			'redo',
			'table',
			'insertTable',
			'addColumnBefore',
			'addColumnAfter',
			'deleteColumn',
			'addRowBefore',
			'addRowAfter',
			'deleteRow',
			'deleteTable',
			'mergeCells',
			'splitCell',
			'toggleHeaderColumn',
			'toggleHeaderRow',
			'toggleHeaderCell',
			'mergeOrSplit',
			'fixTables',
		])

		editor!.commands.selectAll()
		const insertTableButton = view.el.querySelector('[data-command="insertTable"]') as HTMLButtonElement
		insertTableButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(editor!.getHTML()).toContain('<table')
	})

	it('updates command state on undo and redo', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		editor!.commands.selectAll()
		boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(editor!.isActive('bold')).toBe(true)

		const undoButton = view.el.querySelector('[data-command="undo"]') as HTMLButtonElement
		undoButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(editor!.isActive('bold')).toBe(false)

		const redoButton = view.el.querySelector('[data-command="redo"]') as HTMLButtonElement
		redoButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(editor!.isActive('bold')).toBe(true)
	})
})
