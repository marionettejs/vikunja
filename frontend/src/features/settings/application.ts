import {AvatarSettingsView,readAvatar} from './settings-avatar'
import './settings-admin.scss'
import {AccountDataView,accountDataPages,accountDataTitle,readExport,type ExportInfo} from './settings-account-data'
import {BotsSettingsView,readBots,type BotData} from './settings-bots'
import {WebhookSettingsView,readWebhooks,type WebhookData} from '../webhooks/application'
import {SecuritySettingsView} from './settings-security'
import {readSecurity,securityPages,securityTitle,type SecurityData,type SecurityPage} from './settings-security-data'
import {SettingsSearchView} from './settings-search'
import {SettingsRemindersView} from './settings-reminders'
import {getProjectTitle} from '@/helpers/getProjectTitle'
import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render as renderLit, type TemplateResult } from 'lit-html'
import isEqual from 'fast-deep-equal'
import { AuthenticatedHTTPFactory } from '@/helpers/fetcher'
import EmailUpdateService from '@/services/emailUpdate'
import EmailUpdateModel from '@/models/emailUpdate'
import UserSettingsService from '@/services/userSettings'
import ProjectService from '@/services/project'
import PasswordUpdateService from '@/services/passwordUpdateService'
import PasswordUpdateModel from '@/models/passwordUpdate'
import UserModel, { invalidateAvatarCache } from '@/models/user'
import type { IUserSettings } from '@/modelTypes/IUserSettings'
import type { IProject } from '@/modelTypes/IProject'
import { listIcon } from '@/shared/task-list/list-ui'
import { formatDate } from '../../shared/dates'
import { AUTH_TYPES } from '@/modelTypes/IUser'
import { SUPPORTED_LOCALES } from '../../shared/locales'
import { DATE_DISPLAY } from '@/constants/dateDisplay'
import { RELATION_KINDS } from '@/types/IRelationKind'
import { validatePassword } from '@/helpers/validatePasswort'
import { t, setLanguage } from '../../shared/i18n'
import { errorText, reportError, success } from '../../shared/notifications'
import { interceptLink, type Route } from '../../app/routes'
import type { SessionApplication } from '../../app/session'
import './application.scss'
interface Options {
    session: InstanceType<typeof SessionApplication>;
    navigate: (href: string, replace?: boolean) => void;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const field = (label: string, content: TemplateResult) => html `<div class="field"><label class="two-col"><span>${t(label)}</span>${content}</label></div>`
const stackedField = (label: string, content: TemplateResult) => html `<div class="field"><label class="label">${t(label)}${content}</label></div>`
const card = (title: string, content: TemplateResult) => html `<div class="card general-settings ${title === 'user.settings.sections.personalInformation' ? '' : 'section-block'}"><header class="card-header"><p class="card-header-title">${t(title)}</p></header><div class="card-content loader-container"><div class="content"><div class="field-group">${content}</div></div></div></div>`
const navItems = (user: UserModel, config: Record<string, unknown>) => [
	['general', 'user.settings.general.title', true], ['password-update', 'user.settings.newPasswordTitle', user.isLocalUser], ['email-update', 'user.settings.updateEmailTitle', user.isLocalUser], ['avatar', 'user.settings.avatar.title', true], ['totp', 'user.settings.totp.title', config.totp_enabled && user.isLocalUser], ['data-export', 'user.export.title', true], ['migrate', 'migrate.title', Boolean((config.available_migrators as unknown[])?.length)], ['caldav', 'user.settings.caldav.title', config.caldav_enabled], ['feeds', 'user.settings.feeds.title', true], ['api-tokens', 'user.settings.apiTokens.title', true], ['sessions', 'user.settings.sessions.title', true], ['webhooks', 'user.settings.webhooks.title', config.webhooks_enabled], ['bots', 'user.settings.bots.title', true], ['deletion', 'user.deletion.title', config.user_deletion_enabled],
] as const
export const SettingsFrameView = View.extend({
	initialize(options: {
        user: UserModel;
        config: Record<string, unknown>;
        page: string;
        navigate: Options['navigate'];
    }) { void options }, className: 'content-widescreen native-settings native-list-surface',
	regions: { form: '[data-settings-form]' },
	templateContext() { return this.options },
	template({ user, config, page, navigate }: {
        user: UserModel;
        config: Record<string, unknown>;
        page: string;
        navigate: Options['navigate'];
    }) { return html `<div class="side-nav-shell"><nav class="navigation" aria-label=${t('user.settings.title')}><ul>${navItems(user, config).filter(item => item[2] !== false && item[2] !== undefined).map(([path, title]) => html `<li><a class="navigation-link ${page === path ? 'is-active' : ''}" href=${`/user/settings/${path}`} @click=${(event: MouseEvent) => interceptLink(event, navigate)}>${t(title)}</a></li>`)}${Object.values(user.settings.extraSettingsLinks ?? {}).map(link => html `<li><a class="navigation-link" href=${link.url}>${link.text}</a></li>`)}</ul></nav><section class="view" data-settings-form></section></div>` },
}).setDomApi(LitDomApi)
const FormView = View.extend({
	initialize(options: {
        submit: (values: unknown) => void;
    }) { void options },
	ui: { form: 'form', inputs: 'input,select', submit: '[data-save]', error: '[data-error]', pending: '[data-pending]', pendingText: '[data-pending-text]', pendingButtons: '[data-pending-action]', loaders: '.loader-container' },
	events: { 'submit @ui.form': 'submit', 'click @ui.submit': 'submit', 'input @ui.inputs': 'input', 'change @ui.inputs': 'input' },
	createState() { return { busy: false } },
	submit(event: Event) { event.preventDefault(); if (!this.getState().busy)
		this.options.submit(this.values()) },
	input() { }, values() { return {} },
	feedback(error = '') { const element = this.getUI('error')![0] as HTMLElement; element.textContent = error; element.hidden = !error },
	loading(busy: boolean) { this.getState().busy = busy; for (const element of [...Array.from(this.getUI('submit') ?? []), ...Array.from(this.getUI('pendingButtons') ?? [])]) {
		(element as HTMLButtonElement).disabled = busy
		element.classList.toggle('is-loading', busy)
	} ; for (const element of Array.from(this.getUI('loaders') ?? []))
		element.classList.toggle('is-loading', busy); this.el.setAttribute('aria-busy', String(busy)); if (busy)
		this.feedback() },
}).setDomApi(LitDomApi)
const GeneralView = FormView.extend({
	initialize(options: {
        settings: IUserSettings;
        user: UserModel;
        projects: IProject[];
        timezones: string[];
        timeTracking: boolean;
        submit: (value: IUserSettings) => void;
    }) { void options },
	regions: {project:'[data-project-search]',filter:'[data-filter-search]',timezone:'[data-timezone-search]',reminders:'[data-reminders]'},
	ui: { ...FormView.prototype.ui, remindersSection:'[data-reminders-section]', fields: '[data-setting]', overdue: '[data-overdue-time]', timeFormat: '[data-time-format]', brightness: '[data-setting="frontendSettings.backgroundBrightness"]' },
	events: { ...FormView.prototype.events, 'blur @ui.brightness': 'bounds' },
	createState() { const draft = clone((this.options as {
        settings: IUserSettings;
    }).settings); draft.frontendSettings = { ...draft.frontendSettings, defaultView: draft.frontendSettings.defaultView ?? 'first', minimumPriority: draft.frontendSettings.minimumPriority ?? 2, allowIconChanges: draft.frontendSettings.allowIconChanges ?? true, dateDisplay: draft.frontendSettings.dateDisplay ?? 'relative', timeFormat: draft.frontendSettings.timeFormat ?? '12h', defaultTaskRelationType: draft.frontendSettings.defaultTaskRelationType ?? 'related', quickAddDefaultReminders: [...(draft.frontendSettings.quickAddDefaultReminders ?? [])], timeTrackingDefaultStart: draft.frontendSettings.timeTrackingDefaultStart ?? '09:00' }; return { busy: false, draft, initial: clone(draft) } },
	templateContext() { return { ...this.options, draft: this.getState().draft } },
	template(options: {
        draft: IUserSettings;
        user: UserModel;
        projects: IProject[];
        timezones: string[];
        timeTracking: boolean;
    }) {
		const d = options.draft, user = options.user
		const get = (key: string) => key.startsWith('frontendSettings.') ? d.frontendSettings[key.split('.')[1] as keyof IUserSettings['frontendSettings']] : d[key as keyof IUserSettings]
		const input = (key: string, type = 'text', disabled = false) => html `<input class="input" type=${type} data-setting=${key} placeholder=${key === 'name' ? t('user.settings.general.newName') : nothing} .value=${String(get(key) ?? '')} ?disabled=${disabled} min=${type === 'number' ? 0 : nothing} max=${type === 'number' ? 100 : nothing}>`
		const selectLabel = (key: string) => t(key === 'frontendSettings.colorSchema' ? 'user.settings.appearance.title' : key === 'frontendSettings.quickAddMagicMode' ? 'user.settings.quickAddMagic.title' : `user.settings.general.${key.split('.').slice(-1)[0] === 'filterIdUsedOnOverview' ? 'filterUsedOnOverview' : key.split('.').slice(-1)[0]}`)
		const select = (key: string, values: [
            string | number,
            string
        ][]) => html `<div class="select"><select data-setting=${key} aria-label=${selectLabel(key)}>${values.map(([value, label]) => html `<option value=${String(value)} ?selected=${String(get(key)) === String(value)}>${label}</option>`)}</select></div>`
		const check = (key: string, label: string) => html `<div class="field"><label class="checkbox"><input type="checkbox" data-setting=${key} .checked=${Boolean(get(key))}> ${t(label)}</label></div>`
		const f = (name: string, content: TemplateResult) => field(`user.settings.general.${name}`, content)
		const project = (_key: string, filters = false) => html`<span class="settings-search-slot" data-project-search=${filters?nothing:''} data-filter-search=${filters?'':nothing}></span>`
		return html `<form>
  <div data-error class="message danger" role="alert" hidden></div>
  ${card('user.settings.sections.personalInformation', html `${f('name', input('name', 'text', user.isLocalUser === false))}${user.isLocalUser === false ? html `<p class="help">${t('user.settings.general.externalUserNameChange', { provider: (user as UserModel & {
                authProvider?: string;
            }).authProvider })}</p>` : nothing}${f('defaultProject', project('defaultProjectId'))}`)}
  ${card('user.settings.sections.taskAndNotifications', html `${f('defaultView', select('frontendSettings.defaultView', ['first', 'list', 'gantt', 'table', 'kanban'].map(v => [v, t(`project.${v}.title`)])))}${f('minimumPriority', select('frontendSettings.minimumPriority', ['low', 'medium', 'high', 'urgent', 'doNow'].map((v, i) => [i + 1, t(`task.priority.${v}`)])))}${f('defaultDueTime', input('frontendSettings.defaultDueTime', 'time'))}<p class="help">${t('user.settings.general.defaultDueTimeDescription')}</p>${options.projects.some(p => p.id < 0) ? f('filterUsedOnOverview', project('frontendSettings.filterIdUsedOnOverview', true)) : nothing}${check('frontendSettings.showLastViewed', 'user.settings.general.showLastViewed')}${check('emailRemindersEnabled', 'user.settings.general.emailReminders')}${check('overdueTasksRemindersEnabled', 'user.settings.general.overdueReminders')}<div data-overdue-time ?hidden=${!d.overdueTasksRemindersEnabled}>${f('overdueTasksRemindersTime', input('overdueTasksRemindersTime', 'time'))}</div>`)}
  ${card('user.settings.sections.localization', html `${f('language', select('language', Object.entries(SUPPORTED_LOCALES).sort((a, b) => a[1].localeCompare(b[1]))))}${f('timezone', html`<span class="settings-search-slot" data-timezone-search></span>`)}${f('weekStart', select('weekStart', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((v, i) => [i, t(`user.settings.general.weekStart${v}`)])))}${f('dateDisplay', select('frontendSettings.dateDisplay', Object.values(DATE_DISPLAY).map(v => [v, v === 'dayMonthYear' ? formatDate(new Date(), 'D MMMM YYYY') : v === 'weekdayDayMonthYear' ? formatDate(new Date(), 'dddd, D MMMM YYYY') : t(`user.settings.general.dateDisplayOptions.${v}`)])))}<div data-time-format ?hidden=${d.frontendSettings.dateDisplay === 'relative'}>${f('timeFormat', select('frontendSettings.timeFormat', ['12h', '24h'].map(v => [v, t(`user.settings.general.timeFormatOptions.${v}`)])))}</div>${options.timeTracking ? f('timeTrackingDefaultStart', input('frontendSettings.timeTrackingDefaultStart', 'time')) : nothing}`)}
  ${card('user.settings.sections.appearance', html `${field('user.settings.appearance.title', select('frontendSettings.colorSchema', ['light', 'auto', 'dark'].map(v => [v, t(`user.settings.appearance.colorScheme.${v === 'auto' ? 'system' : v}`)])))}${field('user.settings.quickAddMagic.title', select('frontendSettings.quickAddMagicMode', ['disabled', 'vikunja', 'todoist'].map(v => [v, t(`user.settings.quickAddMagic.${v}`)])))}<div data-reminders-section ?hidden=${d.frontendSettings.quickAddMagicMode==='disabled'}><label class="label">${t('user.settings.general.quickAddDefaultReminders')}</label><p class="help">${t('user.settings.general.quickAddDefaultRemindersDescription')}</p><p class="help">${t('user.settings.general.quickAddDefaultRemindersHint')}</p><div data-reminders></div></div>${f('defaultTaskRelationType', select('frontendSettings.defaultTaskRelationType', RELATION_KINDS.map(v => [v, t(`task.relation.kinds.${v}`, 1)])))}${check('frontendSettings.playSoundWhenDone', 'user.settings.general.playSoundWhenDone')}${check('frontendSettings.allowIconChanges', 'user.settings.general.allowIconChanges')}${check('frontendSettings.alwaysShowBucketTaskCount', 'user.settings.general.alwaysShowBucketTaskCount')}${field('user.settings.backgroundBrightness.title', input('frontendSettings.backgroundBrightness', 'number'))}`)}
  ${card('user.settings.sections.privacy', html `${check('discoverableByName', 'user.settings.general.discoverableByName')}${check('discoverableByEmail', 'user.settings.general.discoverableByEmail')}`)}
  <div class="sticky-save"><button type="submit" data-save data-testid="saveGeneralSettings" class="base-button base-button--type-button button is-primary is-fullwidth" hidden>${t('misc.save')}</button></div></form>`
	},
	onRender() {
		const draft=this.getState().draft, projects=this.options.projects
		const ancestors=(project:IProject)=>{const titles:string[]=[];const visited=new Set<number>();let current=project;while(current.parentProjectId&&!visited.has(current.parentProjectId)){visited.add(current.parentProjectId);const parent=projects.find(p=>p.id===current.parentProjectId);if(!parent)break;titles.unshift(getProjectTitle(parent));current=parent}return titles.join(' > ')}
		const bind=(region:string,key:string,items:{value:string|number,label:string,context?:string}[],selected:string|number|null|undefined,label:string,placeholder:string)=>this.showChildView(region,new SettingsSearchView({id:`settings-${region}`,label:t(label),placeholder:t(placeholder),items,selected,changed:(value:string|number|null)=>{if(key==='defaultProjectId')draft.defaultProjectId=Number(value??0);else if(key==='timezone')draft.timezone=String(value??'');else draft.frontendSettings.filterIdUsedOnOverview=value===null?null:Number(value);this.publishDirty()}}))
		bind('project','defaultProjectId',projects.filter(p=>p.id>0&&!p.isArchived).map(p=>({value:p.id,label:getProjectTitle(p),context:ancestors(p)})),draft.defaultProjectId,'user.settings.general.defaultProject','project.search')
		if(projects.some(p=>p.id<-1))bind('filter','filterIdUsedOnOverview',projects.filter(p=>p.id<-1).map(p=>({value:p.id,label:getProjectTitle(p)})),draft.frontendSettings.filterIdUsedOnOverview,'user.settings.general.filterUsedOnOverview','project.search')
		bind('timezone','timezone',this.options.timezones.map(value=>({value,label:value.replace(/_/g,' ')})),draft.timezone,'user.settings.general.timezone','user.settings.general.timezone')
		this.showChildView('reminders',new SettingsRemindersView({items:draft.frontendSettings.quickAddDefaultReminders,changed:(items)=>{draft.frontendSettings.quickAddDefaultReminders=items;this.publishDirty()}}))
	},
	input(event: Event) { const element = event.target as HTMLInputElement, key = element.dataset.setting; if (!key)
		return; const numeric = ['weekStart', 'defaultProjectId', 'frontendSettings.minimumPriority', 'frontendSettings.filterIdUsedOnOverview', 'frontendSettings.backgroundBrightness']; let value: unknown = element.type === 'checkbox' ? element.checked : numeric.includes(key) ? Number(element.value) : element.value; if (key === 'frontendSettings.filterIdUsedOnOverview' && !value)
		value = null; const draft = this.getState().draft; if (key.startsWith('frontendSettings.'))
		Object.assign(draft.frontendSettings, { [key.split('.')[1]]: value })
	else
		Object.assign(draft, { [key]: value }); this.publishDirty(); (this.getUI('remindersSection')![0] as HTMLElement).hidden=draft.frontendSettings.quickAddMagicMode==='disabled'; (this.getUI('overdue')![0] as HTMLElement).hidden = !draft.overdueTasksRemindersEnabled; (this.getUI('timeFormat')![0] as HTMLElement).hidden = draft.frontendSettings.dateDisplay === 'relative' },
	bounds() { const element = this.getUI('brightness')![0] as HTMLInputElement, value = Number(element.value); this.getState().draft.frontendSettings.backgroundBrightness = !value || Number.isNaN(value) ? null : Math.max(0, Math.min(100, value)); element.value = String(this.getState().draft.frontendSettings.backgroundBrightness ?? ''); this.publishDirty() },
	publishDirty() { (this.getUI('submit')![0] as HTMLElement).hidden = isEqual(this.getState().draft, this.getState().initial) },
	values() { return clone(this.getState().draft) },
	accepted(snapshot: IUserSettings) { this.getState().initial = clone(snapshot); this.publishDirty() },
})
const CredentialsView = FormView.extend({
	initialize(options: {
        page: string;
        user: UserModel;
        submit: (value: Record<string, string>) => void;
        pending: (action: string) => void;
    }) { void options },
	ui: { ...FormView.prototype.ui, password: '#password', current: '#currentPassword', newEmail: '#newEmail', emailPassword: '#currentPasswordEmail', passwordError: '[data-password-error]', toggle: '[data-toggle-password]' },
	events: { ...FormView.prototype.events, 'click @ui.pendingButtons': 'pendingAction', 'click @ui.toggle': 'togglePassword' },
	templateContext() { return this.options },
	template({ page, user }: {
        page: string;
        user: UserModel;
    }) { return card(page === 'password-update' ? 'user.settings.newPasswordTitle' : 'user.settings.updateEmailTitle', html `<div data-error class="message danger" role="alert" hidden></div>${page === 'email-update' ? html `<div class="message warning mbe-4" data-pending ?hidden=${!user.pendingEmail} role="status"><p data-pending-text>${t('user.settings.updateEmailPending', { email: user.pendingEmail })}</p><div class="buttons mbs-2"><button type="button" class="base-button base-button--type-button button is-outlined" data-pending-action="resend">${t('user.settings.updateEmailResend')}</button><button type="button" class="base-button base-button--type-button button is-text" data-pending-action="cancel">${t('user.settings.updateEmailCancel')}</button></div></div>` : nothing}<form>${page === 'password-update' ? html `<div class="field"><label class="label" for="password">${t('user.settings.newPassword')}</label><div class="control has-icons-right"><input id="password" class="input" type="password" autocomplete="new-password"><button type="button" data-toggle-password class="base-button password-toggle" aria-label=${t('user.auth.showPassword')}>${listIcon('eye')}</button></div><p class="help is-danger" data-password-error></p></div>${stackedField('user.settings.currentPassword', html `<input id="currentPassword" class="input" type="password" autocomplete="current-password" placeholder=${t('user.settings.currentPasswordPlaceholder')}>`)}` : html `${stackedField('user.settings.updateEmailNew', html `<input id="newEmail" class="input" type="email" autocomplete="email" name="email" placeholder=${t('user.auth.emailPlaceholder')}>`)}${stackedField('user.settings.currentPassword', html `<input id="currentPasswordEmail" class="input" type="password" autocomplete="current-password" placeholder=${t('user.settings.currentPasswordPlaceholder')}>`)}`}<button type="submit" data-save class="base-button base-button--type-button button is-primary is-fullwidth mbs-4">${t('misc.save')}</button></form>`) },
	onRender() { if (this.options.page === 'password-update')
		this.input() },
	values() { const value = (key: string) => (this.getUI(key)?.[0] as HTMLInputElement)?.value ?? ''; return this.options.page === 'password-update' ? { newPassword: value('password'), oldPassword: value('current') } : { newEmail: value('newEmail'), password: value('emailPassword') } },
	input() { if (this.options.page !== 'password-update')
		return; const values = this.values(), error = validatePassword(values.newPassword ?? ''); (this.getUI('passwordError')![0] as HTMLElement).textContent = error === true ? '' : t(error); (this.getUI('submit')![0] as HTMLButtonElement).disabled = this.getState().busy || error !== true || !values.oldPassword },
	loading(busy: boolean) { FormView.prototype.loading.call(this, busy); this.input() },
	togglePassword() { const input = this.getUI('password')![0] as HTMLInputElement; input.type = input.type === 'password' ? 'text' : 'password'; const button = this.getUI('toggle')![0] as HTMLElement; renderLit(listIcon(input.type === 'password' ? 'eye' : 'eye-slash'), button); button.setAttribute('aria-label', t(input.type === 'password' ? 'user.auth.showPassword' : 'user.auth.hidePassword')); input.focus() },
	pendingAction(event: Event) { if (!this.getState().busy)
		this.options.pending((event as Event & {
            delegateTarget: HTMLElement;
        }).delegateTarget.dataset.pendingAction!) },
	updateUser(user: UserModel, clear = false) { const pending = this.getUI('pending')?.[0] as HTMLElement | undefined; if (pending) {
		pending.hidden = !user.pendingEmail;
		(this.getUI('pendingText')![0] as HTMLElement).textContent = t('user.settings.updateEmailPending', { email: user.pendingEmail })
	} if (clear)
		for (const input of Array.from(this.getUI('inputs') ?? []))
			(input as HTMLInputElement).value = '' },
})
export const SettingsApplication = Application.extend({
	initialize(options: Options) { void options },
	createState() { return { route: undefined as Route | undefined, attempt: undefined as AbortController | undefined } },
	onBeforeStart(_app: unknown, route: Route) { this.getState().route = route },
	async prepareStart(route: Route, { signal }: LifecycleContext) {
		const user = this.options.session.getState().get('user')!
		if (user.type !== AUTH_TYPES.USER)
			throw new Error('Personal settings require a user session')
		if(route.params.page==='avatar'){try{return {projects:[] as IProject[],timezones:[] as string[],avatarProvider:await readAvatar(signal)}}catch(error){signal.throwIfAborted();return {projects:[] as IProject[],timezones:[] as string[],adminError:error}}}
		if (securityPages.includes(route.params.page as SecurityPage)) {
			if ((route.params.page==='totp'&&(!user.isLocalUser||!this.options.session.getState().get('config')?.totp_enabled))||(route.params.page==='caldav'&&!this.options.session.getState().get('config')?.caldav_enabled)) return {projects:[] as IProject[],timezones:[] as string[],security:{} as SecurityData,unavailable:true}
			try {const security=await readSecurity(route.params.page as SecurityPage,signal);signal.throwIfAborted();return {projects:[] as IProject[],timezones:[] as string[],security}} catch(error){signal.throwIfAborted();return {projects:[] as IProject[],timezones:[] as string[],security:{error} as SecurityData}}
		}
		if (accountDataPages.includes(route.params.page as never)||['bots','webhooks'].includes(route.params.page)) {
			const page=route.params.page,empty={projects:[] as IProject[],timezones:[] as string[]}
			if(page==='deletion'&&!this.options.session.getState().get('config')?.user_deletion_enabled)return {...empty,unavailable:true}
			try {if(page==='data-export')return {...empty,exportInfo:await readExport(signal)};if(page==='bots')return {...empty,bots:await readBots(signal)};if(page==='webhooks')return {...empty,webhooks:await readWebhooks(undefined,signal)};return empty} catch(error){signal.throwIfAborted();return {...empty,adminError:error}}
		}
		if (route.params.page !== 'general')
			return { projects: [] as IProject[], timezones: [] as string[] }
		const service = new ProjectService(), projects: IProject[] = []
		const [zones] = await Promise.all([AuthenticatedHTTPFactory().get('user/timezones', { signal }), (async () => { let page = 1; do {
			projects.push(...await service.getAll(undefined, {}, page++, signal))
		} while (page <= service.totalPages) })()])
		signal.throwIfAborted()
		return { projects, timezones: zones.data as string[] }
	},
	onStart(_app: unknown, _options: unknown, data: {
        projects: IProject[];
        timezones: string[];
		security?: SecurityData;
		exportInfo?:ExportInfo|null;
		bots?:BotData;
		webhooks?:WebhookData;
		adminError?:unknown;
		avatarProvider?:string;
		unavailable?: boolean;
    }) {
		const route = this.getState().route!, session = this.options.session, user = session.getState().get('user')!, page = route.params.page, config = session.getState().get('config') ?? {}
		const transition=session.getState().get('transition'),current=()=>this.isRunning()&&this.getState().route===route&&session.getState().get('user')===user&&session.getState().get('transition')===transition
		if(page==='export-download'){document.title=`${t(accountDataTitle(page))} | Vikunja`;this.setView(new AccountDataView({page,user,session,current,navigate:this.options.navigate}));this.showView();return}
		const frame = this.setView(new SettingsFrameView({ user, config, page, navigate: this.options.navigate }))
		this.showView()
		document.title = `${t(accountDataPages.includes(page as never)?accountDataTitle(page):page==='avatar'?'user.settings.avatar.title':page==='bots'?'user.settings.bots.title':page==='webhooks'?'user.settings.webhooks.title':securityPages.includes(page as SecurityPage)?securityTitle(page):page === 'general' ? 'user.settings.general.title' : page === 'password-update' ? 'user.settings.newPasswordTitle' : 'user.settings.updateEmailTitle')} - ${t('user.settings.title')} | Vikunja`
		if (securityPages.includes(page as SecurityPage)&&!data.unavailable) {
			const transition=session.getState().get('transition')
			frame.showChildView('form',new SecuritySettingsView({route,data:data.security??{},user,navigate:this.options.navigate,current:()=>this.isRunning()&&this.getState().route===route&&session.getState().get('user')===user&&session.getState().get('transition')===transition,logout:()=>session.logout()}))
		} else if (data.unavailable) frame.showChildView('form', new (View.extend({template:()=>html``}).setDomApi(LitDomApi))())
		else if (accountDataPages.includes(page as never)) frame.showChildView('form',new AccountDataView({page:page as 'data-export'|'deletion',user,session,current,navigate:this.options.navigate,info:data.exportInfo,error:data.adminError}))
		else if(page==='avatar')frame.showChildView('form',new AvatarSettingsView({user,current,provider:data.avatarProvider,error:data.adminError,authProvider:String((user as UserModel & {authProvider?:string}).authProvider??'')}))
		else if(page==='bots')frame.showChildView('form',new BotsSettingsView({user,current,data:data.bots??{error:data.adminError}}))
		else if(page==='webhooks')frame.showChildView('form',new WebhookSettingsView({editable:true,current,data:data.webhooks??{error:data.adminError}}))
		else if (page === 'general')
			frame.showChildView('form', new GeneralView({ user, settings: user.settings, ...data, timeTracking: Boolean((config.enabled_pro_features as string[])?.includes('time_tracking')), submit: (values: IUserSettings) => void this.perform('save', values) }))
		else if (['password-update', 'email-update'].includes(page) && user.isLocalUser)
			frame.showChildView('form', new CredentialsView({ page, user, submit: (values: Record<string, string>) => void this.perform('save', values), pending: (action: string) => void this.perform(action) }))
		else
			frame.showChildView('form', new (View.extend({ template: () => html `<div role="status">Migration incomplete: ${route.path}</div>` }).setDomApi(LitDomApi))())
	},
	async perform(action: string, values?: IUserSettings | Record<string, string>) {
		const state = this.getState()
		if (state.attempt)
			return
		const controller = state.attempt = new AbortController(), signal = controller.signal, session = this.options.session, user = session.getState().get('user')!, transition = session.getState().get('transition'), view = (this.getView() as InstanceType<typeof SettingsFrameView>).getChildView('form') as InstanceType<typeof GeneralView> | InstanceType<typeof CredentialsView>, page = state.route!.params.page
		view.loading(true)
		const current = () => { signal.throwIfAborted(); if (session.getState().get('transition') !== transition || session.getState().get('user') !== user)
			throw new DOMException('Identity changed', 'AbortError') }
		try {
			if (page === 'general') {
				const settings = values as IUserSettings
				await new UserSettingsService().update({ ...settings, ...(session.getState().get('config')?.demo_mode_enabled ? { language: null } : {}) }, signal)
				current()
				await setLanguage(settings.language || 'en', signal)
				current()
				const oldName = user.name
				user.settings = clone(settings)
				user.name = settings.name
				session.applyAppearance()
				session.trigger('profile:changed')
				if (oldName !== user.name)
					invalidateAvatarCache(user);
				(view as InstanceType<typeof GeneralView>).accepted(settings)
				success(t('user.settings.general.savedSuccess'))
			}
			else if (page === 'password-update') {
				await new PasswordUpdateService().update(new PasswordUpdateModel(values), signal)
				current()
				success(t('user.settings.passwordUpdateSuccess'))
			}
			else {
				const http = AuthenticatedHTTPFactory(), service = new EmailUpdateService()
				if (action === 'save')
					await service.update(new EmailUpdateModel(values), signal)
				else if (action === 'cancel')
					await service.cancel(signal)
				else
					await service.resend(signal)
				current()
				const { data } = await http.get('user', { signal })
				current()
				const updated = new UserModel({ ...data, type: AUTH_TYPES.USER })
				session.getState().set('user', updated)
				session.trigger('profile:changed');
				(view as InstanceType<typeof CredentialsView>).updateUser(updated, action === 'save')
				success(t(action === 'cancel' ? 'user.settings.updateEmailCancelSuccess' : action === 'resend' ? 'user.settings.updateEmailResendSuccess' : updated.pendingEmail ? 'user.settings.updateEmailPendingSuccess' : 'user.settings.updateEmailSuccess'))
			}
		}
		catch (error) {
			if (!signal.aborted && state.attempt === controller) {
				if (page === 'general') {
					if (this.isRunning() && !view.isDestroyed() && session.getState().get('transition') === transition && session.getState().get('user') === user)
						reportError(error)
				} else view.feedback(errorText(error))
			}
		}
		finally {
			if (state.attempt === controller) {
				state.attempt = undefined
				if (!signal.aborted)
					view.loading(false)
			}
		}
	},
	onBeforeStop() { this.getState().attempt?.abort(); this.getState().attempt = undefined; this.getState().route = undefined },
})
