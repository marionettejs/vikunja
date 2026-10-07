import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {NativeEditorView, type NativeEditorOptions} from './editor'
const views: InstanceType<typeof NativeEditorView>[] = []
beforeEach(() => { localStorage.clear() })
afterEach(() => { views.forEach(view => view.destroy()); views.length = 0; document.body.replaceChildren(); vi.restoreAllMocks() })
function setup(overrides: Partial<NativeEditorOptions> = {}) {
	const options: NativeEditorOptions = {value: '<p>Accepted text</p>', canWrite: true, projectId: 1, storageKey: 'test-description', placeholder: 'Description', context: {t: key => key, users: async () => [], avatar: async () => undefined, fetchTask: vi.fn(), projectTitle: () => '', openTask: vi.fn(), observeTasks: () => () => {}, displayDate: () => '', reportError: vi.fn()}, upload: async () => [], changed: vi.fn(), save: async submitted => submitted, ...overrides}
	const view = new NativeEditorView(options); view.render(); document.body.append(view.el); views.push(view); return {view, options}
}
it('edit entry eventually focuses the retained editor and keyboard navigation preserves a saved draft', async () => {
	const {view, options} = setup(); const editor = view.live()!
	view.edit(); await vi.waitFor(() => expect(editor.view.hasFocus()).toBe(true))
	editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', code: 'End', ctrlKey: true, bubbles: true, cancelable: true})); editor.commands.insertContent(' appended')
	expect(editor.getHTML()).toBe('<p>Accepted text appended</p>')
	expect(localStorage.getItem('editorDraft-test-description')).toBe('<p>Accepted text appended</p>')
	await view.saveNow()
	expect(options.changed).toHaveBeenLastCalledWith('<p>Accepted text appended</p>'); expect(view.live()).toBe(editor)
	expect(view.getState().editing.value).toBe(false); expect(view.getState().dirty.value).toBe(false)
	expect(localStorage.getItem('editorDraft-test-description')).toBeNull()
})

it('discard before deferred edit focus keeps accepted content readonly and permits a clean reentry', async () => {
	const {view, options} = setup(); const editor = view.live()!
	vi.useFakeTimers({toFake: ['requestAnimationFrame', 'cancelAnimationFrame']})
	try {
		view.edit(); editor.commands.insertContent(' abandoned'); view.discard()
		await vi.advanceTimersByTimeAsync(32)
		expect(editor.isEditable).toBe(false); expect(editor.getHTML()).toBe('<p>Accepted text</p>')
		expect(view.getState().dirty.value).toBe(false); expect(localStorage.getItem('editorDraft-test-description')).toBeNull()
		expect(options.changed).toHaveBeenLastCalledWith('<p>Accepted text</p>')
		view.edit(); await vi.advanceTimersByTimeAsync(32)
		expect(editor.view.hasFocus()).toBe(true); expect(editor.isEditable).toBe(true)
		editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', code: 'End', ctrlKey: true, bubbles: true, cancelable: true})); editor.commands.insertContent(' next')
		expect(editor.getHTML()).toBe('<p>Accepted text next</p>')
		expect(localStorage.getItem('editorDraft-test-description')).toBe('<p>Accepted text next</p>')
	} finally { vi.useRealTimers() }
})

it('destroying the editor before deferred focus keeps focus on the replacement owner', async () => {
	const {view, options} = setup(); const editor = view.live()!
	vi.useFakeTimers({toFake: ['requestAnimationFrame', 'cancelAnimationFrame']})
	try {
		view.edit(); view.destroy()
		const replacement = document.createElement('button'); document.body.append(replacement); replacement.focus()
		await vi.advanceTimersByTimeAsync(32)
		expect(editor.isDestroyed).toBe(true); expect(document.activeElement).toBe(replacement)
		expect(options.changed).not.toHaveBeenCalled(); expect(options.context.reportError).not.toHaveBeenCalled()
	} finally { vi.useRealTimers() }
})


it('a pending BubbleMenu selection update cannot inspect the destroyed editor host', async () => {
	vi.useFakeTimers()
	try {
		const {view, options} = setup(); const editor = view.live()!
		view.edit(); await vi.advanceTimersByTimeAsync(32)
		editor.commands.setTextSelection({from: 1, to: 5})
		const editorView = editor.view
		view.destroy()
		const focus = vi.spyOn(editorView, 'hasFocus')
		const activeElement = vi.spyOn(document, 'activeElement', 'get')
		await vi.advanceTimersByTimeAsync(300)
		expect(focus).not.toHaveBeenCalled(); expect(activeElement).not.toHaveBeenCalled()
		expect(options.changed).not.toHaveBeenCalled(); expect(options.context.reportError).not.toHaveBeenCalled()
		expect(view.getState().menus.every(menu => !menu.isConnected)).toBe(true)
	} finally { vi.useRealTimers() }
})

it('the live editor still shows its selection menu after the installed debounce', async () => {
	vi.useFakeTimers()
	try {
		const {view} = setup(); const editor = view.live()!
		view.edit(); await vi.advanceTimersByTimeAsync(32)
		editor.commands.setTextSelection({from: 1, to: 5})
		expect(view.getState().menus[0].isConnected).toBe(false)
		await vi.advanceTimersByTimeAsync(300)
		expect(view.getState().menus[0].isConnected).toBe(true)
		expect(editor.view.hasFocus()).toBe(true)
		view.destroy()
	} finally { vi.useRealTimers() }
})
