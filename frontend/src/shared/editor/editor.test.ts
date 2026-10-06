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

it('clicking a focused editor does not replace browser selection with stored selection', () => {
 const {view} = setup(); view.edit(); const editor = view.live()!; editor.commands.setTextSelection({from:1,to:editor.state.doc.content.size-1})
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
