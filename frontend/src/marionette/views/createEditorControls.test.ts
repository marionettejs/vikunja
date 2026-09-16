import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {Editor} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

const inputPrompt = vi.fn()
const setImageAltInEditor = vi.fn()
const setLinkInEditor = vi.fn()

vi.mock('@/helpers/inputPrompt', () => ({default: (...args: unknown[]) => inputPrompt(...args)}))
vi.mock('@/components/input/editor/setImageAltInEditor', () => ({
	setImageAltInEditor: (...args: unknown[]) => setImageAltInEditor(...args),
}))
vi.mock('@/components/input/editor/setLinkInEditor', () => ({
	setLinkInEditor: (...args: unknown[]) => setLinkInEditor(...args),
}))

import {createEditorControls} from './createEditorControls'
import type {EditorControls} from './createEditorControls'

const t = (key: string) => key

describe('createEditorControls', () => {
	let editor: Editor | null = null
	let editorElement: HTMLElement
	let controls: EditorControls | null = null

	beforeEach(() => {
		document.body.innerHTML = ''
		inputPrompt.mockReset()
		setImageAltInEditor.mockReset().mockResolvedValue(undefined)
		setLinkInEditor.mockReset().mockResolvedValue(undefined)

		editorElement = document.createElement('div')
		document.body.appendChild(editorElement)
		editor = new Editor({
			element: editorElement,
			extensions: [StarterKit, Image],
			content: '<p>Hello world</p>',
		})
	})

	afterEach(() => {
		controls?.destroy()
		controls = null
		editor?.destroy()
		editor = null
		document.body.innerHTML = ''
	})

	function clickToolbar(controls: EditorControls, label: string) {
		if (!controls.toolbarView.isRendered()) {
			controls.toolbarView.render()
			document.body.appendChild(controls.toolbarView.el)
		}
		const button = controls.toolbarView.el.querySelector<HTMLElement>(`[aria-label="${label}"]`)
		if (!button) {
			throw new Error(`no toolbar button labelled ${label}`)
		}
		button.dispatchEvent(new MouseEvent('click', {bubbles: true}))
	}

	function create(overrides: Partial<Parameters<typeof createEditorControls>[0]> = {}) {
		controls = createEditorControls({
			getEditor: () => editor ?? undefined,
			t,
			pluginKeyPrefix: 'test',
			isActive: () => true,
			...overrides,
		})
		return controls
	}

	it('mounts the floating menus into the container and hands back the toolbar', () => {
		const container = document.createElement('div')
		document.body.appendChild(container)

		const created = create({menuContainer: container})

		expect(created.toolbarView).toBeTruthy()
		expect(container.querySelector('.mn-image-alt-menu')).not.toBeNull()
		expect(container.children).toHaveLength(2)
	})

	it('defaults the floating menus to the body', () => {
		create()

		expect(document.body.querySelector('.mn-image-alt-menu')?.parentElement).toBe(document.body)
	})

	it('registers its plugins under the given prefix so two editors can coexist', () => {
		const registered: string[] = []
		vi.spyOn(editor!, 'registerPlugin').mockImplementation(plugin => {
			registered.push(String((plugin as {key?: string}).key))
			return editor!.state
		})

		create({pluginKeyPrefix: 'taskDescription'})

		expect(registered.some(key => key.startsWith('taskDescriptionBubbleMenu'))).toBe(true)
		expect(registered.some(key => key.startsWith('taskDescriptionImageAltMenu'))).toBe(true)
	})

	it('prompts for alt text on the image the upload inserted', async () => {
		inputPrompt.mockResolvedValue('https://example.com/cat.png')

		const created = create()
		clickToolbar(created, 'input.editor.image')

		await vi.waitFor(() => expect(setImageAltInEditor).toHaveBeenCalled())

		const [calledEditor, position] = setImageAltInEditor.mock.calls[0]
		expect(calledEditor).toBe(editor)
		expect(typeof position).toBe('number')
		expect(editor!.getHTML()).toContain('https://example.com/cat.png')
	})

	it('inserts nothing when the upload prompt is cancelled', async () => {
		inputPrompt.mockResolvedValue(null)

		const created = create()
		clickToolbar(created, 'input.editor.image')

		await vi.waitFor(() => expect(inputPrompt).toHaveBeenCalled())
		expect(setImageAltInEditor).not.toHaveBeenCalled()
		expect(editor!.getHTML()).not.toContain('<img')
	})

	it('drops a resolved prompt once the owner is no longer active', async () => {
		inputPrompt.mockResolvedValue('https://example.com/cat.png')
		let active = true

		const created = create({isActive: () => active})
		clickToolbar(created, 'input.editor.image')
		active = false

		await vi.waitFor(() => expect(inputPrompt).toHaveBeenCalled())
		expect(setImageAltInEditor).not.toHaveBeenCalled()
		expect(editor!.getHTML()).not.toContain('<img')
	})

	it('only asks for alt text while an image is selected', () => {
		const created = create()

		clickToolbar(created, 'input.editor.link')
		expect(setLinkInEditor).toHaveBeenCalledTimes(1)

		const altMenu = document.querySelector<HTMLElement>('[data-action="edit-alt"]')
		altMenu!.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(setImageAltInEditor).not.toHaveBeenCalled()
	})

	it('detaches from the editor and removes the menus on destroy', () => {
		const unregisterPlugin = vi.spyOn(editor!, 'unregisterPlugin')
		const created = create()

		created.destroy()

		expect(unregisterPlugin).toHaveBeenCalledWith('testBubbleMenu')
		expect(unregisterPlugin).toHaveBeenCalledWith('testImageAltMenu')
		expect(document.querySelector('.mn-image-alt-menu')).toBeNull()
		expect(created.toolbarView.isDestroyed()).toBe(true)

		created.destroy()
		expect(unregisterPlugin).toHaveBeenCalledTimes(2)
	})

	it('survives teardown after the editor is already gone', () => {
		const created = create()
		editor!.destroy()
		editor = null

		expect(() => created.destroy()).not.toThrow()
	})
})
