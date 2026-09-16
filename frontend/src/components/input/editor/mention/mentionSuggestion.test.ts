import {describe, it, expect, beforeEach, vi} from 'vitest'
import type {Editor} from '@tiptap/core'

vi.mock('@floating-ui/dom', () => ({
	computePosition: () => Promise.resolve({x: 0, y: 0}),
	autoUpdate: () => () => {},
	flip: () => ({}),
	offset: () => ({}),
	shift: () => ({}),
}))

vi.mock('@/helpers/avatarCache', async importOriginal => {
	const original = await importOriginal<typeof import('@/helpers/avatarCache')>()
	return {...original, fetchAvatarBlobUrl: vi.fn(async () => 'blob:avatar')}
})

import mentionSuggestionSetup from './mentionSuggestion'

const t = (key: string) => key

const ITEMS = [
	{id: 'jane', label: 'Jane Doe', username: 'jane'},
	{id: 'bob', label: 'bob', username: 'bob'},
]

function fakeEditor(): Editor {
	const dom = document.createElement('div')
	document.body.appendChild(dom)
	return {view: {dom}} as unknown as Editor
}

function startRenderer(items = ITEMS) {
	const renderer = mentionSuggestionSetup(1, t).render()
	const command = vi.fn()
	const props = {
		editor: fakeEditor(),
		clientRect: () => new DOMRect(),
		items,
		command,
	}
	renderer.onStart(props)
	return {renderer, command, props}
}

function popupList() {
	return document.querySelector('.mention-items.editor-suggestion-popup')
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('mentionSuggestion', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('renders the users into a popup without Vue', () => {
		startRenderer()
		const buttons = popupList()!.querySelectorAll('button')

		expect(buttons).toHaveLength(2)
		expect(buttons[0].textContent).toContain('Jane Doe')
		expect(buttons[0].textContent).toContain('@jane')
		expect(buttons[0].querySelector('.mention-avatar')).not.toBeNull()
	})

	it('leaves out the handle when it is the same as the display name', () => {
		startRenderer()
		const buttons = popupList()!.querySelectorAll('button')

		expect(buttons[1].textContent).toContain('bob')
		expect(buttons[1].querySelector('.mention-username')).toBeNull()
	})

	it('loads an avatar per user', async () => {
		startRenderer()
		await settled()

		expect(popupList()!.querySelectorAll('.mention-avatar img')).toHaveLength(2)
	})

	it('picks the highlighted user on Enter', () => {
		const {renderer, command} = startRenderer()

		renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'ArrowDown'})})
		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Enter'})})).toBe(true)
		expect(command).toHaveBeenCalledWith(ITEMS[1])
	})

	it('shows the empty label when the search found nobody', () => {
		const {renderer, props} = startRenderer()

		renderer.onUpdate({...props, items: []})

		expect(popupList()!.textContent).toContain('task.mention.noUsersFound')
	})

	it('hides the popup on Escape and removes it on exit', () => {
		const {renderer} = startRenderer()

		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Escape'})})).toBe(true)
		expect((popupList()!.parentElement as HTMLElement).style.display).toBe('none')

		renderer.onExit()
		expect(popupList()).toBeNull()
		expect(document.querySelector('.mention-avatar')).toBeNull()
	})

	it('exits cleanly when the suggestion was never started', () => {
		expect(() => mentionSuggestionSetup(1, t).render().onExit()).not.toThrow()
	})
})
