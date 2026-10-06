import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing} from 'lit-html'
import {KEYBOARD_SHORTCUTS} from './shortcut-data'
import {listIcon} from '@/shared/task-list/list-ui'
import {t} from './i18n'
import './shortcut-help.scss'
interface Options {routeName: string, close: () => void}
export const ShortcutHelpView = View.extend({
	initialize(options: Options) {void options}, tagName: 'dialog',
	className: 'modal-dialog default native-shortcuts native-settings native-list-surface',
	ui: {close: '[data-close]',container: '.modal-container'},
	events: {'click @ui.close': 'close', cancel: 'close', mousedown: 'backdrop'},
	createState() {return {overflow: document.body.style.overflow}},
	templateContext() {return this.options},
	template({routeName}: Options) {
		return html`<div class="modal-container"><button data-close class="base-button base-button--type-button close" aria-label=${t('misc.closeDialog')}>${listIcon('times')}</button><div class="modal-content"><div class="card has-no-shadow has-background-white keyboard-shortcuts"><header class="card-header"><p class="card-header-title">${t('keyboardShortcuts.title')}</p><button data-close class="base-button base-button--type-button card-header-icon close" aria-label=${t('misc.close')}>${listIcon('times')}</button></header><div class="card-content loader-container"><div class="content">${KEYBOARD_SHORTCUTS.map(group => html`<h3>${t(group.title)}</h3>${group.available ? html`<div class="message-wrapper mbe-4"><div class="message info">${t(group.available({name:routeName}) ? 'keyboardShortcuts.currentPageOnly' : 'keyboardShortcuts.somePagesOnly')}</div></div>` : nothing}<dl class="shortcut-list">${group.shortcuts.map(shortcut => html`<dt class="shortcut-title">${t(shortcut.title)}</dt><dd class="shortcuts shortcut-keys">${shortcut.keys.map((key,index) => html`${index ? html`<span>${shortcut.combination ? t('keyboardShortcuts.' + shortcut.combination) : '+'}</span>` : nothing}<kbd>${key}</kbd>`)}</dd>`)}</dl>`)}</div></div></div></div></div>`
	},
	onAttach() {document.body.style.overflow = 'hidden'; (this.el as HTMLDialogElement).showModal()},
	close(event: Event) {event.preventDefault();this.options.close()},
	backdrop(event: MouseEvent) {if(event.target===this.el || event.target===this.getUI('container')![0])this.close(event)},
	onBeforeDestroy() {(this.el as HTMLDialogElement).close();document.body.style.overflow=this.getState().overflow},
}).setDomApi(LitDomApi)
