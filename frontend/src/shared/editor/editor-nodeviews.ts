import {View, Region} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import Mention from '@tiptap/extension-mention'
import {mergeAttributes, type NodeViewRendererProps} from '@tiptap/core'
import type {Node as ProseMirrorNode} from '@tiptap/pm/model'
import {TaskLinkCore} from '@/components/input/editor/taskLinkCore'
import {BlockquoteWithCommentIdCore} from '@/components/input/editor/blockquoteWithCommentIdCore'
import {parseTaskIdFromUrl} from '@/helpers/parseTaskIdFromUrlCore'
import {getTaskIdentifier} from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'
import type {ITaskComment} from '@/modelTypes/ITaskComment'
import {getDisplayName} from '@/models/user'
import {EditorAvatarView} from './editor-avatar'
import {getTopLayerContainer} from '@/helpers/getTopLayerContainer'
import {TaskGlanceView} from '../task-list/list-task-row'
import type {ListContext} from '../task-list/list-context'
import {listIcon} from '../task-list/list-ui'
import '../task-list/list-native.scss'
import type {EditorSuggestionContext} from './editor-suggestions'
export interface EditorNodeContext extends EditorSuggestionContext {
 frontendUrl?: string,
 fetchTask: (id: number) => Promise<ITask>
 projectTitle: (id: number) => string
 openTask: (task: ITask) => void
 observeTasks: (changed: () => void, identity: () => void) => () => void
 displayDate: ListContext['displayDate']
 comments?: {find: (id: number) => ITaskComment | undefined, observe: (changed: () => void) => () => void, jump: (id: number) => void}
 observeAvatar?: (username: string, changed: () => void) => () => void
}
const QuoteHeaderView = View.extend({
	initialize(options: {context: EditorNodeContext, id: number}) { void options },
	className: 'comment-quote__header', attributes: {contenteditable: 'false'}, regions: {avatar: '[data-quote-avatar]'},
	templateContext() { const parent = this.options.context.comments?.find(this.options.id); return {parent, context: this.options.context, id: this.options.id} },
	template: ({parent, context, id}: {parent?: ITaskComment, context: EditorNodeContext, id: number}) => parent ? html`<span data-quote-avatar style="display:contents"></span><span class="comment-quote__author">${getDisplayName(parent.author)}</span><button type="button" class="base-button base-button--type-button comment-quote__jump" title=${context.t('task.comment.jumpToOriginal')} aria-label=${context.t('task.comment.jumpToOriginal')} @click=${() => context.comments?.jump(id)}>${listIcon('angle-right')}</button>` : html`<span class="comment-quote__author comment-quote__author--missing">${context.t('task.comment.deletedComment')}</span>`,
	onRender() { const parent = this.options.context.comments?.find(this.options.id); if (parent) this.showChildView('avatar', new EditorAvatarView({user: parent.author, size: 20, context: this.options.context, imageClass: 'comment-quote__avatar'})) },
}).setDomApi(LitDomApi)
interface NodeOptions {props: NodeViewRendererProps, context: EditorNodeContext, kind: 'task' | 'mention' | 'quote'}
const EditorNodeView = View.extend({
	ui: {quoteHeader: '[data-quote-header]', link: 'a', content: '[data-content-dom]'},
	initialize(options: NodeOptions) { void options },
	tagName() { return this.options.kind === 'quote' ? 'blockquote' : 'span' },
	className() { return this.options.kind === 'task' ? 'task-link' : this.options.kind === 'mention' ? 'mention-user' : 'comment-quote' },
	createState() { return {node: this.options.props.node, task: undefined as ITask | undefined, failed: false, avatar: undefined as string | undefined, version: 0, avatarIdentity: undefined as string | undefined, stopAvatar: undefined as (() => void) | undefined, stop: undefined as (() => void) | undefined, glance: undefined as InstanceType<typeof Region> | undefined, host: undefined as HTMLElement | undefined, header: undefined as InstanceType<typeof Region> | undefined, quoteKey: undefined as string | undefined, timer: undefined as ReturnType<typeof setTimeout> | undefined} },
	templateContext() { return {content: this.content()} }, template: ({content}: {content: TemplateResult}) => content,
	content(): TemplateResult {
		const {node, task, failed, avatar} = this.getState(), {context: ctx, kind} = this.options
		if (kind === 'quote') return html`<div data-quote-header style="display:contents"></div><div class="comment-quote__body" style="white-space:pre-wrap" data-node-view-content data-content-dom></div>`
		if (kind === 'mention') return html`${avatar ? html`<img class="mention-user__avatar" src=${avatar} width="32" height="32" alt="">` : html`<span class="mention-user__avatar user-avatar-placeholder" aria-hidden="true"></span>`}<span class="mention__label">${node.attrs.label ?? node.attrs.id}</span>`
		const href = node.attrs.href as string
		if (parseTaskIdFromUrl(href, this.options.context.frontendUrl) === null) return html`${href}`
		if (!task) return failed ? html`<a href=${href} class="task-link-pill task-link-pill--fallback" target="_blank" rel="noopener noreferrer nofollow">${href}</a>` : html`<span class="task-link-pill task-link-pill--loading">${href}</span>`
		const project = task.projectId !== ctx.projectId() ? ctx.projectTitle(task.projectId) : ''
		return html`<span class="task-glance-tooltip-wrapper" @mouseenter=${() => this.showGlance()} @mouseleave=${() => this.hideGlance()}><a href=${href} class="task-link-pill task-link-pill--task ${task.done ? 'task-link-pill--done' : ''}" @focus=${() => this.showGlance()} @blur=${() => this.hideGlance()} @click=${(event: MouseEvent) => { if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (!this.options.props.editor.isEditable) ctx.openTask(task) }}>${project ? html`<span class="task-link-pill__project">${project} <span aria-hidden="true">›</span></span>` : nothing}<span class="task-link-pill__identifier">${getTaskIdentifier(task)}</span><span class="task-link-pill__title">${task.title}</span>${task.done ? html`${listIcon('check-double')}<span class="is-sr-only">${ctx.t('task.attributes.done')}</span>` : nothing}</a></span>`
	},
	load() {
		const state = this.getState(), version = ++state.version, {context, kind} = this.options
		if (kind === 'quote') return
		if (kind === 'mention') { if (state.avatarIdentity !== state.node.attrs.id) { state.stopAvatar?.(); state.avatarIdentity = state.node.attrs.id; state.stopAvatar = context.observeAvatar?.(state.node.attrs.id, () => this.load()) }; void context.avatar(state.node.attrs.id, 32).then(url => { if (!this.isDestroyed() && state.version === version) { state.avatar = url; this.render() } }).catch(() => {}); return }
		const id = parseTaskIdFromUrl(state.node.attrs.href, this.options.context.frontendUrl); if (id === null) return
		void context.fetchTask(id).then(task => { if (!this.isDestroyed() && state.version === version && !context.life.aborted) { state.task = task; state.failed = false; this.render() } }).catch(() => { if (!this.isDestroyed() && state.version === version && !state.task) { state.failed = true; this.render() } })
	},
	onRender() { if (this.options.kind === 'quote') { this.getState().header = new Region({el: this.getUI('quoteHeader')![0]}); this.quoteHeader() } },
	quoteHeader() { const state = this.getState(), id = Number(state.node.attrs.commentId), comments = this.options.context.comments; if (Number.isInteger(id) && id > 0) this.el.setAttribute('data-comment-id', String(id)); else this.el.removeAttribute('data-comment-id'); const parent = comments?.find(id), key = JSON.stringify([id, parent?.author.id, parent?.author.username, parent?.author.name]); this.el.classList.toggle('comment-quote--has-parent', Boolean(parent)); if (state.quoteKey === key) return; state.quoteKey = key; if (comments && Number.isInteger(id) && id > 0) state.header?.show(new QuoteHeaderView({id, context: this.options.context})); else state.header?.empty() },
	showGlance() { this.hideGlance(); this.getState().timer = setTimeout(() => { const state = this.getState(); if (this.isDestroyed() || !state.task) return; const trigger = this.getUI('link')![0] as HTMLElement; const host = document.createElement('div'); getTopLayerContainer(this.el).append(host); state.host = host; state.glance = new Region({el: host}); state.glance.show(new TaskGlanceView({context: this.options.context, task: state.task, id: `task-link-glance-${state.task.id}`, trigger})) }, 450) },
	hideGlance() { const state = this.getState(); clearTimeout(state.timer); state.glance?.destroy(); state.host?.remove(); state.glance = undefined; state.host = undefined },
	onBeforeDestroy() { this.getState().version++; this.getState().stop?.(); this.getState().stopAvatar?.(); this.getState().header?.destroy(); this.hideGlance() },
}).setDomApi(LitDomApi)
function renderer(kind: NodeOptions['kind'], context: EditorNodeContext) {
	return (props: NodeViewRendererProps) => {
		const host = document.createElement('span'), region = new Region({el: host}), view = new EditorNodeView({props, context, kind}); region.show(view)
		const state = view.getState()
  ;(view.el as HTMLElement).style.whiteSpace = 'normal'
		view.el.setAttribute('data-node-view-wrapper', '')
		if (kind === 'task') state.stop = context.observeTasks(() => view.load(), () => { state.version++; state.task = undefined; state.failed = false; view.hideGlance(); view.render() })
		if (kind === 'quote') state.stop = context.comments?.observe(() => view.quoteHeader())
		view.load()
		return {dom: view.el as HTMLElement, contentDOM: kind === 'quote' ? view.getUI('content')![0] as HTMLElement : undefined,
			update: (node: ProseMirrorNode) => { if (node.type !== state.node.type) return false; const changed = JSON.stringify(node.attrs) !== JSON.stringify(state.node.attrs); state.node = node; if (changed && kind !== 'quote') { view.render(); view.load() }; if (kind === 'quote' && changed) view.quoteHeader(); return true },
			selectNode: () => view.el.classList.add('task-link--selected'), deselectNode: () => view.el.classList.remove('task-link--selected'),
			ignoreMutation: (mutation: MutationRecord | {type: 'selection', target: Node}) => mutation.type !== 'selection' && (kind !== 'quote' || Boolean((mutation.target as Element).closest?.('[data-quote-header]'))),
			destroy: () => { region.destroy() },
		}
	}
}
export function nativeEditorNodes(context: EditorNodeContext, suggestion: object) {
	return {
		taskLink: TaskLinkCore.configure({frontendUrl: context.frontendUrl}).extend({addNodeView() { return renderer('task', context) }}),
		blockquote: BlockquoteWithCommentIdCore.extend({addNodeView() { return renderer('quote', context) }}),
		mention: Mention.configure({HTMLAttributes: {class: 'mention'}, suggestion}).extend({parseHTML() { return [{tag: 'mention-user'}] }, renderHTML({HTMLAttributes}) { return ['mention-user', mergeAttributes(HTMLAttributes)] }, addNodeView() { return renderer('mention', context) }}),
	}
}
