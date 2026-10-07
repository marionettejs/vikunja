import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import UserProjectService from '@/services/userProject'
import TeamProjectService from '@/services/teamProject'
import LinkShareService from '@/services/linkShare'
import UserService from '@/services/user'
import TeamService from '@/services/team'
import UserProjectModel from '@/models/userProject'
import TeamProjectModel from '@/models/teamProject'
import LinkShareModel from '@/models/linkShare'
import { getDisplayName, fetchAvatarBlobUrl } from '@/models/user'
import type { IUser } from '@/modelTypes/IUser'
import type { IProject } from '@/modelTypes/IProject'
import type { ILinkShare } from '@/modelTypes/ILinkShare'
import type { Permission } from '@/constants/permissions'
import type { Route } from '../../app/routes'
import { SettingsSearchView, type SettingsChoice } from '../settings/settings-search'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon, translatedParts } from '@/shared/task-list/list-ui'
import './project-sharing.scss'
type Kind = 'user' | 'team' | 'link';
export interface Member {
    id: number;
    username?: string;
    name?: string;
    permission: Permission;
}
type Entry = Member | ILinkShare;
interface PanelPort {
    isDestroyed: () => boolean;
    getState: () => {
        rows: Entry[];
    };
    publish: (rows: Entry[]) => void;
    feedback: (error: unknown, retry?: boolean) => void;
    loading: (value: boolean) => void;
    readLoading: (value: boolean) => void;
    clearError: () => void;
}
interface Options {
    navigate: (href: string, replace?: boolean) => void;
    user: () => IUser;
    config: () => Record<string, unknown>;
    commit: (project: IProject) => void;
}
const typeName = (kind: Kind, count = 1) => t(`project.share.userTeam.type${kind === 'user' ? 'User' : 'Team'}`, count)
const memberName = (kind: Kind, row: Entry) => kind === 'user' ? getDisplayName(row as unknown as IUser) : String(row.name ?? '')
const permissions = (value: Permission) => [0, 1, 2].map(permission => html `<option value=${permission} ?selected=${permission === value}>${t(`project.share.permission.${['read', 'readWrite', 'admin'][permission]}`)}</option>`)
const services = (kind: Kind) => kind === 'user' ? new UserProjectService() : kind === 'team' ? new TeamProjectService() : new LinkShareService()
const shareModel = (kind: Kind, projectId: number, row: Partial<Entry>) => kind === 'user' ? new UserProjectModel({ projectId, username: (row as Member).username, permission: row.permission }) : kind === 'team' ? new TeamProjectModel({ projectId, teamId: row.id, permission: row.permission }) : new LinkShareModel({ ...row, projectId })
export const ConfirmationView = View.extend({
	initialize(options: {
        title: string;
        text: string;
        submit: () => void;
        close: () => void;
    }) { void options }, tagName: 'dialog', className: 'modal-dialog default native-sharing-confirmation native-list-surface',
	ui: { submit: '[data-submit]', error: '[data-error]' }, events: { cancel: 'close', 'click [data-close]': 'close', 'click @ui.submit': 'submit' },
	createState() { return { focus: document.activeElement as HTMLElement | null } }, templateContext() { return this.options },
	template({ title, text }: {
        title: string;
        text: string;
    }) { return html `<div class="modal-container"><div class="modal-content"><div class="card"><header class="card-header"><h2 class="card-header-title">${title}</h2></header><div class="card-content"><p>${text}</p><div data-error role="alert" class="message danger" hidden></div></div><footer class="card-footer"><button type="button" class="button is-outlined" data-close>${t('misc.cancel')}</button><button type="button" class="button is-danger" data-submit>${t('misc.doit')}</button></footer></div></div></div>` },
	onAttach() { this.getState(); (this.el as HTMLDialogElement).showModal() }, submit() { this.options.submit() }, close(event: Event) { event.preventDefault(); event.stopPropagation(); this.options.close() },
	loading(value: boolean) { const button = this.getUI('submit')![0] as HTMLButtonElement; button.disabled = value; button.classList.toggle('is-loading', value) }, feedback(error: unknown) { const el = this.getUI('error')![0] as HTMLElement; el.textContent = errorText(error); el.hidden = false },
	onBeforeDestroy() { (this.el as HTMLDialogElement).close(); if (this.getState().focus?.isConnected)
        this.getState().focus!.focus() },
}).setDomApi(LitDomApi)
export const ShareSearchView = SettingsSearchView.extend({
	createState() { return {...SettingsSearchView.prototype.createState.call(this), version: 0, members: [] as Member[]} },
	filtered() { return this.options.items },
	initialize(options: {items: SettingsChoice[]; search: (query: string) => Promise<Member[]>; kind: Kind; error: (error: unknown) => void}) {void options},
	async search() {
		SettingsSearchView.prototype.search.call(this)
		const state = this.getState(), version = ++state.version, query = (this.getUI('input')![0] as HTMLInputElement).value
		this.options.items = []; state.members = []; this.publish()
		const control = this.el.querySelector('.control')!
		control.classList.toggle('is-loading', Boolean(query))
		try {
			const rows = await this.options.search(query)
			if (this.isDestroyed() || state.version !== version || (this.getUI('input')![0] as HTMLInputElement).value !== query) return
			state.members = rows
			this.options.items = rows.map(row => ({value: row.id, label: memberName(this.options.kind, row), selectedLabel: this.options.kind === 'user' ? row.username : row.name}))
			this.publish()
		} catch (error) {
			if (!this.isDestroyed() && state.version === version && (error as Error).name !== 'AbortError') this.options.error(error)
		} finally {
			if (!this.isDestroyed() && state.version === version) control.classList.remove('is-loading')
		}
	},
	choice(item: SettingsChoice) {
		const member = this.getState().members.find(row => row.id === item.value)
		if (this.options.kind !== 'user' || !member) return html`<span class="search-result">${item.label}</span>`
		return html`<div class="user" style="--avatar-size:24px"><span class="avatar-wrapper"><img class="avatar" data-avatar=${member.username!} width="24" height="24" alt="" title=${item.label}>${(member as Member & {botOwnerId?: number}).botOwnerId ? html`<span class="bot-badge" aria-label="Bot" title=${t('user.settings.bots.badge')}>B</span>` : nothing}</span><span class="username">${item.label}</span></div>`
	},
	publish() {
		SettingsSearchView.prototype.publish.call(this)
		for (const image of this.el.querySelectorAll<HTMLImageElement>('img[data-avatar]')) {
			void fetchAvatarBlobUrl({username: image.dataset.avatar!}, 24).then(url => {
				if (!this.isDestroyed() && image.isConnected && url) image.src = url
			}).catch(() => {})
		}
	},
})
const SharingPanelView = View.extend({
	initialize(options: {
        kind: Kind;
        project: IProject;
        admin: boolean;
        user: IUser;
        frontendUrl: string;
        read: (view: PanelPort) => void;
        search: (query: string) => Promise<Member[]>;
        write: (action: string, row: Partial<Entry>, view: PanelPort, accepted: () => void) => void;
    }) { void options },
	className: 'native-sharing-panel', regions: { search: '[data-search]', confirmation: '[data-confirmation]' },
	ui: { table: '[data-table]', error: '[data-error]', loading: '[data-loading]', newForm: '[data-new]', name: '#linkShareName', password: '#linkSharePassword', permission: '[data-new-permission]', create: '[data-create]', add: '[data-add]' },
	events: { 'click @ui.create': 'create', 'click @ui.add': 'add', 'click [data-retry]': 'retry', 'change [data-permission]': 'permission', 'change [data-view]': 'viewChanged', 'click [data-remove]': 'remove', 'click [data-copy]': 'copy' },
	createState() { return { rows: [] as Entry[], searchRows: [] as Member[], selected: undefined as Member | undefined, views: {} as Record<number, number> } }, templateContext() { return this.options },
	template({ kind, admin }: {
        kind: Kind;
        admin: boolean;
    }) { return html `<h3 class="has-text-weight-bold share-heading">${kind === 'link' ? t('project.share.links.title') : t('project.share.userTeam.shared', { type: typeName(kind, 2) })}${kind === 'link' ? html `<span class="is-size-7 has-text-grey is-italic mis-3" title=${t('project.share.links.explanation')}>${t('project.share.links.what')}</span>` : nothing}</h3><p data-loading>${t('misc.loading')}</p><div data-error class="message danger" role="alert" hidden></div><button type="button" data-retry class="button is-outlined" hidden>${t('sharing.retry')}</button>${admin ? kind === 'link' ? html `<button type="button" data-create class="base-button base-button--type-button button is-primary mbe-4" style="--button-white-space:break-spaces"><span class="icon is-small">${listIcon('plus')}</span><span>${t('project.share.links.create')}</span></button><div data-new class="p-4" hidden><div class="field"><label class="label" for="share-new-permission">${t('project.share.permission.title')}</label><div class="select"><select id="share-new-permission" data-new-permission>${permissions(0)}</select></div></div><div class="field"><label class="label" for="linkShareName">${t('project.share.links.name')}</label><input id="linkShareName" class="input" placeholder=${t('project.share.links.namePlaceholder')}></div><div class="field"><label class="label" for="linkSharePassword">${t('project.share.links.password')}</label><input id="linkSharePassword" class="input" type="password" autocomplete="new-password" placeholder=${t('user.auth.passwordPlaceholder')}></div><button type="button" data-add class="base-button base-button--type-button button is-primary" style="--button-white-space:break-spaces"><span class="icon is-small">${listIcon('plus')}</span><span>${t('project.share.share')}</span></button></div>` : html `<div><div class="field has-addons"><p class="control is-expanded" data-search></p><p class="control"><button type="button" data-add class="base-button base-button--type-button button is-primary" style="--button-white-space:break-spaces"><span>${t('project.share.share')}</span></button></p></div></div>` : nothing}<div data-table class=${`has-horizontal-overflow ${kind === 'link' ? '' : 'mbe-4'}`}></div><div data-confirmation></div>` },
	onRender() { const kind = this.options.kind; if (this.options.admin && kind !== 'link')
		this.showChildView('search', new ShareSearchView({ id: `share-${kind}-search`, kind, label: t('project.share.userTeam.search', { type: typeName(kind) }), placeholder: t('misc.searchPlaceholder'), items: [], selected: null, changed: (value: string | number | null) => { this.getState().selected = value == null ? undefined : { id: Number(value) } as Member }, search: async (query) => { const rows = await this.options.search(query); if (!this.isDestroyed()) {
			this.getState().selected = undefined
			this.getState().searchRows = rows
		} return rows }, error: error => this.feedback(error) })); this.options.read(this) },
	retry() { this.options.read(this) }, create() { (this.getUI('create')![0] as HTMLElement).hidden = true; (this.getUI('newForm')![0] as HTMLElement).hidden = false; (this.getUI('name')![0] as HTMLInputElement).focus() },
	add() { const kind = this.options.kind; if (kind === 'link') {
		const row = { permission: Number((this.getUI('permission')![0] as HTMLSelectElement).value) as Permission, name: (this.getUI('name')![0] as HTMLInputElement).value, password: (this.getUI('password')![0] as HTMLInputElement).value }
		this.options.write('create', row, this, () => { if ((this.getUI('name')![0] as HTMLInputElement).value !== row.name || (this.getUI('password')![0] as HTMLInputElement).value !== row.password || Number((this.getUI('permission')![0] as HTMLSelectElement).value) !== row.permission)
			return; (this.getUI('name')![0] as HTMLInputElement).value = ''; (this.getUI('password')![0] as HTMLInputElement).value = ''; (this.getUI('permission')![0] as HTMLSelectElement).value = '0'; (this.getUI('newForm')![0] as HTMLElement).hidden = true; (this.getUI('create')![0] as HTMLElement).hidden = false })
	}
	else {
		const row = this.getState().searchRows.find(row => row.id === this.getState().selected?.id)
		if (row)
			this.options.write('create', { ...row, permission: 0 }, this, () => { })
	} },
	publish(rows: Entry[]) {
		this.getState().rows = rows
		const { kind, admin, project, user } = this.options, state = this.getState()
		const table = this.getUI('table')![0] as HTMLElement
		table.classList.toggle('mbe-4', kind !== 'link' && rows.length > 0)
		table.classList.toggle('has-horizontal-overflow', rows.length > 0)
		render(rows.length ? html `<table class="table has-actions is-striped is-hoverable is-fullwidth">${kind === 'link' ? html`<thead><tr><th></th>${project.views.length ? html`<th>${t('project.share.links.view')}</th>` : nothing}<th>${t('project.share.attributes.delete')}</th></tr></thead>` : nothing}<tbody>${rows.map(row => { const link = kind === 'link' ? row as ILinkShare : undefined; return html `<tr data-share-id=${row.id}><td>${link ? html `${link.name ? html `<p class="mbe-2 is-italic">${link.name}</p>` : nothing}<p class="mbe-2">${translatedParts(t, 'project.share.links.sharedBy', [html`<strong>${getDisplayName(link.sharedBy)}</strong>`])}</p><p class="mbe-2"><span class="icon is-small">${listIcon(['users', 'pen', 'lock'][row.permission])}</span>&nbsp;${t(`project.share.permission.${['read', 'readWrite', 'admin'][row.permission]}`)}</p><div class="field has-addons"><div class="control is-expanded"><input class="input" aria-label=${t('project.share.links.title')} readonly .value=${this.url(link)}></div><div class="control"><button type="button" class="base-button base-button--type-button button is-primary has-no-shadow" style="--button-white-space:break-spaces" data-copy=${row.id} aria-label=${t('misc.copy')}><span><span class="icon">${listIcon('paste')}</span></span></button></div></div>` : kind === 'team' ? html `<a href=${`/teams/${row.id}/edit`}>${memberName(kind, row)}</a>` : memberName(kind, row)}</td>${kind === 'user' ? html `<td>${row.id === user.id ? html `<b class="is-success">${t('project.share.userTeam.you')}</b>` : nothing}</td>` : nothing}${!link ? html `<td class="type"><span class="icon is-small">${listIcon(['users', 'pen', 'lock'][row.permission])}</span> ${t(`project.share.permission.${['read', 'readWrite', 'admin'][row.permission]}`)}</td>` : nothing}${admin ? html `${link && project.views.length ? html `<td><div class="select"><select data-view=${row.id} aria-label=${t('project.share.links.view')}>${project.views.map(view => html `<option value=${view.id} ?selected=${(state.views[row.id] ?? project.views[0].id) === view.id}>${view.title}</option>`)}</select></div></td>` : nothing}<td class="actions">${!link ? html `<div class="select"><select .value=${live(String(row.permission))} data-permission=${row.id} aria-label=${t('project.share.userTeam.permissionFor', { sharable: memberName(kind, row) })}>${permissions(row.permission)}</select></div>` : nothing}<button type="button" class="base-button base-button--type-button button is-primary is-danger" style="--button-white-space:break-spaces" data-remove=${row.id} aria-label=${t(link ? 'project.share.links.remove' : 'project.share.userTeam.remove', link ? undefined : { type: typeName(kind) })}>${listIcon('trash-alt')}<span></span></button></td>` : nothing}</tr>` })}</tbody></table>` : kind === 'link' ? nothing : html `<p class="has-text-centered has-text-grey is-italic p-4 mbe-4">${t('project.share.userTeam.notShared', { type: typeName(kind, 2) })}</p>`, table)
	},
	url(row: ILinkShare) { const id = this.getState().views[row.id] ?? this.options.project.views[0]?.id; return `${this.options.frontendUrl}share/${row.hash}/auth${id ? `?view=${id}` : ''}` },
	viewChanged(event: Event) { const input = (event as Event & {
        delegateTarget: HTMLSelectElement;
    }).delegateTarget; this.getState().views[Number(input.dataset.view)] = Number(input.value); const row = this.getState().rows.find(row => row.id === Number(input.dataset.view)) as ILinkShare; (input.closest('tr')!.querySelector('input') as HTMLInputElement).value = this.url(row) },
	async copy(event: Event) { const target = (event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget, row = this.getState().rows.find(row => row.id === Number(target.dataset.copy)) as ILinkShare; try {
		if (navigator.clipboard)
			await navigator.clipboard.writeText(this.url(row))
		else {
			const input = document.createElement('textarea'), focus = document.activeElement as HTMLElement | null
			input.value = this.url(row)
			input.style.position = 'fixed'
			input.style.top = '0'
			input.style.left = '0'
			this.el.append(input)
			try {
				input.focus()
				input.select()
				if (!document.execCommand('copy'))
					throw new Error(t('misc.copyError'))
			}
			finally {
				input.remove()
				if (focus?.isConnected)
					focus.focus()
			}
		}
	}
	catch (error) {
		if (!this.isDestroyed())
			this.feedback(error)
	} },
	permission(event: Event) { const input = (event as Event & {
        delegateTarget: HTMLSelectElement;
    }).delegateTarget, row = this.getState().rows.find(row => row.id === Number(input.dataset.permission)); if (row)
		this.options.write('update', { ...row, permission: Number(input.value) as Permission }, this, () => { }) },
	remove(event: Event) { const target = (event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget, row = this.getState().rows.find(row => row.id === Number(target.dataset.remove)); if (!row)
		return; const kind = this.options.kind; this.showChildView('confirmation', new ConfirmationView({ title: t(kind === 'link' ? 'project.share.links.remove' : 'project.share.userTeam.removeHeader', { type: typeName(kind), sharable: t('project.list.title') }), text: t(kind === 'link' ? 'project.share.links.removeText' : 'project.share.userTeam.removeText', { type: typeName(kind), sharable: t('project.list.title') }), close: () => this.getRegion('confirmation')!.empty(), submit: () => this.options.write('delete', row, this, () => this.getRegion('confirmation')!.empty()) })) },
	loading(value: boolean) { for (const input of this.el.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('[data-add],[data-permission],[data-remove]'))
		input.disabled = value; this.getUI('add')?.[0]?.classList.toggle('is-loading', value); (this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.loading(value) },
	readLoading(value: boolean) { (this.getUI('loading')![0] as HTMLElement).hidden = !value; if (value)
		this.clearError() }, clearError() { (this.getUI('error')![0] as HTMLElement).hidden = true; (this.el.querySelector('[data-retry]') as HTMLElement).hidden = true },
	feedback(error: unknown, retry = false) { const el = this.getUI('error')![0] as HTMLElement; el.textContent = errorText(error); el.hidden = false; (this.el.querySelector('[data-retry]') as HTMLElement).hidden = !retry; (this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.feedback(error) },
}).setDomApi(LitDomApi)
const ProjectSharingView = View.extend({
	initialize(options: {
        project: IProject;
        linkEnabled: boolean;
        close: () => void;
        panel: (kind: Kind) => InstanceType<typeof SharingPanelView>;
    }) { void options },
	tagName: 'dialog', className: 'modal-dialog default native-project-dialog native-project-sharing native-list-surface', regions: { users: '[data-users]', teams: '[data-teams]', links: '[data-links]' }, events: { cancel: 'close', 'click [data-close]': 'close', 'mousedown .modal-container': 'backdrop' },
	createState() { return { focus: document.activeElement as HTMLElement | null, overflow: document.body.style.overflow } },
	template() { return html `<div class="modal-container"><button class="base-button base-button--type-button close" data-close aria-label=${t('misc.closeDialog')}>${listIcon('times')}</button><div class="modal-content"><div class="card has-no-shadow has-text-start"><header class="card-header"><h2 class="card-header-title has-text-weight-bold">${t('project.share.header')}</h2><button type="button" class="base-button base-button--type-button card-header-icon close" data-close aria-label=${t('misc.close')}><span class="icon">${listIcon('times')}</span></button></header><div class="card-content loader-container p-0"><div class="content"><div class="p-4"><div data-users></div><div data-teams></div><div data-links class="mbs-4"></div></div></div></div><footer class="card-footer"><button type="button" class="base-button base-button--type-button button is-outlined" style="--button-white-space:break-spaces" data-close><span>${t('misc.cancel')}</span></button></footer></div></div></div>` },
	onRender() { this.showChildView('users', this.options.panel('user')); this.showChildView('teams', this.options.panel('team')); if (this.options.linkEnabled && this.options.project.maxPermission === 2)
		this.showChildView('links', this.options.panel('link')) },
	backdrop(event:MouseEvent){if((event.target as HTMLElement).closest('dialog')===this.el&&(event.target as HTMLElement).classList.contains('modal-container')){event.preventDefault();event.stopPropagation();this.options.close()}},
	onAttach() { this.getState(); document.body.style.overflow = 'hidden'; (this.el as HTMLDialogElement).showModal() }, close(event: Event) { if ((event.target as HTMLElement).closest('dialog') !== this.el)
		return; event.preventDefault(); event.stopPropagation(); this.options.close() },
	onBeforeDestroy() { (this.el as HTMLDialogElement).close(); document.body.style.overflow = this.getState().overflow; if (this.getState().focus?.isConnected)
        this.getState().focus!.focus() },
}).setDomApi(LitDomApi)
export const ProjectSharingApplication = Application.extend({
	initialize(options: Options) { void options }, createState() { return { route: undefined as Route | undefined, project: undefined as IProject | undefined, requests: new Map<string, AbortController>() } },
	onBeforeStart(_app: unknown, route: Route) { this.getState().route = route }, async prepareStart(route: Route, { signal }: LifecycleContext) { return new ProjectService().get(new ProjectModel({ id: Number(route.params.projectId) }), {}, signal) },
	onStart(_app: unknown, _route: unknown, project: IProject) { this.getState().project = project; this.options.commit(project); this.setView(new ProjectSharingView({ project, linkEnabled: this.options.config().link_sharing_enabled !== false, close: () => this.close(), panel: kind => new SharingPanelView({ kind, project, admin: project.maxPermission === 2, user: this.options.user(), frontendUrl: String(this.options.config().frontend_url ?? ''), read: view => void this.read(kind, view), search: query => this.search(kind, query), write: (action, row, view, accepted) => void this.write(kind, action, row, view, accepted) }) })); this.showView(); document.title = `${t('project.share.title', { project: project.title })} | Vikunja` },
	close() { if (history.state?.backdropView)
		history.back()
	else
		this.options.navigate(`/projects/${this.getState().project!.id}`, true) },
	async read(kind: Kind, view: PanelPort) { const state = this.getState(), key = `${kind}:read`; state.requests.get(key)?.abort(); const request = new AbortController(); state.requests.set(key, request); view.readLoading(true); try {
		const service = services(kind), model = shareModel(kind, state.project!.id, {}), rows: Entry[] = []
		let page = 1
		do {
			rows.push(...await service.getAll(model as never, {}, page++, request.signal) as unknown as Entry[])
		} while (page <= service.totalPages)
		request.signal.throwIfAborted()
		if (this.isRunning() && !view.isDestroyed())
			view.publish(rows)
	}
	catch (error) {
		if (!request.signal.aborted && this.isRunning() && !view.isDestroyed())
			view.feedback(error, true)
	}
	finally {
		if (state.requests.get(key) === request)
			state.requests.delete(key)
		if (!request.signal.aborted && !view.isDestroyed())
			view.readLoading(false)
	} },
	async search(kind: Kind, query: string) { const state = this.getState(), key = `${kind}:search`; state.requests.get(key)?.abort(); const request = new AbortController(); state.requests.set(key, request); try {
		if (!query)
			return []
		const service = kind === 'user' ? new UserService() : new TeamService(), params = kind === 'team' && this.options.config().public_teams_enabled ? { s: query, includePublic: true } : { s: query }
		const rows = await service.getAll(undefined, params, 1, request.signal) as unknown as Member[]
		request.signal.throwIfAborted()
		const panel = (this.getView() as InstanceType<typeof ProjectSharingView>).getChildView(kind === 'user' ? 'users' : 'teams') as unknown as PanelPort
		return rows.filter(row => (kind !== 'user' || row.id !== this.options.user().id) && !panel.getState().rows.some(shared => shared.id === row.id))
	}
	catch (error) {
		if (request.signal.aborted)
			throw new DOMException('Search canceled', 'AbortError')
		throw error
	}
	finally {
		if (state.requests.get(key) === request)
			state.requests.delete(key)
	} },
	async write(kind: Kind, action: string, row: Partial<Entry>, view: PanelPort, accepted: () => void) { const state = this.getState(), key = `${kind}:write`; if (state.requests.has(key) || state.project?.maxPermission !== 2)
		return; const request = new AbortController(); state.requests.set(key, request); view.clearError(); view.loading(true); try {
		const service = services(kind), model = shareModel(kind, state.project!.id, row)
		if (action === 'delete')
			await service.delete(model as never, request.signal)
		else if (action === 'update')
			await service.update(model as never, request.signal)
		else
			await service.create(model as never, request.signal)
		request.signal.throwIfAborted()
		if (!this.isRunning() || view.isDestroyed())
			return
		accepted()
		success(t(kind === 'link' ? `project.share.links.${action === 'delete' ? 'deleteSuccess' : 'createSuccess'}` : `project.share.userTeam.${action === 'delete' ? 'removeSuccess' : action === 'update' ? 'updatedSuccess' : 'addedSuccess'}`, { type: typeName(kind), sharable: t('project.list.title') }))
		await this.read(kind, view)
	}
	catch (error) {
		if (!request.signal.aborted && this.isRunning() && !view.isDestroyed()) {
			view.publish(view.getState().rows)
			view.feedback(error)
		}
	}
	finally {
		if (state.requests.get(key) === request)
			state.requests.delete(key)
		if (!request.signal.aborted && !view.isDestroyed())
			view.loading(false)
	} },
	onBeforeStop() { for (const request of this.getState().requests.values())
		request.abort(); this.getState().requests.clear(); this.getState().route = undefined; this.getState().project = undefined },
})
