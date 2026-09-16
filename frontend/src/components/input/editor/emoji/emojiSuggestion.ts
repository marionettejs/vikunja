import type {Editor, Range} from '@tiptap/core'
import {PluginKey, type EditorState} from '@tiptap/pm/state'
import {html} from 'lit-html'

import {loadEmojis, filterEmojis, type EmojiEntry} from './emojiData'
import {SuggestionListView} from '@/marionette/views/SuggestionListView'
import type {SuggestionListViewInstance} from '@/marionette/views/SuggestionListView'
import {getPopupContainer} from '../popupContainer'
import {createSuggestionPopup, type SuggestionPopup} from '../suggestionPopup'

export const EmojiSuggestionPluginKey = new PluginKey('emojiSuggestion')

type TranslateFunction = (key: string) => string

interface SuggestionProps {
	editor: Editor
	range: Range
	query: string
	clientRect?: (() => DOMRect | null) | null
	items: EmojiEntry[]
	command: (item: EmojiEntry) => void
	event?: KeyboardEvent
}

const SHORTCODE_RE = /^[a-zA-Z0-9_]*$/

function emojiEntries(items: EmojiEntry[]) {
	return items.map(item => ({
		key: item.shortcode,
		content: html`
			<span class="emoji-glyph">${item.emoji}</span>
			<div class="emoji-info">
				<p class="emoji-shortcode">:${item.shortcode}:</p>
				<p class="emoji-annotation">${item.annotation}</p>
			</div>
		`,
	}))
}

export default function emojiSuggestionSetup(t: TranslateFunction) {
	return {
		pluginKey: EmojiSuggestionPluginKey,
		char: ':',
		allowedPrefixes: [' ', '\t', '\n'],
		startOfLine: false,

		allow: ({state, range}: {state: EditorState, range: Range}) => {
			const text = state.doc.textBetween(range.from, range.to, '\n', '\n')
			// Drop the leading ':' trigger character.
			const query = text.startsWith(':') ? text.slice(1) : text
			return SHORTCODE_RE.test(query)
		},

		items: async ({query}: {query: string}): Promise<EmojiEntry[]> => {
			if (query === '') return []
			try {
				const index = await loadEmojis()
				return filterEmojis(index, query)
			} catch (err) {
				console.error('Failed to load emoji index:', err)
				return []
			}
		},

		command: ({editor, range, props}: {editor: Editor, range: Range, props: EmojiEntry}) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent(props.emoji)
				.run()
		},

		render: () => {
			let list: SuggestionListViewInstance | null = null
			let popup: SuggestionPopup | null = null
			let currentProps: SuggestionProps | null = null

			const unmount = () => {
				popup?.destroy()
				popup = null
				list?.destroy()
				list = null
			}

			const mount = (props: SuggestionProps) => {
				unmount()

				list = new SuggestionListView({
					className: 'emoji-items editor-suggestion-popup',
					itemClassName: 'emoji-item',
					emptyLabel: t('input.editor.emoji.empty'),
					entries: emojiEntries(props.items),
					acceptKeys: ['Enter', 'Tab'],
					scrollSelectedIntoView: true,
					onSelect: index => {
						const item = currentProps?.items[index]
						if (item) {
							currentProps!.command(item)
						}
					},
				})
				list.render()

				if (!props.clientRect) {
					unmount()
					return
				}

				popup = createSuggestionPopup(
					getPopupContainer(props.editor),
					list.el,
					props.clientRect,
					props.editor.view.dom,
				)
			}

			return {
				onStart: (props: SuggestionProps) => {
					currentProps = props
					if (!props.items.length && props.query === '') return
					mount(props)
				},

				onUpdate(props: SuggestionProps) {
					currentProps = props
					if (!popup) {
						if (props.items.length || props.query !== '') mount(props)
						return
					}
					list?.setEntries(emojiEntries(props.items))
					popup.reposition()
				},

				onKeyDown(props: {event: KeyboardEvent}) {
					if (props.event.key === 'Escape') {
						if (props.event.isComposing) return false
						if (popup) popup.element.style.display = 'none'
						return true
					}
					return list?.onKeyDown(props.event) ?? false
				},

				onExit() {
					unmount()
					currentProps = null
				},
			}
		},
	}
}
