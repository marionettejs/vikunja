import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import type {IUser} from '@/modelTypes/IUser'
import type {NativeEditorOptions} from './editor'
export const EditorAvatarView = View.extend({
	initialize(options: {user: IUser, size: number, context: Pick<NativeEditorOptions['context'], 'avatar' | 'observeAvatar'>, imageClass?: string}) { void options },
	tagName: 'span', attributes: {style: 'display:contents'},
	createState() { return {version: 0, url: undefined as string | undefined, stop: undefined as (() => void) | undefined} },
	templateContext() { return {url: this.getState().url, size: this.options.size, css: this.options.imageClass ?? ''} },
	template: ({url, size, css}: {url?: string, size: number, css: string}) => url ? html`<img class=${css} src=${url} width=${size} height=${size} alt="">` : html`<span class=${`user-avatar-placeholder ${css}`} style=${`--user-avatar-size:${size}px`} aria-hidden="true"></span>`,
	onAttach() { this.getState().stop = this.options.context.observeAvatar?.(this.options.user.username, () => this.load()); this.load() },
	async load() { const version = ++this.getState().version; try { const url = await this.options.context.avatar(this.options.user.username, this.options.size); if (!this.isDestroyed() && version === this.getState().version) { this.getState().url = url; this.render() } } catch { /* Avatars are decorative. */ } },
	onBeforeDestroy() { this.getState().stop?.() },
}).setDomApi(LitDomApi)
