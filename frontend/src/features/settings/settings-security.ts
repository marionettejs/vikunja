import { View, CollectionView } from 'marionette'
import { Collection, DataApi, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import ApiTokenService from '@/services/apiToken'
import SessionService from '@/services/session'
import CaldavTokenService from '@/services/caldavToken'
import CaldavTokenModel from '@/models/caldavToken'
import type UserModel from '@/models/user'
import type { IApiToken } from '@/modelTypes/IApiToken'
import type { ISession } from '@/modelTypes/ISession'
import type { ICaldavToken } from '@/modelTypes/ICaldavToken'
import { getToken, getTokenPayload } from '@/helpers/auth'
import { getApiBaseUrl } from '@/helpers/fetcher'
import { CALDAV_DOCS } from '@/urls'
import { TokenEditorView } from './settings-token-editor'
import { TotpSettingsView } from './settings-totp'
import { ConfirmationView } from '../projects/project-sharing'
import {
	readSecurity,
	securityTitle,
	type SecurityData,
	type SecurityPage,
} from './settings-security-data'
import { displayDate, formatDateShort } from '../../shared/dates'
import { interceptLink, type Route } from '../../app/routes'
import { translatedParts, listIcon } from '@/shared/task-list/list-ui'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import './settings-security.scss'
type RecordItem = IApiToken | ISession | ICaldavToken;
interface Options {
	route: Route;
	data: SecurityData;
	user: UserModel;
	current: () => boolean;
	navigate: (href: string) => void;
	logout: () => Promise<void>;
}
const formatPermission = (value: string) => value.replace(/_/g, ' ')
const AccountRowView = View.extend({
	initialize(options: {
		model: Model;
		page: SecurityPage;
		user: UserModel;
		currentSessionId: string;
		remove: (record: RecordItem) => void;
	}) {
		void options
	},
	tagName: 'tr',
	ui: { remove: '[data-delete]' },
	events: { 'click @ui.remove': 'remove' },
	templateContext() {
		return { ...this.options, record: this.options.model.get('record') }
	},
	template({
		record,
		page,
		user,
		currentSessionId,
	}: {
		record: RecordItem;
		page: SecurityPage;
		user: UserModel;
		currentSessionId: string;
	}) {
		const api = record as IApiToken,
			session = record as ISession
		return html`${page === 'api-tokens'
			? html`<td>${api.id}</td>
						<td>${api.title}</td>
						<td class="is-capitalized">
							${Object.entries(api.permissions ?? {}).map(
		([group, permissions]) =>
			html`<strong>${formatPermission(group)}:</strong>
										${permissions.map(formatPermission).join(', ')}<br />`,
	)}
						</td>
						<td>
							${displayDate(
		api.expiresAt,
		user.settings.frontendSettings,
	)}${api.expiresAt < new Date()
	? html`<p class="has-text-danger">
										${t('user.settings.apiTokens.expired', {
		ago: displayDate(api.expiresAt),
	})}
									</p>`
	: nothing}
						</td>
						<td>
							${displayDate(api.created, user.settings.frontendSettings)}
						</td>`
			: page === 'sessions'
				? html`<td>
								${session.deviceInfo}${session.id === currentSessionId
	? html`<span class="tag is-primary mis-2"
											>${t('user.settings.sessions.current')}</span
										>`
	: nothing}
							</td>
							<td>${session.ipAddress}</td>
							<td>${displayDate(session.lastActive)}</td>`
				: html`<td>${record.id}</td>
							<td>${formatDateShort(record.created)}</td>`}
			<td class="has-text-end">
				${page === 'sessions' && session.id === currentSessionId
		? nothing
		: html`<button data-delete type="button" class="button is-outlined">
							${t('misc.delete')}
						</button>`}
			</td>`
	},
	remove() {
		this.options.remove(this.options.model.get('record') as RecordItem)
	},
}).setDomApi(LitDomApi)
const AccountRowsView = CollectionView.extend({
	tagName: 'tbody',
	childView: AccountRowView,
}).setDataApi(DataApi)
export const SecuritySettingsView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'native-settings-security',
	regions: {
		rows: { el: '[data-rows]', replaceElement: true },
		editor: '[data-editor]',
		totp: '[data-totp]',
		confirmation: '[data-confirmation]',
	},
	ui: {
		error: '[data-error]',
		retry: '[data-retry]',
		table: '[data-table]',
		empty: '[data-empty]',
		create: '[data-create]',
		caldavCreate: '[data-caldav-create]',
		secret: '[data-secret]',
		url: '[data-url]',
		content: '[data-content]',
		copy: '[data-copy]',
	},
	events: {
		'click @ui.create': 'create',
		'click @ui.caldavCreate': 'caldavCreate',
		'click @ui.retry': 'retry',
		'click @ui.copy': 'copy',
	},
	createState() {
		return {
			collection: (new Collection() as Collection<Model>),
			data: this.options.data as SecurityData,
			read: undefined as AbortController | undefined,
			write: undefined as AbortController | undefined,
		}
	},
	templateContext() {
		return {
			...this.options,
			page: this.options.route.params.page,
			base: getApiBaseUrl().replace(/\/api\/v1\/?$/, ''),
		}
	},
	template({
		page,
		user,
		base,
		navigate,
	}: Options & { page: SecurityPage; base: string }) {
		const link = html`<a
				href="/user/settings/api-tokens"
				@click=${(event: MouseEvent) => interceptLink(event, navigate)}
				>${t('user.settings.apiTokens.title')}</a
			>`,
			feedLink = html`<a
				href=${`/user/settings/api-tokens?title=${encodeURIComponent(t('user.settings.feeds.tokenTitle'))}&scopes=feeds%3Aaccess`}
				@click=${(event: MouseEvent) => interceptLink(event, navigate)}
				>${t('user.settings.apiTokens.title')}</a
			>`
		return html`<div class="card">
			<header class="card-header">
				<p class="card-header-title">${t(securityTitle(page))}</p>
			</header>
			<div class="card-content loader-container" data-content>
				<div data-error class="message danger" role="alert" hidden></div>
				<button data-retry type="button" class="button is-outlined" hidden>
					${t('sharing.retry')}
				</button>
				${page === 'caldav'
		? nothing
		: html`<div
							data-secret
							class="message info has-text-centered mbe-4"
							role="status"
							hidden
						></div>`}
				${page === 'api-tokens'
		? html`<p>
							${t('user.settings.apiTokens.general')}
							<a href=${`${getApiBaseUrl().replace(/\/$/, '')}/docs`}
								>${t('user.settings.apiTokens.apiDocs')}</a
							>.
						</p>`
		: page === 'sessions'
			? html`<p class="mbe-4">
								${t('user.settings.sessions.description')}
							</p>`
			: page === 'caldav' || page === 'feeds'
				? html`<p>${t(`user.settings.${page}.howTo`)}</p>
									<div class="field has-addons">
										<div class="control is-expanded">
											<input
												class="input"
												data-url
												readonly
												.value=${page === 'feeds'
		? `${base}/feeds/notifications.atom`
		: `${base}/dav/principals/${user.username}/`}
											/>
										</div>
										<div class="control">
											<button
												type="button"
												data-copy
												class="button"
												aria-label=${t('misc.copy')}
											>
												${listIcon('paste')}
											</button>
										</div>
									</div>
									${page === 'caldav'
		? html`<h5 class="mbs-5 mbe-4 has-text-weight-bold">
													${t('user.settings.caldav.tokens')}
												</h5>
												<p>
													${t(
		user.isLocalUser
			? 'user.settings.caldav.tokensHowTo'
			: 'user.settings.caldav.mustUseToken',
	)}<br />${translatedParts(
	t,
	'user.settings.caldav.usernameIs',
	[html`<strong>${user.username}</strong>`],
)}
												</p>
												<p class="mbs-2">
													${translatedParts(
		t,
		'user.settings.caldav.apiTokenHint',
		{ link },
	)}
												</p>`
		: html`<p class="mbs-4">
													${translatedParts(
		t,
		'user.settings.feeds.usernameIs',
		[html`<strong>${user.username}</strong>`],
	)}
												</p>
												<p class="mbs-2">
													${translatedParts(
		t,
		'user.settings.feeds.apiTokenHint',
		{
			scope: html`<code>feeds:access</code>`,
			link: feedLink,
		},
	)}
												</p>`}`
				: nothing}
				<div class="has-horizontal-overflow">
					<table class="table" data-table hidden>
						<thead>
							<tr>
								${(page === 'api-tokens'
		? [
			'misc.id',
			'user.settings.apiTokens.attributes.title',
			'user.settings.apiTokens.attributes.permissions',
			'user.settings.apiTokens.attributes.expiresAt',
			'misc.created',
		]
		: page === 'sessions'
			? [
				'user.settings.sessions.deviceInfo',
				'user.settings.sessions.ipAddress',
				'user.settings.sessions.lastActive',
			]
			: ['misc.id', 'misc.created']
	).map((key) => html`<th>${t(key)}</th>`)}
								<th class="has-text-end">${t('misc.actions')}</th>
							</tr>
						</thead>
						<tbody data-rows></tbody>
					</table>
				</div>
				<p data-empty hidden>${t('user.settings.sessions.noOtherSessions')}</p>
				${page === 'caldav'
		? html`<div
							data-secret
							class="message info mbe-4"
							role="status"
							hidden
						></div>`
		: nothing}
				<div data-editor></div>
				<button
					data-create
					type="button"
					class="button is-primary mbe-4"
					?hidden=${page !== 'api-tokens'}
				>
					${listIcon('plus')} ${t('user.settings.apiTokens.createAToken')}</button
				><button
					data-caldav-create
					type="button"
					class="button is-primary mbe-4"
					?hidden=${page !== 'caldav'}
				>
					${listIcon('plus')} ${t('user.settings.caldav.createToken')}</button
				>${page === 'caldav'
		? html`<p>
							<a href=${CALDAV_DOCS} target="_blank" rel="noopener noreferrer"
								>${t('user.settings.caldav.more')}</a
							>
						</p>`
		: nothing}
				<div data-totp></div>
				<div data-confirmation></div>
			</div>
		</div>`
	},
	onRender() {
		this.showChildView(
			'rows',
			new AccountRowsView({
				collection: this.getState().collection,
				childViewOptions: () => ({
					page: this.page(),
					user: this.options.user,
					currentSessionId: String(getTokenPayload(getToken())?.sid ?? ''),
					remove: (record: RecordItem) => this.remove(record),
				}),
			}),
		)
		this.applyData(this.options.data)
		if (
			this.page() === 'api-tokens' &&
			!this.options.data.error &&
			(this.options.route.query.title || this.options.route.query.scopes)
		)
			this.create()
	},
	page() {
		return this.options.route.params.page as SecurityPage
	},
	applyData(data: SecurityData) {
		const state = this.getState()
		state.data = data
		if (data.error) {
			this.feedback(data.error, true)
			return
		}
		const records = data.tokens ?? data.sessions ?? data.caldav ?? []
		state.collection.reset(
			records.map((record) => ({ id: record.id, record })),
		)
		this.count()
		if (this.page() === 'totp' && data.totp)
			this.showChildView(
				'totp',
				new TotpSettingsView({
					totp: data.totp,
					current: this.options.current,
					logout: this.options.logout,
				}),
			)
	},
	count() {
		(this.getUI('table')![0] as HTMLElement).hidden =
			this.getState().collection.length === 0;
		(this.getUI('empty')![0] as HTMLElement).hidden =
			this.page() !== 'sessions' || this.getState().collection.length > 0
	},
	feedback(error: unknown, retry = false) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = errorText(error)
		el.hidden = false;
		(this.getUI('retry')![0] as HTMLElement).hidden = !retry;
		(
			this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		)?.feedback(errorText(error))
	},
	async retry() {
		const state = this.getState()
		state.read?.abort()
		const request = (state.read = new AbortController()),
			page = this.page()
		this.el.setAttribute('aria-busy', 'true')
		try {
			const data = await readSecurity(page, request.signal)
			request.signal.throwIfAborted()
			if (!this.options.current() || this.isDestroyed()) return
			this.applyData(data)
			if (
				page === 'api-tokens' &&
				!this.getChildView('editor') &&
				(this.options.route.query.title || this.options.route.query.scopes)
			)
				this.create();
			(this.getUI('error')![0] as HTMLElement).hidden = true;
			(this.getUI('retry')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (!request.signal.aborted && !this.isDestroyed() && this.options.current())
				this.feedback(error, true)
		} finally {
			if (!request.signal.aborted && !this.isDestroyed() && this.options.current())
				this.el.setAttribute('aria-busy', 'false')
		}
	},
	create() {
		const data = this.getState().data
		if (!data.routes) {
			void this.retry()
			return
		}
		const first = (value: unknown) =>
			Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
		this.showChildView(
			'editor',
			new TokenEditorView({
				routes: data.routes,
				title: first(this.options.route.query.title),
				scopes: first(this.options.route.query.scopes),
				settings: this.options.user.settings,
				submit: (
					token: IApiToken,
					editor: InstanceType<typeof TokenEditorView>,
				) => void this.write('create', token, editor),
				cancel: () => this.closeEditor(),
			}),
		);
		(this.getUI('create')![0] as HTMLElement).hidden = true
	},
	closeEditor() {
		this.getRegion('editor')!.empty();
		(this.getUI('create')![0] as HTMLElement).hidden = false;
		(this.getUI('create')![0] as HTMLElement).focus()
	},
	caldavCreate() {
		void this.write('create', new CaldavTokenModel({}))
	},
	remove(record: RecordItem) {
		if (this.getState().write) return
		if (this.page() === 'caldav') {
			void this.write('delete', record)
			return
		}
		const api = record as IApiToken,
			title = t(
				this.page() === 'sessions'
					? 'user.settings.sessions.delete.header'
					: 'user.settings.apiTokens.delete.header',
			),
			text =
				this.page() === 'sessions'
					? t('user.settings.sessions.delete.text')
					: `${t('user.settings.apiTokens.delete.text1', { token: api.title })}\n${t('user.settings.apiTokens.delete.text2')}`
		this.showChildView(
			'confirmation',
			new ConfirmationView({
				title,
				text,
				close: () => this.getRegion('confirmation')!.empty(),
				submit: () => void this.write('delete', record),
			}),
		)
	},
	async write(
		kind: 'create' | 'delete',
		record: RecordItem,
		editor?: InstanceType<typeof TokenEditorView>,
	) {
		const state = this.getState()
		if (state.write) return
		const request = (state.write = new AbortController()),
			page = this.page(),
			submittedDraft = editor?.draftSignature(),
			confirmation = this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		this.el.setAttribute('aria-busy', 'true')
		editor?.loading(true)
		confirmation?.loading(true);
		(this.getUI('caldavCreate')![0] as HTMLButtonElement).disabled = true
		try {
			const service =
				page === 'api-tokens'
					? new ApiTokenService()
					: page === 'sessions'
						? new SessionService()
						: new CaldavTokenService()
			if (kind === 'create') {
				const created =
					page === 'api-tokens'
						? await (service as ApiTokenService).create(
								record as IApiToken,
								request.signal,
						)
						: await (service as CaldavTokenService).create(
								record as ICaldavToken,
								request.signal,
						)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.collection.add({ id: created.id, record: created })
				this.count()
				const secret = this.getUI('secret')![0] as HTMLElement
				secret.textContent = `${t(page === 'api-tokens' ? 'user.settings.apiTokens.tokenCreatedSuccess' : 'user.settings.caldav.tokenCreated', { token: (created as IApiToken).token })}\n${t(page === 'api-tokens' ? 'user.settings.apiTokens.tokenCreatedNotSeeAgain' : 'user.settings.caldav.wontSeeItAgain')}`
				secret.hidden = false
				if (editor && !editor.isDestroyed()) editor.feedback('')
				if (
					editor &&
					!editor.isDestroyed() &&
					editor.draftSignature() === submittedDraft
				)
					this.closeEditor()
			} else {
				if (page === 'api-tokens')
					await (service as ApiTokenService).delete(
						record as IApiToken,
						request.signal,
					)
				else if (page === 'sessions')
					await (service as SessionService).delete(
						record as ISession,
						request.signal,
					)
				else
					await (service as CaldavTokenService).delete(
						record as ICaldavToken,
						request.signal,
					)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.collection.remove(record.id)
				this.count()
				this.getRegion('confirmation')!.empty()
				if (page === 'sessions')
					success(t('user.settings.sessions.deleteSuccess'))
			}
			(this.getUI('error')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			) {
				if (editor && !editor.isDestroyed()) editor.feedback(errorText(error))
				else this.feedback(error)
			}
		} finally {
			if (state.write === request) state.write = undefined
			if (!request.signal.aborted && !this.isDestroyed() && this.options.current()) {
				this.el.setAttribute('aria-busy', 'false');
				(this.getUI('caldavCreate')![0] as HTMLButtonElement).disabled = false
				if (editor && !editor.isDestroyed()) editor.loading(false)
				if (confirmation && !confirmation.isDestroyed())
					confirmation.loading(false)
			}
		}
	},
	async copy() {
		try {
			await navigator.clipboard.writeText(
				(this.getUI('url')![0] as HTMLInputElement).value,
			)
		} catch (error) {
			if (!this.isDestroyed()) this.feedback(error)
		}
	},
	onBeforeDestroy() {
		this.getState().read?.abort()
		this.getState().write?.abort()
	},
}).setDomApi(LitDomApi)
