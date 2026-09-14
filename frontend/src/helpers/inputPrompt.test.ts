import {describe, it, expect, vi, beforeEach, afterEach, afterAll} from 'vitest'
import {nextTick} from 'vue'
import inputPrompt from './inputPrompt'
import {Editor} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

const editors: Editor[] = []
function createEditor(): {editor: Editor; triggerDestroy: () => void} {
	const editor = new Editor({element: document.createElement('div'), extensions: [StarterKit], content: '<p>Text</p>'})
	editors.push(editor)
	return {editor, triggerDestroy: () => editor.destroy()}
}

beforeEach(() => {
	document.body.innerHTML = ''
})

afterEach(() => {
	for (const editor of editors.splice(0)) editor.destroy()
	document.body.innerHTML = ''
	vi.restoreAllMocks()
	vi.useRealTimers()
})

describe('inputPrompt', () => {
	it('resolves null and cleans up when the owning editor is destroyed', async () => {
		const {editor, triggerDestroy} = createEditor()

		const prompt = inputPrompt(new DOMRect(), 'Image alt', 'initial', editor)
		await nextTick()
		expect(document.querySelector('input.input[placeholder="Image alt"]')).toBeInstanceOf(HTMLInputElement)

		triggerDestroy()

		await expect(prompt).resolves.toBeNull()
		expect(document.querySelector('input.input[placeholder="Image alt"]')).toBeNull()
	})

	it('does not register delayed outside-click cancellation after cleanup and blocks late focus', async () => {
		vi.useFakeTimers()
		const {editor, triggerDestroy} = createEditor()
		const addEventListener = vi.spyOn(document, 'addEventListener')
		const removeEventListener = vi.spyOn(document, 'removeEventListener')
		const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {})

		const prompt = inputPrompt(new DOMRect(), 'URL', '', editor)
		focusSpy.mockClear()
		addEventListener.mockClear()
		removeEventListener.mockClear()

		triggerDestroy()
		await prompt

		vi.advanceTimersByTime(150)

		const clickRegistrations = addEventListener.mock.calls.filter(([eventName]) => eventName === 'click')
		expect(clickRegistrations).toHaveLength(0)
		expect(removeEventListener).toHaveBeenCalledWith('click', expect.any(Function))
		expect(focusSpy).not.toHaveBeenCalled()
	})
})

afterAll(() => {
	vi.useRealTimers()
})
