import {html, nothing} from 'lit-html'
import {unsafeSVG} from 'lit-html/directives/unsafe-svg.js'
import {icon} from '@fortawesome/fontawesome-svg-core'
import {
	faBold,
	faCode,
	faHeader,
	faImage,
	faItalic,
	faLink,
	faListCheck,
	faListOl,
	faListUl,
	faParagraph,
	faQuoteRight,
	faRedo,
	faRulerHorizontal,
	faStrikethrough,
	faTable,
	faUnderline,
	faUndo,
} from '@fortawesome/free-solid-svg-icons'
import type {Editor} from '@tiptap/core'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

const svgBold = icon(faBold).html[0]
const svgCode = icon(faCode).html[0]
const svgHeader = icon(faHeader).html[0]
const svgImage = icon(faImage).html[0]
const svgItalic = icon(faItalic).html[0]
const svgLink = icon(faLink).html[0]
const svgListCheck = icon(faListCheck).html[0]
const svgListOl = icon(faListOl).html[0]
const svgListUl = icon(faListUl).html[0]
const svgParagraph = icon(faParagraph).html[0]
const svgQuote = icon(faQuoteRight).html[0]
const svgRedo = icon(faRedo).html[0]
const svgRulerHorizontal = icon(faRulerHorizontal).html[0]
const svgStrikethrough = icon(faStrikethrough).html[0]
const svgTable = icon(faTable).html[0]
const svgUnderline = icon(faUnderline).html[0]
const svgUndo = icon(faUndo).html[0]

interface TableLabels {
	title: string
	insert: string
	addColumnBefore: string
	addColumnAfter: string
	deleteColumn: string
	addRowBefore: string
	addRowAfter: string
	deleteRow: string
	deleteTable: string
	mergeCells: string
	splitCell: string
	toggleHeaderColumn: string
	toggleHeaderRow: string
	toggleHeaderCell: string
	mergeOrSplit: string
	fixTables: string
}

export interface EditorToolbarViewOptions {
	getEditor: () => Editor | undefined
	labels: {
		toolbarLabel: string
		heading1: string
		heading2: string
		heading3: string
		bold: string
		italic: string
		underline: string
		strikethrough: string
		code: string
		quote: string
		bulletList: string
		orderedList: string
		taskList: string
		image: string
		link: string
		text: string
		horizontalRule: string
		undo: string
		redo: string
		table: TableLabels
	}
	onImageUpload: (rect: DOMRect) => void
	onLink: (rect: DOMRect) => void
}

export interface EditorToolbarViewInstance extends ViewInstance {
	refresh(): void
}

interface TemplateData {
	tableControlsId: string
	editor: Editor | undefined
	labels: EditorToolbarViewOptions['labels']
	isHeading1Active: boolean
	isHeading2Active: boolean
	isHeading3Active: boolean
	isBoldActive: boolean
	isItalicActive: boolean
	isUnderlineActive: boolean
	isStrikeActive: boolean
	isCodeActive: boolean
	isBlockquoteActive: boolean
	isBulletListActive: boolean
	isOrderedListActive: boolean
	isTaskListActive: boolean
	isLinkActive: boolean
	isParagraphActive: boolean
	isTaskLinkActive: boolean
	isTableActive: boolean
	canAddColumnBefore: boolean
	canAddColumnAfter: boolean
	canDeleteColumn: boolean
	canAddRowBefore: boolean
	canAddRowAfter: boolean
	canDeleteRow: boolean
	canDeleteTable: boolean
	canMergeCells: boolean
	canSplitCell: boolean
	canToggleHeaderColumn: boolean
	canToggleHeaderRow: boolean
	canToggleHeaderCell: boolean
	canMergeOrSplit: boolean
	canFixTables: boolean
	tableMode: boolean
}

export const EditorToolbarView = View.extend({
	className: 'mn-editor-toolbar-host',

	_observer: null as MutationObserver | null,
	_tableMode: false,

	events: {
		click: 'onClick',
		focusin: 'onToolbarFocusin',
		keydown: 'onToolbarKeydown',
	},

	templateContext(): TemplateData {
		const opts = this.options as EditorToolbarViewOptions
		const editor = opts.getEditor()

		return {
			labels: opts.labels,
			tableControlsId: `${this.cid}-table-controls`,
			editor,
			isHeading1Active: Boolean(editor?.isActive('heading', {level: 1})),
			isHeading2Active: Boolean(editor?.isActive('heading', {level: 2})),
			isHeading3Active: Boolean(editor?.isActive('heading', {level: 3})),
			isBoldActive: Boolean(editor?.isActive('bold')),
			isItalicActive: Boolean(editor?.isActive('italic')),
			isUnderlineActive: Boolean(editor?.isActive('underline')),
			isStrikeActive: Boolean(editor?.isActive('strike')),
			isCodeActive: Boolean(editor?.isActive('codeBlock')),
			isBlockquoteActive: Boolean(editor?.isActive('blockquote')),
			isBulletListActive: Boolean(editor?.isActive('bulletList')),
			isOrderedListActive: Boolean(editor?.isActive('orderedList')),
			isTaskListActive: Boolean(editor?.isActive('taskList')),
			isLinkActive: Boolean(editor?.isActive('link')),
			isParagraphActive: Boolean(editor?.isActive('paragraph')),
			isTaskLinkActive: Boolean(editor?.isActive('taskLink')),
			isTableActive: Boolean(editor?.isActive('table')),
			canAddColumnBefore: Boolean(editor?.can().addColumnBefore?.()),
			canAddColumnAfter: Boolean(editor?.can().addColumnAfter?.()),
			canDeleteColumn: Boolean(editor?.can().deleteColumn?.()),
			canAddRowBefore: Boolean(editor?.can().addRowBefore?.()),
			canAddRowAfter: Boolean(editor?.can().addRowAfter?.()),
			canDeleteRow: Boolean(editor?.can().deleteRow?.()),
			canDeleteTable: Boolean(editor?.can().deleteTable?.()),
			canMergeCells: Boolean(editor?.can().mergeCells?.()),
			canSplitCell: Boolean(editor?.can().splitCell?.()),
			canToggleHeaderColumn: Boolean(editor?.can().toggleHeaderColumn?.()),
			canToggleHeaderRow: Boolean(editor?.can().toggleHeaderRow?.()),
			canToggleHeaderCell: Boolean(editor?.can().toggleHeaderCell?.()),
			canMergeOrSplit: Boolean(editor?.can().mergeOrSplit?.()),
			canFixTables: Boolean(editor?.can().fixTables?.()),
			tableMode: this._tableMode,
		}
	},

	template(data: TemplateData) {
		const labels = data.labels

		const {
			isHeading1Active,
			isHeading2Active,
			isHeading3Active,
			isBoldActive,
			isItalicActive,
			isUnderlineActive,
			isStrikeActive,
			isCodeActive,
			isBlockquoteActive,
			isBulletListActive,
			isOrderedListActive,
			isTaskListActive,
			isLinkActive,
			isParagraphActive,
			isTaskLinkActive,
			isTableActive,
			canAddColumnBefore,
			canAddColumnAfter,
			canDeleteColumn,
			canAddRowBefore,
			canAddRowAfter,
			canDeleteRow,
			canDeleteTable,
			canMergeCells,
			canSplitCell,
			canToggleHeaderColumn,
			canToggleHeaderRow,
			canToggleHeaderCell,
			canMergeOrSplit,
			canFixTables,
			tableMode,
		} = data

		return html`
			<div
				class='mn-editor-toolbar'
				role='toolbar'
				aria-label='${labels.toolbarLabel}'
				tabindex='-1'
			>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isHeading1Active ? 'is-active' : ''}'
						data-command='heading1'
						aria-label='${labels.heading1}'
						aria-pressed='${isHeading1Active ? 'true' : 'false'}'
						title='${labels.heading1}'
					>
						<span class='icon'>${unsafeSVG(svgHeader)}<span class='icon__lower-text' aria-hidden='true'>1</span></span>
						<span class='is-sr-only'>${labels.heading1}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isHeading2Active ? 'is-active' : ''}'
						data-command='heading2'
						aria-label='${labels.heading2}'
						aria-pressed='${isHeading2Active ? 'true' : 'false'}'
						title='${labels.heading2}'
					>
						<span class='icon'>${unsafeSVG(svgHeader)}<span class='icon__lower-text' aria-hidden='true'>2</span></span>
						<span class='is-sr-only'>${labels.heading2}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isHeading3Active ? 'is-active' : ''}'
						data-command='heading3'
						aria-label='${labels.heading3}'
						aria-pressed='${isHeading3Active ? 'true' : 'false'}'
						title='${labels.heading3}'
					>
						<span class='icon'>${unsafeSVG(svgHeader)}<span class='icon__lower-text' aria-hidden='true'>3</span></span>
						<span class='is-sr-only'>${labels.heading3}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isBoldActive ? 'is-active' : ''}'
						data-command='bold'
						aria-label='${labels.bold}'
						aria-pressed='${isBoldActive ? 'true' : 'false'}'
						title='${labels.bold}'
					>
						<span class='icon'>${unsafeSVG(svgBold)}</span>
						<span class='is-sr-only'>${labels.bold}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isItalicActive ? 'is-active' : ''}'
						data-command='italic'
						aria-label='${labels.italic}'
						aria-pressed='${isItalicActive ? 'true' : 'false'}'
						title='${labels.italic}'
					>
						<span class='icon'>${unsafeSVG(svgItalic)}</span>
						<span class='is-sr-only'>${labels.italic}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isUnderlineActive ? 'is-active' : ''}'
						data-command='underline'
						aria-label='${labels.underline}'
						aria-pressed='${isUnderlineActive ? 'true' : 'false'}'
						title='${labels.underline}'
					>
						<span class='icon'>${unsafeSVG(svgUnderline)}</span>
						<span class='is-sr-only'>${labels.underline}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isStrikeActive ? 'is-active' : ''}'
						data-command='strikethrough'
						aria-label='${labels.strikethrough}'
						aria-pressed='${isStrikeActive ? 'true' : 'false'}'
						title='${labels.strikethrough}'
					>
						<span class='icon'>${unsafeSVG(svgStrikethrough)}</span>
						<span class='is-sr-only'>${labels.strikethrough}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isCodeActive ? 'is-active' : ''}'
						data-command='code'
						aria-label='${labels.code}'
						aria-pressed='${isCodeActive ? 'true' : 'false'}'
						title='${labels.code}'
					>
						<span class='icon'>${unsafeSVG(svgCode)}</span>
						<span class='is-sr-only'>${labels.code}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isBlockquoteActive ? 'is-active' : ''}'
						data-command='quote'
						aria-label='${labels.quote}'
						aria-pressed='${isBlockquoteActive ? 'true' : 'false'}'
						title='${labels.quote}'
					>
						<span class='icon'>${unsafeSVG(svgQuote)}</span>
						<span class='is-sr-only'>${labels.quote}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isBulletListActive ? 'is-active' : ''}'
						data-command='bulletList'
						aria-label='${labels.bulletList}'
						aria-pressed='${isBulletListActive ? 'true' : 'false'}'
						title='${labels.bulletList}'
					>
						<span class='icon'>${unsafeSVG(svgListUl)}</span>
						<span class='is-sr-only'>${labels.bulletList}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isOrderedListActive ? 'is-active' : ''}'
						data-command='orderedList'
						aria-label='${labels.orderedList}'
						aria-pressed='${isOrderedListActive ? 'true' : 'false'}'
						title='${labels.orderedList}'
					>
						<span class='icon'>${unsafeSVG(svgListOl)}</span>
						<span class='is-sr-only'>${labels.orderedList}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isTaskListActive ? 'is-active' : ''}'
						data-command='taskList'
						aria-label='${labels.taskList}'
						aria-pressed='${isTaskListActive ? 'true' : 'false'}'
						title='${labels.taskList}'
					>
						<span class='icon'>${unsafeSVG(svgListCheck)}</span>
						<span class='is-sr-only'>${labels.taskList}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button'
						data-command='image'
						aria-label='${labels.image}'
						title='${labels.image}'
					>
						<span class='icon'>${unsafeSVG(svgImage)}</span>
						<span class='is-sr-only'>${labels.image}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isLinkActive ? 'is-active' : ''}'
						data-command='link'
						aria-label='${labels.link}'
						aria-pressed='${isLinkActive ? 'true' : 'false'}'
						title='${labels.link}'
					>
						<span class='icon'>${unsafeSVG(svgLink)}</span>
						<span class='is-sr-only'>${labels.link}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isParagraphActive && !isTaskLinkActive ? 'is-active' : ''}'
						data-command='text'
						aria-label='${labels.text}'
						aria-pressed='${isParagraphActive && !isTaskLinkActive ? 'true' : 'false'}'
						title='${labels.text}'
					>
						<span class='icon'>${unsafeSVG(svgParagraph)}</span>
						<span class='is-sr-only'>${labels.text}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button'
						data-command='horizontalRule'
						aria-label='${labels.horizontalRule}'
						title='${labels.horizontalRule}'
					>
						<span class='icon'>${unsafeSVG(svgRulerHorizontal)}</span>
						<span class='is-sr-only'>${labels.horizontalRule}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button'
						data-command='undo'
						aria-label='${labels.undo}'
						title='${labels.undo}'
					>
						<span class='icon'>${unsafeSVG(svgUndo)}</span>
						<span class='is-sr-only'>${labels.undo}</span>
					</button>
					<button
						type='button'
						class='mn-editor-toolbar__button'
						data-command='redo'
						aria-label='${labels.redo}'
						title='${labels.redo}'
					>
						<span class='icon'>${unsafeSVG(svgRedo)}</span>
						<span class='is-sr-only'>${labels.redo}</span>
					</button>
				</div>
				<div class='mn-editor-toolbar__segment'>
					<button
						type='button'
						class='mn-editor-toolbar__button ${isTableActive ? 'is-active' : ''}'
						data-command='table'
						aria-label='${labels.table.title}'
						aria-expanded='${tableMode ? 'true' : 'false'}'
						aria-controls=${tableMode ? data.tableControlsId : nothing}
						title='${labels.table.title}'
					>
						<span class='icon'>${unsafeSVG(svgTable)}</span>
						<span class='is-sr-only'>${labels.table.title}</span>
					</button>
					${tableMode ? html`
						<div id=${data.tableControlsId} class='mn-editor-toolbar__table-buttons'>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								data-command='insertTable'
								title='${labels.table.insert}'
							>
								${labels.table.insert}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canAddColumnBefore}
								data-command='addColumnBefore'
								title='${labels.table.addColumnBefore}'
							>
								${labels.table.addColumnBefore}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canAddColumnAfter}
								data-command='addColumnAfter'
								title='${labels.table.addColumnAfter}'
							>
								${labels.table.addColumnAfter}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canDeleteColumn}
								data-command='deleteColumn'
								title='${labels.table.deleteColumn}'
							>
								${labels.table.deleteColumn}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canAddRowBefore}
								data-command='addRowBefore'
								title='${labels.table.addRowBefore}'
							>
								${labels.table.addRowBefore}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canAddRowAfter}
								data-command='addRowAfter'
								title='${labels.table.addRowAfter}'
							>
								${labels.table.addRowAfter}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canDeleteRow}
								data-command='deleteRow'
								title='${labels.table.deleteRow}'
							>
								${labels.table.deleteRow}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canDeleteTable}
								data-command='deleteTable'
								title='${labels.table.deleteTable}'
							>
								${labels.table.deleteTable}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canMergeCells}
								data-command='mergeCells'
								title='${labels.table.mergeCells}'
							>
								${labels.table.mergeCells}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canSplitCell}
								data-command='splitCell'
								title='${labels.table.splitCell}'
							>
								${labels.table.splitCell}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canToggleHeaderColumn}
								data-command='toggleHeaderColumn'
								title='${labels.table.toggleHeaderColumn}'
							>
								${labels.table.toggleHeaderColumn}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canToggleHeaderRow}
								data-command='toggleHeaderRow'
								title='${labels.table.toggleHeaderRow}'
							>
								${labels.table.toggleHeaderRow}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canToggleHeaderCell}
								data-command='toggleHeaderCell'
								title='${labels.table.toggleHeaderCell}'
							>
								${labels.table.toggleHeaderCell}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canMergeOrSplit}
								data-command='mergeOrSplit'
								title='${labels.table.mergeOrSplit}'
							>
								${labels.table.mergeOrSplit}
							</button>
							<button
								type='button'
								class='mn-editor-toolbar__button'
								?disabled=${!canFixTables}
								data-command='fixTables'
								title='${labels.table.fixTables}'
							>
								${labels.table.fixTables}
							</button>
						</div>
					` : nothing}
				</div>
			</div>
		`
	},

	onRender() {
		this.setRovingTabindex(document.activeElement as HTMLElement | null)

		if (!this._observer) {
			this._observer = new MutationObserver(() => this.setRovingTabindex(document.activeElement as HTMLElement | null))
		}
		this._observer.disconnect()
		this._observer.observe(this.el, {
			subtree: true,
			childList: true,
			attributeFilter: ['disabled'],
		})
	},

	onBeforeDestroy() {
		this._observer?.disconnect()
		this._observer = null
	},

	toolbarButtons(): HTMLButtonElement[] {
		return Array.from(this.el.querySelectorAll<HTMLButtonElement>('button')).filter((button) => !button.disabled)
	},

	setRovingTabindex(active: HTMLElement | null): void {
		const buttons = this.toolbarButtons()
		if (buttons.length === 0) {
			return
		}

		const target = active && buttons.includes(active as HTMLButtonElement) ? active : buttons[0]
		buttons.forEach((button) => {
			button.tabIndex = button === target ? 0 : -1
		})
	},

	onToolbarFocusin(event: FocusEvent): void {
		const target = event.target as HTMLElement
		if (target.tagName === 'BUTTON') {
			this.setRovingTabindex(target)
		}
	},

	onToolbarKeydown(event: KeyboardEvent): void {
		if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
			return
		}

		const buttons = this.toolbarButtons()
		if (buttons.length === 0) {
			return
		}

		event.preventDefault()

		const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
		const index = currentIndex === -1 ? 0 : currentIndex

		let next = index
		switch (event.key) {
			case 'ArrowRight':
				next = (index + 1) % buttons.length
				break
			case 'ArrowLeft':
				next = (index - 1 + buttons.length) % buttons.length
				break
			case 'Home':
				next = 0
				break
			case 'End':
				next = buttons.length - 1
				break
		}

		const nextButton = buttons[next]
		this.setRovingTabindex(nextButton)
		nextButton.focus()
	},

	onClick(event: MouseEvent) {
		const opts = this.options as EditorToolbarViewOptions
		const button = (event.target as Element | null)?.closest('[data-command]') as HTMLButtonElement | null
		if (!button) {
			return
		}

		const command = button.getAttribute('data-command')
		if (!command) {
			return
		}

		if (command === 'image') {
			opts.onImageUpload(button.getBoundingClientRect())
			return
		}

		const editor = opts.getEditor()
		if (!editor) {
			return
		}

		if (command === 'link') {
			opts.onLink(button.getBoundingClientRect())
			this.refresh()
			return
		}

		if (command === 'table') {
			this._tableMode = !this._tableMode
			this.render()
			return
		}

		switch (command) {
			case 'heading1':
				editor.chain().focus().toggleHeading({level: 1}).run()
				break
			case 'heading2':
				editor.chain().focus().toggleHeading({level: 2}).run()
				break
			case 'heading3':
				editor.chain().focus().toggleHeading({level: 3}).run()
				break
			case 'bold':
				editor.chain().focus().toggleBold().run()
				break
			case 'italic':
				editor.chain().focus().toggleItalic().run()
				break
			case 'underline':
				editor.chain().focus().toggleUnderline().run()
				break
			case 'strikethrough':
				editor.chain().focus().toggleStrike().run()
				break
			case 'code':
				editor.chain().focus().toggleCodeBlock().run()
				break
			case 'quote':
				editor.chain().focus().toggleBlockquote().run()
				break
			case 'bulletList':
				editor.chain().focus().toggleBulletList().run()
				break
			case 'orderedList':
				editor.chain().focus().toggleOrderedList().run()
				break
			case 'taskList':
				editor.chain().focus().toggleTaskList().run()
				break
			case 'text':
				editor.chain().focus().setParagraph().run()
				break
			case 'horizontalRule':
				editor.chain().focus().setHorizontalRule().run()
				break
			case 'undo':
				editor.chain().focus().undo().run()
				break
			case 'redo':
				editor.chain().focus().redo().run()
				break
			case 'insertTable':
				editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
				break
			case 'addColumnBefore':
				editor.chain().focus().addColumnBefore().run()
				break
			case 'addColumnAfter':
				editor.chain().focus().addColumnAfter().run()
				break
			case 'deleteColumn':
				editor.chain().focus().deleteColumn().run()
				break
			case 'addRowBefore':
				editor.chain().focus().addRowBefore().run()
				break
			case 'addRowAfter':
				editor.chain().focus().addRowAfter().run()
				break
			case 'deleteRow':
				editor.chain().focus().deleteRow().run()
				break
			case 'deleteTable':
				editor.chain().focus().deleteTable().run()
				break
			case 'mergeCells':
				editor.chain().focus().mergeCells().run()
				break
			case 'splitCell':
				editor.chain().focus().splitCell().run()
				break
			case 'toggleHeaderColumn':
				editor.chain().focus().toggleHeaderColumn().run()
				break
			case 'toggleHeaderRow':
				editor.chain().focus().toggleHeaderRow().run()
				break
			case 'toggleHeaderCell':
				editor.chain().focus().toggleHeaderCell().run()
				break
			case 'mergeOrSplit':
				editor.chain().focus().mergeOrSplit().run()
				break
			case 'fixTables':
				editor.chain().focus().fixTables().run()
				break
		}

		this.refresh()
	},

	refresh(): void {
		this.render()
	},
}) as new (options: EditorToolbarViewOptions) => EditorToolbarViewInstance
