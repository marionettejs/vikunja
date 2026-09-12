import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import StarterKit from '@tiptap/starter-kit'
import {RichTextEditorView} from './RichTextEditorView'
import type {RichTextEditorViewInstance, RichTextEditorViewOptions} from './RichTextEditorView'

describe('RichTextEditorView', () => {
	const views: RichTextEditorViewInstance[] = []

	beforeEach(() => {
		document.body.innerHTML = ''
	})

	afterEach(() => {
		views.forEach(view => {
			view.destroy()
		})
		views.length = 0
		document.body.innerHTML = ''
	})

	function createView(overrides: Partial<RichTextEditorViewOptions> = {}): RichTextEditorViewInstance {
		const options: RichTextEditorViewOptions = {
			extensions: [StarterKit],
			content: '<p>Hello world</p>',
			editable: true,
			editorId: 'test-editor-id',
			ariaLabel: 'Description editor',
			onChange: vi.fn(),
			...overrides,
		}
		const view = new RichTextEditorView(options)
		views.push(view)
		return view
	}

	it('the mounted element carries the supplied id and aria-label', () => {
		const view = createView({
			editorId: 'custom-editor-id',
			ariaLabel: 'Custom Editor Label',
		})
		view.render()
		document.body.appendChild(view.el)

		const mountEl = view.el.querySelector('#custom-editor-id')
		expect(mountEl).not.toBeNull()
		expect(mountEl?.getAttribute('aria-label')).toBe('Custom Editor Label')
	})

	it('initial content is present in the editor after render', () => {
		const view = createView({
			content: '<p>Initial text content</p>',
		})
		view.render()
		document.body.appendChild(view.el)

		expect(view.getContent()).toContain('Initial text content')
	})

	it('getContent reflects content set programmatically through the editor', () => {
		const view = createView({
			content: '<p>Initial</p>',
		})
		view.render()
		document.body.appendChild(view.el)

		const editor = (view as unknown as {_editor: {commands: {setContent: (c: string) => void}}})._editor
		editor.commands.setContent('<p>Updated content</p>')

		expect(view.getContent()).toContain('Updated content')
	})

	it('onChange is NOT called merely by constructing the view with initial content', () => {
		const onChange = vi.fn()
		const view = createView({
			content: '<p>Initial content</p>',
			onChange,
		})
		view.render()
		document.body.appendChild(view.el)

		expect(onChange).not.toHaveBeenCalled()
	})

	it('setEditable(false) makes the editor non-editable and setEditable(true) restores it', () => {
		const view = createView({
			editable: true,
		})
		view.render()
		document.body.appendChild(view.el)

		const editor = (view as unknown as {_editor: {isEditable: boolean}})._editor
		expect(editor.isEditable).toBe(true)

		view.setEditable(false)
		expect(editor.isEditable).toBe(false)

		view.setEditable(true)
		expect(editor.isEditable).toBe(true)
	})

	it('destroying the view destroys the editor, and destroying twice does not throw', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const editor = (view as unknown as {_editor: {isDestroyed: boolean}})._editor
		expect(editor.isDestroyed).toBe(false)

		expect(() => {
			view.destroy()
		}).not.toThrow()

		expect(editor.isDestroyed).toBe(true)

		expect(() => {
			view.destroy()
		}).not.toThrow()
	})
})
