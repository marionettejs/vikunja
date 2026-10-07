import type {Page} from '@playwright/test'

// Test-only observation of the real editor; wrappers preserve arguments and return values.
export async function installEditorSelectionTrace(page: Page) {
 await page.locator('#comment-1 .ProseMirror').waitFor({state: 'attached'})
 await page.evaluate(mode => {
  const minimal = mode !== 'full', critical = mode === 'critical-writers'
  const dom = document.querySelector('#comment-1 .ProseMirror') as HTMLElement & {editor?: any}
  const editor = dom.editor, events: unknown[] = []
  if (!editor?.view) throw new Error('Tiptap editor is unavailable for selection tracing')
  const view = editor.view
  Object.assign(window, {editorSelectionTrace: events})
  const log = (kind: string, extra: unknown = {}, stack = true) => {
   if (events.length >= 20000) return
   const selection = getSelection()
   events.push({kind, time: performance.now(), text: dom.textContent, selected: selection?.toString(), anchor: selection?.anchorOffset, focus: selection?.focusOffset, model: {from: view.state.selection.from, to: view.state.selection.to}, extra, stack: stack ? new Error().stack : undefined})
  }
  for (const name of minimal ? [] : ['focus', 'updateState', 'dispatch']) {
   const original = view[name]
   view[name] = function(...args: any[]) {log(name, name === 'dispatch' ? {selection: args[0].selection.toJSON(), docChanged: args[0].docChanged, meta: args[0].meta} : {}); return original.apply(this, args)}
  }
  for (const name of minimal ? [] : ['flush', 'suppressSelectionUpdates']) {
   const original = view.domObserver[name]
   view.domObserver[name] = function(...args: any[]) {log('observer.' + name, {suppressing: this.suppressingSelectionUpdates}); return original.apply(this, args)}
  }
  for (const name of ['collapse', 'extend', 'setBaseAndExtent', 'removeAllRanges', 'addRange']) {
   const original = Selection.prototype[name]
   Selection.prototype[name] = function(...args: any[]) {if (!critical || getSelection()?.toString()) log('selection.' + name); return original.apply(this, args)}
  }
  for (const type of critical ? [] : ['beforeinput', 'selectionchange', 'focusin', 'focusout', 'keydown', 'input']) document.addEventListener(type, event => {const input = event as InputEvent; log(type, {inputType: input.inputType, data: input.data, key: (event as KeyboardEvent).key, trusted: event.isTrusted}, !minimal)}, true)
 }, process.env.COMMENT_SELECTION_TRACE_MODE ?? 'full')
}
