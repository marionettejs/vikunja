import {describe, it, expect, beforeEach, vi} from 'vitest'
import type {Editor} from '@tiptap/core'

vi.mock('@floating-ui/dom', () => ({
	computePosition: () => Promise.resolve({x: 0, y: 0}),
	autoUpdate: () => () => {},
	flip: () => ({}),
	offset: () => ({}),
	shift: () => ({}),
}))

import suggestionSetup from './suggestion'

const t = (key: string) => key

function fakeEditor(): Editor {
	const dom = document.createElement('div')
	document.body.appendChild(dom)
	return {view: {dom}} as unknown as Editor
}

function startRenderer(itemCount = 3) {
	const editor = fakeEditor()
	const setup = suggestionSetup(t)
	const items = setup.items({query: ''}).slice(0, itemCount)
	const command = vi.fn()
	const renderer = setup.render()
	const props = {
		editor,
		clientRect: () => new DOMRect(),
		command,
		items,
	}
	renderer.onStart(props)
	return {renderer, command, items, props, editor}
}

function popupList() {
	return document.querySelector('.items.editor-suggestion-popup')
}

describe('slash command suggestion', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('filters the command list by the query', () => {
		const items = suggestionSetup(t).items({query: 'input.editor.heading'})

		expect(items.length).toBeGreaterThan(0)
		expect(items.every(item => item.title.startsWith('input.editor.heading'))).toBe(true)
	})

	it('renders the commands into a popup without Vue', () => {
		const {items} = startRenderer()
		const list = popupList()

		expect(list).not.toBeNull()
		const buttons = list!.querySelectorAll('button')
		expect(buttons).toHaveLength(items.length)
		expect(buttons[0].textContent).toContain(items[0].title)
		expect(buttons[0].querySelector('svg')).not.toBeNull()
		expect(buttons[0].className).toContain('is-selected')
	})

	it('runs the highlighted command on Enter', () => {
		const {renderer, command, items} = startRenderer()

		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'ArrowDown'})})).toBe(true)
		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Enter'})})).toBe(true)
		expect(command).toHaveBeenCalledWith(items[1])
	})

	it('runs the clicked command', () => {
		const {command, items} = startRenderer()

		popupList()!.querySelectorAll('button')[2]
			.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(command).toHaveBeenCalledWith(items[2])
	})

	it('hides the popup on Escape and keeps the keystroke', () => {
		const {renderer} = startRenderer()

		expect(renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Escape'})})).toBe(true)
		expect((popupList()!.parentElement as HTMLElement).style.display).toBe('none')
	})

	it('re-renders and re-targets the command on update', () => {
		const {renderer, props, items} = startRenderer()
		const command = vi.fn()

		renderer.onUpdate({...props, command, items: items.slice(0, 2)})

		expect(popupList()!.querySelectorAll('button')).toHaveLength(2)
		renderer.onKeyDown({event: new KeyboardEvent('keydown', {key: 'Enter'})})
		expect(command).toHaveBeenCalledWith(items[0])
	})

	it('removes the popup on exit', () => {
		const {renderer} = startRenderer()

		renderer.onExit()

		expect(popupList()).toBeNull()
	})

	it('exits cleanly when the suggestion was never started', () => {
		expect(() => suggestionSetup(t).render().onExit()).not.toThrow()
	})
})
