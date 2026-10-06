import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import { AuthenticatedHTTPFactory } from '@/helpers/fetcher'
import type { Route } from '../../app/routes'
import { t } from '../../shared/i18n'
import { errorText } from '../../shared/notifications'
const required = [
	'response_type',
	'client_id',
	'redirect_uri',
	'code_challenge',
	'code_challenge_method',
] as const
export const OAuthApplication = Application.extend({
	initialize(options: { current: () => boolean }) {
		void options
	},
	onBeforeStart() {
		this.setView(new OAuthView({ loading: true }))
		this.showView()
	},
	createState() {
		return { route: undefined as Route | undefined }
	},
	async prepareStart(route: Route, { signal }: LifecycleContext) {
		this.getState().route = route
		const missing = required.filter((p) => !route.query[p])
		if (missing.length)
			return {
				error: new Error(
					t('user.auth.oauthMissingParams', { params: missing.join(', ') }),
				),
			}
		try {
			const response = await AuthenticatedHTTPFactory().post(
				'oauth/authorize',
				Object.fromEntries(
					[...required, 'state'].map((k) => [k, route.query[k]]),
				),
				{ signal },
			)
			signal.throwIfAborted()
			return response.data as {
				code: string;
				redirect_uri: string;
				state: string;
			}
		} catch (error) {
			signal.throwIfAborted()
			return { error }
		}
	},
	onStart(
		_app: unknown,
		route: Route,
		data: {
			error?: unknown;
			code?: string;
			redirect_uri?: string;
			state?: string;
		},
	) {
		if (!this.options.current() || this.getState().route !== route) return
		this.setView(new OAuthView({ error: data.error }))
		this.showView()
		if (!data.error && data.redirect_uri) {
			const url = new URL(data.redirect_uri)
			url.searchParams.set('code', data.code!)
			if (data.state) url.searchParams.set('state', data.state)
			window.location.href = url.toString()
		}
	},
})
const OAuthView = View.extend({
	className: 'native-import',
	initialize(options: { error?: unknown; loading?: boolean }) {
		void options
	},
	templateContext() {
		return this.options
	},
	template({ error, loading }: { error?: unknown; loading?: boolean }) {
		return html`<div
			class="message ${error ? 'danger' : 'info'}"
			role=${error ? 'alert' : 'status'}
		>
			${error
		? errorText(error)
		: t(
			loading
				? 'user.auth.authenticating'
				: 'user.auth.oauthRedirectedToApp',
		)}
		</div>`
	},
}).setDomApi(LitDomApi)
