import {REDIRECT_HASH_PREFIX} from '@/constants/redirectHash'
import {getAutoRedirectProvider, redirectToProvider} from '@/helpers/redirectToProvider'
import {isDesktopApp} from '@/helpers/desktopAuth'
import {openIdProviders} from './openid-config'
import {OpenIdApplication} from './openid'
import {Application, View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, render} from 'lit-html'
import {ApiConfigView} from '../../app/api-config'
import {LogoView} from '@/shared/logo'
import {t, locale} from '../../shared/i18n'
import {errorText, success, reportError} from '../../shared/notifications'
import {SessionApplication} from '../../app/session'
import {AUTH_TYPES} from '@/modelTypes/IUser'
import {parseValidationErrors} from '@/helpers/parseValidationErrors'
import PasswordResetService from '@/services/passwordReset'
import PasswordResetModel from '@/models/passwordReset'
import {getLastVisited, clearLastVisited} from '@/helpers/saveLastVisited'
import {queryHref, type Route} from '../../app/routes'
import {LoginFormView, RegistrationFormView, ResetPasswordFormView, ResetRequestFormView, type AccountForm, type AccountValues, type AuthConfig} from './account-forms'
const legalLinks = (config: AuthConfig) => html`${config.legal?.imprint_url ? html`<a href=${config.legal.imprint_url}>${t('navigation.imprint')}</a>` : nothing}${config.legal?.imprint_url && config.legal?.privacy_policy_url ? ' | ' : ''}${config.legal?.privacy_policy_url ? html`<a href=${config.legal.privacy_policy_url}>${t('navigation.privacy')}</a>` : nothing}`
const title = (route: Route) => route.kind === 'openid' ? '' : t(route.kind === 'register' ? 'user.auth.createAccount' : route.kind === 'password-request' || route.kind === 'password-reset' ? 'user.auth.resetPassword' : 'user.auth.login')
export const AuthenticationFrameView = View.extend({
	initialize(options: {title: string, config: AuthConfig}) {void options},
	className: 'no-auth-wrapper native-account-entry native-list-surface',
	regions: {logo: '[data-logo]', form: '[data-form]', api: '[data-api]'},
	ui: {image: '.noauth-container > .image', imageMessage: '[data-image-message]', message: '[data-main-message]', legal: '.legal-links'},
	onRender() {this.showChildView('logo',new LogoView({config:this.options.config as unknown as Record<string,unknown>}))},
	updateConfiguration(config: AuthConfig) {this.options.config = config; const logo = this.getChildView('logo') as InstanceType<typeof LogoView>; logo.options.config = config as unknown as Record<string,unknown>; logo.render(); (this.getUI('image')![0] as HTMLElement).classList.toggle('has-message', Boolean(config.motd)); for (const name of ['imageMessage', 'message']) {const element = this.getUI(name)![0] as HTMLElement; element.hidden = !config.motd; element.textContent = config.motd ?? ''}; render(legalLinks(config), this.getUI('legal')![0] as HTMLElement)},
	templateContext() {return this.options},
	template: ({title, config}: {title: string, config: AuthConfig}) => html`<div class="logo" data-logo></div><div class="noauth-container"><section class="image ${config.motd ? 'has-message' : ''}"><div class="message" data-image-message ?hidden=${!config.motd}>${config.motd}</div><h2 class="image-title">${t('misc.welcomeBack')}</h2></section><main id="main-content" tabindex="-1" class="content"><div>${title ? html`<h2 class="title">${title}</h2>` : nothing}<div data-api></div><div class="message is-hidden-tablet mbe-4" data-main-message ?hidden=${!config.motd}>${config.motd}</div><div data-form></div></div><div class="legal-links">${legalLinks(config)}</div></main></div>`,
}).setDomApi(LitDomApi)
export const AuthenticationApplication = Application.extend({
	initialize(options: {session: InstanceType<typeof SessionApplication>, navigate: (href: string, replace?: boolean) => void}) {this.addChildApp('openid', new OpenIdApplication({session: options.session, authenticated: () => this.finishLogin()}))},
	createState() {return {route: undefined as Route | undefined, request: undefined as AbortController | undefined, apiBusy: false}},
	onBeforeStart(_app: unknown, route: Route) {this.getState().route = route},
	onStart() {
		const route = this.getState().route!, config = this.options.session.getState().get('config') as AuthConfig
		document.title = title(route) ? `${title(route)} | Vikunja` : 'Vikunja'
		const frame = this.setView(new AuthenticationFrameView({title: title(route), config})); this.showView()
		if (route.kind === 'openid') {void this.getChildApp('openid')!.start({...route, region: frame.getRegion('form')}); return}
		const Form = route.kind === 'register' ? RegistrationFormView : route.kind === 'password-request' ? ResetRequestFormView : route.kind === 'password-reset' ? ResetPasswordFormView : LoginFormView
		frame.showChildView('form', new Form({config, navigate: href => this.options.navigate(href), submit: values => void this.submit(values)}))
		if (this.options.session.getState().get('status') === 'anonymous' && (!isDesktopApp() || localStorage.getItem('API_URL') !== null)) frame.showChildView('api', new ApiConfigView({canChange: () => this.isRunning() && !this.getState().request, busy: busy => {this.getState().apiBusy = busy; this.form().setLoading(busy)}, accepted: next => {this.options.session.getState().set('config', next); frame.updateConfiguration(next); this.form().updateConfiguration(next)}}))
		if (route.kind === 'login') {const justLoggedOut = sessionStorage.getItem('justLoggedOut') !== null; sessionStorage.removeItem('justLoggedOut'); const provider = getAutoRedirectProvider({localAuthEnabled: Boolean(config.auth?.local?.enabled), ldapAuthEnabled: Boolean(config.auth?.ldap?.enabled), openIdEnabled: openIdProviders(config).length > 0, providers: openIdProviders(config), isDesktopApp: isDesktopApp(), justLoggedOut, hasCopyableRedirect: location.hash.startsWith(REDIRECT_HASH_PREFIX)}); if (provider) redirectToProvider(provider)}
		if (route.kind === 'login' && (route.query.userEmailConfirm || localStorage.getItem('emailConfirmToken'))) void this.confirmEmail()
	},
	form() {return (this.getView() as InstanceType<typeof AuthenticationFrameView>).getChildView('form') as AccountForm},
	finishLogin() {
		const last = getLastVisited(); clearLastVisited()
		const href = last?.name === 'oauth.authorize' ? queryHref('/oauth/authorize',last.query) : last?.name === 'task.detail' ? queryHref(`/tasks/${last.params.id}`, last.query) : last?.name === 'project.view' ? queryHref(`/projects/${last.params.projectId}/${last.params.viewId}`, last.query) : '/'
		this.options.navigate(href, true)
	},
	async submit(values: AccountValues) {
		const state = this.getState(); if (state.request || state.apiBusy || !this.isRunning()) return
		const request = new AbortController(), route = state.route!, view = this.form(); state.request = request; view.setLoading(true)
		try {
			if (route.kind === 'login') {await this.options.session.login(values, request.signal); request.signal.throwIfAborted(); this.finishLogin()}
			else if (route.kind === 'register') {await this.options.session.register(values, locale(), request.signal); request.signal.throwIfAborted(); this.finishLogin()}
			else if (route.kind === 'password-request') {await new PasswordResetService().requestResetPassword(new PasswordResetModel({email: values.email}), request.signal); request.signal.throwIfAborted(); view.completed(t('user.auth.resetPasswordSuccess'))}
			else if (route.kind === 'password-reset') {if (typeof route.query.userPasswordReset !== 'string' || !route.query.userPasswordReset) {view.feedback(t('user.auth.passwordResetTokenMissing'), ''); return}; const result = await new PasswordResetService().resetPassword(new PasswordResetModel({newPassword: values.password, token: String(route.query.userPasswordReset)}), request.signal); request.signal.throwIfAborted(); view.completed(result.message)}
		} catch (error) {
			if (request.signal.aborted || state.request !== request || !this.isRunning()) return
			const data = (error as {response?: {data?: {code?: number, message?: string, invalid_fields?: string[]}}})?.response?.data
			if (route.kind === 'login' && data?.code === 1017 && !values.totp_passcode) view.requireTotp()
			else if (route.kind === 'register' && data?.code === 1012) view.feedback('', t('user.auth.registrationConfirmEmail'))
			else if (route.kind === 'register' && data?.invalid_fields) {const fields = parseValidationErrors(data); for (const [field, message] of Object.entries(fields)) view.fieldError(field, message); if (!Object.keys(fields).length) view.feedback(t('user.auth.registrationFailed'), '')}
			else view.feedback((route.kind === 'password-request' || route.kind === 'password-reset') ? data?.message ?? errorText(error) : errorText(error))
		} finally {if (state.request === request) state.request = undefined; if (!request.signal.aborted && !view.isDestroyed()) view.setLoading(false)}
	},
	async confirmEmail() {
		const state = this.getState(); if (state.request || state.apiBusy || !this.isRunning()) return
		const token = typeof state.route?.query.userEmailConfirm === 'string' ? state.route.query.userEmailConfirm : localStorage.getItem('emailConfirmToken')
		if (!token) return
		const request = new AbortController(), view = this.form(), personal = this.options.session.getState().get('user')?.type === AUTH_TYPES.USER
		state.request = request; view.setLoading(true)
		try {
			const changed = await this.options.session.confirmEmail(token, request.signal, personal)
			request.signal.throwIfAborted()
			if (personal) {success(t(changed ? 'user.settings.updateEmailConfirmed' : 'user.auth.confirmEmailSuccess')); this.options.navigate(changed ? '/user/settings/email-update' : '/', true)}
			else view.feedback('', t('user.auth.confirmEmailSuccess'))
		} catch (error) {if (!request.signal.aborted && this.isRunning()) {if (personal) {reportError(error); this.options.navigate('/', true)} else view.feedback(errorText(error))}}
		finally {if (!request.signal.aborted && localStorage.getItem('emailConfirmToken') === token) localStorage.removeItem('emailConfirmToken'); if (state.request === request) state.request = undefined; if (!request.signal.aborted && !view.isDestroyed()) view.setLoading(false)}
	},
	onBeforeStop() {this.getState().request?.abort(); this.getState().request = undefined; this.getState().route = undefined; this.getState().apiBusy = false},
})
