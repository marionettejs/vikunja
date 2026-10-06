import {Application, type LifecycleContext} from 'marionette'
import {Model} from '@mnjs/data'
import {HTTPFactory, AuthenticatedHTTPFactory} from '@/helpers/fetcher'
import {getToken, saveToken, removeToken, refreshToken, getTokenIdentity, getTokenType, getTokenPayload} from '@/helpers/auth'
import {AUTH_TYPES} from '@/modelTypes/IUser'
import UserModel from '@/models/user'
import {clearTaskCache} from '@/helpers/taskCache'
import {getRedirectUrlFromCurrentFrontendPath} from '@/helpers/redirectToProvider'
import {openIdProviders} from '../features/auth/openid-config'
import {setLanguage} from '../shared/i18n'
export const SessionApplication = Application.extend({
	initialize() { this.appearanceChanged = this.appearanceChanged.bind(this); this.storageChanged = this.storageChanged.bind(this); this.listenTo(this.getState(), 'change:user', this.appearanceChanged) },
	storageChanged(event: StorageEvent) { if (this.getState().get('user')?.type === AUTH_TYPES.LINK_SHARE) return; if (event.key !== 'token' && event.key !== null) return; const revision = Number(this.getState().get('transition') ?? 0) + 1; this.getState().set('transition', revision); const token = event.key === null ? null : event.newValue, previous = getTokenIdentity(getToken()); if (token) saveToken(token, false); else { removeToken(); clearTaskCache(); this.getState().set({user: null, status: 'anonymous'}); this.trigger('signed:out'); return }; if (JSON.stringify(previous) === JSON.stringify(getTokenIdentity(token))) return; clearTaskCache(); this.trigger('identity:changing'); void this.restart().then(() => { if (this.getState().get('transition') === revision) this.trigger('signed:in') }).catch(() => { if (this.getState().get('transition') !== revision) return; removeToken(); this.getState().set({user: null, status: 'anonymous'}); this.trigger('signed:out') }) },
	createState(): Model<{transition: number, user: UserModel | null, config: Record<string, unknown>, shareHash: string, shareProjectId: number, logoVisible: boolean, status: 'loading' | 'authenticated' | 'anonymous' | 'unavailable'}> { return new Model({transition: 0, user: null as UserModel | null, config: {} as Record<string, unknown>, shareHash: '', shareProjectId: 0, logoVisible: true, status: 'loading' as 'loading' | 'authenticated' | 'anonymous' | 'unavailable'}) },
	async prepareStart(options: {sharePending?: boolean} | undefined, {signal}: LifecycleContext) {
		const {data: config} = await HTTPFactory().get('info', {signal})
		if (options?.sharePending) return {user: null, config, status: 'anonymous' as const}
		if (!getToken()) { try { await refreshToken(true) } catch { /* No refresh cookie is the normal logged-out case. */ } }
		signal.throwIfAborted()
		if (!getToken()) return {user: null, config, status: 'anonymous' as const}
		if (getTokenType(getToken()) === AUTH_TYPES.LINK_SHARE) return {user: new UserModel(getTokenPayload(getToken()) ?? {}), config, status: 'authenticated' as const}
		const {data} = await AuthenticatedHTTPFactory().get('user', {signal})
		const user = new UserModel({...data, type: AUTH_TYPES.USER})
		await setLanguage(user.settings.language || 'en', signal)
		return {user, config, status: 'authenticated' as const}
	},
	onBeforeStart() { this.getState().set('status', 'loading') },
	appearanceChanged() {this.applyAppearance()},
	applyAppearance() {const setting = this.getState().get('user')?.settings.frontendSettings.colorSchema ?? 'auto', dark = setting === 'dark' || (setting === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.classList.toggle('dark', dark); document.documentElement.classList.toggle('light', !dark)},
	onStart(_app: unknown, _options: unknown, result: {user: UserModel | null, config: Record<string, unknown>, status: 'anonymous' | 'authenticated'}) { this.getState().set(result); this.applyAppearance(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.appearanceChanged) },
	onBeforeStop() {matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.appearanceChanged)},
	async authenticateShare(hash: string, password: string, logoVisible: boolean, signal: AbortSignal) {
		const {data} = await HTTPFactory().post(`shares/${encodeURIComponent(hash)}/auth`, {password}, {signal})
		signal.throwIfAborted()
		const payload = getTokenPayload(data.token)
		if (payload?.type !== AUTH_TYPES.LINK_SHARE) throw new Error('Invalid share authentication response')
		if (JSON.stringify(getTokenIdentity(getToken())) !== JSON.stringify(getTokenIdentity(data.token))) clearTaskCache()
		saveToken(data.token, false)
		this.getState().set({user: new UserModel(payload), status: 'authenticated', shareHash: hash, shareProjectId: Number(data.project_id), logoVisible})
		return {projectId: Number(data.project_id)}
	},
	async login(values: {username: string, password: string, long_token: boolean, totp_passcode?: string}, signal: AbortSignal) {
		const revision = Number(this.getState().get('transition') ?? 0)
		const {data} = await HTTPFactory().post('login', {username: values.username, password: values.password, long_token: values.long_token, ...(values.totp_passcode !== undefined ? {totp_passcode: values.totp_passcode} : {})}, {signal})
		await this.acceptIdentity(data.token, revision, signal)
		localStorage.removeItem('loggedInViaProvider')
	},
	async openId(providerKey: string, code: string, totpPasscode: string | undefined, signal: AbortSignal) {
		const revision = Number(this.getState().get('transition') ?? 0)
		const provider = openIdProviders(this.getState().get('config')).find(p => p.key === providerKey)
		if (!provider) throw new Error('Provider does not exist')
		const {data} = await HTTPFactory().post(`auth/openid/${encodeURIComponent(providerKey)}/callback`, {code, redirect_url: getRedirectUrlFromCurrentFrontendPath(provider), ...(totpPasscode ? {totp_passcode: totpPasscode} : {})}, {signal})
		await this.acceptIdentity(data.token, revision, signal)
		localStorage.setItem('loggedInViaProvider', providerKey)
	},
	async acceptIdentity(token: string, revision: number, signal: AbortSignal) {
		signal.throwIfAborted()
		const {data: identity} = await HTTPFactory().get('user', {signal, headers: {Authorization: `Bearer ${token}`}})
		signal.throwIfAborted()
		if (this.getState().get('transition') !== revision) throw new DOMException('Identity changed during login', 'AbortError')
		const user = new UserModel({...identity, type: AUTH_TYPES.USER})
		await setLanguage(user.settings.language || 'en', signal)
		signal.throwIfAborted()
		if (this.getState().get('transition') !== revision) throw new DOMException('Identity changed during login', 'AbortError')
		if (JSON.stringify(getTokenIdentity(getToken())) !== JSON.stringify(getTokenIdentity(token))) clearTaskCache()
		saveToken(token, true)
		this.getState().set({user, status: 'authenticated', shareHash: '', shareProjectId: 0}); this.applyAppearance()
	},
	async register(values: {username: string, email: string, password: string}, language: string, signal: AbortSignal) {
		const credentials = {username: values.username, email: values.email, password: values.password}
		try {await HTTPFactory().post('register', {...credentials, language}, {signal})}
		catch (error) {
			signal.throwIfAborted()
			const data = (error as {response?: {data?: {code?: number, invalid_fields?: string[]}}})?.response?.data
			if (language !== 'en' && data?.code === 2002 && data.invalid_fields?.[0]?.startsWith('language:')) await HTTPFactory().post('register', {...credentials, language: 'en'}, {signal})
			else throw error
		}
		signal.throwIfAborted()
		await this.login({username: values.username, password: values.password, long_token: false}, signal)
	},
	async confirmEmail(token: string, signal: AbortSignal, personal = false) {
		let hadPending = false
		if (personal) {const {data} = await AuthenticatedHTTPFactory().get('user', {signal}); signal.throwIfAborted(); hadPending = Boolean(data.pending_email)}
		await HTTPFactory().post('user/confirm', {token}, {signal})
		signal.throwIfAborted()
		if (!personal) return false
		const {data} = await AuthenticatedHTTPFactory().get('user', {signal})
		signal.throwIfAborted()
		this.getState().set('user', new UserModel({...data, type: AUTH_TYPES.USER}))
		return hadPending && !data.pending_email
	},
	async logout() {
		const providerKey = localStorage.getItem('loggedInViaProvider'), revision = Number(this.getState().get('transition')) + 1
		const request = HTTPFactory().post('user/logout', undefined, {headers: {Authorization: `Bearer ${getToken()}`}})
		this.getState().set('transition', revision); removeToken(); clearTaskCache(); this.getState().set({user: null, status: 'anonymous'})
		localStorage.removeItem('loggedInViaProvider'); sessionStorage.setItem('justLoggedOut', 'true'); this.trigger('signed:out')
		let logoutUrl = ''
		try {const {data} = await request; logoutUrl = data?.oidc_logout_url ?? ''} catch { /* Local logout remains effective when the server is unavailable. */ }
		if (this.getState().get('transition') !== revision) return
		logoutUrl ||= openIdProviders(this.getState().get('config')).find(p => p.key === providerKey)?.logoutUrl ?? ''
		if (logoutUrl) {sessionStorage.setItem('justLoggedOut', 'true'); location.href = logoutUrl}
	},
})
