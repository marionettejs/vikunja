import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import type { IUser } from '@/modelTypes/IUser'
import {EditorAvatarView} from '../../shared/editor/editor-avatar'
import {listIcon} from '../../shared/task-list/list-ui'
import {fetchAvatarBlobUrl, observeAvatar, getDisplayName } from '@/models/user'
import {interceptLink} from '@/app/routes'
import { t } from '@/shared/i18n'
interface Options {
    user: IUser;
    navigate?: (href: string) => void;
    logout: () => Promise<void>;
    reportError: (error: unknown) => void; openShortcuts?: () => void;
}
export const AccountMenuView = View.extend({
	className: 'dropdown is-right',
	regions: {avatar: '[data-avatar]'},
	initialize(options: Options) { void options },
	ui: { trigger: '.username-dropdown-trigger', menu: '.dropdown-menu', logout: '[data-logout]', settings: '[data-settings]', about:'[data-about]', dropdownIcon:'.dropdown-icon', shortcuts:'[data-shortcuts]' },
	events: { 'click @ui.trigger': 'toggle', 'click @ui.logout': 'logout', 'click @ui.settings': 'settings', 'click @ui.about':'settings', 'click @ui.shortcuts':'shortcuts', keydown: 'key' },
	createState() {
		return {
			open: false,
			busy: false,
			outside: (event: MouseEvent) => {
				if (!this.el.contains(event.target as Node))
					this.close()
			},
		}
	},
	templateContext() { return {user: this.options.user} },
	template({user}: {user: IUser}) {
		return html `<div class="dropdown-trigger">
			<button type="button" class="base-button base-button--type-button username-dropdown-trigger" aria-haspopup="menu" aria-expanded="false">
				<span data-avatar style="display:contents"></span><span class="username">${getDisplayName(user)}</span><span class="mis-1 dropdown-icon icon is-small" aria-hidden="true">${listIcon('chevron-down')}</span>
			</button>
		</div><div class="dropdown-menu" hidden><div class="dropdown-content">
			<a class="dropdown-item" href="/user/settings" data-settings>${t('user.settings.title')}</a>
			<button type="button" class="base-button base-button--type-button dropdown-item" data-shortcuts>${t('keyboardShortcuts.title')}</button><a class="dropdown-item" href="/about" data-about>${t('about.title')}</a>
			<button type="button" class="base-button base-button--type-button dropdown-item" data-logout>${t('user.auth.logout')}</button>
		</div></div>`
	},
	shortcuts() {this.close();this.options.openShortcuts?.()},
	onRender() { this.showChildView('avatar',new EditorAvatarView({user:this.options.user,size:40,imageClass:'avatar',context:{avatar:(username,size)=>fetchAvatarBlobUrl({username},size),observeAvatar}})) },
	onAttach() { document.addEventListener('click', this.getState().outside) },
	toggle(event: MouseEvent) {
		event.stopPropagation()
		this.getState().open = !this.getState().open
		this.publish()
	},
	close() { this.getState().open = false; this.publish() },
	publish() {
		const open = this.getState().open
		this.el.classList.toggle('is-active', open);
		(this.getUI('menu')![0] as HTMLElement).hidden = !open;
		(this.getUI('trigger')![0] as HTMLButtonElement).setAttribute('aria-expanded', String(open));
		(this.getUI('dropdownIcon')![0] as HTMLElement).style.transform = open ? 'rotate(180deg)' : 'rotate(0)'
	},
	key(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !this.getState().open)
			return
		event.preventDefault()
		this.close();
		(this.getUI('trigger')![0] as HTMLButtonElement).focus()
	},
	settings(event: MouseEvent) {if (this.options.navigate) interceptLink(event, this.options.navigate); this.close()},
	logout() {
		if (this.getState().busy)
			return
		this.getState().busy = true;
		(this.getUI('logout')![0] as HTMLButtonElement).disabled = true
		void this.options.logout().catch(this.options.reportError)
	},
	onBeforeDestroy() { document.removeEventListener('click', this.getState().outside) },
}).setDomApi(LitDomApi)
