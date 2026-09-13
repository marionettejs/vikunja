import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {Editor} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {EditorBubbleMenuView} from './EditorBubbleMenuView'
import type {EditorBubbleMenuViewInstance, EditorBubbleMenuViewOptions} from './EditorBubbleMenuView'

describe('EditorBubbleMenuView', () => {
	let editor: Editor | null = null
	let editorElement: HTMLElement | null = null
	const views: EditorBubbleMenuViewInstance[] = []

	const defaultLabels = {
		bold: 'Bold',
		italic: 'Italic',
		underline: 'Underline',
		strikethrough: 'Strikethrough',
		code: 'Code',
		link: 'Link',
	}

	beforeEach(() => {
		document.body.innerHTML = ''
		editorElement = document.createElement('div')
		document.body.appendChild(editorElement)
		editor = new Editor({
			element: editorElement,
			extensions: [StarterKit, Underline],
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

	function createView(overrides: Partial<EditorBubbleMenuViewOptions> = {}): EditorBubbleMenuViewInstance {
		const options: EditorBubbleMenuViewOptions = {
			getEditor: () => editor ?? undefined,
			labels: defaultLabels,
			onLink: vi.fn(),
			...overrides,
		}
		const view = new EditorBubbleMenuView(options)
		views.push(view)
		return view
	}

	it('renders exactly six buttons, in the documented order, each with its data-command', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const buttons = Array.from(view.el.querySelectorAll('button'))
		expect(buttons).toHaveLength(6)

		const expectedCommands = ['bold', 'italic', 'underline', 'strike', 'code', 'link']
		const actualCommands = buttons.map(btn => btn.getAttribute('data-command'))
		expect(actualCommands).toEqual(expectedCommands)

		buttons.forEach(btn => {
			expect(btn.classList.contains('editor-bubble__button')).toBe(true)
			expect(btn.getAttribute('type')).toBe('button')
		})

		const expectedIcons = ['B', 'I', 'U', 'S', '</>', '🔗']
		const actualIcons = buttons.map(btn => btn.querySelector('.icon')?.textContent)
		expect(actualIcons).toEqual(expectedIcons)
	})

	it('each button carries the aria-label supplied in labels', () => {
		const customLabels = {
			bold: 'Custom Bold',
			italic: 'Custom Italic',
			underline: 'Custom Underline',
			strikethrough: 'Custom Strikethrough',
			code: 'Custom Code',
			link: 'Custom Link',
		}
		const view = createView({labels: customLabels})
		view.render()
		document.body.appendChild(view.el)

		const buttons = Array.from(view.el.querySelectorAll('button'))
		const actualLabels = buttons.map(btn => btn.getAttribute('aria-label'))
		expect(actualLabels).toEqual([
			customLabels.bold,
			customLabels.italic,
			customLabels.underline,
			customLabels.strikethrough,
			customLabels.code,
			customLabels.link,
		])
	})

	it('clicking the bold button makes editor.isActive("bold") true', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		editor!.commands.selectAll()
		expect(editor!.isActive('bold')).toBe(false)

		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(editor!.isActive('bold')).toBe(true)
	})

	it('clicking bold a second time turns it back off', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		editor!.commands.selectAll()
		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement

		boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(editor!.isActive('bold')).toBe(true)

		boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(editor!.isActive('bold')).toBe(false)
	})

	it('after toggling bold on and calling refresh(), the bold button has aria-pressed="true" and the italic button has aria-pressed="false"', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		editor!.commands.selectAll()
		editor!.chain().focus().toggleBold().run()
		expect(editor!.isActive('bold')).toBe(true)

		view.refresh()

		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		const italicButton = view.el.querySelector('[data-command="italic"]') as HTMLButtonElement
		const linkButton = view.el.querySelector('[data-command="link"]') as HTMLButtonElement

		expect(boldButton.getAttribute('aria-pressed')).toBe('true')
		expect(boldButton.classList.contains('is-active')).toBe(true)

		expect(italicButton.getAttribute('aria-pressed')).toBe('false')
		expect(italicButton.classList.contains('is-active')).toBe(false)

		expect(linkButton.getAttribute('aria-pressed')).toBeNull()
		expect(linkButton.classList.contains('is-active')).toBe(false)
	})

	it('clicking bold updates its own pressed state without an explicit refresh', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		editor!.commands.selectAll()

		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		expect(boldButton.getAttribute('aria-pressed')).toBe('false')

		boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		const refreshed = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		expect(refreshed.getAttribute('aria-pressed')).toBe('true')
		expect(refreshed.classList.contains('is-active')).toBe(true)
	})

	it('clicking the link button calls onLink exactly once and does NOT change the document', () => {
		const onLink = vi.fn()
		const view = createView({onLink})
		view.render()
		document.body.appendChild(view.el)

		const htmlBefore = editor!.getHTML()
		const linkButton = view.el.querySelector('[data-command="link"]') as HTMLButtonElement

		linkButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onLink).toHaveBeenCalledTimes(1)
		expect(onLink.mock.calls[0][0]).toBeInstanceOf(DOMRect)
		expect(editor!.getHTML()).toBe(htmlBefore)
	})

	it('with getEditor: () => undefined, rendering works and clicking bold does not throw', () => {
		const view = createView({getEditor: () => undefined})
		view.render()
		document.body.appendChild(view.el)

		const buttons = Array.from(view.el.querySelectorAll('button'))
		expect(buttons).toHaveLength(6)

		buttons.forEach(btn => {
			expect(btn.classList.contains('is-active')).toBe(false)
		})

		const boldButton = view.el.querySelector('[data-command="bold"]') as HTMLButtonElement
		expect(boldButton.getAttribute('aria-pressed')).toBe('false')

		expect(() => {
			boldButton.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		}).not.toThrow()
	})

	it('clicking somewhere inside the wrapper that is not a button does not throw and does not call onLink', () => {
		const onLink = vi.fn()
		const view = createView({onLink})
		view.render()
		document.body.appendChild(view.el)

		const wrapper = view.el.querySelector('.editor-bubble__wrapper') as HTMLElement
		expect(wrapper).not.toBeNull()

		expect(() => {
			wrapper.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		}).not.toThrow()

		expect(onLink).not.toHaveBeenCalled()
	})
})
