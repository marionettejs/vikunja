import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing} from 'lit-html'
import {t} from '../../shared/i18n'
import {isEmail} from '@/helpers/isEmail'
import {validatePassword} from '@/helpers/validatePasswort'
import {listIcon} from '@/shared/task-list/list-ui'
import {interceptLink} from '../../app/routes'
import './application.scss'
import {openIdProviders} from './openid-config'
import {redirectToProvider} from '@/helpers/redirectToProvider'
import {isDesktopApp} from '@/helpers/desktopAuth'
export interface AuthConfig extends Record<string, unknown> {auth?: {local?: {enabled?: boolean, registration_enabled?: boolean}, ldap?: {enabled?: boolean}}, demo_mode_enabled?: boolean, motd?: string, legal?: {imprint_url?: string, privacy_policy_url?: string}}
export interface AccountValues {username: string, email: string, password: string, long_token: boolean, totp_passcode?: string}
interface FormOptions {config: AuthConfig, navigate: (href: string) => void, submit: (values: AccountValues) => void}
const field = (name: 'username' | 'email', label: string, autocomplete: string) => html`<div class="field"><label class="label" for=${name}>${t(label)}</label><input class="input" id=${name} name=${name} type=${name === 'email' ? 'email' : 'text'} required autocomplete=${autocomplete} placeholder=${t(name === 'email' ? 'user.auth.emailPlaceholder' : 'user.auth.usernamePlaceholder')}><p class="help is-danger" id=${`${name}-error`} data-field-error=${name} role="alert" hidden></p></div>`
const password = (autocomplete: string, showReset = false) => html`<div class="field"><div class="label-with-link"><label class="label" for="password">${t('user.auth.password')}</label>${showReset ? html`<a href="/get-password-reset" class="reset-password-link" data-route>${t('user.auth.forgotPassword')}</a>` : nothing}</div><div class="password-field"><input class="input" id="password" name="password" type="password" required autocomplete=${autocomplete} placeholder=${t('user.auth.passwordPlaceholder')}><button class="base-button base-button--type-button password-field-type-toggle" type="button" data-toggle aria-label=${t('user.auth.showPassword')}>${listIcon('eye')}</button></div><p class="help is-danger" id="password-error" data-field-error="password" role="alert" hidden></p></div>`
const messages = () => html`<div data-success class="message success mbe-4" hidden role="status"></div><div data-error class="message danger mbe-4" hidden role="alert"></div>`
const loginLink = () => html`<a href="/login" class="base-button base-button--type-button button is-secondary" data-route>${t('user.auth.login')}</a>`
const ACCOUNT_UI = {form: 'form', username: '#username', email: '#email', password: '#password', submit: 'button[type=submit]', toggle: '[data-toggle]', error: '[data-error]', success: '[data-success]', challenge: '[data-challenge]', totp: '#totpPasscode', usernameError: '[data-field-error=username]', emailError: '[data-field-error=email]', passwordError: '[data-field-error=password]'}
const AccountFormView = View.extend({
	initialize(options: FormOptions) {void options},
	ui: ACCOUNT_UI,
	createState() {return {busy: false, touched: new Set<string>(), needsTotp: false, completed: false}},
	events: {'submit @ui.form': 'submit', 'input input': 'input', 'blur input': 'blur', 'click @ui.toggle': 'togglePassword', 'click [data-route]': 'navigate'},
	navigate(event: MouseEvent) {interceptLink(event, this.options.navigate)},
	value(name: string) {return (this.getUI(name)?.[0] as HTMLInputElement | undefined)?.value ?? ''},
	values(): AccountValues {return {username: this.value('username'), email: this.value('email'), password: this.value('password'), long_token: Boolean((this.getUI('form')?.[0] as HTMLFormElement | undefined)?.elements.namedItem('remember') && ((this.getUI('form')![0] as HTMLFormElement).elements.namedItem('remember') as HTMLInputElement).checked), ...(this.getState().needsTotp ? {totp_passcode: this.value('totp')} : {})}},
	onAttach() {const name = this.getUI('username')?.length ? 'username' : this.getUI('email')?.length ? 'email' : 'password'; (this.getUI(name)?.[0] as HTMLInputElement | undefined)?.focus(); this.refreshSubmit()},
	submit(event: SubmitEvent) {event.preventDefault(); if (this.getState().busy || this.getState().completed || !this.validate()) return; this.options.submit(this.values())},
	validate() {return true},
	fieldValidation(name: string): string {void name; return ''},
	fieldError(name: string, message: string) {const node = this.getUI(`${name}Error`)?.[0] as HTMLElement | undefined, input = this.getUI(name)?.[0] as HTMLInputElement | undefined; if (node) {node.hidden = !message; node.textContent = message}; if (input) {input.setAttribute('aria-invalid', String(Boolean(message))); if (message) input.setAttribute('aria-describedby', `${name}-error`); else input.removeAttribute('aria-describedby')}},
	input(event: InputEvent) {const name = (event.target as HTMLInputElement).name; this.fieldError(name, this.getState().touched.has(name) ? this.fieldValidation(name) : ''); this.refreshSubmit()},
	blur(event: FocusEvent) {if ((event.relatedTarget as HTMLElement | null)?.matches('[data-provider]')) return; const name = (event.target as HTMLInputElement).name; this.getState().touched.add(name); this.fieldError(name, this.fieldValidation(name)); this.refreshSubmit()},
	refreshSubmit() {const button = this.getUI('submit')?.[0] as HTMLButtonElement | undefined; if (button) button.disabled = this.getState().busy},
	setLoading(busy: boolean) {this.getState().busy = busy; const button = this.getUI('submit')?.[0] as HTMLButtonElement | undefined; button?.classList.toggle('is-loading', busy); this.refreshSubmit(); if (busy) this.feedback('')},
	feedback(error: string, success?: string) {for (const [name, value] of [['error', error], ['success', success]] as const) {if (value === undefined) continue; const element = this.getUI(name)?.[0] as HTMLElement | undefined; if (element) {element.hidden = !value; element.textContent = value}}},
	completed(message: string) {this.getState().completed = true; this.feedback('', message); (this.getUI('form')![0] as HTMLElement).hidden = true; this.showLogin()},
	updateConfiguration(config: AuthConfig) {const form = this.getUI('form')?.[0] as HTMLFormElement | undefined, fields = [...(form?.querySelectorAll('input') ?? [])].map(input => ({name: input.name, value: input.value, checked: input.checked, start: input.selectionStart, end: input.selectionEnd})), focused = document.activeElement instanceof HTMLInputElement ? document.activeElement.name : ''; this.options.config = config; this.render(); for (const field of fields) {const input = (this.getUI('form')?.[0] as HTMLFormElement | undefined)?.elements.namedItem(field.name); if (input instanceof HTMLInputElement) {input.value = field.value; input.checked = field.checked; if (field.name === focused) {input.focus(); if (field.start !== null && field.end !== null) input.setSelectionRange(field.start, field.end)}}}; if (this.getState().needsTotp) this.requireTotp(); this.refreshSubmit()},
	showLogin() {},
	requireTotp() {this.getState().needsTotp = true; (this.getUI('challenge')![0] as HTMLElement).hidden = false; const input = this.getUI('totp')![0] as HTMLInputElement; input.required = true; input.focus()},
	togglePassword() {const input = this.getUI('password')![0] as HTMLInputElement, button = this.getUI('toggle')![0] as HTMLButtonElement; input.type = input.type === 'password' ? 'text' : 'password'; button.setAttribute('aria-label', t(input.type === 'password' ? 'user.auth.showPassword' : 'user.auth.hidePassword'))},
}).setDomApi(LitDomApi)
export const LoginFormView = AccountFormView.extend({
	events: {...AccountFormView.prototype.events, 'click [data-provider]': 'provider'},
	provider(event: MouseEvent) {const key = ((event as MouseEvent & {delegateTarget: HTMLElement}).delegateTarget).dataset.provider; const provider = openIdProviders(this.options.config).find(p => p.key === key); if (provider && !this.getState().busy) redirectToProvider(provider)},
	templateContext() {return {config: this.options.config}},
	template: ({config}: {config: AuthConfig}) => html`${messages()}${config.auth?.local?.enabled || config.auth?.ldap?.enabled ? html`<form id="loginform" novalidate>${field('username', 'user.auth.usernameEmail', 'username')}${password('current-password', Boolean(config.auth?.local?.enabled))}<div class="field" data-challenge hidden><label class="label" for="totpPasscode">${t('user.auth.totpTitle')}</label><input class="input" id="totpPasscode" name="totp" autocomplete="one-time-code" inputmode="numeric" placeholder=${t('user.auth.totpPlaceholder')}></div><label class="checkbox"><input type="checkbox" name="remember"> ${t('user.auth.remember')}</label><div><button type="submit" class="base-button base-button--type-button button">${t('user.auth.login')}</button></div>${config.auth?.local?.registration_enabled ? html`<p class="mbs-2">${t('user.auth.noAccountYet')} <a href="/register" class="inline-link" data-route>${t('user.auth.createAccount')}</a></p>` : nothing}</form>` : nothing}${!isDesktopApp() && openIdProviders(config).length ? html`<div class="mbs-4">${openIdProviders(config).map(p => html`<button type="button" class="base-button base-button--type-button button is-outlined is-fullwidth mbs-2" data-provider=${p.key}>${t('user.auth.loginWith', {provider: p.name})}</button>`)}</div>` : nothing}`,
	fieldValidation(name: string) {if (name === 'username') return this.value(name) ? '' : t('user.auth.usernameRequired'); if (name === 'password') {const result = validatePassword(this.value(name), false); return result === true ? '' : t(result)}; return ''},
	validate() {const valid = ['username', 'password'].every(name => !this.fieldValidation(name)); for (const name of ['username', 'password']) this.fieldError(name, this.fieldValidation(name)); if (this.getState().needsTotp && !this.value('totp')) {this.requireTotp(); return false}; return valid},
})
export const RegistrationFormView = AccountFormView.extend({
	templateContext() {return {config: this.options.config}},
	template: ({config}: {config: AuthConfig}) => html`${messages()}${config.auth?.local?.registration_enabled ? html`<form id="registerform" novalidate>${field('username', 'user.auth.username', 'username')}${field('email', 'user.auth.email', 'email')}${password('new-password')}<button id="register-submit" type="submit" class="base-button base-button--type-button button mie-2">${t('user.auth.createAccount')}</button>${config.demo_mode_enabled ? html`<div class="message warning mbs-4">${t('demo.title')} ${t('demo.accountWillBeDeleted')}<br><strong class="is-uppercase">${t('demo.everythingWillBeDeleted')}</strong></div>` : nothing}<p class="mbs-2">${t('user.auth.alreadyHaveAnAccount')} <a href="/login" class="inline-link" data-route>${t('user.auth.login')}</a></p></form>` : html`<div class="message warning">${t('user.auth.registrationDisabled')}</div>`}`,
	fieldValidation(name: string) {const value = this.value(name); if (name === 'username') return !value ? t('user.auth.usernameRequired') : value.includes(' ') ? t('user.auth.usernameMustNotContainSpace') : value.includes('://') || value.includes('.') ? t('user.auth.usernameMustNotLookLikeUrl') : ''; if (name === 'email') return isEmail(value) ? '' : t('user.auth.emailInvalid'); if (name === 'password') {const result = validatePassword(value); return result === true ? '' : t(result)}; return ''},
	validate() {let valid = true; for (const name of ['username', 'email', 'password']) {const message = this.fieldValidation(name); this.fieldError(name, message); if (message) valid = false}; return valid},
	refreshSubmit() {const button = this.getUI('submit')?.[0] as HTMLButtonElement | undefined; if (button) button.disabled = this.getState().busy || ['username', 'email', 'password'].some(name => Boolean(this.fieldValidation(name)))},
})
export const ResetRequestFormView = AccountFormView.extend({
	ui: {...ACCOUNT_UI, login: '[data-success-login]'},
	template: () => html`${messages()}<div data-success-login class="has-text-centered mbe-4" hidden>${loginLink()}</div><form novalidate>${field('email', 'user.auth.email', 'email')}<div class="is-flex"><button type="submit" class="base-button base-button--type-button button">${t('user.auth.resetPasswordAction')}</button>${loginLink()}</div></form>`,
	fieldValidation(name: string) {return name === 'email' && !isEmail(this.value(name)) ? t('user.auth.emailInvalid') : ''},
	validate() {const message = this.fieldValidation('email'); this.fieldError('email', message); return !message},
	showLogin() {(this.getUI('login')![0] as HTMLElement).hidden = false},
})
export const ResetPasswordFormView = AccountFormView.extend({
	onRender() {(this.getUI('error')![0] as HTMLElement).classList.replace('danger', 'info')},
	ui: {...ACCOUNT_UI, login: '[data-success-login]'},
	template: () => html`${messages()}<div data-success-login class="has-text-centered mbe-4" hidden>${loginLink()}</div><form id="form" novalidate>${password('new-password')}<button type="submit" class="base-button base-button--type-button button">${t('user.auth.resetPassword')}</button></form>`,
	fieldValidation(name: string) {if (name === 'password') {const result = validatePassword(this.value(name)); return result === true ? '' : t(result)}; return ''},
	validate() {const result = validatePassword(this.value('password'), false); this.fieldError('password', result === true ? '' : t(result)); return result === true},
	showLogin() {(this.getUI('login')![0] as HTMLElement).hidden = false},
})
export type AccountForm = InstanceType<typeof AccountFormView>
