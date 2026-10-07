import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {t} from './i18n'
import {observeNotices, type Notice} from './notifications'
import './notice-view.scss'
interface Entry {notice: Notice, element: HTMLElement, count: number, duplicates: HTMLElement, timer: ReturnType<typeof setTimeout>}
export const NoticeView = View.extend({
	className: 'native-notices',
	attributes: {style: 'display:contents'},
	ui: {notices: '[data-notices]'},
	template: () => html`<div data-notices class="global-notification" role="status" aria-live="polite"></div>`,
	createState() {return {entries: [] as Entry[], stop: undefined as (() => void) | undefined, modal: undefined as HTMLDialogElement | undefined, place: () => this.place()}},
	onAttach() {this.getState().stop = observeNotices(notice => this.notice(notice))},
	notice(notice: Notice) {
		const state = this.getState(), duplicate = state.entries.find(entry => entry.notice.type === notice.type && entry.notice.message === notice.message)
		if (duplicate) {duplicate.duplicates.textContent = `×${++duplicate.count}`; duplicate.duplicates.hidden = false; return}
		const element = document.createElement('div')
		element.className = `vue-notification-template vue-notification ${notice.type} notification ${notice.type === 'error' ? 'is-danger' : 'is-success'}`
		element.setAttribute('role', 'alert')
		const title = document.createElement('div'); title.className = 'notification-title'; title.textContent = t(notice.type === 'success' ? 'error.success' : 'error.error')
		const content = document.createElement('div'); content.className = 'notification-content'; content.textContent = notice.message
		const duplicates = document.createElement('span'); duplicates.className = 'tw:text-xs tw:font-bold tw:ml-1'; duplicates.hidden = true; content.append(duplicates)
		element.append(title, content)
		// Vue's installed notification component expires after duration + 2 * speed.
		const entry: Entry = {notice, element, count: 1, duplicates, timer: setTimeout(() => this.remove(entry), 3600)}
		element.onclick = () => this.remove(entry)
		if (notice.undo) {
			const actions = document.createElement('div'); actions.className = 'mbs-2 tw:flex tw:justify-end tw:gap-2'
			const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'base-button base-button--type-button button is-small is-outlined has-no-shadow undo'; undo.style.setProperty('--button-white-space', 'break-spaces')
			const label = document.createElement('span'); label.textContent = t('task.undo'); undo.append(label)
			undo.onclick = event => {event.stopPropagation(); notice.undo?.(); this.remove(entry)}
			actions.append(undo); element.append(actions)
		}
		if (!state.entries.length) document.addEventListener('focusin', state.place)
		state.entries.push(entry); (this.getUI('notices')![0] as HTMLElement).append(element)
		if (state.entries.length > 2) this.remove(state.entries[0])
		this.place()
	},
	place() {
		const state = this.getState()
		if (this.isDestroyed() || !state.entries.length) return
		const target = document.activeElement?.closest<HTMLDialogElement>('dialog[open]') ?? [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)
		if (target === state.modal && this.getUI('notices')![0].parentElement === (target ?? this.el)) return
		state.modal?.removeEventListener('close', state.place); state.modal = target
		;(target ?? this.el).append(this.getUI('notices')![0])
		target?.addEventListener('close', state.place)
	},
	remove(entry: Entry) {
		const state = this.getState(), index = state.entries.indexOf(entry)
		if (index < 0) return
		clearTimeout(entry.timer); entry.element.onclick = null; entry.element.remove(); state.entries.splice(index, 1)
		if (!state.entries.length) this.restore()
	},
	restore() {
		const state = this.getState()
		document.removeEventListener('focusin', state.place); state.modal?.removeEventListener('close', state.place); state.modal = undefined
		this.el.append(this.getUI('notices')![0])
	},
	onBeforeDestroy() {
		this.getState().stop?.()
		for (const entry of [...this.getState().entries]) this.remove(entry)
		this.restore()
	},
}).setDomApi(LitDomApi)
