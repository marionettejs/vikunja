import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {Region} from 'marionette'
import {Model} from '@mnjs/data'
import TaskTitleView, {type TaskTitleModelAttributes} from './TaskTitleView'

describe('TaskTitleView', () => {
	let regionEl: HTMLElement
	let region: InstanceType<typeof Region>
	let model: Model<TaskTitleModelAttributes>

	beforeEach(() => {
		regionEl = document.createElement('div')
		document.body.appendChild(regionEl)
		region = new Region({el: regionEl})
	})

	afterEach(() => {
		try {
			region.destroy()
		} finally {
			model?.destroy()
			regionEl?.remove()
		}
	})

	function mount(attrs?: Partial<TaskTitleModelAttributes>, callbacks?: {onCommit?: (title: string) => void; onInvalid?: () => void}) {
		model = new Model<TaskTitleModelAttributes>({
			title: 'Default Title',
			canWrite: true,
			label: 'Default Label',
			...attrs,
		})
		const onCommit = callbacks?.onCommit ?? vi.fn()
		const onInvalid = callbacks?.onInvalid ?? vi.fn()
		const view = new TaskTitleView({
			model,
			onCommit,
			onInvalid,
		})
		region.show(view)
		return {view, onCommit, onInvalid}
	}

	it('initializes literal text trimmed and applies writable attributes', () => {
		const {view} = mount({title: '  <b>Clean Task</b>  ', canWrite: true, label: 'Task title'})

		expect(view.el.tagName).toBe('H1')
		expect(view.el.className).toBe('title input')
		expect(view.el.textContent).toBe('<b>Clean Task</b>')
		expect(view.el.innerHTML).toBe('&lt;b&gt;Clean Task&lt;/b&gt;')
		expect(view.el.getAttribute('contenteditable')).toBe('true')
		expect(view.el.getAttribute('tabindex')).toBe('0')
		expect(view.el.getAttribute('aria-label')).toBe('Task title')
		expect(view.el.getAttribute('spellcheck')).toBe('false')
	})

	it('applies readonly attributes and prevents editing and commit', () => {
		const {view, onCommit, onInvalid} = mount({title: 'Readonly Task', canWrite: false})

		expect(view.el.className).toBe('title input disabled')
		expect(view.el.getAttribute('contenteditable')).toBeNull()
		expect(view.el.getAttribute('tabindex')).toBeNull()
		expect(view.el.getAttribute('aria-label')).toBeNull()

		view.el.textContent = 'Changed'
		view.el.dispatchEvent(new Event('blur'))
		expect(onCommit).not.toHaveBeenCalled()
		expect(onInvalid).not.toHaveBeenCalled()
	})

	it('commits on blur when title text has changed', () => {
		const {view, onCommit, onInvalid} = mount({title: 'Original Title'})

		view.el.focus()
		view.el.textContent = 'Updated Title'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))
		view.el.blur()

		expect(onCommit).toHaveBeenCalledTimes(1)
		expect(onCommit).toHaveBeenCalledWith('Updated Title')
		expect(onInvalid).not.toHaveBeenCalled()
	})

	it('does not commit or invalidate on blur when title text is unchanged', () => {
		const {view, onCommit, onInvalid} = mount({title: 'Original Title'})

		view.el.focus()
		view.el.blur()

		expect(onCommit).not.toHaveBeenCalled()
		expect(onInvalid).not.toHaveBeenCalled()
	})

	it('restores raw title and calls onInvalid on blur when text is empty or whitespace', () => {
		const {view, onCommit, onInvalid} = mount({title: '  Raw Title  '})

		view.el.focus()
		view.el.textContent = '   '
		view.el.dispatchEvent(new Event('input', {bubbles: true}))
		view.el.blur()

		expect(view.el.textContent).toBe('  Raw Title  ')
		expect(onInvalid).toHaveBeenCalledTimes(1)
		expect(onInvalid).toHaveBeenCalledWith()
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('blurs and commits on Enter keydown unless composing', () => {
		const {view, onCommit} = mount({title: 'Original Title'})
		view.el.focus()
		view.el.textContent = 'New Title'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		const imeEnter = new KeyboardEvent('keydown', {key: 'Enter', cancelable: true, bubbles: true})
		Object.defineProperty(imeEnter, 'isComposing', {value: true})
		view.el.dispatchEvent(imeEnter)
		expect(document.activeElement).toBe(view.el)
		expect(onCommit).not.toHaveBeenCalled()

		const normalEnter = new KeyboardEvent('keydown', {key: 'Enter', cancelable: true, bubbles: true})
		view.el.dispatchEvent(normalEnter)
		expect(normalEnter.defaultPrevented).toBe(true)
		expect(document.activeElement).not.toBe(view.el)
		expect(onCommit).toHaveBeenCalledWith('New Title')
	})

	it('restores raw title and blurs on Escape keydown unless composing', () => {
		const {view, onCommit} = mount({title: '  Original Title  '})
		view.el.focus()
		view.el.textContent = 'Draft Text'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		const imeEscape = new KeyboardEvent('keydown', {key: 'Escape', cancelable: true, bubbles: true})
		Object.defineProperty(imeEscape, 'isComposing', {value: true})
		view.el.dispatchEvent(imeEscape)
		expect(view.el.textContent).toBe('Draft Text')
		expect(document.activeElement).toBe(view.el)

		const normalEscape = new KeyboardEvent('keydown', {key: 'Escape', cancelable: true, bubbles: true})
		view.el.dispatchEvent(normalEscape)
		expect(normalEscape.defaultPrevented).toBe(true)
		expect(view.el.textContent).toBe('  Original Title  ')
		expect(document.activeElement).not.toBe(view.el)
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('preserves draft text and Range selection across unrelated model label updates', () => {
		const {view} = mount({title: 'Original Title', label: 'Initial'})
		view.el.focus()
		view.el.textContent = 'Unsaved draft text'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		const textNode = view.el.firstChild!
		const range = document.createRange()
		range.setStart(textNode, 2)
		range.setEnd(textNode, 6)
		const sel = window.getSelection()!
		sel.removeAllRanges()
		sel.addRange(range)

		model.set('label', 'Updated Label')

		expect(view.el.textContent).toBe('Unsaved draft text')
		expect(view.el.getAttribute('aria-label')).toBe('Updated Label')
		expect(document.activeElement).toBe(view.el)
		const currentRange = window.getSelection()!.getRangeAt(0)
		expect(currentRange.startOffset).toBe(2)
		expect(currentRange.endOffset).toBe(6)
	})

	it('acknowledges draft matching raw title with whitespace and updates clean model', () => {
		const {view} = mount({title: 'Initial Title'})
		view.el.focus()
		view.el.textContent = '  Draft Spaced  '
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		model.set('title', '  Draft Spaced  ')
		view.el.blur()

		model.set('title', 'Third Title')
		expect(view.el.textContent).toBe('Third Title')
		model.set('title', '  Updated clean title  ')
		expect(view.el.textContent).toBe('Updated clean title')
	})

	it('resets draft and prevents commit when canWrite is revoked', () => {
		const {view, onCommit} = mount({title: 'Canonical Title', canWrite: true})
		view.el.focus()
		view.el.textContent = 'Uncommitted Draft'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		model.set('canWrite', false)
		expect(view.el.textContent).toBe('Canonical Title')
		expect(view.el.className).toBe('title input disabled')

		view.el.blur()
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('prevents beforeunload when dirty and allows when clean', () => {
		const {view} = mount({title: 'Initial'})
		const event = new Event('beforeunload', {cancelable: true}) as BeforeUnloadEvent

		window.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(false)

		view.el.textContent = 'Dirty Draft'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		const dirtyEvent = new Event('beforeunload', {cancelable: true}) as BeforeUnloadEvent
		window.dispatchEvent(dirtyEvent)
		expect(dirtyEvent.defaultPrevented).toBe(true)
	})

	it('removes beforeunload listener on detach and destroy', () => {
		const {view} = mount({title: 'Initial'})
		view.el.textContent = 'Dirty Draft'
		view.el.dispatchEvent(new Event('input', {bubbles: true}))

		expect(region.detachView()).toBe(view)
		const detachEvent = new Event('beforeunload', {cancelable: true}) as BeforeUnloadEvent
		window.dispatchEvent(detachEvent)
		expect(detachEvent.defaultPrevented).toBe(false)

		region.show(view)
		region.destroy()
		const destroyEvent = new Event('beforeunload', {cancelable: true}) as BeforeUnloadEvent
		window.dispatchEvent(destroyEvent)
		expect(destroyEvent.defaultPrevented).toBe(false)
	})
})
