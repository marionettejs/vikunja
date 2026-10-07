import {View} from 'marionette'
import {DataApi, type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import full from '@/assets/logo-full.svg?raw'
import pride from '@/assets/logo-full-pride.svg?raw'
import type UserModel from '@/models/user'
import './logo.scss'

export const LogoView = View.extend({
	className: 'native-logo',
	initialize(options: {model?: Model; config?: Record<string, unknown>}) {void options},
	modelEvents: {change: 'render'},
	createState() {return {timer: undefined as ReturnType<typeof setInterval> | undefined, theme: new MutationObserver(() => this.render())}},
	templateContext() {
		const config = this.options.model?.get('config') as Record<string, unknown> | undefined ?? this.options.config ?? {}
		const user = this.options.model?.get('user') as UserModel | undefined
		const settings = user?.settings.frontendSettings
		const globals = window as Window & {CUSTOM_LOGO_URL?: string; CUSTOM_LOGO_URL_DARK?: string}
		const light = globals.CUSTOM_LOGO_URL, dark = globals.CUSTOM_LOGO_URL_DARK
		const custom = !light ? dark : !dark ? light : document.documentElement.classList.contains('dark') ? dark : light
		const seasonal = config.allow_icon_changes !== false && settings?.allowIconChanges !== false && new Date().getMonth() === 5
		return {custom, svg: (seasonal ? pride : full).replace('<svg ', '<svg class="logo-image" ')}
	},
	template: ({custom, svg}: {custom?: string; svg: string}) => custom ? html`<img class="logo-image" src=${custom} alt="Vikunja">` : html`${unsafeHTML(svg)}`,
	onAttach() {this.getState().theme.observe(document.documentElement, {attributes: true, attributeFilter: ['class']}); this.getState().timer = setInterval(() => this.render(), 3600000)},
	onBeforeDestroy() {this.getState().theme.disconnect(); clearInterval(this.getState().timer)},
}).setDomApi(LitDomApi).setDataApi(DataApi)
