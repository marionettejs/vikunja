import {describe, it, expect, beforeEach, vi} from 'vitest'
import type {Editor} from '@tiptap/core'

vi.mock('@floating-ui/dom', () => ({
	computePosition: () => Promise.resolve({x: 0, y: 0}),
	autoUpdate: () => () => {},
	flip: () => ({}),
	offset: () => ({}),
	shift: () => ({}),
}))

import emojiSuggestionSetup from './emojiSuggestion'
import type {EmojiEntry} from './emojiData'

const t = (key: string) => key

const ENTRIES: EmojiEntry[] = [
	{emoji: '😄', shortcode: 'smile', annotation: 'grinning face', tags: []},
	{emoji: '😀', shortcode: 'smiley', annotation: 'grinning', tags: []},
]

function fakeEditor(): Editor {
	const dom = document.createElement('div')
	document.body.appendChild(dom)
	return {view: {dom}} as unknown as Editor
}

function startRenderer(items: EmojiEntry[] = ENTRIES) {
	const renderer = emojiSuggestionSetup(t).render()
	const command = vi.fn()
	const props = {
		editor: fakeEditor(),
		range: {from: 0, to: 0},
		query: 'smi',
		clientRect: () => new DOMRect(),
		items,
		command,
	}
	renderer.onStart(props)
	return {renderer, command, props}
}

function popupList() {
	return document.querySelector('.emoji-items.editor-suggestion-popup')
}

describe('emojiSuggestion', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('renders the emoji entries into a popup without Vue', () => {
		startRenderer()
		const buttons = popupList()!.querySelectorAll('button')

		expect(buttons).toHaveLength(2)
		expect(buttons[0].textContent).toContain('😄')
		expect(buttons[0].textContent).toContain(':smile:')
		expect(buttons[0].textContent).toContain('grinning face')
	})

	it('uses the injected translator for the empty state', () => {
		const {renderer, props} = startRenderer()

		renderer.onUpdate({...props, items: []})

		expect(popupList()!.textContent).toContain('input.editor.emoji.empty')
	})

	it('inserts the highlighted emoji on Enter and on Tab', () => {
		const {renderer, command} = startRenderer()

		renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'ArrowDown'})})
		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Enter'})})).toBe(true)
		expect(command).toHaveBeenCalledWith(ENTRIES[1])

		renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Tab'})})
		expect(command).toHaveBeenCalledTimes(2)
		expect(command).toHaveBeenLastCalledWith(ENTRIES[1])
	})

	it('does not mount while the query is still empty and nothing matches', () => {
		const renderer = emojiSuggestionSetup(t).render()
		renderer.onStart({
			editor: fakeEditor(),
			range: {from: 0, to: 0},
			query: '',
			clientRect: () => new DOMRect(),
			items: [],
			command: vi.fn(),
		})

		expect(popupList()).toBeNull()
	})

	it('hides the popup on Escape and removes it on exit', () => {
		const {renderer} = startRenderer()

		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Escape'})})).toBe(true)
		expect((popupList()!.parentElement as HTMLElement).style.display).toBe('none')

		renderer.onExit()
		expect(popupList()).toBeNull()
	})

	it('exits cleanly when the suggestion was never started', () => {
		expect(() => emojiSuggestionSetup(t).render().onExit()).not.toThrow()
	})
})
