import {afterEach, describe, expect, it, vi} from 'vitest'
import {Editor} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import {setImageAltInEditor} from './setImageAltInEditor'

const {prompt} = vi.hoisted(() => ({prompt: vi.fn()}))
vi.mock('@/helpers/inputPrompt', () => ({default: prompt}))
vi.mock('@/i18n', () => ({i18n: {global: {t: (key: string) => key}}}))
let editor: Editor

afterEach(() => {
	editor?.destroy()
	prompt.mockReset()
})

function createEditor() {
	editor = new Editor({extensions: [StarterKit, Image], content: '<img src="/photo.png" alt="Original">'})
	return editor
}

describe('image alt prompt', () => {
	it.each(['A description', ''])('applies accepted alt text %j', async alt => {
		createEditor()
		prompt.mockResolvedValue(alt)
		await setImageAltInEditor(editor, 0, new DOMRect(), () => true)
		expect(editor.state.doc.nodeAt(0)?.attrs.alt).toBe(alt)
	})

	it.each(['cancel', 'navigation', 'replacement', 'destroy'])('ignores a stale or cancelled answer: %s', async reason => {
		createEditor()
		let resolve!: (value: string | null) => void
		prompt.mockReturnValue(new Promise<string | null>(done => { resolve = done }))
		let current = true
		const pending = setImageAltInEditor(editor, 0, new DOMRect(), () => current)
		if (reason === 'navigation') current = false
		if (reason === 'replacement') editor.commands.setContent('<img src="/other.png" alt="Other">')
		const chain = vi.spyOn(editor, 'chain')
		if (reason === 'destroy') editor.destroy()
		resolve(reason === 'cancel' ? null : 'Late answer')
		await pending
		expect(chain).not.toHaveBeenCalled()
	})
})
