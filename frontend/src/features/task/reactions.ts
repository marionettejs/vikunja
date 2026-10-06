import {View, Region} from 'marionette'
import {getTopLayerContainer} from '@/helpers/getTopLayerContainer'
import {AvatarTooltipView} from './task-membership-user'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {klona} from 'klona'
import 'emoji-picker-element'
import type {IUser} from '@/modelTypes/IUser'
import type {IReactionPerEntity} from '@/modelTypes/IReaction'
import {getDisplayName} from '@/models/user'
import {listIcon} from '../../shared/task-list/list-ui'
import type {NativeEditorOptions} from '../../shared/editor/editor'
import './reactions.scss'

export interface ReactionsOptions {
	className?: string
	user: () => IUser
	canWrite: () => boolean
	reactions: () => IReactionPerEntity
	transport: (value: string, remove: boolean, signal: AbortSignal) => Promise<unknown>
	accepted: (reactions: IReactionPerEntity) => void
	t: NativeEditorOptions['context']['t']
	reportError: (error: unknown) => void
	tip?: (trigger: HTMLElement, text: string) => void
	hideTip?: () => void
}

export const ReactionsView = View.extend({
	initialize(options: ReactionsOptions) { void options },
	className() { return this.options.className ?? 'reactions mbs-2 d-print-none' },
	createState() { return {life: new AbortController(), request: undefined as AbortController | undefined, picker: false, tip: undefined as InstanceType<typeof Region> | undefined, tipHost: undefined as HTMLElement | undefined, tipTimer: undefined as ReturnType<typeof setTimeout> | undefined} },
	templateContext() { return {content: this.content()} },
	template: ({content}: {content: TemplateResult}) => content,
	content() {
		const {t, user, canWrite, reactions} = this.options, state = this.getState()
		return html`${Object.entries(reactions() ?? {}).map(([value, users]) => {
			const title = users.length === 1 ? t('reaction.reactedWith', {user: getDisplayName(users[0]), value}) : users.length < 10 ? t('reaction.reactedWithAnd', {users: users.slice(0, -1).map(getDisplayName).join(', '), lastUser: getDisplayName(users[users.length - 1]), value}) : t('reaction.reactedWithAndMany', {users: users.slice(0, 10).map(getDisplayName).join(', '), num: users.length - 10, value})
			return html`<button type="button" class="base-button base-button--type-button reaction-button ${users.some(u => u.id === user().id) ? 'current-user-has-reacted' : ''}" ?disabled=${!canWrite() || Boolean(state.request)} @mouseenter=${(event: MouseEvent) => this.tip(event.currentTarget as HTMLElement, title)} @mouseleave=${() => this.hideTip()} @click=${() => { this.hideTip(); void this.toggle(value) }}>${value} ${users.length}</button>`
		})}${canWrite() ? html`<button type="button" data-add-reaction class="base-button base-button--type-button reaction-button" ?disabled=${Boolean(state.request)} @mouseenter=${(event: MouseEvent) => this.tip(event.currentTarget as HTMLElement, t('reaction.add'))} @mouseleave=${() => this.hideTip()} @click=${(event: MouseEvent) => { event.stopPropagation(); this.hideTip(); state.picker = !state.picker; this.render() }}><span class="is-sr-only">${t('reaction.add')}</span>${listIcon('face-laugh', true)}</button>` : nothing}${state.picker && canWrite() ? html`<emoji-picker class="emoji-picker ${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}" data-source="/emojis.json" @emoji-click=${(event: CustomEvent<{unicode: string}>) => void this.toggle(event.detail.unicode)}></emoji-picker>` : nothing}`
	},
	tip(trigger: HTMLElement, text: string) {
		if (this.options.tip) {this.options.tip(trigger, text); return}
		this.hideTip(); const state = this.getState()
		state.tipTimer = setTimeout(() => {if (this.isDestroyed() || !trigger.isConnected) return; const host = document.createElement('div'); getTopLayerContainer(this.el).append(host); state.tipHost = host; state.tip = new Region({el: host}); state.tip.show(new AvatarTooltipView({trigger, text}))}, 200)
	},
	hideTip() {const state = this.getState(); clearTimeout(state.tipTimer); state.tip?.destroy(); state.tipHost?.remove(); state.tip = undefined; state.tipHost = undefined; this.options.hideTip?.()},
	async toggle(value: string) {
		const state = this.getState(), options = this.options
		if (!options.canWrite() || state.request || state.life.signal.aborted) return
		const request = new AbortController(), user = options.user(), remove = (options.reactions()?.[value] ?? []).some(u => u.id === user.id)
		state.request = request
		const restoreFocus = this.el.contains(document.activeElement)
		this.render()
		try {
			await options.transport(value, remove, request.signal)
			request.signal.throwIfAborted()
			if (!options.canWrite()) return
			const reactions = klona(options.reactions() ?? {})
			reactions[value] = (reactions[value] ?? []).filter(u => u.id !== user.id)
			if (!remove) reactions[value].push(user)
			if (!reactions[value].length) delete reactions[value]
			options.accepted(reactions)
			state.picker = false
		} catch (error) { if (!request.signal.aborted) options.reportError(error) }
		finally {
			if (state.request === request) state.request = undefined
			if (!this.isDestroyed()) {
				this.render()
				if (restoreFocus && !state.picker && (document.activeElement === document.body || this.el.contains(document.activeElement))) this.el.querySelector<HTMLElement>('[data-add-reaction]')?.focus()
			}
		}
	},
	updateInputs() {
		if (!this.options.canWrite()) { this.getState().request?.abort(); this.getState().request = undefined; this.getState().picker = false }
		this.render()
	},
	outside(event: MouseEvent) { if (this.getState().picker && !event.composedPath().includes(this.el)) { this.getState().picker = false; this.render() } },
	onAttach() {
		const signal = this.getState().life.signal
		document.addEventListener('click', this.outside.bind(this), {signal})
		;(this.el as HTMLElement).addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !this.getState().picker) return
			event.preventDefault(); event.stopPropagation(); this.getState().picker = false; this.render(); this.el.querySelector<HTMLElement>('[data-add-reaction]')?.focus()
		}, {signal})
	},
	onBeforeDestroy() { this.getState().life.abort(); this.getState().request?.abort(); this.hideTip() },
}).setDomApi(LitDomApi)
