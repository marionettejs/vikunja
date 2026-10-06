import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import type {Editor} from '@tiptap/core'
import {listIcon} from '../task-list/list-ui'
type Action = {key: string, icon?: string, command?: string, args?: unknown[], active?: string, attributes?: object, pressed?: boolean, heading?: number, special?: string, title?: string}
const groups: Action[][] = [
	[1, 2, 3].map(level => ({key: `heading${level}`, icon: 'header', heading: level, command: 'toggleHeading', args: [{level}], active: 'heading', attributes: {level}, pressed: true})),
	['bold', 'italic', 'underline', 'strike'].map(name => ({key: name === 'strike' ? 'strikethrough' : name, icon: name === 'strike' ? 'strikethrough' : name, command: 'toggle' + name[0].toUpperCase() + name.slice(1), active: name, pressed: true})),
	[{key: 'code', icon: 'code', command: 'toggleCodeBlock', active: 'codeBlock', pressed: true}, {key: 'quote', icon: 'quote-right', command: 'toggleBlockquote', active: 'blockquote', pressed: true}],
	['bulletList', 'orderedList', 'taskList'].map((name, i) => ({key: name, icon: ['list-ul', 'list-ol', 'list-check'][i], command: 'toggle' + name[0].toUpperCase() + name.slice(1), active: name, pressed: true})),
	[{key: 'image', icon: 'image', special: 'image'}],
	[{key: 'link', icon: 'link', active: 'link', special: 'link', title: 'set link'}, {key: 'text', icon: 'paragraph', command: 'setParagraph', active: 'paragraph', title: 'paragraph'}, {key: 'horizontalRule', icon: 'ruler-horizontal', command: 'setHorizontalRule'}],
	[{key: 'undo', icon: 'undo', command: 'undo'}, {key: 'redo', icon: 'redo', command: 'redo'}],
	[{key: 'table.title', icon: 'table', active: 'table', special: 'table'}],
]
const tableCommands = ['insert', 'addColumnBefore', 'addColumnAfter', 'deleteColumn', 'addRowBefore', 'addRowAfter', 'deleteRow', 'deleteTable', 'mergeCells', 'splitCell', 'toggleHeaderColumn', 'toggleHeaderRow', 'toggleHeaderCell', 'mergeOrSplit', 'fixTables']
export const EditorToolbarView = View.extend({
	ui: {active: '[data-active]', command: '[data-command]', buttons: 'button'},
	className: 'editor-toolbar', attributes() { return {role: 'toolbar', 'aria-label': this.options.t('input.editor.toolbarLabel')} },
	initialize(options: {editor: Editor, t: (key: string) => string, image: (event: Event) => void, link: (event: MouseEvent) => void, tip: (element: HTMLElement, text: string) => void, hideTip: () => void}) { void options },
	createState() { return {table: false} },
	events: {keydown: 'key', focusin: 'focus'},
	templateContext() { return {content: this.content()} }, template: ({content}: {content: TemplateResult}) => content,
	content(): TemplateResult {
		const {editor, t, tip, hideTip} = this.options
		return html`${groups.map((group, i) => html`<div class="editor-toolbar__segment">${group.map(action => html`<button type="button" class="base-button base-button--type-button editor-toolbar__button ${action.active && editor.isActive(action.active, action.attributes) ? 'is-active' : ''}" data-active=${action.active || nothing} data-heading=${action.heading ?? nothing} data-pressed=${action.pressed ? 'true' : nothing} aria-pressed=${action.pressed ? String(editor.isActive(action.active!, action.attributes)) : nothing} title=${action.title || nothing} @mouseenter=${(event: MouseEvent) => tip(event.currentTarget as HTMLElement, t(`input.editor.${action.key}`))} @mouseleave=${hideTip} @click=${(event: MouseEvent) => this.run(action, event)}><span class="icon">${listIcon(action.icon!)}${action.heading ? html`<span class="icon__lower-text" aria-hidden="true">${action.heading}</span>` : nothing}</span><span class="is-sr-only">${t(`input.editor.${action.key}`)}</span></button>`)}${i === 7 && this.getState().table ? html`<div class="editor-toolbar__table-buttons">${tableCommands.map(command => html`<button type="button" class="base-button base-button--type-button editor-toolbar__button" data-command=${command} ?disabled=${command !== 'insert' && !(editor.can() as unknown as Record<string, () => boolean>)[command]()} @click=${() => { const chain = editor.chain().focus(); if (command === 'insert') chain.insertTable({rows: 3, cols: 3, withHeaderRow: true}).run(); else (chain as unknown as Record<string, () => typeof chain>)[command]().run() }}>${t(`input.editor.table.${command}`)}</button>`)}</div>` : nothing}</div>`)} `
	},
	run(action: Action, event: MouseEvent) {
		this.options.hideTip()
		if (action.special === 'image') this.options.image(event)
		else if (action.special === 'link') this.options.link(event)
		else if (action.special === 'table') { this.getState().table = !this.getState().table; this.render() }
		else { const chain = this.options.editor.chain().focus(); (chain as unknown as Record<string, (...args: unknown[]) => typeof chain>)[action.command!](...(action.args || [])).run() }
	},
	onRender() { this.refresh(); this.roving(document.activeElement as HTMLElement) },
	refresh() {
		const editor = this.options.editor
		Array.from(this.getUI('active')! as ArrayLike<HTMLButtonElement>).forEach(button => { const active = editor.isActive(button.dataset.active!, button.dataset.heading ? {level: Number(button.dataset.heading)} : undefined); button.classList.toggle('is-active', active); if (button.dataset.pressed) button.setAttribute('aria-pressed', String(active)) })
		Array.from(this.getUI('command')! as ArrayLike<HTMLButtonElement>).forEach(button => { button.disabled = button.dataset.command !== 'insert' && !(editor.can() as unknown as Record<string, () => boolean>)[button.dataset.command!]() })
		this.roving(document.activeElement as HTMLElement)
	},
	buttons() { return Array.from(Array.from(this.getUI('buttons')! as ArrayLike<HTMLButtonElement>)).filter(button => !button.disabled) },
	roving(active: HTMLElement | null) { const buttons = this.buttons(), target = buttons.includes(active as HTMLButtonElement) ? active : buttons[0]; buttons.forEach(button => { button.tabIndex = button === target ? 0 : -1 }) },
	focus(event: FocusEvent) { if ((event.target as HTMLElement).tagName === 'BUTTON') this.roving(event.target as HTMLElement) },
	key(event: KeyboardEvent) { if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; const buttons = this.buttons(); if (!buttons.length) return; event.preventDefault(); const index = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement)); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + buttons.length + (event.key === 'ArrowRight' ? 1 : -1)) % buttons.length; this.roving(buttons[next]); buttons[next].focus() },
}).setDomApi(LitDomApi)
