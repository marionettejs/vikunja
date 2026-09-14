import type {Editor} from '@tiptap/core'
import inputPrompt from '@/helpers/inputPrompt'
import {i18n} from '@/i18n'

export async function setImageAltInEditor(editor: Editor, position: number, rect: DOMRect, isCurrent: () => boolean) {
	const image = editor.state.doc.nodeAt(position)
	if (image?.type.name !== 'image') return
	const alt = await inputPrompt(rect, i18n.global.t('input.editor.altTextPlaceholder'), image.attrs.alt || '', editor)
	// Never apply a delayed answer to a replacement image or another route.
	if (alt === null || editor.isDestroyed || !isCurrent() || editor.state.doc.nodeAt(position) !== image) return
	editor.chain().focus().setNodeSelection(position).updateAttributes('image', {alt}).run()
}
