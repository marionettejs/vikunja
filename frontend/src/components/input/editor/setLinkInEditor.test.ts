import {describe, it, expect, vi} from 'vitest'
import type {Editor} from '@tiptap/core'
import {setLinkInEditor} from './setLinkInEditor'

const {prompt} = vi.hoisted(() => ({prompt: vi.fn()}))
vi.mock('@/helpers/inputPrompt', () => ({default: prompt}))
vi.mock('@/i18n', () => ({i18n: {global: {t: (key: string) => key}}}))

describe('setLinkInEditor prompt lifetime', () => {
	it.each(['destroyed', 'navigation'])('ignores a prompt result after %s', async kind => {
		let resolve!: (value: string) => void
		prompt.mockReturnValue(new Promise<string>(done => { resolve = done }))
		const chain = vi.fn()
		const editor = {getAttributes: () => ({}), isDestroyed: false, chain}
		let current = true
		const pending = setLinkInEditor({} as DOMRect, editor as unknown as Editor, () => current)
		if (kind === 'destroyed') editor.isDestroyed = true
		else current = false
		resolve('https://example.com')
		await pending
		expect(chain).not.toHaveBeenCalled()
	})
})
