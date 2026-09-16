import type {Editor, Range} from '@tiptap/core'
import {html} from 'lit-html'
import {unsafeSVG} from 'lit-html/directives/unsafe-svg.js'
import {icon} from '@fortawesome/fontawesome-svg-core'
import {
	faCode,
	faFont,
	faHeader,
	faImage,
	faListCheck,
	faListOl,
	faListUl,
	faQuoteRight,
	faRulerHorizontal,
} from '@fortawesome/free-solid-svg-icons'

import {SuggestionListView} from '@/marionette/views/SuggestionListView'
import type {SuggestionListViewInstance} from '@/marionette/views/SuggestionListView'
import {getPopupContainer} from './popupContainer'
import {createSuggestionPopup, type SuggestionPopup} from './suggestionPopup'

const COMMAND_ICON_SVG: Record<string, string> = {
	'fa-code': icon(faCode).html[0],
	'fa-font': icon(faFont).html[0],
	'fa-header': icon(faHeader).html[0],
	'fa-image': icon(faImage).html[0],
	'fa-list-check': icon(faListCheck).html[0],
	'fa-list-ol': icon(faListOl).html[0],
	'fa-list-ul': icon(faListUl).html[0],
	'fa-quote-right': icon(faQuoteRight).html[0],
	'fa-ruler-horizontal': icon(faRulerHorizontal).html[0],
}

type TranslateFunction = (key: string) => string

interface CommandItem {
	title: string
	description: string
	icon: string
	command: (params: {editor: Editor, range: Range}) => void
}

interface SuggestionProps {
	editor: Editor
	clientRect?: () => DOMRect
	command: (item: CommandItem) => void
	items: CommandItem[]
	event?: KeyboardEvent
}

function commandEntries(items: CommandItem[]) {
	return items.map(item => ({
		key: item.title,
		content: html`
			${unsafeSVG(COMMAND_ICON_SVG[item.icon] ?? '')}
			<div class="description">
				<p>${item.title}</p>
				<p>${item.description}</p>
			</div>
		`,
	}))
}

export default function suggestionSetup(t: TranslateFunction) {
	return {
		items: ({query}: { query: string }) => {
			return [
				{
					title: t('input.editor.text'),
					description: t('input.editor.textTooltip'),
					icon: 'fa-font',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.setNode('paragraph', {level: 1})
							.run()
					},
				},
				{
					title: t('input.editor.heading1'),
					description: t('input.editor.heading1Tooltip'),
					icon: 'fa-header',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.setNode('heading', {level: 1})
							.run()
					},
				},
				{
					title: t('input.editor.heading2'),
					description: t('input.editor.heading2Tooltip'),
					icon: 'fa-header',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.setNode('heading', {level: 2})
							.run()
					},
				},
				{
					title: t('input.editor.heading3'),
					description: t('input.editor.heading3Tooltip'),
					icon: 'fa-header',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.setNode('heading', {level: 2})
							.run()
					},
				},
				{
					title: t('input.editor.bulletList'),
					description: t('input.editor.bulletListTooltip'),
					icon: 'fa-list-ul',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.toggleBulletList()
							.run()
					},
				},
				{
					title: t('input.editor.orderedList'),
					description: t('input.editor.orderedListTooltip'),
					icon: 'fa-list-ol',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.toggleOrderedList()
							.run()
					},
				},
				{
					title: t('input.editor.taskList'),
					description: t('input.editor.taskListTooltip'),
					icon: 'fa-list-check',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.toggleTaskList()
							.run()
					},
				},
				{
					title: t('input.editor.quote'),
					description: t('input.editor.quoteTooltip'),
					icon: 'fa-quote-right',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.toggleBlockquote()
							.run()
					},
				},
				{
					title: t('input.editor.code'),
					description: t('input.editor.codeTooltip'),
					icon: 'fa-code',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.toggleCodeBlock()
							.run()
					},
				},
				{
					title: t('input.editor.image'),
					description: t('input.editor.imageTooltip'),
					icon: 'fa-image',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.run()
						const uploadElement = document.getElementById('tiptap__image-upload')
						if (uploadElement) {
							uploadElement.click()
						}
					},
				},
				{
					title: t('input.editor.horizontalRule'),
					description: t('input.editor.horizontalRuleTooltip'),
					icon: 'fa-ruler-horizontal',
					command: ({editor, range}: {editor: Editor, range: Range}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.setHorizontalRule()
							.run()
					},
				},
			].filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()))
		},

		render: () => {
			let list: SuggestionListViewInstance | null = null
			let popup: SuggestionPopup | null = null
			let currentProps: SuggestionProps | null = null

			return {
				onStart: (props: SuggestionProps) => {
					currentProps = props

					list = new SuggestionListView({
						className: 'items editor-suggestion-popup',
						itemClassName: 'item',
						emptyLabel: 'No result',
						entries: commandEntries(props.items),
						onSelect: index => {
							const item = currentProps?.items[index]
							if (item) {
								currentProps!.command(item)
							}
						},
					})
					list.render()

					if (!props.clientRect) {
						return
					}

					popup = createSuggestionPopup(
						getPopupContainer(props.editor),
						list.el,
						props.clientRect,
						props.editor.view.dom,
					)
				},

				onUpdate(props: SuggestionProps) {
					currentProps = props
					list?.setEntries(commandEntries(props.items))
					popup?.reposition()
				},

				onKeyDown(props: {event?: KeyboardEvent}) {
					if (!props.event) {
						return false
					}

					if (props.event.key === 'Escape') {
						if (props.event.isComposing) {
							return false
						}

						if (popup) {
							popup.element.style.display = 'none'
						}

						return true
					}

					return list?.onKeyDown(props.event) ?? false
				},

				onExit() {
					popup?.destroy()
					popup = null
					list?.destroy()
					list = null
					currentProps = null
				},
			}
		},
	}
}
