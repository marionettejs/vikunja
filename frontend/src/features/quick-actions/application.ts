import { HintDialogView } from '@/shared/task-list/list-help'
import { labels, checklist } from '@/shared/task-list/list-task-row'
import { EditorAvatarView } from '@/shared/editor/editor-avatar'
import { fetchAvatarBlobUrl, observeAvatar, getDisplayName } from '@/models/user'
import { getHexColor } from '@/models/task'
import { Application, View, type RegionInstance } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import { repeat } from 'lit-html/directives/repeat.js'
import TaskService from '@/services/task'
import TeamService from '@/services/team'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import TeamModel from '@/models/team'
import type { ITask } from '@/modelTypes/ITask'
import type { IProject } from '@/modelTypes/IProject'
import type { Label } from '@/client/generated/index'
import type { SessionApplication } from '../../app/session'
import { parseTaskText } from '@/modules/quickAddMagic/quickAddMagicCore'
import { PrefixMode, PREFIXES } from '@/modules/quickAddMagic/prefixes'
import { getHistory } from '@/modules/projectHistory'
import { getProjectTitle } from '@/helpers/getProjectTitle'
import { createTasks } from '../../shared/quick-add'
import { listIcon } from '@/shared/task-list/list-ui'
import { displayDate, formatDateLong } from '../../shared/dates'
import { t } from '../../shared/i18n'
import { errorText, reportError, success } from '../../shared/notifications'
import './application.scss'
type Command = 'newTask' | 'newProject' | 'newTeam';
type Kind = 'command' | 'project' | 'task' | 'label' | 'team';
interface Result {
    id: string | number;
    title: string;
    task?: ITask;
    hexColor?: string;
}
interface Group {
    kind: Kind;
    items: Result[];
}
export interface QuickActionsOptions {
    session: InstanceType<typeof SessionApplication>;
    projects: () => IProject[];
    labels: () => Label[];
    ensureLabels: (titles: string[], signal: AbortSignal) => Promise<Label[]>;
    currentProject: () => IProject | undefined;
    commitProject: (project: IProject) => void;
    navigate: (href: string) => void;
}
export const QuickActionsApplication = Application.extend({
	initialize(options: QuickActionsOptions) { void options },
	createState() { return { dialog: undefined as {
            isDestroyed: () => boolean;
        } | undefined, overlay: undefined as RegionInstance | undefined } },
	onStart(_app: unknown, options: {
        overlay: RegionInstance;
    }) { this.getState().overlay = options.overlay; this.setView(new QuickActionsTrigger({ open: () => this.open() })); this.showView() },
	open() { const state = this.getState(); if (state.dialog && !state.dialog.isDestroyed())
		return; const dialog = new QuickActionsView({ controller: this }); state.dialog = dialog; state.overlay!.show(dialog) },
	close() { this.getState().overlay?.empty(); this.getState().dialog = undefined },
	async search(query: string, signal: AbortSignal) { const config = this.options, settings = config.session.getState().get('user')!.settings, parsed = parseTaskText(query, settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default), filter: string[] = []; if (parsed.project) {
		const project = config.projects().find(p => p.title.toLowerCase() === parsed.project!.toLowerCase())
		if (project)
			filter.push(`project = ${project.id}`)
	} const labels = config.labels().filter(label => parsed.labels.some(title => title.toLowerCase() === label.title?.toLowerCase())); if (labels.length)
		filter.push(`labels in ${labels.map(label => label.id).join(', ')}`); const teamsOnly = parsed.assignees.length > 0 && !parsed.project && !parsed.text; const [tasks, teams] = await Promise.all([teamsOnly ? Promise.resolve([]) : new TaskService().getAll(undefined, { s: parsed.text, sort_by: ['done', 'relevance'], filter: filter.join(' && ') }, 1, signal), parsed.assignees.length ? Promise.all(parsed.assignees.map(name => new TeamService().getAll(undefined, { s: name }, 1, signal))) : Promise.resolve([])]); signal.throwIfAborted(); return { tasks, teams: teams.flat().map(team => ({ id: team.id, title: team.name })) } },
	async create(command: Command, query: string, signal: AbortSignal) { const config = this.options, settings = config.session.getState().get('user')!.settings, current = config.currentProject(); if (command === 'newTask') {
		const parsed = parseTaskText(query, settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default), target = parsed.project ? config.projects().find(p => p.title.toLowerCase() === parsed.project!.toLowerCase()) : undefined, labels = await config.ensureLabels(parsed.labels, signal), result = await createTasks([{ title: query, projectId: target?.id ?? (current && current.id > 0 ? current.id : settings.defaultProjectId ?? 0) }], { settings, labels: [...config.labels(), ...labels], reportError }, signal)
		signal.throwIfAborted()
		if (result.error)
			throw result.error
		if (!result.tasks[0])
			throw new Error(t('error.error'))
		return `/tasks/${result.tasks[0].id}`
	} if (command === 'newProject') {
		const project = await new ProjectService().create(new ProjectModel({ title: query, parentProjectId: Math.max(current?.id ?? 0, 0) }), signal)
		signal.throwIfAborted()
		config.commitProject(project)
		return `/projects/${project.id}`
	} const team = await new TeamService().create(new TeamModel({ name: query }) as unknown as import('@/modelTypes/ITeam').ITeam, signal); signal.throwIfAborted(); return `/teams/${team.id}/edit` },
	onBeforeStop() { this.close() },
})
const QuickActionsTrigger = View.extend({
	initialize(options: {
        open: () => void;
    }) { void options },
	tagName: 'button', className: 'base-button base-button--type-button header-search', attributes: () => ({ type: 'button', title: t('keyboardShortcuts.quickSearch'), 'aria-label': t('keyboardShortcuts.quickSearch') }),
	template: () => listIcon('search'), events: { click: 'open' }, open() { this.options.open() },
	createState() { return { key: (event: KeyboardEvent) => { const mac = /Mac|iPhone|iPad/.test(navigator.platform); if (event.code === 'KeyK' && (mac ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey) {
		event.preventDefault()
		this.open()
	} } } },
	onAttach() { document.addEventListener('keydown', this.getState().key) }, onBeforeDestroy() { document.removeEventListener('keydown', this.getState().key) },
}).setDomApi(LitDomApi)
export const QuickActionsView = View.extend({
	initialize(options: {
        controller: {
            options: QuickActionsOptions;
            close: () => void;
            search: (query: string, signal: AbortSignal) => Promise<{
                tasks: ITask[];
                teams: Result[];
            }>;
            create: (command: Command, query: string, signal: AbortSignal) => Promise<string>;
        };
    }) { void options },
	regions: { help: '[data-help-host]' }, tagName: 'dialog', className: 'native-quick-actions', attributes: () => ({ 'aria-label': t('quickActions.title') }),
	events: { 'input input': 'changed', 'keydown input': 'inputKey', 'keydown [data-result]': 'resultKey', 'click [data-result]': 'choose', 'click [data-close]': 'close', cancel: 'cancel', click: 'backdrop', 'click [data-retry]': 'retry', 'click [data-help]': 'help' },
	createState() { return { avatars: new Set<string>(), query: '', command: undefined as Command | undefined, groups: [] as Group[], tasks: [] as ITask[], teams: [] as Result[], life: new AbortController(), search: undefined as AbortController | undefined, timer: undefined as ReturnType<typeof setTimeout> | undefined, announce: undefined as ReturnType<typeof setTimeout> | undefined, busy: false, loading: false, error: '', focus: document.activeElement as HTMLElement | null, overflow: document.body.style.overflow } },
	template: () => html `<div class="card quick-actions"><div class="action-input"><div data-command class="active-cmd tag" hidden></div><input class="input" aria-label=${t('quickActions.title')} placeholder=${t('quickActions.placeholder')} autocomplete="off"><button type="button" class="base-button base-button--type-button icon is-small show-helper-text" data-help hidden aria-label=${t('task.quickAddMagic.hint')}>${listIcon('circle-question', true)}</button><button type="button" class="base-button base-button--type-button close" data-close aria-label=${t('misc.closeQuickActions')}>${listIcon('times')}</button></div><div data-hint class="help has-text-grey-light p-2"></div><div data-status class="is-sr-only" role="status" aria-live="polite"></div><div data-error class="message danger" role="alert" hidden></div><button type="button" class="button is-outlined" data-retry hidden>${t('loadingError.tryAgain')}</button><div class="results" data-results></div><div data-help-host></div></div><button type="button" class="base-button base-button--type-button quick-actions-outside-close" data-close aria-label=${t('misc.closeQuickActions')}>${listIcon('times')}</button>`,
	onAttach() { const state = this.getState(); state.overflow = document.body.style.overflow; state.focus = document.activeElement as HTMLElement | null; document.body.style.overflow = 'hidden'; (this.el as HTMLDialogElement).showModal(); this.input().focus(); this.changed() },
	input() { return this.el.querySelector<HTMLInputElement>('input')! },
	config() { return this.options.controller.options },
	parsed() { const settings = this.config().session.getState().get('user')!.settings; return parseTaskText(this.getState().query, settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default) },
	changed() { const state = this.getState(); state.query = this.input().value; state.search?.abort(); clearTimeout(state.timer); state.tasks = []; state.teams = []; state.error = ''; state.loading = !state.command; this.publish(); if (!state.command)
		state.timer = setTimeout(() => void this.search(), 150) },
	async search() { const state = this.getState(), request = new AbortController(); state.search?.abort(); state.search = request; state.loading = true; this.publish(); const signal = AbortSignal.any([request.signal, state.life.signal]); try {
		const result = await this.options.controller.search(state.query, signal)
		signal.throwIfAborted()
		if (state.search !== request)
			return
		state.tasks = result.tasks
		state.teams = result.teams
	}
	catch (error) {
		if (!signal.aborted && state.search === request)
			state.error = errorText(error)
	}
	finally {
		if (state.search === request) {
			state.search = undefined
			state.loading = false
			if (!state.life.signal.aborted)
				this.publish()
		}
	} },
	groups(): Group[] { const state = this.getState(); if (state.command)
		return []; const parsed = this.parsed(), projects = this.config().projects().filter(p => !p.isArchived), query = state.query.toLowerCase(), projectQuery = (parsed.project ?? parsed.text).toLowerCase(); let found: IProject[] = []; if (parsed.project || (!parsed.labels.length && !parsed.assignees.length))
		found = projectQuery ? projects.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(projectQuery)) : getHistory().flatMap(history => projects.filter(p => p.id === history.id)); const labelQuery = (parsed.labels[0] ?? parsed.text).toLowerCase(); return [{ kind: 'command', items: (['newTask', 'newProject', 'newTeam'] as Command[]).map(id => ({ id, title: t(`quickActions.cmds.${id}`) })).filter(cmd => cmd.title.toLowerCase().includes(query)) }, { kind: 'project', items: found.map(p => ({ id: p.id, title: getProjectTitle(p) })) }, { kind: 'task', items: state.tasks.map(task => ({ id: task.id, title: task.title, task })) }, { kind: 'label', items: labelQuery ? this.config().labels().filter(label => label.title?.toLowerCase().includes(labelQuery)).map(label => ({ id: label.id!, title: label.title!, hexColor: label.hex_color })) : [] }, { kind: 'team', items: state.teams }].filter(group => group.items.length) as Group[] },
	publish() { const state = this.getState(); state.groups = this.groups(); const command = this.el.querySelector<HTMLElement>('[data-command]')!; command.hidden = !state.command; this.el.querySelector('.action-input')!.classList.toggle('has-active-cmd', Boolean(state.command)); command.textContent = state.command ? t(`quickActions.cmds.${state.command}`) : ''; this.el.querySelector<HTMLElement>('[data-help]')!.hidden = state.command !== 'newTask' || !PREFIXES[this.config().session.getState().get('user')!.settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default]; this.input().placeholder = t(state.command ? `quickActions.${state.command}` : 'quickActions.placeholder'); this.input().classList.toggle('is-loading', state.loading || state.busy); const error = this.el.querySelector<HTMLElement>('[data-error]')!; error.hidden = !state.error; error.textContent = state.error; const retry = this.el.querySelector<HTMLButtonElement>('[data-retry]')!; retry.hidden = !state.error; retry.disabled = state.busy; const settings = this.config().session.getState().get('user')!.settings, project = this.config().currentProject(); const hint = this.el.querySelector<HTMLElement>('[data-hint]')!; hint.hidden = state.command === 'newTask'; hint.textContent = state.command === 'newTask' ? t('quickActions.createTask', { title: project?.title ?? '' }) : state.command === 'newProject' ? t('quickActions.createProject') : t('quickActions.hint', { ...(PREFIXES[settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default] ?? PREFIXES[PrefixMode.Default]) }); render(html `${repeat(state.groups, g => g.kind, group => html `<div class="result"><span class="result-title">${t(`quickActions.${({ command: 'commands', project: 'projects', task: 'tasks', label: 'labels', team: 'teams' } as const)[group.kind]}`)}</span><div class="result-items">${repeat(group.items, item => item.id, item => html `<button type="button" class="result-item-button ${item.task?.done ? 'is-strikethrough' : ''}" data-result data-kind=${group.kind} data-id=${item.id}>${this.result(item, group.kind)}<span class="is-sr-only">${t(`quickActions.resultTypes.${group.kind}`)}</span></button>`)}</div></div>`)}`, this.el.querySelector('[data-results]')!); this.showAvatars(); clearTimeout(state.announce); state.announce = setTimeout(() => { if (!state.life.signal.aborted)
        this.el.querySelector('[data-status]')!.textContent = t('quickActions.results', state.groups.reduce((n, g) => n + g.items.length, 0)) }, 300) },
	result(item: Result, kind: Kind) { if (kind === 'label')
		return html `<span class="tag" style=${item.hexColor ? `background-color:#${item.hexColor.replace('#', '')}` : ''}>${item.title}</span>`; if (!item.task)
		return html `${Number(item.id) < -1 ? listIcon('filter') : nothing}${item.title}`; const task = item.task, project = this.config().projects().find(p => p.id === task.projectId); return html `<span class="task-inline-readonly task"><span><span class="task-project ${task.hexColor ? 'mie-2' : ''}">${project ? getProjectTitle(project) : ''}</span> ${task.hexColor ? html `<span class="color-bubble mie-1" style=${`background-color:${getHexColor(task.hexColor)}`}></span>` : nothing} ${!task.done && task.priority >= (this.config().session.getState().get('user')!.settings.frontendSettings.minimumPriority || 2) ? html `<span class="priority-label ${task.priority >= 3 ? 'high-priority' : task.priority > 1 ? 'not-so-high' : 'negligible'}"><span class="icon">${listIcon(task.priority >= 3 ? 'exclamation-circle' : 'exclamation')}</span> ${t(`task.priority.${['unset', 'low', 'medium', 'high', 'urgent', 'doNow'][task.priority]}`)}</span>` : nothing}${task.relatedTasks.parenttask?.length ? html `<span class="parent-tasks">${task.relatedTasks.parenttask.map(parent => parent.title).join(', ')} › </span>` : nothing} ${task.title}</span>${labels(task, 'labels mis-2 mie-1')}${task.assignees.map(user => html `<span class="assignee" title=${getDisplayName(user)} data-avatar-host=${`${task.id}-${user.username}`}></span>`)}${task.dueDate && +task.dueDate > 0 ? html `<time title=${formatDateLong(task.dueDate)}>${displayDate(task.dueDate)}</time>` : nothing}${task.attachments.length ? listIcon('paperclip') : nothing}${task.description ? listIcon('align-left') : nothing}${(typeof task.repeatAfter === 'object' && task.repeatAfter.amount) ? listIcon('history') : nothing}${checklist(task, { t, displayDate })}${task.percentDone ? html `<progress class="progress is-small" max="100" value=${task.percentDone * 100}>${task.percentDone * 100}%</progress>` : nothing}${task.done ? html `<span class="is-sr-only">${t('task.attributes.done')}</span>` : nothing}</span>` },
	showAvatars() { const current = new Set<string>(); for (const host of this.el.querySelectorAll<HTMLElement>('[data-avatar-host]')) {
		const key = host.dataset.avatarHost!, user = this.getState().tasks.flatMap(task => task.assignees.map(user => ({ key: `${task.id}-${user.username}`, user }))).find(item => item.key === key)?.user
		if (!user)
			continue
		current.add(key)
		if (!this.hasRegion(key))
			this.addRegion(key, { el: host })
		if (!this.getChildView(key))
			this.showChildView(key, new EditorAvatarView({ user, size: 20, imageClass: 'avatar', context: { avatar: (username, size) => fetchAvatarBlobUrl({ username }, size), observeAvatar } }))
	} for (const key of this.getState().avatars)
		if (!current.has(key))
			this.removeRegion(key); this.getState().avatars = current },
	inputKey(event: KeyboardEvent) { if (event.isComposing)
		return; if (event.key === 'Escape') {
		event.preventDefault()
		this.close()
	}
	else if (event.key === 'ArrowDown') {
		event.preventDefault()
		this.el.querySelector<HTMLButtonElement>('[data-result]')?.focus()
	}
	else if (event.key === 'Enter') {
		event.preventDefault()
		void this.execute()
	}
	else if (event.key === 'Backspace' && !this.input().value && this.getState().command) {
		this.getState().command = undefined
		this.changed()
	} },
	resultKey(event: KeyboardEvent) { const buttons = [...this.el.querySelectorAll<HTMLButtonElement>('[data-result]')], index = buttons.indexOf((event as KeyboardEvent & {
        delegateTarget: HTMLButtonElement;
    }).delegateTarget); if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
		event.preventDefault()
		if (index === 0 && event.key === 'ArrowUp')
			this.input().focus()
		else
			buttons[index + (event.key === 'ArrowUp' ? -1 : 1)]?.focus()
	}
	else if (event.key === 'Escape') {
		event.preventDefault()
		event.stopPropagation()
		this.input().focus()
	} },
	choose(event: Event) { const target = (event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget; this.action(target.dataset.kind as Kind, target.dataset.id!) },
	action(kind: Kind, id: string | number) { const state = this.getState(), item = state.groups.find(g => g.kind === kind)?.items.find(item => String(item.id) === String(id)); if (!item)
		return; if (kind === 'command') {
		state.command = item.id as Command
		this.input().value = ''
		this.changed()
		this.input().focus()
	}
	else if (kind === 'label') {
		this.input().value = /\s/.test(item.title) ? `*"${item.title}"` : `*${item.title}`
		this.changed()
		this.input().focus()
	}
	else {
		const href = kind === 'task' ? `/tasks/${id}` : kind === 'project' ? `/projects/${id}` : `/teams/${id}/edit`
		this.close()
		this.config().navigate(href)
	} },
	async execute() { const state = this.getState(); if (!state.command) {
		if (state.groups.length === 1 && state.groups[0].items.length === 1)
			this.action(state.groups[0].kind, state.groups[0].items[0].id)
		return
	} if (!state.query.trim() || state.busy)
		return; const query = state.query, command = state.command, signal = state.life.signal; state.busy = true; state.error = ''; this.publish(); try {
		const href = await this.options.controller.create(command, query, signal)
		signal.throwIfAborted()
		success(t(command === 'newTask' ? 'task.createSuccess' : command === 'newProject' ? 'project.create.createdSuccess' : 'team.create.success'))
		if (state.query === query && state.command === command) {
			this.close()
			if (href)
				this.config().navigate(href)
		}
	}
	catch (error) {
		if (!signal.aborted)
			state.error = errorText(error)
	}
	finally {
		state.busy = false
		if (!signal.aborted)
			this.publish()
	} },
	help() { if (!this.getChildView('help'))
		this.showChildView('help', new HintDialogView({ context: { t, quickAddMode: () => this.config().session.getState().get('user')!.settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default } })) },
	retry() { if (this.getState().command)
		void this.execute()
	else
		void this.search() },
	cancel(event: Event) { event.preventDefault(); this.close() }, backdrop(event: MouseEvent) { if (event.target === this.el)
		this.close() }, close() { this.options.controller.close() },
	onBeforeDestroy() { const state = this.getState(); state.life.abort(); state.search?.abort(); clearTimeout(state.timer); clearTimeout(state.announce); this.getRegion('help')!.empty(); (this.el as HTMLDialogElement).close(); document.body.style.overflow = state.overflow; if (state.focus?.isConnected)
		state.focus.focus() },
}).setDomApi(LitDomApi)
