import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import StarterKit from '@tiptap/starter-kit'
import {TaskRecords} from '../data/TaskRecords'
import {TaskDescriptionView} from './TaskDescriptionView'

let records: TaskRecords
let views: InstanceType<typeof TaskDescriptionView>[]
const key = 'editorDraft-task-description-3'
beforeEach(() => {
	vi.useFakeTimers()
	records = new TaskRecords()
	views = []
	localStorage.clear()
})
afterEach(() => {
	views.forEach(view => view.destroy())
	records.destroy()
	vi.useRealTimers()
	document.body.replaceChildren()
	localStorage.clear()
})
function create(onCommit = vi.fn<(value: string) => Promise<void>>(async () => {}), canWrite = true) {
	const model = records.upsert({id: 3, description: '<p>Original</p>'})
	const view = new TaskDescriptionView({model, extensions: [StarterKit], canWrite, labels: {description: 'Description', save: 'Save', saving: 'Saving', saved: 'Saved', error: 'Failed'}, t: (key: string) => key, onCommit})
	views.push(view)
	view.render()
	document.body.appendChild(view.el)
	return {view, model, onCommit}
}

describe('native task description', () => {
	it('saves editor content after debounce without mutating the canonical record', async () => {
		const {view, model, onCommit} = create()
		view.getEditor()!.commands.setContent('<p>Draft</p>')
		expect(localStorage.getItem(key)).toBe('<p>Draft</p>')
		await vi.advanceTimersByTimeAsync(5000)
		expect(onCommit).toHaveBeenCalledWith('<p>Draft</p>')
		expect(model.get('description')).toBe('<p>Original</p>')
		expect(localStorage.getItem(key)).toBeNull()
	})

	it('retains empty deletion drafts through destruction and remount', () => {
		const {view} = create()
		view.getEditor()!.commands.setContent('<p></p>')
		view.destroy()
		expect(localStorage.getItem(key)).toBe('<p></p>')
		const replacement = create().view
		expect(replacement.getEditor()!.getHTML()).toBe('<p></p>')
	})

	it('preserves the actual TipTap editor and draft across parent rerenders', () => {
		const {view} = create()
		const editor = view.getEditor()!
		editor.commands.setContent('<p>Keep me</p>')
		view.render()
		expect(view.getEditor()).toBe(editor)
		expect(editor.getHTML()).toBe('<p>Keep me</p>')
		view.destroy()
		expect(editor.isDestroyed).toBe(true)
	})

	it('ignores stored drafts and prevents saves when readonly', async () => {
		localStorage.setItem(key, '<p>Private draft</p>')
		const {view, onCommit} = create(undefined, false)
		expect(view.getEditor()!.isEditable).toBe(false)
		expect(view.getEditor()!.getHTML()).toBe('<p>Original</p>')
		await view.save()
		expect(onCommit).not.toHaveBeenCalled()
		expect(localStorage.getItem(key)).toBe('<p>Private draft</p>')
	})

	it('retains failed drafts for an explicit retry', async () => {
		const onCommit = vi.fn<(value: string) => Promise<void>>(async () => {}).mockRejectedValueOnce(new Error('failed'))
		const {view} = create(onCommit)
		view.getEditor()!.commands.setContent('<p>Retry</p>')
		await view.save().catch(() => {})
		expect(localStorage.getItem(key)).toBe('<p>Retry</p>')
		expect(view.el.textContent).toContain('Failed')
		await view.save()
		expect(onCommit).toHaveBeenCalledTimes(2)
		expect(localStorage.getItem(key)).toBeNull()
	})

	it('does not clear newer edits when a prior submission finishes', async () => {
		let release!: () => void
		const onCommit = vi.fn<(value: string) => Promise<void>>(async () => {})
		onCommit.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
		const {view} = create(onCommit)
		view.getEditor()!.commands.setContent('<p>First</p>')
		const saved = view.save()
		await Promise.resolve()
		view.getEditor()!.commands.setContent('<p>Second</p>')
		release()
		await saved
		await vi.advanceTimersByTimeAsync(5000)
		expect(onCommit.mock.calls.map(([value]) => value)).toEqual(['<p>First</p>', '<p>Second</p>'])
	})

	it('renders its own toolbar for a writable task', () => {
		const {view} = create()

		const toolbar = view.el.querySelector('[data-region="description-toolbar"]')
		expect(toolbar!.querySelector('[role="toolbar"]')).not.toBeNull()
		expect(toolbar!.querySelector('[aria-label="input.editor.bold"]')).not.toBeNull()
	})

	it('renders no editor controls on a read-only task', () => {
		const {view} = create(vi.fn(async () => {}), false)

		expect(view.el.querySelector('[data-region="description-toolbar"]')!.children).toHaveLength(0)
		expect(document.querySelector('.mn-image-alt-menu')).toBeNull()
	})

	it('keeps the same editor and toolbar across a re-render', () => {
		const {view} = create()
		const editor = view.getEditor()
		const toolbar = view.el.querySelector('[role="toolbar"]')

		view.render()

		expect(view.getEditor()).toBe(editor)
		expect(view.el.querySelector('[role="toolbar"]')).toBe(toolbar)
	})

	it('tears its floating menus down with the view', () => {
		const {view} = create()
		expect(document.querySelector('.mn-image-alt-menu')).not.toBeNull()

		view.destroy()

		expect(document.querySelector('.mn-image-alt-menu')).toBeNull()
	})
})
