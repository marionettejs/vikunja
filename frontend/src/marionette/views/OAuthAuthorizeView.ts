import {html, nothing} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface OAuthAuthorizeViewOptions {
	t: (key: string, params?: Record<string, string>) => string
	loading: boolean
	errorMessage: string
	redirectedToApp: boolean
}

interface TemplateData {
	t: (key: string, params?: Record<string, string>) => string
	loading: boolean
	errorMessage: string
	redirectedToApp: boolean
	AUTHENTICATING: string
	OAUTH_REDIRECTED_TO_APP: string
}

interface OAuthAuthorizeViewContext extends ViewInstance {
	_loading: boolean
	_errorMessage: string
	_redirectedToApp: boolean
	_t: (key: string, params?: Record<string, string>) => string
	_options(): OAuthAuthorizeViewOptions
	setLoading(loading: boolean): void
	setErrorMessage(message: string): void
	setRedirectedToApp(redirected: boolean): void
}

const AUTHENTICATING = 'user.auth.authenticating'
const OAUTH_REDIRECTED_TO_APP = 'user.auth.oauthRedirectedToApp'

export const OAuthAuthorizeView = View.extend({
	className: 'oauth-authorize',

	_loading: true,
	_errorMessage: '',
	_redirectedToApp: false,
	_t: (key: string) => key,

	initialize(this: OAuthAuthorizeViewContext) {
		const opts = this._options()
		this._t = opts.t
		this._loading = Boolean(opts.loading)
		this._errorMessage = opts.errorMessage
		this._redirectedToApp = Boolean(opts.redirectedToApp)
	},

	templateContext(this: OAuthAuthorizeViewContext): TemplateData {
		return {
			t: this._t,
			loading: this._loading,
			errorMessage: this._errorMessage,
			redirectedToApp: this._redirectedToApp,
			AUTHENTICATING,
			OAUTH_REDIRECTED_TO_APP,
		}
	},

	template(data: TemplateData) {
		const {t, loading, errorMessage, redirectedToApp, AUTHENTICATING, OAUTH_REDIRECTED_TO_APP} = data

		return html`
			${errorMessage
			? html`
					<div class="message danger" role="alert">
						${errorMessage}
					</div>
				`
			: nothing}
			${redirectedToApp && !errorMessage
				? html`
					<div class="message" role="status">
						${t(OAUTH_REDIRECTED_TO_APP)}
					</div>
				`
				: nothing}
			${loading && !errorMessage && !redirectedToApp
					? html`
					<div class="message" role="status">
						${t(AUTHENTICATING)}
					</div>
				`
					: nothing}
		`
	},

	onRender(this: OAuthAuthorizeViewContext) {
	},

	onBeforeDestroy(this: OAuthAuthorizeViewContext) {
	},

	_options(this: OAuthAuthorizeViewContext): OAuthAuthorizeViewOptions {
		return this.options as OAuthAuthorizeViewOptions
	},

	setLoading(this: OAuthAuthorizeViewContext, loading: boolean): void {
		this._loading = loading
		this.render()
	},

	setErrorMessage(this: OAuthAuthorizeViewContext, message: string): void {
		this._errorMessage = message
		this.render()
	},

	setRedirectedToApp(this: OAuthAuthorizeViewContext, redirected: boolean): void {
		this._redirectedToApp = redirected
		this.render()
	},
}) as new (options: OAuthAuthorizeViewOptions) => OAuthAuthorizeViewContext & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setRedirectedToApp: (redirected: boolean) => void
}

export type OAuthAuthorizeViewInstance = ViewInstance & {
	setLoading: (loading: boolean) => void
	setErrorMessage: (message: string) => void
	setRedirectedToApp: (redirected: boolean) => void
}