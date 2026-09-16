import type {Editor} from '@tiptap/core'
import {isTextSelection} from '@tiptap/core'
import {BubbleMenuPlugin} from '@tiptap/extension-bubble-menu'

import inputPrompt from '@/helpers/inputPrompt'
import {setImageAltInEditor} from '@/components/input/editor/setImageAltInEditor'
import {setLinkInEditor} from '@/components/input/editor/setLinkInEditor'
import {EditorBubbleMenuView} from './EditorBubbleMenuView'
import {EditorToolbarView, type EditorToolbarViewInstance} from './EditorToolbarView'
import {ImageAltMenuView} from './ImageAltMenuView'

export interface EditorControlsOptions {
	/** Must already resolve to a live editor: the controls attach to it once, at construction. */
	getEditor: () => Editor | undefined
	t: (key: string) => string
	/** Namespaces the registered ProseMirror plugins so two editors can be live at once. */
	pluginKeyPrefix: string
	/** False once the owner has torn down or replaced this editor; guards every async prompt. */
	isActive: () => boolean
	/** Where the floating menus live. Defaults to the body so they escape overflow clipping. */
	menuContainer?: HTMLElement
}

export interface EditorControls {
	toolbarView: EditorToolbarViewInstance
	destroy(): void
}

function toolbarLabels(t: (key: string) => string) {
	return {
		toolbarLabel: t('input.editor.toolbarLabel'),
		heading1: t('input.editor.heading1'),
		heading2: t('input.editor.heading2'),
		heading3: t('input.editor.heading3'),
		bold: t('input.editor.bold'),
		italic: t('input.editor.italic'),
		underline: t('input.editor.underline'),
		strikethrough: t('input.editor.strikethrough'),
		code: t('input.editor.code'),
		quote: t('input.editor.quote'),
		bulletList: t('input.editor.bulletList'),
		orderedList: t('input.editor.orderedList'),
		taskList: t('input.editor.taskList'),
		image: t('input.editor.image'),
		link: t('input.editor.link'),
		text: t('input.editor.text'),
		horizontalRule: t('input.editor.horizontalRule'),
		undo: t('input.editor.undo'),
		redo: t('input.editor.redo'),
		table: {
			title: t('input.editor.table.title'),
			insert: t('input.editor.table.insert'),
			addColumnBefore: t('input.editor.table.addColumnBefore'),
			addColumnAfter: t('input.editor.table.addColumnAfter'),
			deleteColumn: t('input.editor.table.deleteColumn'),
			addRowBefore: t('input.editor.table.addRowBefore'),
			addRowAfter: t('input.editor.table.addRowAfter'),
			deleteRow: t('input.editor.table.deleteRow'),
			deleteTable: t('input.editor.table.deleteTable'),
			mergeCells: t('input.editor.table.mergeCells'),
			splitCell: t('input.editor.table.splitCell'),
			toggleHeaderColumn: t('input.editor.table.toggleHeaderColumn'),
			toggleHeaderRow: t('input.editor.table.toggleHeaderRow'),
			toggleHeaderCell: t('input.editor.table.toggleHeaderCell'),
			mergeOrSplit: t('input.editor.table.mergeOrSplit'),
			fixTables: t('input.editor.table.fixTables'),
		},
	}
}

// Inserting an image and then asking for its alt text has to find the node it just created.
// The URL is not unique, so the lookup is restricted to the range the insertion mapped.
function insertImage(editor: Editor, url: string): number | null {
	let position: number | null = null

	editor.chain().focus().setImage({src: url}).command(({tr}) => {
		const insertion = tr.mapping.maps[tr.mapping.maps.length - 1]
		insertion?.forEach((_from: number, _to: number, insertedFrom: number, insertedTo: number) => {
			tr.doc.nodesBetween(insertedFrom, insertedTo, (node, pos) => {
				if (node.type.name === 'image') {
					position = pos
				}
			})
		})
		return true
	}).run()

	return position
}

/**
 * Builds the toolbar, selection bubble menu and image alt-text menu for one editor, wires their
 * ProseMirror plugins and refresh listeners, and hands back a single teardown.
 *
 * The caller owns where the toolbar goes; everything else is self-contained.
 */
export function createEditorControls(options: EditorControlsOptions): EditorControls {
	const {getEditor, t, pluginKeyPrefix, isActive} = options
	const menuContainer = options.menuContainer ?? document.body

	const bubbleMenuKey = `${pluginKeyPrefix}BubbleMenu`
	const imageAltMenuKey = `${pluginKeyPrefix}ImageAltMenu`

	// The plugins and listeners attach once, here. Controls built before the editor exists could
	// never attach afterwards, so that is a caller bug rather than a state to carry.
	const registeredEditor = getEditor()
	if (!registeredEditor) {
		throw new Error('createEditorControls needs a rendered editor')
	}

	function handleLink(rect: DOMRect) {
		void setLinkInEditor(rect, getEditor(), isActive)
	}

	function handleImageAlt(rect: DOMRect) {
		const editor = getEditor()
		if (!editor || !editor.isActive('image')) {
			return
		}
		void setImageAltInEditor(editor, editor.state.selection.from, rect, isActive)
	}

	function handleImageUpload(rect: DOMRect) {
		const promptedEditor = getEditor()
		if (!promptedEditor) {
			return
		}

		void inputPrompt(rect, t('input.editor.urlPlaceholder'), '', promptedEditor).then(async url => {
			const editor = getEditor()
			if (
				!isActive()
				|| promptedEditor.isDestroyed
				|| !editor
				|| editor !== promptedEditor
				|| editor.isDestroyed
				|| url === null
				|| url === ''
			) {
				return
			}

			const position = insertImage(editor, url)
			if (position === null) {
				return
			}

			editor.chain().setNodeSelection(position).run()
			const image = editor.view.nodeDOM(position) as HTMLElement | null
			await setImageAltInEditor(editor, position, image?.getBoundingClientRect() ?? rect, isActive)

			// Only step past the image if it is still the thing the user is looking at.
			if (
				isActive()
				&& !editor.isDestroyed
				&& editor.state.selection.from === position
				&& editor.isActive('image')
				&& editor.state.doc.nodeAt(position)?.attrs.src === url
			) {
				editor.chain().setTextSelection(position + 1).run()
			}
		})
	}

	const toolbarView = new EditorToolbarView({
		getEditor,
		labels: toolbarLabels(t),
		onImageUpload: handleImageUpload,
		onLink: handleLink,
	})

	const bubbleMenuView = new EditorBubbleMenuView({
		getEditor,
		labels: {
			bold: t('input.editor.bold'),
			italic: t('input.editor.italic'),
			underline: t('input.editor.underline'),
			strikethrough: t('input.editor.strikethrough'),
			code: t('input.editor.code'),
			link: t('input.editor.link'),
		},
		onLink: handleLink,
	})
	bubbleMenuView.render()
	menuContainer.appendChild(bubbleMenuView.el)

	const imageAltMenuView = new ImageAltMenuView({
		label: t('input.editor.altText'),
		onEdit: handleImageAlt,
	})
	imageAltMenuView.render()
	menuContainer.appendChild(imageAltMenuView.el)

	const refresh = () => {
		bubbleMenuView.refresh()
		toolbarView.refresh()
	}

	registeredEditor.registerPlugin(BubbleMenuPlugin({
		pluginKey: bubbleMenuKey,
		editor: registeredEditor,
		element: bubbleMenuView.el as HTMLElement,
		shouldShow: ({view, element, state, from, to}) => {
			const isEmptyTextBlock = !state.doc.textBetween(from, to).length
				&& isTextSelection(state.selection)
			const hasEditorFocus = view.hasFocus() || element.contains(document.activeElement)
			return hasEditorFocus
				&& from !== to
				&& !isEmptyTextBlock
				&& !registeredEditor.isActive('image')
				&& !registeredEditor.isActive('taskLink')
		},
	}))

	registeredEditor.registerPlugin(BubbleMenuPlugin({
		pluginKey: imageAltMenuKey,
		editor: registeredEditor,
		element: imageAltMenuView.el as HTMLElement,
		shouldShow: ({view, element}) => registeredEditor.isEditable
			&& registeredEditor.isActive('image')
			&& (view.hasFocus() || element.contains(document.activeElement)),
	}))

	registeredEditor.on('selectionUpdate', refresh)
	registeredEditor.on('transaction', refresh)

	let destroyed = false

	return {
		toolbarView,

		destroy() {
			if (destroyed) {
				return
			}
			destroyed = true

			// Detach from the editor these controls actually registered with, not whatever the
			// owner points at now, and do it before destroying the elements the plugins position.
			if (!registeredEditor.isDestroyed) {
				registeredEditor.off('selectionUpdate', refresh)
				registeredEditor.off('transaction', refresh)
				registeredEditor.unregisterPlugin(bubbleMenuKey)
				registeredEditor.unregisterPlugin(imageAltMenuKey)
			}

			bubbleMenuView.el.remove()
			bubbleMenuView.destroy()
			imageAltMenuView.el.remove()
			imageAltMenuView.destroy()

			if (!toolbarView.isDestroyed()) {
				toolbarView.destroy()
			}
		},
	}
}
