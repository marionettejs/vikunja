import {View, Region, type RegionInstance} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {computePosition, flip, offset, shift, arrow} from '@floating-ui/dom'
import type {IUser} from '@/modelTypes/IUser'
import {getDisplayName, fetchAvatarBlobUrl} from '@/models/user'
import {getTopLayerContainer} from '@/helpers/getTopLayerContainer'

export const AvatarTooltipView = View.extend({
	ui: {arrow: '.v-popper__arrow-container'},
	className: 'v-popper__popper v-popper--theme-tooltip v-popper__popper--shown',
	attributes: {role: 'tooltip', style: 'position:absolute'},
	initialize(options: {text: string, trigger: HTMLElement}) { void options },
	templateContext() { return {text: this.options.text} },
	template: ({text}: {text: string}) => html`<div class="v-popper__wrapper"><div class="v-popper__inner"><div>${text}</div></div><div class="v-popper__arrow-container"><div class="v-popper__arrow-outer"></div><div class="v-popper__arrow-inner"></div></div></div>`,
	async onAttach() {
		const tip = this.el as HTMLElement, arrowEl = this.getUI('arrow')![0] as HTMLElement
		const position = await computePosition(this.options.trigger, tip, {placement: 'top', middleware: [offset(5), flip(), shift(), arrow({element: arrowEl})]})
		if (this.isDestroyed()) return
		tip.dataset.popperPlacement = position.placement
		const ratio = window.devicePixelRatio || 1
		Object.assign(tip.style, {left: '0px', top: '0px', transform: `translate3d(${Math.round(position.x * ratio) / ratio}px, ${Math.round(position.y * ratio) / ratio}px, 0)`})
		Object.assign(arrowEl.style, {left: position.middlewareData.arrow?.x == null ? '' : `${position.middlewareData.arrow.x}px`, top: position.middlewareData.arrow?.y == null ? '' : `${position.middlewareData.arrow.y}px`})
	},
}).setDomApi(LitDomApi)

export interface MembershipUserOptions {user: IUser, size: number, t: (key: string) => string, observeAvatar: (username: string, changed: () => void) => () => void}
export const TaskMembershipUserView = View.extend({
	className: 'user',
	initialize(options: MembershipUserOptions) { void options },
	createState() { return {url: undefined as string | undefined, version: 0, stopAvatar: undefined as (() => void) | undefined, tooltip: undefined as RegionInstance | undefined, host: undefined as HTMLElement | undefined, timer: undefined as ReturnType<typeof setTimeout> | undefined} },
	attributes() { return {style: `--avatar-size:${this.options.size}px`} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const {user, size, t} = this.options, name = getDisplayName(user), url = this.getState().url
		return html`<span class="avatar-wrapper">${url ? html`<img @mouseenter=${(event: Event) => this.showTip(event.currentTarget as HTMLElement, name)} @mouseleave=${() => this.hideTip()} @click=${() => this.hideTip()} class="avatar" src=${url} alt="" width=${size} height=${size}>` : html`<span @mouseenter=${(event: Event) => this.showTip(event.currentTarget as HTMLElement, name)} @mouseleave=${() => this.hideTip()} @click=${() => this.hideTip()} class="avatar user-avatar-placeholder" style=${`--user-avatar-size:${size}px`} aria-hidden="true"></span>`}${(user.botOwnerId ?? 0) > 0 ? html`<span class="bot-badge" aria-label="Bot" @mouseenter=${(event: Event) => this.showTip(event.currentTarget as HTMLElement, t('user.settings.bots.badge'))} @mouseleave=${() => this.hideTip()}>B</span>` : nothing}</span><span class="username">${name}</span>`
	},
	onAttach() { this.getState().stopAvatar = this.options.observeAvatar(this.options.user.username, () => this.loadAvatar()); this.loadAvatar() },
	loadAvatar() { const version = ++this.getState().version; void fetchAvatarBlobUrl(this.options.user, this.options.size).then(url => { if (!this.isDestroyed() && this.getState().version === version) { this.getState().url = url; this.render() } }).catch(() => {}) },
	showTip(trigger: HTMLElement, text: string) { this.hideTip(); this.getState().timer = setTimeout(() => { if (this.isDestroyed()) return; const host = document.createElement('div'); getTopLayerContainer(this.el).append(host); this.getState().host = host; const tooltip = new Region({el: host}); this.getState().tooltip = tooltip; tooltip.show(new AvatarTooltipView({trigger, text})) }, 200) },
	hideTip() { clearTimeout(this.getState().timer); this.getState().tooltip?.destroy(); this.getState().host?.remove(); this.getState().tooltip = undefined; this.getState().host = undefined },
	onBeforeDestroy() { this.getState().version++; this.getState().stopAvatar?.(); this.hideTip() },
}).setDomApi(LitDomApi)
