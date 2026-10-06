import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import TeamService from '@/services/team'
import TeamModel from '@/models/team'
import TeamMemberService from '@/services/teamMember'
import TeamMemberModel from '@/models/teamMember'
import UserService from '@/services/user'
import { getDisplayName } from '@/models/user'
import type { ITeam } from '@/modelTypes/ITeam'
import type { ITeamMember } from '@/modelTypes/ITeamMember'
import type { IUser } from '@/modelTypes/IUser'
import { NativeEditorView, type NativeEditorOptions } from '@/shared/editor/editor'
import { ConfirmationView, ShareSearchView, type Member } from '../projects/project-sharing'
import { interceptLink, type Route } from '../../app/routes'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import '../organizations/organization.scss'
import {publicTeamCheckbox} from '../organizations/organization-ui'
interface Options {
    user: () => IUser;
    config: () => Record<string, unknown>;
    editor: NativeEditorOptions['context'];
    navigate: (href: string) => void;
}
const TeamListView = View.extend({
	initialize(options: {
        teams: ITeam[];
        navigate: Options['navigate'];
    }) { void options }, className: 'content loader-container is-max-width-desktop native-teams native-list-surface', templateContext() { return this.options }, template({ teams, navigate }: {
        teams: ITeam[];
        navigate: Options['navigate'];
    }) { return html `<a class="button is-primary is-pulled-end" href="/teams/new" @click=${(event: MouseEvent) => interceptLink(event, navigate)}><span class="icon is-small">${listIcon('plus')}</span><span>${t('team.create.title')}</span></a><h1>${t('team.title')}</h1>${teams.length ? html `<div class="card"><ul class="teams">${teams.map(team => html `<li><a href=${`/teams/${team.id}/edit`} @click=${(event: MouseEvent) => interceptLink(event, navigate)}><p>${team.name}</p></a></li>`)}</ul></div>` : html `<p class="has-text-centered has-text-grey is-italic">${t('team.noTeams')} <a href="/teams/new" @click=${(event: MouseEvent) => interceptLink(event, navigate)}>${t('team.create.title')}.</a></p>`}` },
}).setDomApi(LitDomApi)
const TeamEditView = View.extend({
	initialize(options: {
        team: ITeam;
        user: IUser;
        publicEnabled: boolean;
        editor: Options['editor'];
        search: (query: string) => Promise<IUser[]>;
        write: (action: string, value: ITeam | ITeamMember) => void;
    }) { void options }, className: 'loader-container is-max-width-desktop native-team-edit native-list-surface', regions: { description: '[data-description]', search: '[data-search]', confirmation: '[data-confirmation]' },
	ui: { form: '[data-form]', name: '#teamtext', public: '[data-public]', members: '[data-members]', error: '[data-error]', actions: '[data-action]' }, events: { 'submit @ui.form': 'save', 'click [data-delete]': 'deleteTeam', 'click [data-add]': 'add', 'click [data-admin]': 'toggle', 'click [data-remove]': 'remove', 'click [data-leave]': 'leave' },
	createState() { return { team: (new TeamModel(this.options.team) as ITeam), description: this.options.team.description, selected: undefined as IUser | undefined, found: [] as IUser[] } },
	templateContext() { return { ...this.options, admin: Number(this.options.team.maxPermission) > 0 && !this.options.team.externalId } },
	template({ team, publicEnabled, admin }: {
        team: ITeam;
        publicEnabled: boolean;
        admin: boolean;
    }) { return html `<div data-error role="alert" class="message danger" hidden></div>${admin ? html `<section class="card is-fullwidth"><header class="card-header"><p class="card-header-title">${t('team.edit.title', { team: team.name })}</p></header><div class="card-content"><form data-form><div class="field"><label class="label" for="teamtext">${t('team.attributes.name')}</label><input id="teamtext" class="input" placeholder=${t('team.attributes.namePlaceholder')} .value=${team.name}></div>${publicEnabled ? publicTeamCheckbox(team.isPublic) : nothing}<div class="field"><label class="label">${t('team.attributes.description')}</label><div data-description></div></div><div class="field has-addons mbs-4"><div class="control is-fullwidth"><button data-action type="submit" class="button is-primary is-fullwidth">${t('misc.save')}</button></div><div class="control"><button data-action type="button" data-delete class="button is-danger" aria-label=${t('team.edit.delete.header')}>${listIcon('trash-alt')}</button></div></div></form></div></section>` : nothing}<section class="card is-fullwidth has-overflow"><header class="card-header"><p class="card-header-title">${t('team.edit.members')}</p></header>${admin ? html `<div class="p-4"><div class="field has-addons"><div class="control is-expanded" data-search></div><div class="control"><button data-action data-add type="button" class="button is-primary"><span class="icon is-small">${listIcon('plus')}</span><span>${t('team.edit.addUser')}</span></button></div></div></div>` : nothing}<div class="has-horizontal-overflow"><table class="table has-actions is-striped is-hoverable is-fullwidth"><tbody data-members></tbody></table></div></section>${!team.externalId ? html `<button data-action type="button" data-leave class="button is-fullwidth is-danger">${t('team.edit.leave.title')}</button>` : nothing}<div data-confirmation></div>` },
	onAttach(){(this.getUI('name')?.[0] as HTMLInputElement|undefined)?.focus()},
	onRender() { const team = this.getState().team, admin = Number(team.maxPermission) > 0 && !team.externalId; if (admin) {
		this.showChildView('description', new NativeEditorView({ value: team.description, canWrite: true, projectId: 0, storageKey: `team-${team.id}-description`, placeholder: t('team.attributes.descriptionPlaceholder'), context: this.options.editor, changed: value => { this.getState().description = value }, save: async (value) => value, showSave: false, enableDiscard: false, editShortcut: '' }))
		this.showChildView('search', new ShareSearchView({ id: 'team-member-search', kind: 'user', label: t('team.edit.search'), placeholder: t('team.edit.search'), items: [], selected: null, changed: (value: string | number | null) => { this.getState().selected = this.getState().found.find(user => user.id === Number(value)) }, search: async (query) => { const users = await this.options.search(query); if (!this.isDestroyed())
			this.getState().found = users; return users as unknown as Member[] }, error: error => this.feedback(error) }))
	} this.publishMembers(team) },
	values() { const team = (new TeamModel(this.getState().team) as ITeam); team.name = (this.getUI('name')?.[0] as HTMLInputElement | undefined)?.value ?? team.name; team.description = this.getState().description; team.isPublic = (this.getUI('public')?.[0] as HTMLInputElement | undefined)?.checked ?? team.isPublic; return team },
	save(event: Event) { event.preventDefault(); const team = this.values(); if (!team.name.trim()) {
		this.feedback(t('team.attributes.nameRequired'))
		return
	} this.options.write('save', team) },
	add() { const user = this.getState().selected; if (!user) {
		this.feedback(t('team.edit.mustSelectUser'))
		return
	} this.options.write('add', new TeamMemberModel({ ...user, teamId: this.getState().team.id })) },
	member(event: Event) { return this.getState().team.members.find(member => member.id === Number((event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget.dataset.member)) }, toggle(event: Event) { const member = this.member(event); if (member)
		this.options.write('admin', new TeamMemberModel({ ...member, teamId: this.getState().team.id })) },
	confirm(action: string, value: ITeam | ITeamMember, header: string) { this.showChildView('confirmation', new ConfirmationView({ title: t(`${header}.${action === 'leave' ? 'title' : 'header'}`), text: `${t(`${header}.text1`)} ${t(`${header}.text2`)}`, submit: () => this.options.write(action, value), close: () => this.getRegion('confirmation')!.empty() })) },
	deleteTeam() { this.confirm('delete', this.getState().team, 'team.edit.delete') }, remove(event: Event) { const member = this.member(event); if (member)
		this.confirm('remove', new TeamMemberModel({ ...member, teamId: this.getState().team.id }), 'team.edit.deleteUser') }, leave() { this.confirm('leave', new TeamMemberModel({ ...this.options.user, teamId: this.getState().team.id }), 'team.edit.leave') },
	publishMembers(team: ITeam) { this.getState().team = (new TeamModel(team) as ITeam); const admin = Number(team.maxPermission) > 0 && !team.externalId; render(html `${[...team.members].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), undefined, { sensitivity: 'base' })).map(member => html `<tr><td>${getDisplayName(member)}</td><td>${member.id === this.options.user.id ? html `<b class="is-success">${t('project.share.userTeam.you')}</b>` : nothing}</td><td class="type"><span class="icon is-small">${listIcon(member.admin?'lock':'user')}</span>${t(member.admin ? 'team.attributes.admin' : 'team.attributes.member')}</td>${admin ? html `<td class="actions">${member.id !== this.options.user.id ? html `<button type="button" data-action data-admin data-member=${member.id} class="button is-primary">${t(member.admin ? 'team.edit.makeMember' : 'team.edit.makeAdmin')}</button><button type="button" data-action data-remove data-member=${member.id} class="button is-danger" aria-label=${t('team.edit.deleteUser.header')}>${listIcon('trash-alt')}</button>` : nothing}</td>` : nothing}</tr>`)}`, (this.getUI('members')![0] as HTMLElement)) },
	loading(value: boolean) { for (const button of this.el.querySelectorAll<HTMLButtonElement>('[data-action]')) {
		button.disabled = value
		button.classList.toggle('is-loading', value)
	} (this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.loading(value); if (value)
		(this.getUI('error')![0] as HTMLElement).hidden = true }, feedback(error: unknown) { const el = this.getUI('error')![0] as HTMLElement; el.textContent = errorText(error); el.hidden = false; (this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.feedback(error) },
	accepted(team: ITeam, action: string) { this.publishMembers(team); if (['add', 'remove', 'admin'].includes(action)) {
		if (action === 'add') {
			this.getState().selected = undefined;
			(this.getChildView('search') as InstanceType<typeof ShareSearchView>).clear(new Event('clear'))
		}
        this.getRegion('confirmation')!.empty()
	} },
}).setDomApi(LitDomApi)
export const TeamAdministrationApplication = Application.extend({
	initialize(options: Options) { void options }, createState() { return { route: undefined as Route | undefined, request: undefined as AbortController | undefined, search: undefined as AbortController | undefined } }, onBeforeStart(_app: unknown, route: Route) { this.getState().route = route },
	async prepareStart(route: Route, { signal }: LifecycleContext) { const service = new TeamService(); if (route.params.id)
		return service.get((new TeamModel({ id: Number(route.params.id) }) as ITeam), {}, signal); const teams: ITeam[] = []; let page = 1; do {
		teams.push(...await service.getAll(undefined, {}, page++, signal))
	} while (page <= service.totalPages); signal.throwIfAborted(); return teams },
	onStart(_app: unknown, _route: unknown, data: ITeam | ITeam[]) { this.setView(Array.isArray(data) ? new TeamListView({ teams: data, navigate: this.options.navigate }) : new TeamEditView({ team: data, user: this.options.user(), publicEnabled: Boolean(this.options.config().public_teams_enabled), editor: this.options.editor, search: query => this.searchUsers(query), write: (action, value) => void this.write(action, value) })); this.showView(); document.title = `${Array.isArray(data) ? t('team.title') : t('team.edit.title', { team: data.name })} | Vikunja` },
	async searchUsers(query: string) { const state = this.getState(); state.search?.abort(); const request = state.search = new AbortController(); try {
		if (!query)
			return []
		const users = await new UserService().getAll(undefined, { s: query }, 1, request.signal)
		request.signal.throwIfAborted()
		return users.filter(user => user.id !== this.options.user().id)
	}
	catch (error) {
		if (request.signal.aborted)
			throw new DOMException('Search canceled', 'AbortError')
		throw error
	} },
	async write(action: string, value: ITeam | ITeamMember) { const state = this.getState(); if (state.request)
		return; const request = state.request = new AbortController(), view = this.getView() as InstanceType<typeof TeamEditView>; view.loading(true); try {
		const service = new TeamService(), members = new TeamMemberService()
		if (action === 'save') {
			const team = await service.update(value as ITeam, request.signal)
			request.signal.throwIfAborted()
			if (!this.isRunning() || view.isDestroyed())
				return
			view.accepted(team, action)
		}
		else if (action === 'delete') {
			await service.delete(value as ITeam, request.signal)
			request.signal.throwIfAborted()
			if (this.isRunning())
				this.options.navigate('/teams')
		}
		else {
			if (action === 'add')
				await members.create(value as ITeamMember, request.signal)
			else if (action === 'admin')
				await members.update(value as ITeamMember, request.signal)
			else
				await members.delete(value as ITeamMember, request.signal)
			request.signal.throwIfAborted()
			if (!this.isRunning() || view.isDestroyed())
				return
			if (action === 'leave')
				this.options.navigate('/')
			else {
				const team = await service.get((new TeamModel({ id: Number(state.route!.params.id) }) as ITeam), {}, request.signal)
				request.signal.throwIfAborted()
				if (this.isRunning() && !view.isDestroyed())
					view.accepted(team, action)
			}
		}
		if (!request.signal.aborted && this.isRunning())
			success(t(action === 'save' ? 'team.edit.success' : action === 'delete' ? 'team.edit.delete.success' : action === 'add' ? 'team.edit.userAddedSuccess' : action === 'leave' ? 'team.edit.leave.success' : action === 'remove' ? 'team.edit.deleteUser.success' : (value as ITeamMember).admin ? 'team.edit.madeMember' : 'team.edit.madeAdmin'))
	}
	catch (error) {
		if (!request.signal.aborted && this.isRunning() && !view.isDestroyed())
			view.feedback(error)
	}
	finally {
		if (state.request === request)
			state.request = undefined
		if (!request.signal.aborted && !view.isDestroyed())
			view.loading(false)
	} },
	onBeforeStop() { this.getState().request?.abort(); this.getState().search?.abort(); this.getState().request = undefined; this.getState().search = undefined; this.getState().route = undefined },
})
