import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import dayjs from 'dayjs'
import AdminOverviewService from '@/services/admin/overviewService'
import AdminUserService from '@/services/admin/userService'
import AdminProjectService from '@/services/admin/projectService'
import AdminUserModel from '@/models/adminUser'
import ProjectModel from '@/models/project'
import type { IAdminUser } from '@/modelTypes/IAdminUser'
import type { IProject } from '@/modelTypes/IProject'
import type { IAdminOverview } from '@/modelTypes/IAdminOverview'
import type { SessionApplication } from '../../app/session'
import {featureEnabled} from '../../shared/feature-enabled'
export {featureEnabled} from '../../shared/feature-enabled'
import { PRO_FEATURE } from '@/constants/proFeatures'
import { t } from '../../shared/i18n'
import { displayDate } from '../../shared/dates'
import { errorText, success } from '../../shared/notifications'
import { interceptLink, type Route } from '../../app/routes'
import { NotFoundView } from '../../app/system-pages'
import { RemoteSearchView } from '../../shared/remote-search'
import { ProjectMenuView } from '../projects/project-cards'
import './application.scss'
const statusKey = [
	'statusActive',
	'statusEmailConfirmation',
	'statusDisabled',
	'statusLocked',
]
const statusLabel = (status: number) =>
	statusKey[status] ? t(`admin.users.${statusKey[status]}`) : String(status)
const input = (key: string, name: string, value: unknown = '', type = 'text') =>
	html`<div class="field">
		<label class="label" for=${`admin-${name}`}>${t(key)}</label
		><input
			class="input"
			id=${`admin-${name}`}
			name=${name}
			type=${type}
			.value=${String(value ?? '')}
			autocomplete=${type === 'password' ? 'new-password' : 'off'}
		/>
	</div>`
const checkbox = (key: string, name: string, value = false) =>
	html`<label class="checkbox field"
		><input name=${name} type="checkbox" .checked=${value} /> ${t(key)}</label
	>`
export const AdminApplication = Application.extend({
	initialize(options: {
		session: InstanceType<typeof SessionApplication>;
		navigate: (href: string) => void;
	}) {
		void options
	},
	async prepareStart(_route: Route, { signal }: LifecycleContext) {
		signal.throwIfAborted()
		return (
			featureEnabled(this.options.session, PRO_FEATURE.ADMIN_PANEL) &&
			this.options.session.getState().get('user')?.isAdmin === true
		)
	},
	onStart(_app: unknown, route: Route, allowed: boolean) {
		document.title = `${t(allowed ? 'admin.title' : '404.title')} | Vikunja`
		if (!allowed) {
			this.setView(new NotFoundView())
			this.showView()
			return
		}
		const user = this.options.session.getState().get('user')!,
			transition = this.options.session.getState().get('transition'),
			current = () =>
				this.isRunning() &&
				this.options.session.getState().get('user') === user &&
				this.options.session.getState().get('transition') === transition
		const frame = this.setView(
			new AdminFrameView({
				page: route.params.page,
				navigate: this.options.navigate,
			}),
		)
		this.showView()
		frame.showChildView(
			'body',
			route.params.page === 'overview'
				? new AdminOverviewView({
					version: String(
						this.options.session.getState().get('config')?.version ?? '',
					),
					current,
				})
				: new AdminDirectoryView({
					kind: route.params.page,
					currentUserId: user.id,
					current,
					navigate: this.options.navigate,
					backgroundEnabled: Boolean(
						(
								this.options.session.getState().get('config')
									?.enabled_background_providers as string[]
						)?.length,
					),
				}),
		)
	},
})
const AdminFrameView = View.extend({
	initialize(options: { page: string; navigate: (href: string) => void }) {
		void options
	},
	className:
		'content-widescreen native-settings native-admin native-list-surface',
	regions: { body: '[data-admin-body]' },
	templateContext() {
		return this.options
	},
	template: ({ page, navigate }:{page:string,navigate:(href:string)=>void}) =>
		html`<div class="side-nav-shell">
			<nav class="navigation" aria-label=${t('admin.title')}>
				<ul>
					${[
		['overview', 'navigation.overview', '/admin'],
		['users', 'admin.labels.users', '/admin/users'],
		['projects', 'project.projects', '/admin/projects'],
	].map(
		([key, label, path]) =>
			html`<li>
								<a
									class="navigation-link ${page === key ? 'is-active' : ''}"
									href=${path}
									@click=${(event: MouseEvent) =>
		interceptLink(event, navigate)}
									>${t(label)}</a
								>
							</li>`,
	)}
				</ul>
			</nav>
			<section class="view" data-admin-body></section>
		</div>`,
}).setDomApi(LitDomApi)
const AdminOverviewView = View.extend({
	initialize(options: { version: string; current: () => boolean }) {
		void options
	},
	ui: {
		results: '[data-results]',
		loading: '[data-loading]',
		error: '[data-error]',
	},
	events: { 'click [data-retry]': 'load' },
	createState() {
		return { request: undefined as AbortController | undefined }
	},
	template: () =>
		html`<div class="card">
			<header class="card-header">
				<p class="card-header-title">${t('navigation.overview')}</p>
			</header>
			<div class="card-content admin-overview">
				<p data-loading>${t('misc.loading')}</p>
				<div class="message danger" data-error role="alert" hidden></div>
				<button type="button" data-retry class="button is-outlined" hidden>
					${t('sharing.retry')}
				</button>
				<div data-results class="admin-overview__grid"></div>
			</div>
		</div>`,
	onAttach() {
		void this.load()
	},
	async load() {
		const state = this.getState()
		state.request?.abort()
		const request = new AbortController()
		state.request = request;
		(this.getUI('loading')![0] as HTMLElement).hidden = false;
		(this.getUI('error')![0] as HTMLElement).hidden = true
		try {
			const data = await new AdminOverviewService().getOverview(request.signal)
			request.signal.throwIfAborted()
			if (
				this.isDestroyed() ||
				!this.options.current() ||
				state.request !== request
			)
				return
			render(this.content(data), this.getUI('results')![0] as HTMLElement)
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			) {
				const node = this.getUI('error')![0] as HTMLElement
				node.textContent = errorText(error)
				node.hidden = false;
				(this.el.querySelector('[data-retry]') as HTMLElement).hidden = false
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed())
				(this.getUI('loading')![0] as HTMLElement).hidden = true
		}
	},
	content(data: IAdminOverview) {
		const shares = data.shares,
			license = data.license,
			days = license.expiresAt
				? Math.max(0, dayjs(license.expiresAt).diff(dayjs(), 'day'))
				: null
		return html`${[
			['admin.labels.users', data.users],
			['project.projects', data.projects],
			['admin.labels.tasks', data.tasks],
			['team.title', data.teams],
			[
				'admin.overview.shares',
				shares.linkShares + shares.teamShares + shares.userShares,
			],
			['admin.overview.version', this.options.version],
		].map(
			([label, value]) =>
				html`<div class="admin-overview__card">
						<h2 class="admin-overview__card-title">${t(String(label))}</h2>
						<p class="admin-overview__card-value">${value}</p>
						${label === 'admin.overview.shares'
		? html`<p
									class="admin-overview__hint admin-overview__shares-breakdown"
								>
									${shares.linkShares} ${t('admin.overview.linkSharesShort')} ·
									${shares.teamShares} ${t('admin.overview.teamSharesShort')} ·
									${shares.userShares} ${t('admin.overview.userSharesShort')}
								</p>`
		: nothing}
					</div>`,
		)}
			<div class="admin-overview__card admin-overview__card--wide">
				<h2 class="admin-overview__card-title">
					${t('admin.overview.license')}
				</h2>
				<dl class="admin-overview__kv">
					<dt>${t('admin.overview.licenseValidUntil')}</dt>
					<dd>
						${displayDate(license.expiresAt)}
						${days === null
		? ''
		: t('admin.overview.licenseExpiresIn', { days })}
					</dd>
					<dt>${t('admin.overview.licenseLastVerified')}</dt>
					<dd>
						${displayDate(license.validatedAt) ||
						t('admin.overview.licenseNever')}${license.lastCheckFailed
	? html`<span class="has-text-danger admin-overview__hint"
									>(${t('admin.overview.licenseLastCheckFailed')})</span
								>`
	: nothing}
					</dd>
					${license.features.length
		? html`<dt>${t('admin.overview.licenseFeatures')}</dt>
								<dd>${license.features.join(', ')}</dd>`
		: nothing}${license.instanceId
	? html`<dt>${t('admin.overview.licenseInstance')}</dt>
								<dd><code>${license.instanceId}</code></dd>`
	: nothing}
				</dl>
				<p class="admin-overview__card-action">
					<a
						href="https://console.vikunja.io"
						target="_blank"
						rel="noopener noreferrer"
						>${t('admin.overview.licenseManage')}</a
					>
				</p>
			</div>`
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
	},
}).setDomApi(LitDomApi)
const AdminDirectoryView = View.extend({
	initialize(options: {
		kind: string;
		currentUserId: number;
		current: () => boolean;
		navigate: (href: string) => void;
		backgroundEnabled: boolean;
	}) {
		void options
	},
	regions: { dialog: '[data-dialog]' },
	ui: {
		rows: 'tbody',
		search: '[data-search]',
		loading: '[data-loading]',
		error: '[data-error]',
		pages: '[data-pages]',
	},
	createState() {
		return {
			request: undefined as AbortController | undefined,
			timer: undefined as ReturnType<typeof setTimeout> | undefined,
			rows: [] as (IAdminUser | IProject)[],
			page: 1,
			totalPages: 1,
		}
	},
	events: {
		'input @ui.search': 'search',
		'click [data-details]': 'details',
		'click [data-reassign]': 'reassign',
		'click [data-create]': 'create',
		'click [data-page]': 'page',
		'click [data-retry]': 'load',
	},
	templateContext() {
		return this.options
	},
	template: ({ kind }:{kind:string}) =>
		html`<div class="card">
			<div class="card-content admin-${kind}">
				${kind === 'users'
		? html`<div class="admin-users__toolbar">
							<input
								class="input"
								data-search
								type="text"
								placeholder=${t('admin.searchUsersPlaceholder')}
							/><button type="button" class="button" data-create>
								${t('admin.users.addUser')}
							</button>
						</div>`
		: nothing}
				<p data-loading>${t('misc.loading')}</p>
				<div data-error role="alert" class="message danger" hidden></div>
				<button data-retry class="button is-outlined" hidden>
					${t('sharing.retry')}
				</button>
				<div class="has-horizontal-overflow">
					<table class="table has-actions is-striped is-hoverable is-fullwidth">
						<thead>
							<tr>
								${(kind === 'users'
		? [
			'misc.id',
			'user.auth.username',
			'user.auth.email',
			'admin.users.issuer',
			'admin.users.status',
			'task.attributes.created',
		]
		: [
			'misc.id',
			'project.title',
			'admin.projects.ownerLabel',
			'task.attributes.created',
			'task.attributes.updated',
			'navigation.settings',
		]
	).map((key) => html`<th>${t(key)}</th>`)}${kind === 'users'
	? html`<th></th>`
	: nothing}
							</tr>
						</thead>
						<tbody></tbody>
					</table>
				</div>
				<div data-pages></div>
			</div>
			<div data-dialog></div>
		</div>`,
	onAttach() {
		void this.load()
	},
	search() {
		clearTimeout(this.getState().timer)
		this.getState().request?.abort()
		this.getState().timer = setTimeout(() => {
			this.getState().page = 1
			void this.load()
		}, 300)
	},
	page(event: Event) {
		this.getState().page = Number(
			(event as Event & { delegateTarget: HTMLElement }).delegateTarget.dataset
				.page,
		)
		void this.load()
	},
	async load() {
		const state = this.getState()
		state.request?.abort()
		const request = new AbortController()
		state.request = request;
		(this.getUI('loading')![0] as HTMLElement).hidden = false;
		(this.getUI('error')![0] as HTMLElement).hidden = true
		try {
			const service =
					this.options.kind === 'users'
						? new AdminUserService()
						: new AdminProjectService(),
				query =
					(this.getUI('search')?.[0] as HTMLInputElement | undefined)?.value ??
					''
			const rows = this.options.kind==='users'?await (service as AdminUserService).getAll(new AdminUserModel(),query?{s:query}:{},state.page,request.signal):await (service as AdminProjectService).getAll(new ProjectModel(),{},state.page,request.signal)
			request.signal.throwIfAborted()
			if (
				this.isDestroyed() ||
				!this.options.current() ||
				state.request !== request
			)
				return
			state.rows = rows
			state.totalPages = service.totalPages || 1
			this.publish()
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			) {
				const node = this.getUI('error')![0] as HTMLElement
				node.textContent = errorText(error)
				node.hidden = false;
				(this.el.querySelector('[data-retry]') as HTMLElement).hidden = false
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed())
				(this.getUI('loading')![0] as HTMLElement).hidden = true
		}
	},
	publish() {
		const state = this.getState()
		render(
			html`${state.rows.map((row) =>
				this.options.kind === 'users'
					? this.userRow(row as IAdminUser)
					: this.projectRow(row as IProject),
			)}`,
			this.getUI('rows')![0] as HTMLElement,
		)
		render(
			html`${state.totalPages > 1
				? Array.from(
					{ length: state.totalPages },
					(_, i) =>
						html`<button
								class="button is-outlined ${state.page === i + 1
		? 'is-active'
		: ''}"
								data-page=${i + 1}
								?disabled=${state.page === i + 1}
							>
								${i + 1}
							</button>`,
				)
				: nothing}`,
			this.getUI('pages')![0] as HTMLElement,
		)
	},
	userRow(u: IAdminUser) {
		return html`<tr>
			<td>${u.id}</td>
			<td>${u.username}</td>
			<td>${u.email}</td>
			<td>${u.authProvider || t('admin.users.issuerLocal')}</td>
			<td>${statusLabel(u.status)}</td>
			<td>${displayDate(u.created)}</td>
			<td class="actions">
				<button class="button is-outlined" data-details=${u.id}>
					${t('admin.users.details')}
				</button>
			</td>
		</tr>`
	},
	projectRow(p: IProject) {
		const options = {
			project: { ...p, maxPermission: 2 as const },
			navigate: this.options.navigate,
			backgroundEnabled: this.options.backgroundEnabled,
			beforeDelete: html`<button
				type="button"
				class="dropdown-item"
				data-reassign=${p.id}
			>
				${t('admin.projects.reassignOwner')}
			</button>`,
		}
		const menu = ProjectMenuView.prototype.template.call(null, {
			...options,
			navigate: options.navigate,
		})
		return html`<tr>
			<td>${p.id}</td>
			<td>${p.title}</td>
			<td>${p.owner?.username ?? p.owner?.id}</td>
			<td>${displayDate(p.created)}</td>
			<td>${displayDate(p.updated)}</td>
			<td class="actions">${menu}</td>
		</tr>`
	},
	details(event: Event) {
		const id = Number(
			(event as Event & { delegateTarget: HTMLElement }).delegateTarget.dataset
				.details,
		)
		this.dialog(
			'detail',
			this.getState().rows.find((row) => row.id === id) as IAdminUser,
		)
	},
	reassign(event: Event) {
		const id = Number(
			(event as Event & { delegateTarget: HTMLElement }).delegateTarget.dataset
				.reassign,
		)
		this.dialog(
			'reassign',
			this.getState().rows.find((row) => row.id === id) as IProject,
		)
	},
	create() {
		this.dialog('create')
	},
	dialog(mode: string, target?: IAdminUser | IProject) {
		this.showChildView(
			'dialog',
			new AdminDialogView({
				mode,
				target,
				currentUserId: this.options.currentUserId,
				current: this.options.current,
				close: () => this.getRegion('dialog')!.empty(),
				updated: () => void this.load(),
			}),
		)
	},
	onBeforeDestroy() {
		clearTimeout(this.getState().timer)
		this.getState().request?.abort()
	},
}).setDomApi(LitDomApi)
const AdminDialogView = View.extend({
	initialize(options: {
		mode: string;
		target?: IAdminUser | IProject;
		currentUserId: number;
		current: () => boolean;
		close: () => void;
		updated: () => void;
	}) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog hint-modal native-admin native-settings native-list-surface',
	regions: { owner: '[data-owner]' },
	ui: {
		form: 'form',
		error: '[data-error]',
		buttons: 'button',
		password: '[name=password]',
	},
	createState() {
		const target = this.options.target as IAdminUser | undefined
		return {
			mode: this.options.mode,
			request: undefined as AbortController | undefined,
			owner: null as number | null,
			draft: {
				isAdmin: Boolean(target?.isAdmin),
				status: target?.status ?? 0,
				password: '',
			},
		}
	},
	events: {
		cancel: 'close',
		'click [data-close]': 'close',
		'click [data-save]': 'save',
		'submit form': 'save',
		'click [data-delete]': 'deletePrompt',
		'click [data-cancel-delete]': 'cancelDelete',
		'click [data-delete-mode]': 'delete',
		'click [data-password]': 'password',
		'click [data-reset]': 'resetEmail',
		'input form': 'refresh',
		'change form': 'refresh',
	},
	templateContext() {
		return { ...this.options, ...this.getState() }
	},
	template({ mode, target, draft, currentUserId }:{mode:string,target?:IAdminUser|IProject,draft:{isAdmin:boolean,status:number,password:string},currentUserId:number}) {
		const u = target as IAdminUser,
			p = target as IProject,
			title =
				mode === 'create'
					? t('admin.users.createTitle')
					: mode === 'delete'
						? t('admin.users.confirmDeleteTitle')
						: mode === 'reassign'
							? t('admin.projects.reassignTitle', { title: p.title })
							: t('admin.users.detailsTitle', { username: u.username })
		return html`<div class="modal-container">
			<div class="modal-content">
				<div class="card has-no-shadow">
					<header class="card-header">
						<p class="card-header-title">${title}</p>
					</header>
					<div class="card-content">
						<div class="message danger" role="alert" data-error hidden></div>
						<form>
							${mode === 'create'
		? html`${input('user.auth.username', 'username')}${input(
			'user.auth.email',
			'email',
			'',
			'email',
		)}${input('admin.users.nameLabel', 'name')}${input(
			'user.auth.password',
			'password',
			'',
			'password',
		)}${input(
			'user.settings.general.language',
			'language',
		)}${checkbox(
			'admin.users.isAdminLabel',
			'isAdmin',
		)}${checkbox(
			'admin.users.skipEmailConfirm',
			'skipEmailConfirm',
		)}`
		: mode === 'detail'
			? html`<dl class="admin-users__meta">
												${[
		['misc.id', u.id],
		['user.auth.email', u.email],
		[
			'admin.users.issuer',
			u.authProvider || t('admin.users.issuerLocal'),
		],
		...(u.issuer?.startsWith('http')
			? [['admin.users.issuerUrl', u.issuer]]
			: []),
		...(u.subject
			? [['admin.users.subject', u.subject]]
			: []),
		['task.attributes.created', displayDate(u.created)],
		['task.attributes.updated', displayDate(u.updated)],
	].map(
		([key, value]) =>
			html`<dt>${t(String(key))}</dt>
															<dd>${value}</dd>`,
	)}
											</dl>
											${checkbox(
		'admin.users.isAdminLabel',
		'isAdmin',
		draft.isAdmin,
	)}
											<div class="field">
												<label class="label" for="admin-status"
													>${t('admin.users.status')}</label
												><select class="input" name="status" id="admin-status">
													${statusKey.map(
		(key, i) =>
			html`<option
																value=${i}
																?selected=${draft.status === i}
															>
																${t(`admin.users.${key}`)}
															</option>`,
	)}
												</select>
											</div>
											${!u.authProvider
		? html`${input(
			'admin.users.newPasswordLabel',
			'password',
			draft.password,
			'password',
		)}
														<div class="admin-users__password-actions">
															<button
																type="button"
																data-password
																class="button is-outlined"
															>
																${t('admin.users.setPassword')}</button
															><button
																type="button"
																data-reset
																class="button is-outlined"
															>
																${t('admin.users.sendResetEmail')}
															</button>
														</div>`
		: nothing}`
			: mode === 'delete'
				? html`<p>
													${t('admin.users.confirmDeleteIntro', {
		username: u.username,
	})}
												</p>
												<p>${t('admin.users.deleteModeScheduledHelp')}</p>
												<p>${t('admin.users.deleteModeNowHelp')}</p>`
				: html`<label class="label"
													>${t('admin.projects.newOwnerLabel')}</label
												>
												<div data-owner></div>`}
						</form>
					</div>
					<footer class="card-footer">
						<button
							type="button"
							data-close=${mode === 'delete' ? '' : true}
							?hidden=${mode === 'delete'}
							class="button is-text"
						>
							${t('misc.cancel')}</button
						>${mode === 'delete'
		? html`<button data-cancel-delete class="button is-text">
										${t('misc.cancel')}</button
									><button
										data-delete-mode="scheduled"
										class="button is-outlined"
									>
										${t('admin.users.deleteModeScheduled')}</button
									><button data-delete-mode="now" class="button is-danger">
										${t('admin.users.deleteModeNow')}
									</button>`
		: html`${mode === 'detail' && u.id !== currentUserId
			? html`<button
												data-delete
												class="button is-outlined is-danger"
											>
												${t('misc.delete')}
											</button>`
			: nothing}<button type="button" data-save class="button">
										${t(
		mode === 'create'
			? 'admin.users.createSubmit'
			: mode === 'detail'
				? 'admin.users.saveButton'
				: 'admin.projects.reassignOwner',
	)}
									</button>`}
					</footer>
				</div>
			</div>
		</div>`
	},
	onRender() {
		if (this.getState().mode === 'reassign')
			this.showChildView(
				'owner',
				new RemoteSearchView({
					id: 'admin-owner',
					label: t('admin.projects.newOwnerLabel'),
					placeholder: t('admin.searchUsersPlaceholder'),
					items: [],
					selected: null,
					changed: (value) => {
						this.getState().owner = value as number | null
						this.refresh()
					},
					search: async (query, signal) =>
						query.length < 2
							? []
							: (
								await new AdminUserService().getAll(
									new AdminUserModel(),
									{ s: query },
									1,
									signal,
								)
							).map((u) => ({ value: u.id, label: u.username })),
					error: (error) => this.feedback(errorText(error)),
				}),
			)
		this.refresh()
	},
	onAttach() {
		document.body.style.overflow = 'hidden';
		(this.el as HTMLDialogElement).showModal();
		(this.el.querySelector('input') as HTMLInputElement | null)?.focus()
	},
	values() {
		const form = this.getUI('form')![0] as HTMLFormElement,
			values = new FormData(form)
		return {
			username: String(values.get('username') ?? ''),
			email: String(values.get('email') ?? ''),
			name: String(values.get('name') ?? ''),
			password: String(values.get('password') ?? ''),
			language: String(values.get('language') ?? ''),
			isAdmin: values.has('isAdmin'),
			skipEmailConfirm: values.has('skipEmailConfirm'),
			status: Number(values.get('status')),
		}
	},
	refresh() {
		const values = this.values(),
			state = this.getState(),
			target = this.options.target as IAdminUser
		const disabled =
			Boolean(state.request) ||
			(state.mode === 'create'
				? !(values.username && values.email && values.password)
				: state.mode === 'reassign'
					? !state.owner
					: state.mode === 'detail'
						? values.isAdmin === Boolean(target.isAdmin) &&
							values.status === target.status
						: false)
		const save = this.el.querySelector(
			'[data-save]',
		) as HTMLButtonElement | null
		if (save) save.disabled = disabled
		const password = this.el.querySelector(
			'[data-password]',
		) as HTMLButtonElement | null
		if (password)
			password.disabled = Boolean(state.request) || !values.password
	},
	feedback(message: string) {
		const node = this.getUI('error')![0] as HTMLElement
		node.textContent = message
		node.hidden = !message
	},
	async write(
		action: (signal: AbortSignal) => Promise<unknown>,
		message: string,
		close = true,
		clearPassword = false,
	) {
		const state = this.getState()
		if (state.request || !this.options.current()) return
		const request = new AbortController()
		state.request = request
		this.feedback('')
		for (const button of Array.from(this.getUI('buttons') ?? []))
			(button as HTMLButtonElement).disabled = true
		this.el.setAttribute('aria-busy', 'true')
		try {
			await action(request.signal)
			request.signal.throwIfAborted()
			if (
				this.isDestroyed() ||
				state.request !== request ||
				!this.options.current()
			)
				return
			this.options.updated()
			success(message)
			if (close) this.options.close()
			else if (clearPassword && this.getUI('password')?.[0])
				(this.getUI('password')![0] as HTMLInputElement).value = ''
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			)
				this.feedback(errorText(error))
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				for (const button of Array.from(this.getUI('buttons') ?? []))
					(button as HTMLButtonElement).disabled = false
				this.el.setAttribute('aria-busy', 'false')
				this.refresh()
			}
		}
	},
	save(event: Event) {
		event.preventDefault()
		const values = this.values(),
			state = this.getState(),
			target = this.options.target as IAdminUser,
			service = new AdminUserService()
		if (state.mode === 'create') {
			if (!values.username || !values.email || !values.password) return
			void this.write(
				(signal) =>
					service.createUser(
						{
							username: values.username,
							email: values.email,
							password: values.password,
							...(values.name ? { name: values.name } : {}),
							...(values.language ? { language: values.language } : {}),
							...(values.isAdmin ? { isAdmin: true } : {}),
							...(values.skipEmailConfirm ? { skipEmailConfirm: true } : {}),
						},
						signal,
					),
				t('admin.users.createdSuccess', { username: values.username }),
			)
		} else if (state.mode === 'reassign') {
			if (!state.owner) return
			void this.write(
				(signal) =>
					new AdminProjectService().reassignOwner(
						target.id,
						state.owner!,
						signal,
					),
				t('admin.projects.reassignedSuccess'),
			)
		} else
			void this.write(
				async (signal) => {
					if (values.isAdmin !== Boolean(target.isAdmin)) {
						const latest = await service.setAdmin(
							target.id,
							values.isAdmin,
							signal,
						)
						signal.throwIfAborted()
						if (!this.isDestroyed() && this.options.current())
							this.options.target = latest
					}
					const latest = this.options.target as IAdminUser
					if (values.status !== latest.status) {
						const updated = await service.setStatus(
							target.id,
							values.status,
							signal,
						)
						signal.throwIfAborted()
						if (!this.isDestroyed() && this.options.current())
							this.options.target = updated
					}
				},
				t('admin.users.updatedSuccess', { username: target.username }),
			)
	},
	password(event: Event) {
		event.preventDefault()
		const target = this.options.target as IAdminUser,
			password = this.values().password
		if (password)
			void this.write(
				(signal) =>
					new AdminUserService().setPassword(target.id, password, signal),
				t('admin.users.setPasswordSuccess', { username: target.username }),
				false,
				true,
			)
	},
	resetEmail(event: Event) {
		event.preventDefault()
		const target = this.options.target as IAdminUser
		void this.write(
			(signal) =>
				new AdminUserService().sendPasswordResetEmail(target.id, signal),
			t('admin.users.sendResetEmailSuccess', { username: target.username }),
			false,
		)
	},
	deletePrompt() {
		this.getState().draft = {
			isAdmin: this.values().isAdmin,
			status: this.values().status,
			password: this.values().password,
		}
		this.getState().mode = 'delete'
		this.render()
	},
	cancelDelete() {
		if (this.getState().request) return
		this.getState().mode = 'detail'
		this.render()
	},
	delete(event: Event) {
		const mode = (event as Event & { delegateTarget: HTMLElement })
			.delegateTarget.dataset.deleteMode as 'now' | 'scheduled',
			target = this.options.target as IAdminUser
		void this.write(
			(signal) => new AdminUserService().deleteUser(target.id, mode, signal),
			t(
				mode === 'now'
					? 'admin.users.deletedSuccess'
					: 'admin.users.deleteScheduledSuccess',
				{ username: target.username },
			),
		)
	},
	close(event: Event) {
		event.preventDefault()
		if (this.getState().mode === 'delete' && this.getState().request) return
		this.options.close()
	},
	onBeforeDestroy() {
		this.getState().request?.abort();
		(this.el as HTMLDialogElement).close()
		document.body.style.overflow = ''
	},
}).setDomApi(LitDomApi)
