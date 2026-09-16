import {afterEach, describe, expect, it, vi} from 'vitest'
import {Model} from '@mnjs/data'
import {TaskHeadingView, type TaskHeadingViewOptions, type TaskHeadingViewInstance} from './TaskHeadingView'

const owned: Array<{view: TaskHeadingViewInstance; model: Model}> = []
const labels = {title: 'Title', titleRequired: 'Title required', saving: 'Saving', saved: 'Saved', saveError: 'Save failed', copy: 'Copy link', close: 'Close task', done: 'Done'}
function fixture(overrides: Partial<TaskHeadingViewOptions> = {}) {
	const model = new Model({id: 1, title: 'Initial', done: false, hexColor: ''})
	const onCommit = vi.fn(async (title: string) => {model.set('title', title)})
	const options = {model, canWrite: true, hasClose: true, labels, taskUrl: '/tasks/1', taskIdentifier: '#1', onCopy: vi.fn(), onCommit, ...overrides}
	const view = new TaskHeadingView(options)
	owned.push({view, model})
	view.render()
	document.body.append(view.el)
	const heading = view.el.querySelector('h1')!
	return {view, model, heading, onCommit: options.onCommit, options}
}
function input(heading: HTMLElement, text: string) {
	heading.textContent = text
	heading.dispatchEvent(new Event('input', {bubbles: true}))
}
function blur(heading: HTMLElement) {
	heading.dispatchEvent(new FocusEvent('focusout', {bubbles: true}))
}
function key(heading: HTMLElement, key: string, isComposing = false) {
	heading.dispatchEvent(new KeyboardEvent('keydown', {key, isComposing, bubbles: true, cancelable: true}))
}
const settle = async () => {await Promise.resolve(); await Promise.resolve(); await Promise.resolve()}
afterEach(() => {
	for (const {view, model} of owned.splice(0)) {view.destroy(); model.destroy()}
	vi.restoreAllMocks()
	vi.useRealTimers()
	document.body.replaceChildren()
})

describe('TaskHeadingView', () => {
	it('commits DOM edits without losing rendering markers and shows a non-error status', async () => {
		const {view, heading, onCommit} = fixture()
		expect(heading.getAttribute('tabindex')).toBe('0')
		input(heading, '  Changed title  ')
		blur(heading)
		expect(onCommit).toHaveBeenCalledWith('  Changed title  ')
		expect(view.el.textContent).toContain('Saving')
		expect(heading.hasAttribute('aria-invalid')).toBe(false)
		await settle()
		expect(heading.textContent).toBe('  Changed title  ')
		expect(view.el.textContent).toContain('Saved')
		expect(view.el.querySelector('.help.is-danger')).toBeNull()
		input(heading, 'Second edit')
		key(heading, 'Enter')
		await settle()
		expect(heading.textContent).toBe('Second edit')
	})

	it('restores the canonical title on Escape or empty input without saving', () => {
		const {heading, onCommit, view} = fixture()
		input(heading, 'Draft')
		key(heading, 'Escape')
		expect(heading.textContent).toBe('Initial')
		input(heading, '   ')
		blur(heading)
		expect(heading.textContent).toBe('Initial')
		expect(view.el.textContent).toContain('Title required')
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('does not intercept composing Enter or Escape', () => {
		const {heading, onCommit} = fixture()
		input(heading, 'Composing')
		key(heading, 'Enter', true)
		key(heading, 'Escape', true)
		expect(heading.textContent).toBe('Composing')
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('keeps readonly text and hides unavailable close and done controls', () => {
		const {heading, view, onCommit} = fixture({canWrite: false, hasClose: false})
		expect(heading.hasAttribute('contenteditable')).toBe(false)
		expect(heading.hasAttribute('tabindex')).toBe(false)
		expect(view.el.querySelector('[data-role="task-heading-close"]')).toBeNull()
		expect(view.el.querySelector('.done-indicator')).toBeNull()
		input(heading, 'Synthetic')
		blur(heading)
		expect(onCommit).not.toHaveBeenCalled()
	})

	it('retains a failed draft for retry and accepts the owner canonical result', async () => {
		const commit = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(async () => {model.set('title', 'Server title')})
		const {heading, model, view} = fixture({onCommit: commit})
		input(heading, 'Retry me')
		blur(heading)
		await settle()
		expect(heading.textContent).toBe('Retry me')
		expect(view.el.textContent).toContain('Save failed')
		blur(heading)
		await settle()
		expect(commit).toHaveBeenCalledTimes(2)
		expect(heading.textContent).toBe('Server title')
	})

	it('preserves dirty text during unrelated canonical changes', () => {
		const {heading, model, view} = fixture()
		input(heading, 'Draft')
		model.set({done: true, title: 'Remote title'})
		expect(heading.textContent).toBe('Draft')
		expect(view.el.querySelector('.done-indicator')).not.toBeNull()
		key(heading, 'Escape')
		expect(heading.textContent).toBe('Remote title')
	})

	it('cleans dirty unload protection and ignores a late save after destruction', async () => {
		let resolve!: () => void
		const {heading, view} = fixture({onCommit: () => new Promise<void>(done => {resolve = done})})
		input(heading, 'Draft')
		const before = new Event('beforeunload', {cancelable: true})
		window.dispatchEvent(before)
		expect(before.defaultPrevented).toBe(true)
		blur(heading)
		view.destroy()
		resolve()
		await settle()
		const after = new Event('beforeunload', {cancelable: true})
		window.dispatchEvent(after)
		expect(after.defaultPrevented).toBe(false)
		expect(document.body.contains(view.el)).toBe(false)
	})

	it('dispatches copy and close callbacks and releases the saved timer', async () => {
		vi.useFakeTimers()
		const onCopy = vi.fn(), onClose = vi.fn()
		const {view, heading} = fixture({onCopy, onClose})
		view.el.querySelector<HTMLButtonElement>('[data-role="task-heading-copy"]')!.click()
		view.el.querySelector<HTMLButtonElement>('[data-role="task-heading-close"]')!.click()
		expect(onCopy).toHaveBeenCalledWith('/tasks/1', '#1')
		expect(onClose).toHaveBeenCalledOnce()
		input(heading, 'Saved title')
		blur(heading)
		await settle()
		view.destroy()
		expect(vi.getTimerCount()).toBe(0)
	})
	it('waits for an in-flight blur save when navigation requests save', async () => {
		let release!: () => void
		const onCommit = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
		const {view, heading} = fixture({onCommit})
		input(heading, 'Pending')
		blur(heading)
		let finished = false
		const saving = view.save().then(() => {finished = true})
		await settle()
		expect(finished).toBe(false)
		expect(onCommit).toHaveBeenCalledTimes(1)
		release()
		await saving
		expect(finished).toBe(true)
	})

	it('rejects navigation save failures while retaining title for retry', async () => {
		const failure = new Error('offline')
		const onCommit = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined)
		const {view, heading} = fixture({onCommit})
		input(heading, 'Retained')
		await expect(view.save()).rejects.toBe(failure)
		expect(heading.textContent).toBe('Retained')
		expect(view.el.textContent).toContain('Save failed')
		await view.save()
		expect(onCommit).toHaveBeenCalledTimes(2)
	})

})
