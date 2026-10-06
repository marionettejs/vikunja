import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import logo from '@/assets/logo.svg?url'
import {t} from '../shared/i18n'
import './bootstrap.scss'

export const BootstrapLoadingView = View.extend({
	tagName: 'section',
	className: 'vikunja-loading',
	attributes: {role: 'status', 'aria-live': 'polite'},
	template: () => html`<img class="logo" width="100" height="100" src=${logo} alt=""><p><span class="loader-container is-loading-small is-loading" aria-hidden="true"></span>${t('ready.loading')}</p>`,
}).setDomApi(LitDomApi)

export const BootstrapErrorView = View.extend({
	initialize(options: {error: string}) {void options},
	className: 'message danger mbe-4',
	attributes: {role: 'alert'},
	templateContext() {return this.options},
	template: ({error}: {error: string}) => html`<p>${t('ready.errorOccured')}<br>${error}</p><p>${t('ready.checkApiUrl')}</p>`,
}).setDomApi(LitDomApi)

export const OfflineView = View.extend({
	className: 'app offline',
	template: () => html`<div class="offline-message"><h1 class="title">${t('offline.title')}</h1><p>${t('offline.text')}</p></div>`,
}).setDomApi(LitDomApi)
