import {PwaNoticesView} from './pwa-notices'
import {REDIRECT_HASH_PREFIX} from '@/constants/redirectHash'
import {
	Application,
	View,
	type LifecycleContext,
	type ApplicationOptions,
} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import { AUTH_TYPES } from '@/modelTypes/IUser'
import { saveLastVisited } from '@/helpers/saveLastVisited'
import { ShareAuthenticationApplication } from '../features/auth/sharing'
import { SessionApplication } from './session'
import type { WorkspaceApplication } from './workspace'
import { AuthenticationApplication, AuthenticationFrameView } from '../features/auth/application'
import {BootstrapLoadingView, BootstrapErrorView, OfflineView} from './bootstrap'
import {ApiConfigView} from './api-config'
import { parseRoute } from './routes'
import { reportError, errorText } from '../shared/notifications'
import {NoticeView} from '../shared/notice-view'
const RootView = View.extend({
	className: 'native-app',
	initialize(options: {connectionChanged: (online: boolean) => void}) {void options},
	createState() {return {life: new AbortController(), forceOnline: !navigator.onLine && Boolean(import.meta.env.VITE_IS_ONLINE)}},
	template: () => html`<div class="offline" style="height:0;width:0" aria-hidden="true"></div><div data-workspace style="display:contents"></div><div data-pwa style="display:contents"></div><div data-notices-region style="display:contents"></div>`,
	regions: { workspace: '[data-workspace]', pwa: '[data-pwa]', notices: '[data-notices-region]' },
	onAttach() {
		const state = this.getState(), changed = () => this.options.connectionChanged(state.forceOnline || navigator.onLine)
		window.addEventListener('online', changed, {signal: state.life.signal})
		window.addEventListener('offline', changed, {signal: state.life.signal})
		changed()
	},
	onBeforeDestroy() {this.getState().life.abort()},
}).setDomApi(LitDomApi)
export const VikunjaApplication = Application.extend({
	initialize(options: ApplicationOptions) {
		void options
		const session = this.addChildApp('session', new SessionApplication())
		this.addChildApp(
			'sharing',
			new ShareAuthenticationApplication({
				session,
				navigate: (href, replace) => this.navigate(href, replace),
			}),
		)
		this.addChildApp(
			'authentication',
			new AuthenticationApplication({
				session,
				navigate: (href, replace) => this.navigate(href, replace),
			}),
		)
		this.listenTo(session, 'identity:changing', () => {
			this.getState().epoch++
			this.getChildApp('workspace')?.stop()
			this.getState().destination = ''
		})
		this.listenTo(session, 'signed:in', () => {
			this.getChildApp('workspace')?.stop()
			this.getState().destination = ''
			this.navigate('/', true)
		})
		this.listenTo(session, 'signed:out', () => {
			this.getChildApp('workspace')?.stop()
			this.navigate('/login', true)
		})
	},
	createState() {
		return {
			online: true,
			epoch: 0,
			navigation: 0,
			destination: '',
			popstate: () => {
				void this.dispatch()
			},
			storage: (event: StorageEvent) =>
				(
					this.getChildApp('session') as InstanceType<typeof SessionApplication>
				).storageChanged(event),
		}
	},
	onBeforeStart() {
		const root = this.setView(new RootView({connectionChanged: (online: boolean) => this.connectionChanged(online)}))
		root.showChildView('workspace', new BootstrapLoadingView())
		this.showView()
	},
	connectionChanged(online: boolean) {
		const state = this.getState()
		if (state.online === online) return
		state.online = online
		state.epoch++
		state.navigation++
		state.destination = ''
		const root = this.getView() as InstanceType<typeof RootView>
		if (!online) {
			for (const name of ['workspace', 'sharing', 'authentication']) this.getChildApp(name)?.stop()
			root.getRegion('pwa')!.empty()
			root.getRegion('notices')!.empty()
			root.showChildView('workspace', new OfflineView())
		} else if (this.isRunning()) {
			root.showChildView('workspace', new BootstrapLoadingView())
			root.showChildView('pwa', new PwaNoticesView({}))
			root.showChildView('notices', new NoticeView())
			void this.dispatch()
		} else {
			root.showChildView('workspace', new BootstrapLoadingView())
			void this.start().catch(console.error)
		}
	},
	async prepareStart(_options: unknown, { signal }: LifecycleContext) {
		const url = new URL(location.href)
		try {
			await this.getChildApp('session')!.start({
				sharePending:
					url.hash.startsWith('#share-auth-token=') ||
					parseRoute(url).kind === 'share-auth',
			})
			signal.throwIfAborted()
		} catch (error) {
			if (!signal.aborted && this.getState().online) {
				const frame = new AuthenticationFrameView({title: '', config: {}})
				frame.showChildView('form', new BootstrapErrorView({error: errorText(error)}))
				frame.showChildView('api', new ApiConfigView({
					configureOpen: true,
					canChange: () => !signal.aborted,
					busy: () => {},
					accepted: () => {void this.start().catch(console.error)},
				}))
				;(this.getView() as InstanceType<typeof RootView>).showChildView('workspace', frame)
			}
			throw error
		}
	},
	onStart() {
		if (this.getState().online) {
			const root = this.getView() as InstanceType<typeof RootView>
			root.showChildView('pwa', new PwaNoticesView({}))
			root.showChildView('notices', new NoticeView())
		}
		window.addEventListener('popstate', this.getState().popstate)
		window.addEventListener('storage', this.getState().storage)
		void this.dispatch()
	},
	navigate(href: string, replace = false) {
		void this.commitNavigation(href, replace)
	},
	async commitNavigation(href: string, replace: boolean) {
		const state = this.getState(),
			navigation = ++state.navigation,
			workspace = this.getChildApp('workspace') as InstanceType<
				typeof WorkspaceApplication
			>,
			session = this.getChildApp('session') as InstanceType<
				typeof SessionApplication
			>
		try {
			if (
				workspace?.isRunning() &&
				session.getState().get('status') === 'authenticated'
			)
				await workspace.flushForNavigation()
			if (navigation !== state.navigation || !this.isRunning()) return
			if (
				session.getState().get('user')?.type === AUTH_TYPES.LINK_SHARE &&
				/^\/(?:projects|tasks)\//.test(href) &&
				!href.includes('#')
			)
				href += `#share-auth-token=${encodeURIComponent(session.getState().get('shareHash') ?? '')}`
			if (href !== location.pathname + location.search + location.hash)
				history[replace ? 'replaceState' : 'pushState'](replace ? history.state ?? {} : {back: location.pathname + location.search + location.hash}, '', href)
			await this.dispatch()
		} catch (error) {
			if (navigation === state.navigation) reportError(error)
		}
	},
	async dispatch() {
		if (!this.getState().online) return
		const state = this.getState(),
			epoch = ++state.epoch,
			session = this.getChildApp('session') as InstanceType<
				typeof SessionApplication
			>,
			region = (this.getView() as InstanceType<typeof RootView>).getRegion(
				'workspace',
			)!
		if (session.getState().get('status') === 'loading') return
		if(location.pathname.startsWith('/lists')){const legacy=new URL(location.href);legacy.pathname=legacy.pathname.replace('/lists','/projects');history.replaceState({},'',legacy.pathname+legacy.search+legacy.hash)}
		let route = parseRoute(new URL(location.href))
		const url = new URL(location.href),
			shareHash = url.hash.startsWith('#share-auth-token=')
				? decodeURIComponent(url.hash.slice('#share-auth-token='.length))
				: undefined
		if (
			shareHash &&
			(session.getState().get('user')?.type !== AUTH_TYPES.LINK_SHARE ||
				session.getState().get('shareHash') !== shareHash)
		) {
			if (route.kind === 'task' || route.kind === 'project')
				saveLastVisited(
					route.kind === 'task' ? 'task.detail' : 'project.view',
					route.params,
					route.query,
				)
			history.replaceState(
				{},
				'',
				`/share/${encodeURIComponent(shareHash)}/auth`,
			)
			route = parseRoute(new URL(location.href))
		}
		if (route.kind === 'settings' && route.path === '/user/settings') {
			history.replaceState({}, '', '/user/settings/general')
			route = parseRoute(new URL(location.href))
		}
		const personal = session.getState().get('user')?.type === AUTH_TYPES.USER
		if (route.kind === 'login' && url.hash.startsWith(REDIRECT_HASH_PREFIX)) {
			try {
				const target = new URL(decodeURIComponent(url.hash.slice(REDIRECT_HASH_PREFIX.length)), url.origin),
					destination = parseRoute(target)
				if (destination.kind === 'oauth') {
					saveLastVisited('oauth.authorize', destination.params, destination.query)
					if (personal) {
						history.replaceState({}, '', target.pathname + target.search)
						route = destination
					}
				}
			} catch { /* Invalid copied destination remains on login. */ }
		}
		if (!personal && session.getState().get('status') === 'anonymous' && route.kind === 'oauth') {
			saveLastVisited('oauth.authorize', route.params, route.query)
			history.replaceState({}, '', '/login' + REDIRECT_HASH_PREFIX + encodeURIComponent(url.pathname + url.search))
			route = parseRoute(new URL(location.href))
		}

		if (session.getState().get('status') === 'anonymous') {
			const reset = route.query.userPasswordReset,
				confirm = route.query.userEmailConfirm
			if (
				typeof reset === 'string' &&
				reset &&
				route.kind !== 'password-reset'
			) {
				history.replaceState(
					{},
					'',
					`/password-reset?userPasswordReset=${encodeURIComponent(reset)}`,
				)
				route = parseRoute(new URL(location.href))
			} else if (route.kind === 'password-reset' && typeof reset !== 'string') {
				history.replaceState({}, '', '/login')
				route = parseRoute(new URL(location.href))
			}
			if (typeof confirm === 'string' && confirm) {
				localStorage.setItem('emailConfirmToken', confirm)
				if (route.kind !== 'login') {
					history.replaceState(
						{},
						'',
						`/login?userEmailConfirm=${encodeURIComponent(confirm)}`,
					)
					route = parseRoute(new URL(location.href))
				}
			}
		}
		const entry = [
			'login',
			'register',
			'password-request',
			'password-reset',
			'openid',
		].includes(route.kind)
		if (
			personal &&
			['login', 'register'].includes(route.kind) &&
			!route.query.userEmailConfirm &&
			!localStorage.getItem('emailConfirmToken')
		) {
			history.replaceState({}, '', '/')
			route = parseRoute(new URL(location.href))
		}
		if (
			personal &&
			typeof route.query.userEmailConfirm === 'string' &&
			route.query.userEmailConfirm &&
			route.kind !== 'login'
		) {
			history.replaceState(
				{},
				'',
				`/login?userEmailConfirm=${encodeURIComponent(route.query.userEmailConfirm)}`,
			)
			route = parseRoute(new URL(location.href))
		}
		if (
			session.getState().get('status') === 'anonymous' &&
			!entry &&
			route.kind !== 'share-auth'
		) {
			if (route.kind === 'task' || route.kind === 'project')
				saveLastVisited(
					route.kind === 'task' ? 'task.detail' : 'project.view',
					route.params,
					route.query,
				)
			history.replaceState({}, '', '/login')
			route = parseRoute(new URL(location.href))
		}
		const kind =
			route.kind === 'share-auth'
				? 'sharing'
				: ['login', 'register', 'password-request', 'password-reset', 'openid'].includes(
					route.kind,
					  )
					? 'authentication'
					: 'workspace'
		try {
			if (state.destination !== kind) {
				this.getChildApp(state.destination)?.stop()
				state.destination = kind
			}
			if (kind === 'workspace' && !this.getChildApp(kind)) {
				region.show(new BootstrapLoadingView())
				const {WorkspaceApplication} = await import('./workspace')
				if (epoch !== state.epoch || !this.isRunning()) return
				if (!this.getChildApp(kind)) this.addChildApp(kind, new WorkspaceApplication({session, navigate: (href, replace) => this.navigate(href, replace)}))
			}
			const child = this.getChildApp(kind)!
			if (
				(kind === 'sharing' || kind === 'authentication') &&
				child.isRunning() &&
				(
					child as InstanceType<typeof ShareAuthenticationApplication>
				).getState().route?.key !== route.key
			)
				child.stop()
			await child.start({ ...route, region })
			if (epoch !== state.epoch || !this.isRunning()) return
			if (kind === 'workspace')
				await (child as InstanceType<typeof WorkspaceApplication>).showRoute(
					route,
				)
		} catch (error) {
			if (epoch === state.epoch) {
				state.destination = ''
				reportError(error)
				console.error(error)
			}
		}
	},
	onBeforeStop() {
		this.getState().epoch++
		this.getState().navigation++
		window.removeEventListener('popstate', this.getState().popstate)
		window.removeEventListener('storage', this.getState().storage)
		this.getState().destination = ''
	},
})
