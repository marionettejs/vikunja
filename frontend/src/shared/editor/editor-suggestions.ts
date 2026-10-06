import {View, Region} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing} from 'lit-html'
import {Extension, type Editor, type Range} from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import {PluginKey, type EditorState} from '@tiptap/pm/state'
import {commandItems} from '@/components/input/editor/commandItems'
import {loadEmojis, filterEmojis, type EmojiEntry} from '@/components/input/editor/emoji/emojiData'
import {createSuggestionPopup, type SuggestionPopup} from '@/components/input/editor/suggestionPopup'
import {getPopupContainer} from '@/components/input/editor/popupContainer'
import {listIcon} from '../task-list/list-ui'
import type {IUser} from '@/modelTypes/IUser'
import {getDisplayName} from '@/models/user'
export interface EditorSuggestionContext {
 t: (key: string, values?: Record<string, unknown> | number | unknown[]) => string
 users: (projectId: number, query: string, signal: AbortSignal) => Promise<IUser[]>
 avatar: (username: string, size: number) => Promise<string | undefined>
 projectId: () => number
 life: AbortSignal
}
type Kind = 'commands' | 'mentions' | 'emoji'
interface Item {command?: (params: {editor: Editor, range: Range}) => void, id?: string, label?: string, username?: string, title?: string, description?: string, icon?: string, shortcode?: string, emoji?: string, annotation?: string}
interface Props {editor: Editor, items: Item[], query?: string, clientRect?: (() => DOMRect | null) | null, command: (item: Item) => void}
const SuggestionListView = View.extend({
	ui: {choices: 'button'},
	initialize(options: {kind: Kind, context: EditorSuggestionContext, props: Props}) { void options },
	className() { return this.options.kind === 'commands' ? 'items' : this.options.kind === 'mentions' ? 'mention-items' : 'emoji-items' },
	createState() { return {index: 0, version: 0} },
	templateContext() { return {kind: this.options.kind, context: this.options.context, props: this.options.props, index: this.getState().index, choose: (index: number) => this.choose(index)} },
	template: ({kind, context, props, index, choose}: {kind: Kind, context: EditorSuggestionContext, props: Props, index: number, choose: (index: number) => void}) => html`${props.items.length ? props.items.map((item: Item, i: number) => html`<button type="button" class="${kind === 'commands' ? 'item' : kind === 'mentions' ? 'mention-item' : 'emoji-item'} ${i === index ? 'is-selected' : ''}" @click=${() => choose(i)}>${kind === 'commands' ? html`${listIcon(item.icon?.replace('fa-', '') ?? '')}<div class="description"><p>${item.title}</p><p>${item.description}</p></div>` : kind === 'mentions' ? html`<span data-avatar=${i} class="mention-avatar user-avatar-placeholder" style="--user-avatar-size:32px" aria-hidden="true"></span><div class="mention-info"><p class="mention-name">${item.label}</p>${item.label !== item.username ? html`<p class="mention-username">@${item.username}</p>` : nothing}</div>` : html`<span class="emoji-glyph">${item.emoji}</span><div class="emoji-info"><p class="emoji-shortcode">:${item.shortcode}:</p><p class="emoji-annotation">${item.annotation}</p></div>`}</button>`) : html`<div class="${kind === 'commands' ? 'item' : kind === 'mentions' ? 'mention-item no-results' : 'emoji-item no-results'}">${kind === 'commands' ? 'No result' : context.t(kind === 'mentions' ? 'task.mention.noUsersFound' : 'input.editor.emoji.empty')}</div>`}`,
	onRender() {
		const version = ++this.getState().version
		if (this.options.kind !== 'mentions') return
		this.options.props.items.forEach((item, index) => { void this.options.context.avatar(item.username!, 32).then(url => {
			if (!url || this.isDestroyed() || this.getState().version !== version) return
			const slot = this.el.querySelector(`[data-avatar="${index}"]`)
			if (!slot) return
			const img = document.createElement('img'); img.className = 'mention-avatar'; img.src = url; img.width = img.height = 32; img.alt = ''; slot.replaceWith(img)
		}).catch(() => {}) })
	},
	updateProps(props: Props) { this.options.props = props; this.getState().index = 0; this.render() },
	choose(index: number) { const item = this.options.props.items[index]; if (item) this.options.props.command(item) },
	key(event: KeyboardEvent) {
		if (event.isComposing) return false
		const state = this.getState(), length = this.options.props.items.length
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			state.index = length ? (state.index + length + (event.key === 'ArrowUp' ? -1 : 1)) % length : 0
			const buttons = Array.from(this.getUI('choices')! as ArrayLike<HTMLButtonElement>); buttons.forEach((button, i) => button.classList.toggle('is-selected', i === state.index)); if (this.options.kind === 'emoji') buttons[state.index]?.scrollIntoView({block: 'nearest'}); return true
		}
		if (event.key === 'Enter') { this.choose(state.index); return true }
		return false
	},
}).setDomApi(LitDomApi)
function renderer<T extends Item = Item>(kind: Kind, context: EditorSuggestionContext, closers: Set<() => void>) {
	return () => {
		let region: InstanceType<typeof Region> | undefined, view: InstanceType<typeof SuggestionListView> | undefined, popup: SuggestionPopup | undefined
		const close = () => { popup?.destroy(); region?.destroy(); popup = undefined; region = undefined; view = undefined }
		closers.add(close)
		const mount = (props: Props) => {
			close(); if (context.life.aborted) return
			const host = document.createElement('div'); host.className = 'native-editor-surface'; region = new Region({el: host}); view = new SuggestionListView({kind, context, props}); region.show(view)
			if (props.clientRect) popup = createSuggestionPopup(getPopupContainer(props.editor), host, props.clientRect, props.editor.view.dom)
		}
		return {
			onStart: (incoming: Omit<Props, 'command'> & {command: (item: T) => void}) => { const props: Props = {...incoming, command: item => incoming.command(item as T)}; if (kind !== 'emoji' || props.items.length || props.query) mount(props) },
			onUpdate: (incoming: Omit<Props, 'command'> & {command: (item: T) => void}) => { const props: Props = {...incoming, command: item => incoming.command(item as T)}; if (!view) { if (kind !== 'emoji' || props.items.length || props.query) mount(props); return }; view.updateProps(props); popup?.reposition() },
			onKeyDown: ({event}: {event: KeyboardEvent}) => { if (event.isComposing) return false; if (event.key === 'Escape') { if (popup) popup.element.style.display = 'none'; return true }; return view?.key(event) ?? false },
			onExit: close,
		}
	}
}
export function nativeEditorSuggestions(context: EditorSuggestionContext) {
	const closers = new Set<() => void>()
	let timer: ReturnType<typeof setTimeout> | undefined, pending: ((items: Item[]) => void) | undefined, request: AbortController | undefined
	const cancel = () => { clearTimeout(timer); pending?.([]); pending = undefined; request?.abort(); closers.forEach(close => close()) }
	context.life.addEventListener('abort', cancel, {once: true})
	const mentions = {
		char: '@',
		items: ({query}: {query: string}): Promise<Item[]> => {
			cancel(); if (!context.projectId() || context.life.aborted) return Promise.resolve([])
			return new Promise(resolve => { pending = resolve; timer = setTimeout(async () => {
				const controller = new AbortController(); request = controller
				try { const users = await context.users(context.projectId(), query, controller.signal); if (!controller.signal.aborted && !context.life.aborted) resolve(users.slice(0, query ? 10 : 5).map(user => ({id: user.username, label: getDisplayName(user), username: user.username}))) }
				catch { resolve([]) } finally { if (request === controller) { request = undefined; if (pending === resolve) pending = undefined } }
			}, 300) })
		},
		render: renderer('mentions', context, closers),
	}
	const emoji = {
		pluginKey: new PluginKey('emojiSuggestion'), char: ':', allowedPrefixes: [' ', '\t', '\n'], startOfLine: false,
		allow: ({state, range}: {state: EditorState, range: Range}) => /^[a-zA-Z0-9_]*$/.test(state.doc.textBetween(range.from, range.to, '\n', '\n').replace(/^:/, '')),
		items: async ({query}: {query: string}) => { if (!query) return []; try { return filterEmojis(await loadEmojis(), query) } catch { return [] } },
		command: ({editor, range, props}: {editor: Editor, range: Range, props: EmojiEntry}) => { editor.chain().focus().deleteRange(range).insertContent(props.emoji).run() },
		render: renderer<EmojiEntry>('emoji', context, closers),
	}
	const emojiExtension = Extension.create({name: 'emojiAutocomplete', addProseMirrorPlugins() { return [Suggestion({editor: this.editor, ...emoji})] }})
	return {cancel, commands: {suggestion: {char: '/', command: ({editor, range, props}: {editor: Editor, range: Range, props: {command: (params: {editor: Editor, range: Range}) => void}}) => props.command({editor, range}), items: commandItems(context.t), render: renderer<Item & {command: (params: {editor: Editor, range: Range}) => void}>('commands', context, closers)}}, mentions, emoji: emojiExtension}
}
