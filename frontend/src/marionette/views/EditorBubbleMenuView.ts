import {html, nothing} from 'lit-html'
import {unsafeSVG} from 'lit-html/directives/unsafe-svg.js'
import {icon} from '@fortawesome/fontawesome-svg-core'
import {
	faBold,
	faCode,
	faItalic,
	faLink,
	faStrikethrough,
	faUnderline,
} from '@fortawesome/free-solid-svg-icons'
import type {Editor} from '@tiptap/core'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

const svgBold = icon(faBold).html[0]
const svgItalic = icon(faItalic).html[0]
const svgUnderline = icon(faUnderline).html[0]
const svgStrikethrough = icon(faStrikethrough).html[0]
const svgCode = icon(faCode).html[0]
const svgLink = icon(faLink).html[0]

export interface EditorBubbleMenuViewOptions {
	getEditor: () => Editor | undefined
	labels: {
		bold: string
		italic: string
		underline: string
		strikethrough: string
		code: string
		link: string
	}
	onLink: (rect: DOMRect) => void
}

export interface EditorBubbleMenuViewInstance extends ViewInstance {
	refresh(): void
}

interface ButtonItem {
	command: string
	label: string
	icon: string
	isMark: boolean
	isActive: boolean
}

interface TemplateData {
	buttons: ButtonItem[]
}

export const EditorBubbleMenuView = View.extend({
	className: 'editor-bubble',

	events: {
		'click': 'onClick',
	},

	template(data: TemplateData) {
		return html`
			<div class='editor-bubble__wrapper'>
				${data.buttons.map(btn => {
			const classNames = ['editor-bubble__button']
			if (btn.isActive) {
				classNames.push('is-active')
			}
			return html`<button
						type='button'
						class='${classNames.join(' ')}'
						data-command='${btn.command}'
						aria-label='${btn.label}'
						aria-pressed='${btn.isMark ? (btn.isActive ? 'true' : 'false') : nothing}'
					><span class='icon'>${unsafeSVG(btn.icon)}</span></button>`
		})}
			</div>
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as EditorBubbleMenuViewOptions
		const editor = opts.getEditor()

		const buttons: ButtonItem[] = [
			{
				command: 'bold',
				label: opts.labels.bold,
				icon: svgBold,
				isMark: true,
				isActive: Boolean(editor?.isActive('bold')),
			},
			{
				command: 'italic',
				label: opts.labels.italic,
				icon: svgItalic,
				isMark: true,
				isActive: Boolean(editor?.isActive('italic')),
			},
			{
				command: 'underline',
				label: opts.labels.underline,
				icon: svgUnderline,
				isMark: true,
				isActive: Boolean(editor?.isActive('underline')),
			},
			{
				command: 'strike',
				label: opts.labels.strikethrough,
				icon: svgStrikethrough,
				isMark: true,
				isActive: Boolean(editor?.isActive('strike')),
			},
			{
				command: 'code',
				label: opts.labels.code,
				icon: svgCode,
				isMark: true,
				isActive: Boolean(editor?.isActive('code')),
			},
			{
				command: 'link',
				label: opts.labels.link,
				icon: svgLink,
				isMark: false,
				isActive: Boolean(editor?.isActive('link')),
			},
		]

		return {
			buttons,
		}
	},

	onClick(event: MouseEvent) {
		const opts = this.options as EditorBubbleMenuViewOptions
		const button = (event.target as Element | null)?.closest('[data-command]') as HTMLElement | null
		if (!button) {
			return
		}

		const command = button.getAttribute('data-command')
		if (!command) {
			return
		}

		if (command === 'link') {
			opts.onLink(button.getBoundingClientRect())
			return
		}

		const editor = opts.getEditor()
		if (!editor) {
			return
		}

		switch (command) {
			case 'bold':
				editor.chain().focus().toggleBold().run()
				break
			case 'italic':
				editor.chain().focus().toggleItalic().run()
				break
			case 'underline':
				editor.chain().focus().toggleUnderline().run()
				break
			case 'strike':
				editor.chain().focus().toggleStrike().run()
				break
			case 'code':
				editor.chain().focus().toggleCode().run()
				break
		}

		this.refresh()
	},

	refresh(): void {
		this.render()
	},
}) as new (options: EditorBubbleMenuViewOptions) => EditorBubbleMenuViewInstance
