import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {NativeEditorView, type NativeEditorOptions} from './editor'
const views: InstanceType<typeof NativeEditorView>[] = []
beforeEach(() => { localStorage.clear() })
afterEach(() => { views.forEach(view => view.destroy()); views.length = 0; document.body.replaceChildren(); vi.restoreAllMocks() })
function setup(overrides: Partial<NativeEditorOptions> = {}) {
 const options: NativeEditorOptions = {value: '<p>Accepted text</p>', canWrite: true, projectId: 1, storageKey: 'test-description', placeholder: 'Description', context: {t: key => key, users: async () => [], avatar: async () => undefined, fetchTask: vi.fn(), projectTitle: () => '', openTask: vi.fn(), observeTasks: () => () => {}, displayDate: () => '', reportError: vi.fn()}, upload: async () => [], changed: vi.fn(), save: async submitted => submitted, ...overrides}
 const view = new NativeEditorView(options); view.render(); document.body.append(view.el); views.push(view); return {view, options}
}
it('accepted prop updates preserve a newer draft, editor identity and document selection', () => {
 const {view} = setup(); view.edit(); const editor = view.live()!; editor.commands.setContent('<p>Newer draft</p>'); editor.commands.setTextSelection(5); const dom = editor.view.dom
 view.updateInputs('<p>Older response</p>', true, 1)
 expect(view.live()).toBe(editor); expect(editor.view.dom).toBe(dom); expect(editor.getHTML()).toBe('<p>Newer draft</p>'); expect(editor.state.selection.from).toBe(5); expect(localStorage.getItem('editorDraft-test-description')).toBe('<p>Newer draft</p>')
})
it.each(['destroy', 'readonly', 'project'] as const)('pending upload cannot insert, publish, or notify after %s', async reason => {
 let finish!: (urls: string[]) => void, signal!: AbortSignal
 const {view, options} = setup({upload: (_files, requestSignal) => { signal = requestSignal; return new Promise(resolve => { finish = resolve }) }})
 const upload = view.uploadFiles([new File(['fixture'], 'image.png', {type: 'image/png'})]); const editor = view.live()!
 if (reason === 'destroy') view.destroy(); else view.updateInputs('<p>Accepted text</p>', reason !== 'readonly', reason === 'project' ? 2 : 1)
 expect(signal.aborted).toBe(true); finish(['https://example.org/late.png']); await upload
 expect(options.changed).not.toHaveBeenCalled(); expect(options.context.reportError).not.toHaveBeenCalled(); if (reason === 'readonly') expect(editor.getHTML()).toBe('<p>Accepted text</p>')
})
it('failed explicit save leaves the draft and edit mode available for retry', async () => {
 const save = vi.fn().mockRejectedValueOnce(new Error('fixture rejected')).mockResolvedValueOnce('<p>Unsaved</p>'), {view, options} = setup({save})
 view.edit(); view.live()!.commands.setContent('<p>Unsaved</p>'); await view.saveNow(); expect(view.getState().editing.value).toBe(true); expect(view.getState().dirty.value).toBe(true); expect(localStorage.getItem('editorDraft-test-description')).toBe('<p>Unsaved</p>'); expect(options.context.reportError).toHaveBeenCalledOnce()
 await view.saveNow(); expect(view.getState().editing.value).toBe(false); expect(localStorage.getItem('editorDraft-test-description')).toBeNull()
})
it('discard restores accepted HTML and removes the draft without replacing the editor', () => {
 const {view, options} = setup(); view.edit(); const editor = view.live()!; editor.commands.setContent('<p>Discard me</p>'); view.discard(); expect(view.live()).toBe(editor); expect(editor.getHTML()).toBe('<p>Accepted text</p>'); expect(options.changed).toHaveBeenLastCalledWith('<p>Accepted text</p>'); expect(localStorage.getItem('editorDraft-test-description')).toBeNull()
})

it('explicit save never acknowledges a different snapshot returned by the owner', async () => {
 const {view} = setup({save: async () => '<p>Newer owner snapshot</p>'}); view.edit(); view.live()!.commands.setContent('<p>Submitted</p>'); await view.saveNow(); expect(view.getState().editing.value).toBe(true); expect(view.getState().dirty.value).toBe(true); expect(localStorage.getItem('editorDraft-test-description')).toBe('<p>Submitted</p>')
})
it('project change dismisses an image alt prompt and cancels its selection continuation', async () => {
 const {view} = setup({upload: async () => ['https://example.org/image.png']}); view.edit(); const editor = view.live()!; const upload = view.uploadFiles([new File(['image'], 'image.png')]); await vi.waitFor(() => expect(document.querySelector('input[placeholder="input.editor.altTextPlaceholder"]')).not.toBeNull()); const selection = editor.state.selection; view.updateInputs(editor.getHTML(), true, 2); await upload; expect(document.querySelector('input[placeholder="input.editor.altTextPlaceholder"]')).toBeNull(); expect(editor.state.selection).toBe(selection); expect(editor.getAttributes('image').alt).toBeNull()
})

it('clicking a focused editor does not replace browser selection with stored selection', async () => {
 const {view} = setup(); view.edit(); const editor = view.live()!; editor.commands.setTextSelection({from:1,to:editor.state.doc.content.size-1})
 await vi.waitFor(() => expect(editor.view.hasFocus()).toBe(true))
 const focus=vi.spyOn(editor.view,'focus'), frame=vi.spyOn(window,'requestAnimationFrame');const selection=editor.state.selection
 const range=document.createRange();range.selectNodeContents(editor.view.dom);const browserSelection=getSelection()!;browserSelection.removeAllRanges();browserSelection.addRange(range);const selected=browserSelection.toString()
 view.contentClick(new MouseEvent('click'))
 expect(focus).not.toHaveBeenCalled();expect(frame).not.toHaveBeenCalled();expect(editor.state.selection).toBe(selection);expect(browserSelection.toString()).toBe(selected)
})
it('unchanged input publication preserves browser selection without resetting editable DOM', () => {
 const {view} = setup(); view.edit(); const editor = view.live()!; editor.commands.setTextSelection(editor.state.doc.content.size - 1)
 const range = document.createRange(); range.selectNodeContents(editor.view.dom); const selected = getSelection()!; selected.removeAllRanges(); selected.addRange(range)
 const text = selected.toString(), editable = vi.spyOn(editor, 'setEditable')
 view.updateInputs('<p>Accepted text</p>', true, 1); view.refreshActions()
 expect(editable).not.toHaveBeenCalled(); expect(selected.toString()).toBe(text); expect(editor.isEditable).toBe(true)
})

it('preview Edit presentation and Reply never grant permission to mutate a comment', () => {
 const reply = vi.fn(), {view} = setup({canWrite: false, bottomActions: [{title: 'Reply', action: reply}]})
 expect((view.getUI('editItem')![0] as HTMLElement).hidden).toBe(false)
 view.edit(); expect(view.live()!.isEditable).toBe(false)
 const button = Array.from(view.el.querySelectorAll('button')).find(item => item.textContent === 'Reply')!
 button.click(); expect(reply).toHaveBeenCalledOnce()
 view.options.showEdit = false; view.refreshMode()
 expect((view.getUI('editItem')![0] as HTMLElement).hidden).toBe(true)
 expect(button.hidden).toBe(false); view.edit(); expect(view.live()!.isEditable).toBe(false)
 view.options.showEdit = true; view.updateInputs('<p>Accepted text</p>', true, 1)
 view.edit(); expect(view.live()!.isEditable).toBe(true)
})

it('preview editors defer hidden toolbar controls until the first permitted edit', () => {
 const {view} = setup({value: '<p><strong>Accepted text</strong></p>'})
 expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(0)
 view.edit(); const toolbar = view.getState().toolbar!
 expect(toolbar.el.querySelectorAll('button')).toHaveLength(19)
 view.live()!.commands.setTextSelection(3); view.refreshControls()
 expect(toolbar.el.querySelector('[data-active="bold"]')!.getAttribute('aria-pressed')).toBe('true')
 const buttons = toolbar.buttons(); buttons[0].focus()
 buttons[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
 expect(document.activeElement).toBe(buttons[1])
})
it.each(['empty', 'draft'] as const)('initial %s composer exposes controls immediately', kind => {
 if (kind === 'draft') localStorage.setItem('editorDraft-test-description', '<p>Restored draft</p>')
 const {view} = setup({value: ''})
 expect(view.getState().editing.value).toBe(true)
 expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(19)
 if (kind === 'draft') expect(view.live()!.getHTML()).toBe('<p>Restored draft</p>')
})
it('first edit toolbar retains its expanded state through discard and save and is destroyed by its region', async () => {
 const {view} = setup(); view.edit(); const toolbar = view.getState().toolbar!
 toolbar.el.querySelector<HTMLButtonElement>('[data-active="table"]')!.click()
 const element = toolbar.el, controls = element.querySelectorAll('button')
 expect(controls.length).toBeGreaterThan(19)
 view.discard(); view.edit(); expect(view.getState().toolbar).toBe(toolbar); expect(toolbar.el).toBe(element)
 expect(toolbar.el.querySelectorAll('button')).toHaveLength(controls.length)
 view.live()!.commands.setContent('<p>Saved change</p>'); await view.saveNow(); view.edit()
 expect(view.getState().toolbar).toBe(toolbar); expect(toolbar.getState().table).toBe(true)
 view.destroy(); expect(toolbar.isDestroyed()).toBe(true); expect(element.isConnected).toBe(false)
})
it('readonly previews do not create controls until permission is granted and editing begins', () => {
 const {view} = setup({canWrite: false})
 view.edit(); expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(0)
 view.updateInputs('<p>Accepted text</p>', true, 1)
 expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(0)
 view.edit(); expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(19)
})

it('a released toolbar region is recreated only on the next permitted edit', () => {
 const {view} = setup(); view.edit(); const first = view.getState().toolbar!
 view.discard(); view.getRegion('toolbar')!.empty(); expect(first.isDestroyed()).toBe(true)
 view.refreshMode(); expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(0)
 view.edit(); expect(view.getState().toolbar).not.toBe(first)
 expect(view.el.querySelectorAll('[data-toolbar] button')).toHaveLength(19)
 view.updateInputs('<p>Accepted text</p>', false, 1)
 expect(view.live()!.isEditable).toBe(false); expect((view.getUI('toolbarHost')![0] as HTMLElement).hidden).toBe(true)
})
