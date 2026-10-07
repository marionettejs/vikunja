import {ShellApplication} from './shell-application'
import {ShellView} from './shell-view'
import {TimerApplication} from '../features/timer/application'
import type {TimeTrackingApplication} from '../features/time-tracking/application'
import type {TimePorts} from '../features/time-tracking/time-form'
import type {AdminApplication} from '../features/admin/application'
import {featureEnabled} from '../shared/feature-enabled'
import {PRO_FEATURE} from '@/constants/proFeatures'
import type {ImportApplication} from '../features/imports/import-services'
import type {OAuthApplication} from '../features/imports/oauth'
import {SystemPagesApplication,NotFoundView} from './system-pages'
import type {TeamAdministrationApplication} from '../features/teams/application'
import type {LabelsApplication} from '../features/labels/application'
import type {OrganizationCreateApplication} from '../features/organizations/application'
import type {ProjectSharingApplication} from '../features/projects/project-sharing'
import type {DailyEntryApplication} from '../features/home/application'
import type {ProjectManagementApplication} from '../features/projects/project-management'
import {
	saveProjectToHistory,
	removeProjectFromHistory,
} from '@/modules/projectHistory'
import ProjectService from '@/services/project'
import ProjectModel from '@/models/project'
import { getProjectViewId, saveProjectView } from '@/helpers/projectView'
import type {SettingsApplication} from '../features/settings/application'
import { AUTH_TYPES } from '@/modelTypes/IUser'
import { ShareShellView } from './share-shell'
import popSoundFile from '@/assets/audio/pop.mp3'
import { Application, View, type LifecycleContext } from 'marionette'
import { Collection, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import TaskService from '@/services/task'
import { parseTaskText } from '@/modules/quickAddMagic/quickAddMagicCore'
import { createTasks } from '../shared/quick-add'
import type { IProject } from '@/modelTypes/IProject'
import {
	taskLabelsCreate,
	taskLabelsDelete,
	type Label,
} from '@/client/generated'
import type { ListWidgets } from '@/shared/task-list/list-context'
import { PrefixMode } from '@/modules/quickAddMagic/prefixes'
import { CatalogApplication } from '../features/projects/catalog'
import {
	ProjectListPendingView,
	ProjectMetadataPendingView,
} from '@/features/projects/project-list-view'
import { parseListQuery } from '@/shared/task-list/task-list-query'
import type { TaskApplication, TaskPorts } from '../features/task/application'
import TaskCommentService from '@/services/taskComment'
import ProjectUserService from '@/services/projectUsers'
import TaskAssigneeService from '@/services/taskAssignee'
import TaskAssigneeModel from '@/models/taskAssignee'
import ReactionService from '@/services/reactions'
import ReactionModel from '@/models/reaction'
import UserSettingsService from '@/services/userSettings'
import { fetchTaskById } from '@/helpers/fetchTaskById'
import { observeTasks } from '@/helpers/taskCache'
import { fetchAvatarBlobUrl, observeAvatar } from '@/models/user'
import { uploadFile, uploadFilesForEditor } from '@/helpers/attachments'
import { formatDateLong } from '../shared/dates'
import type { IUser } from '@/modelTypes/IUser'
import type { IAbstract } from '@/modelTypes/IAbstract'
import type { ITaskComment } from '@/modelTypes/ITaskComment'
import { ProjectApplication } from '../features/projects/application'
import type { SessionApplication } from './session'
import { t } from '../shared/i18n'
import {
	errorText,
	reportError,
	success,
} from '../shared/notifications'
import { displayDate } from '../shared/dates'
import { interceptLink, parseRoute, queryHref, type Route } from './routes'
interface Options {
	session: InstanceType<typeof SessionApplication>
	navigate: (href: string, replace?: boolean) => void
}
const StatusView = View.extend({
	initialize(options: { text: string }) {
		void options
	},
	templateContext() {
		return this.options
	},
	template: ({ text }: { text: string }) =>
		html`<div role="status">${text}</div>`,
}).setDomApi(LitDomApi)
export const WorkspaceApplication = Application.extend({
	initialize(options: Options) {
		void options
		this.registerSettings()
		this.registerCatalog()
		this.addChildApp('shell',new ShellApplication({session:options.session,navigate:options.navigate,openProject:href=>this.openHref(href),retry:()=>{this.getState().current?.stop();this.getState().contentKey='';void this.showRoute(this.getState().route!)},projects:this.getState().projects,quickActions:{session:options.session,navigate:options.navigate,projects:()=>this.getState().projects.models.map(model=>model.get('project') as IProject),labels:()=>this.getState().labels,ensureLabels:(titles,signal)=>(this.getChildApp('catalog') as InstanceType<typeof CatalogApplication>).ensureLabels(titles,signal),currentProject:()=>this.getState().route?.kind==='task'?this.shell().navigationProject():this.getState().projects.get(Number(this.getState().route?.params.projectId))?.get('project') as IProject|undefined,commitProject:project=>{const model=this.getState().projects.get(project.id);if(model)model.set('project',project);else this.getState().projects.add({id:project.id,project})}}}))

		this.registerTaskAndProject()
	},
	registerSettings() {
		this.addChildApp('systemPages',new SystemPagesApplication({config:()=>this.options.session.getState().get('config')??{},navigate:this.options.navigate}))


	},
	registerCatalog() {
		this.addChildApp(
			'catalog',
			new CatalogApplication({
				projects: (projects) => {
					for (const project of projects) {
						const model = this.getState().projects.get(project.id)
						if (this.getState().deletedProjects.has(project.id)) continue
						if (model)
							model.set({
								project: { ...project, ...(model.get('project') as IProject),maxPermission:(model.get('project') as IProject).maxPermission??project.maxPermission },
							})
						else this.getState().projects.add({ id: project.id, project })
					}
				},
				labels: (labels) => {
					this.getState().labels = labels
					this.getState().labelsLoading = false
					this.getState().labelsChanged.forEach((changed) => changed())
				},
			}),
		)
	},
	async registerManagementApp(name: string, current: () => boolean) {
		const commit = (project: IProject) => {
			const state = this.getState()
			if (state.deletedProjects.has(project.id)) return
			const model = state.projects.get(project.id)
			if (model) model.set({ project })
			else state.projects.add({ id: project.id, project })
			this.syncProjectBackground()
		}
		const management = {
			config: () => this.options.session.getState().get('config') ?? {},
			filter: this.widgets().filter,
			navigate: (href: string, replace?: boolean) =>
				this.options.navigate(href, replace),
			commit,
			remove: (ids: number[]) => {
				(this.getChildApp('directory') as InstanceType<typeof ProjectManagementApplication> | undefined)?.removeProjects(ids)
				for (const id of ids) {
					this.getState().deletedProjects.add(id)
					this.getState().projects.remove(id)
					removeProjectFromHistory({ id })
				}
			},
			editor: this.taskPorts(this.widgets().context).editor,
		}
		const catalog = this.getChildApp('catalog') as InstanceType<
			typeof CatalogApplication
		>
		const organization = {
			navigate: (href: string) => this.openHref(href),
			config: () => this.options.session.getState().get('config') ?? {},
			catalog,
			editor: management.editor,
		}
		if (name === 'imports') {
			const {ImportApplication} = await import('../features/imports/import-services')
			if (current() && !this.getChildApp(name)) this.addChildApp('imports',new ImportApplication({user:()=>this.options.session.getState().get('user')!,config:()=>this.options.session.getState().get('config')??{},navigate:this.options.navigate,catalog,context:this.widgets().context,current:()=>this.isRunning()&&this.options.session.getState().get('status')==='authenticated'}))
		}
		if (name === 'oauth') {
			const {OAuthApplication} = await import('../features/imports/oauth')
			if (current() && !this.getChildApp(name)) this.addChildApp('oauth',new OAuthApplication({current:()=>this.isRunning()&&this.options.session.getState().get('status')==='authenticated'}))
		}
		if (name === 'teams') {
			const {TeamAdministrationApplication} = await import('../features/teams/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(
				'teams',
				new TeamAdministrationApplication({
					...organization,
					user: () => this.options.session.getState().get('user')!,
				}),
			)
		}
		if (name === 'labels') {
			const {LabelsApplication} = await import('../features/labels/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(
				'labels',
				new LabelsApplication({
					...organization,
					userId: () => this.options.session.getState().get('user')!.id,
				}),
			)
		}
		if (name === 'organizationCreate') {
			const {OrganizationCreateApplication} = await import('../features/organizations/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(
				'organizationCreate',
				new OrganizationCreateApplication({
					...organization,
					navigate: this.options.navigate,
				}),
			)
		}
		if (name === 'projectSharing') {
			const {ProjectSharingApplication} = await import('../features/projects/project-sharing')
			if (current() && !this.getChildApp(name)) this.addChildApp(
				'projectSharing',
				new ProjectSharingApplication({
					navigate: this.options.navigate,
					user: () => this.options.session.getState().get('user')!,
					config: () => this.options.session.getState().get('config') ?? {},
					commit,
				}),
			)
		}
		if (name === 'directory') {
			const {ProjectManagementApplication} = await import('../features/projects/project-management')
			if (current() && !this.getChildApp(name)) this.addChildApp('directory', new ProjectManagementApplication(management))
		}
		if (name === 'projectManagement') {
			const {ProjectManagementApplication} = await import('../features/projects/project-management')
			if (current() && !this.getChildApp(name)) this.addChildApp(
				'projectManagement',
				new ProjectManagementApplication(management),
			)
		}
		if (name === 'dailyEntry') {
			const {DailyEntryApplication} = await import('../features/home/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(
				'dailyEntry',
				new DailyEntryApplication({
					config: () => this.options.session.getState().get('config') ?? {},
					user: () => this.options.session.getState().get('user')!,
					widgets: this.widgets(),
					navigate: (href) => this.openHref(href),
					commit,
				}),
			)
		}
	},
	registerTaskAndProject() {
		const widgets = this.widgets()

		this.addChildApp(
			'project',
			new ProjectApplication({
				kanban: {
					dropProject: event => this.shell().projectAtPoint(event),
					setTaskDragging: active => this.shell().setTaskDragging(active),
					openTask: (id) => this.openHref(`/tasks/${id}`),
					alwaysShowCount: () =>
						Boolean(
							this.options.session.getState().get('user')!.settings
								.frontendSettings.alwaysShowBucketTaskCount,
						),
					timezone: () =>
						this.options.session.getState().get('user')!.settings.timezone,
					commitProject: (project) => {
						const current = this.getState().projects.get(project.id)
						current?.set({ project })
					},
					createTask: async (title, bucketId, signal) => {
						const projectId = Number(this.getState().route!.params.projectId),
							settings = this.options.session.getState().get('user')!.settings
						await (
							this.getChildApp('catalog') as InstanceType<
								typeof CatalogApplication
							>
						).ensureLabels(
							parseTaskText(
								title,
								settings.frontendSettings.quickAddMagicMode ??
									PrefixMode.Default,
							).labels,
							signal,
						)
						signal.throwIfAborted()
						const result = await createTasks(
							[{ title, bucketId, projectId }],
							{ settings, labels: this.getState().labels, reportError },
							signal,
						)
						if (result.error) throw result.error
						if (!result.tasks[0]) throw new Error('Task was not created')
						return result.tasks[0]
					},
				},
				taskPorts: this.taskPorts(widgets.context),
				widgets,
				timezone: () =>
					this.options.session.getState().get('user')!.settings.timezone,
				navigateQuery: (query) => {
					const route = this.getState().route!
					this.options.navigate(queryHref(route.path, query))
					return Promise.resolve()
				},
				reportError,
				commitProject: (project) => {
					const existing = this.getState().projects.get(project.id)
					if (existing) existing.set({ project })
					else this.getState().projects.add({ id: project.id, project })
					this.updateShareProject()
					this.syncProjectBackground()
					this.shell().updateHeader(project)
				},
			}),
		)
	},
	async ensureFeature(name: string, current: () => boolean) {
		if (!current()) return
		const existing = this.getChildApp(name)
		if (existing) return existing
		if (name === 'admin') {
			const {AdminApplication} = await import('../features/admin/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(name, new AdminApplication(this.options))
		} else if (name === 'timeTracking') {
			const {TimeTrackingApplication} = await import('../features/time-tracking/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(name, new TimeTrackingApplication({session: this.options.session, ports: () => this.timePorts()}))
		} else if (name === 'settings') {
			const {SettingsApplication} = await import('../features/settings/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(name, new SettingsApplication({session: this.options.session, navigate: this.options.navigate}))
		} else if (name === 'task') {
			const {TaskApplication} = await import('../features/task/application')
			if (current() && !this.getChildApp(name)) this.addChildApp(name, new TaskApplication({ports: this.taskPorts(this.widgets().context)}))
		} else {
			await this.registerManagementApp(name, current)
		}
		return current() ? this.getChildApp(name) : undefined
	},
	createState() {
		return {
			deletedProjects: new Set<number>(),
			backgroundProjectId: 0,
			managementKey: '',
			projects: (new Collection() as Collection<Model>),
			labels: [] as Label[],
			labelsLoading: true,
			labelsChanged: new Set<() => void>(),
			route: undefined as Route | undefined,
			routeRevision: 0,
			defaultViewRequest: undefined as AbortController | undefined,
			contentKey: '',
			taskProjectId: 0,
			headerProjectId: 0,
			closing: false,
			current: undefined as
				| InstanceType<typeof AdminApplication>
				| InstanceType<typeof TimeTrackingApplication>
				| InstanceType<typeof TeamAdministrationApplication>
				| InstanceType<typeof LabelsApplication>
				| InstanceType<typeof DailyEntryApplication>
				| InstanceType<typeof ProjectManagementApplication>
				| InstanceType<typeof SettingsApplication>
				| InstanceType<typeof SystemPagesApplication>
				| InstanceType<typeof ImportApplication>
				| InstanceType<typeof OAuthApplication>
				| InstanceType<typeof ProjectApplication>
				| InstanceType<typeof TaskApplication>
				| undefined,
		}
	},
	shell() { return this.getChildApp('shell') as InstanceType<typeof ShellApplication> },
	async prepareStart(_options: unknown, {signal}: LifecycleContext) {
		await this.shell().start({region:this.getRegion()!})
		signal.throwIfAborted()
	},
	onStart() {
		const shared = this.options.session.getState().get('user')?.type === AUTH_TYPES.LINK_SHARE
		if (shared)
			this.listenTo(this.getState().projects, {
				change: () => this.updateShareProject(),
				update: () => this.updateShareProject(),
			})
		void this.getChildApp('catalog')!
			.start()
			.catch((error) => {
				if (this.isRunning()) reportError(error)
			})
	},
	syncProjectBackground() {
		if (this.isRunning()) this.shell().updateBackground(this.getState().projects.get(this.getState().backgroundProjectId)?.get('project') as IProject | undefined)
	},
	updateShareProject() {
		if (
			this.options.session.getState().get('user')?.type !==
			AUTH_TYPES.LINK_SHARE
		)
			return
		const route = this.getState().route,
			id =
				Number(route?.params.projectId) ||
				this.getState().taskProjectId ||
				this.options.session.getState().get('shareProjectId')
		const project = this.getState().projects.get(id)?.get('project') as
			| IProject
			| undefined
		this.shell().updateShareProject(
			project,
			Number(route?.params.viewId),
		)
	},
	widgets(): ListWidgets {
		const project = (id: number) =>
			this.getState().projects.get(id)?.get('project') as IProject | undefined
		const settings = () => this.options.session.getState().get('user')!.settings
		const context: ListWidgets['context'] = {
			t,
			reportError: error => {if (this.isRunning()) reportError(error)},
			success,
			displayDate: (date) => displayDate(date, settings().frontendSettings),
			getProject: project,
			observeProject: (id, changed) => {
				const callback = () => {
					const value = project(id)
					if (value) changed(value)
				}
				this.getState().projects.on({ change: callback, update: callback })
				return () =>
					this.getState().projects.off({ change: callback, update: callback })
			},
			playDoneSound: () => {
				if (settings().frontendSettings.playSoundWhenDone)
					void new Audio(popSoundFile)
						.play()
						.catch((error) => console.error('Could not play pop sound:', error))
			},
			minimumPriority: () => settings().frontendSettings.minimumPriority ?? 2,
			taskHref: (id) => `/tasks/${id}`,
			viewHref: (value, view) => `/projects/${value.id}/${view.id}`,
			pageHref: (page) =>
				queryHref(this.getState().route!.path, {
					...this.getState().route!.query,
					page,
				}),
			navigate: (event) => interceptLink(event, this.options.navigate),
			flatpickrOptions: () => ({
				altFormat: t('date.altFormatLong'),
				altInput: true,
				dateFormat: 'Y-m-d H:i',
				enableTime: true,
				locale: { firstDayOfWeek: settings().weekStart ?? 0 },
				time_24hr: settings().frontendSettings.timeFormat === '24h',
				inline: true,
			}),
			updateTask: (task, signal) => new TaskService().update(task, signal),
			favoriteTask: (task, signal) =>
				new TaskService().update(
					{ ...task, isFavorite: !task.isFavorite },
					signal,
				),
			deferTask: (task, signal) => new TaskService().update(task, signal),
			quickAddMode: () =>
				settings().frontendSettings.quickAddMagicMode ?? PrefixMode.Default,
			defaultProject: () => settings().defaultProjectId ?? 0,
			concurrentWrites: () => false,
			ensureLabels: (titles, signal) =>
				(
					this.getChildApp('catalog') as InstanceType<typeof CatalogApplication>
				).ensureLabels(titles, signal),
			findProject: (title) =>
				(this.getState().projects.models.find(
					(model) => (model.get('project') as IProject).title === title,
				)?.id as number) ?? null,
			createTasks: (entries) =>
				createTasks(entries, {
					settings: settings(),
					labels: this.getState().labels,
					reportError,
				}),
		}
		return {
			context,
			filter: {
				ui: context,
				labels: () => this.getState().labels,
				labelsPending: () => this.getState().labelsLoading,
				observeLabels: (changed) => {
					this.getState().labelsChanged.add(changed)
					return () => this.getState().labelsChanged.delete(changed)
				},
				labelByTitle: (title) =>
					this.getState().labels.find(
						(label) => label.title?.toLowerCase() === title.toLowerCase(),
					),
				labelById: (id) =>
					this.getState().labels.find((label) => label.id === id),
				filterLabels: (query) =>
					query
						? this.getState().labels.filter(
							(label) =>
								label.title?.toLowerCase().includes(query.toLowerCase()) ||
									label.description
										?.toLowerCase()
										.includes(query.toLowerCase()),
						)
						: [],
				projectByTitle: (title) =>
					this.getState()
						.projects.models.map((model) => model.get('project') as IProject)
						.find(
							(project) => project.title.toLowerCase() === title.toLowerCase(),
						),
				searchProjects: (query) =>
					this.getState()
						.projects.models.map((model) => model.get('project') as IProject)
						.filter((project) =>
							project.title.toLowerCase().includes(query.toLowerCase()),
						),
			},
		}
	},
	openHref(href: string) {
		const state = this.getState()
		if (
			this.options.session.getState().get('user')?.type ===
				AUTH_TYPES.LINK_SHARE &&
			!href.includes('#')
		)
			href += `#share-auth-token=${encodeURIComponent(this.options.session.getState().get('shareHash') ?? '')}`
		if (
			(/^\/tasks\/\d+/.test(href) && state.route?.kind === 'project' && !this.shell().shared()) ||
			([
				'project-management',
				'project-sharing',
				'organization-create',
			].includes(parseRoute(new URL(href, location.origin)).kind) &&
				state.route)
		) {
			history.pushState(
				{
					backdropView:
						typeof history.state?.backdropView === 'string'
							? history.state.backdropView
							: location.pathname + location.search + location.hash,
					modal: true,
				},
				'',
				href,
			)
			this.options.navigate(href)
		} else this.options.navigate(href)
	},
	timePorts():TimePorts {
		const user=this.options.session.getState().get('user')!,transition=this.options.session.getState().get('transition'),ui=this.widgets().context
		return {user:()=>this.options.session.getState().get('user')!,projects:()=>this.getState().projects.models.map(model=>model.get('project') as IProject),navigate:this.options.navigate,dates:{t,flatpickrOptions:ui.flatpickrOptions,shortcutDate:(date:Date)=>date,displayDate:ui.displayDate},timer:()=>this.shell().getChildApp('timer') as InstanceType<typeof TimerApplication>,current:()=>this.isRunning()&&this.options.session.getState().get('user')===user&&this.options.session.getState().get('transition')===transition}
	},
	taskPorts(ui: ListWidgets['context']): TaskPorts {
		const displayDate = ui.displayDate
		const user = () => this.options.session.getState().get('user')!,
			getProject = ui.getProject,
			users = new ProjectUserService(),
			comments = new TaskCommentService(),
			reactions = new ReactionService()
		const editor: TaskPorts['editor'] = {
			frontendUrl: String(
				this.options.session.getState().get('config')?.frontend_url ?? '',
			),
			t,
			reportError,
			users: (projectId, query, signal) =>
				users.getAll(
					{ projectId } as unknown as IAbstract,
					{ s: query },
					1,
					signal,
				) as Promise<IUser[]>,
			avatar: (username, size) => fetchAvatarBlobUrl({ username }, size),
			observeAvatar,
			fetchTask: fetchTaskById,
			observeTasks,
			projectTitle: (id) => getProject(id)?.title ?? '',
			openTask: (task) => this.openHref(`/tasks/${task.id}`),
			displayDate: (date) => (date ? formatDateLong(date) : ''),
		}
		const upload =
			(id: number) => (files: File[] | FileList, signal: AbortSignal) =>
				uploadFilesForEditor(
					(file, done) => uploadFile(id, file, done, signal),
					files,
				)
		const membership: TaskPorts['membership'] = {
			t,
			reportError,
			users: editor.users,
			currentUser: () => user().id,
			labels: (hidden, query) =>
				this.getState().labels.filter(
					(label) =>
						!hidden.some((value) => value.id === label.id) &&
						(!query ||
							label.title?.toLowerCase().includes(query.toLowerCase())),
				),
			observeLabels: (changed) => {
				this.getState().labelsChanged.add(changed)
				return () => this.getState().labelsChanged.delete(changed)
			},
			observeLoading: (changed) => {
				changed(false)
				return () => {}
			},
			observeAvatar,
			success: (key) => success(t(key)),
			createLabel: (title, signal) =>
				(
					this.getChildApp('catalog') as InstanceType<typeof CatalogApplication>
				).createLabel(title, signal),
			add: (kind, taskId, item, signal) =>
				kind === 'labels'
					? taskLabelsCreate({
						path: { projecttask: taskId },
						body: { label_id: Number(item.id) },
						signal,
					})
					: new TaskAssigneeService().create(
						new TaskAssigneeModel({ taskId, userId: item.id }),
						signal,
					),
			remove: (kind, taskId, item, signal) =>
				kind === 'labels'
					? taskLabelsDelete({
						path: { projecttask: taskId, label: Number(item.id) },
						signal,
					})
					: new TaskAssigneeService().delete(
						new TaskAssigneeModel({ taskId, userId: item.id }),
						signal,
					),
		}
		return {
			ui,
			user,
			getProject,
			activeView: () => Number(this.getState().route?.params.viewId ?? 0),
			editor,
			upload,
			membership,
			timeTracking: ()=>featureEnabled(this.options.session,PRO_FEATURE.TIME_TRACKING)?this.timePorts():undefined,
			commentsEnabled: () =>
				Boolean(
					this.options.session.getState().get('config')?.task_comments_enabled,
				),
			copy: () => navigator.clipboard.writeText(location.href),
			close: () => {
				void this.closeTask()
			},
			open:href=>{void this.openHref(href)},
			removed:()=>{const project=this.getChildApp('project') as InstanceType<typeof ProjectApplication>;if(project.isRunning())void project.reload()},
			accepted:(task)=>{const project=this.getChildApp('project') as InstanceType<typeof ProjectApplication>;const previous=this.getState().taskProjectId;this.getState().taskProjectId=task.projectId;if(previous&&previous!==task.projectId)this.shell().updateNavigation(this.getState().route?.path ?? '',task.projectId);if(project.isRunning()){if(previous&&previous!==task.projectId)void project.reload();else project.taskUpdated(task)}this.getState().backgroundProjectId=task.projectId;this.syncProjectBackground();if(previous&&previous!==task.projectId){this.getState().headerProjectId=task.projectId;if(this.getState().route)this.updateProjectHeader(this.getState().route!)}},
			reaction: (id, value, remove, signal) => reactions[remove ? 'delete' : 'create'](new ReactionModel({id, kind: 'tasks', value}), signal),
			comments: (id) => ({
				editor,
				upload: upload(id),
				displayDate,
				order: user().settings.frontendSettings.commentSortOrder ?? 'asc',
				maxItems: Number(
					this.options.session.getState().get('config')?.max_items_per_page ??
						50,
				),
				load: async (taskId, order, page, signal) => ({
					comments: await comments.getAll(
						{ taskId } as ITaskComment,
						{ order_by: order },
						page,
						signal,
					),
					pages: comments.totalPages,
				}),
				create: (comment, signal) => comments.create(comment, signal),
				update: (comment, signal) => comments.update(comment, signal),
				remove: (comment, signal) => comments.delete(comment, signal),
				reaction: (id, value, remove, signal) =>
					reactions[remove ? 'delete' : 'create'](
						new ReactionModel({ id, kind: 'comments', value }),
						signal,
					),
				sort: async (order, signal) => {
					signal.throwIfAborted()
					const owner = user(), transition = this.options.session.getState().get('transition')
					const settings = {
						...owner.settings,
						frontendSettings: {
							...owner.settings.frontendSettings,
							commentSortOrder: order,
						},
					}
					await new UserSettingsService().update(settings, signal)
					signal.throwIfAborted()
					if (user() !== owner || this.options.session.getState().get('transition') !== transition)
						throw new DOMException('Identity changed during comment sort save', 'AbortError')
					owner.settings = settings
				},
				copy: (id) => {
					const url = new URL(location.href)
					url.hash = `comment-${id}`
					void navigator.clipboard.writeText(url.href)
				},
				success: (key) => success(t(key)),
			}),
		}
	},
	flushForNavigation() {
		if (
			this.getState().route?.kind !== 'project' &&
			this.getState().route?.kind !== 'task'
		)
			return Promise.resolve()
		return this.getState().route?.kind === 'project'
			? (
					this.getChildApp('project') as InstanceType<typeof ProjectApplication>
			).flushTask()
			: (
					this.getChildApp('task') as InstanceType<typeof TaskApplication> | undefined
			)?.flush() ?? Promise.resolve()
	},
	async closeTask() {
		const state = this.getState()
		if (state.closing) return
		state.closing = true
		try {
			await this.flushForNavigation()
			if (!this.isRunning()) return
			const previousProject = typeof history.state?.back === 'string' ? history.state.back.match(/\/projects\/(-?\d+)/) : undefined
			if ((history.state?.modal && !this.shell().shared()) || (this.shell().shared() && previousProject && state.projects.get(Number(previousProject[1])))) history.back()
			else {
				this.options.navigate(
					state.taskProjectId
						? `/projects/${state.taskProjectId}`
						: '/',
					false,
				)
			}
		} catch (error) {
			reportError(error)
		} finally {
			state.closing = false
		}
	},
	updateProjectHeader(destination: Route) {
		const state = this.getState(), project = destination.kind === 'project' || destination.kind === 'task' ? state.projects.get(state.headerProjectId)?.get('project') as IProject | undefined : undefined
		this.shell().updateHeader(project, destination.kind === 'time-tracking' ? t('timeTracking.title') : destination.kind === 'admin' ? t('admin.title') : '')
	},
	async showRoute(route: Route) {
		const routeChanged = this.shell().routeChanged(route,Number(route.params.projectId)||this.getState().taskProjectId)
		const state = this.getState(),
			revision = ++state.routeRevision,
			shell = this.shell().getView() as InstanceType<typeof ShellView>
		const management =
			route.kind === 'project-management' ||
			route.kind === 'project-sharing' ||
			route.kind === 'organization-create'
		const backdrop =
			((route.kind === 'task' && !this.shell().shared()) || management) &&
			typeof history.state?.backdropView === 'string'
				? parseRoute(new URL(history.state.backdropView, location.origin))
				: undefined
		const destination = management
			? (backdrop ??
				parseRoute(
					new URL(
						route.kind === 'organization-create'
							? route.params.family === 'team'
								? '/teams'
								: '/labels'
							: '/projects',
						location.origin,
					),
				))
			: backdrop?.kind === 'project'
				? backdrop
				: route
		if (
			(!management || state.managementKey !== route.key) &&
			state.managementKey
		) {
			this.getChildApp('projectManagement')?.stop()
			this.getChildApp('projectSharing')?.stop()
			this.getChildApp('organizationCreate')?.stop()
			state.managementKey = ''
			shell.getRegion('overlay')!.empty()
		}
		if (routeChanged) {
			if (destination.kind === 'project') state.headerProjectId = Number(destination.params.projectId)
			else if (destination.kind !== 'task') state.headerProjectId = 0
		}
		state.route = destination
		state.backgroundProjectId = Number((management ? route : destination).params.projectId) || 0
		this.syncProjectBackground()
		state.defaultViewRequest?.abort()
		state.defaultViewRequest = undefined
		if (
			destination.kind === 'project' &&
			Number(destination.params.viewId) === 0
		) {
			const request = (state.defaultViewRequest = new AbortController()),
				id = Number(destination.params.projectId)
			try {
				const project =
					(state.projects.get(id)?.get('project') as IProject | undefined) ??
					(await new ProjectService().get(
						new ProjectModel({ id }),
						{},
						request.signal,
					))
				request.signal.throwIfAborted()
				if (revision !== state.routeRevision || !this.isRunning()) return
				const stored = getProjectViewId(id),
					preferred = this.options.session.getState().get('user')!.settings
						.frontendSettings.defaultView
				const view =
					project.views.find((view) => view.id === stored) ??
					project.views.find((view) => view.viewKind === preferred) ??
					project.views[0]
				if (view)
					this.options.navigate(
						queryHref(`/projects/${id}/${view.id}`, destination.query) +
							location.hash,
						true,
					)
				return
			} catch (error) {
				if (request.signal.aborted) return
				throw error
			}
		}
		if (destination.kind === 'project') {
			saveProjectView(
				Number(destination.params.projectId),
				Number(destination.params.viewId),
			)
			saveProjectToHistory({ id: Number(destination.params.projectId) })
		}
		this.updateShareProject()
		if (shell instanceof ShareShellView) shell.projectError(false)
		if (!backdrop)
			(
				this.getChildApp('project') as InstanceType<typeof ProjectApplication>
			).closeTask()
		if (destination.key !== state.contentKey) {
			state.current?.stop()
			state.current = undefined
			state.contentKey = destination.key
			const region = shell.getRegion('content')!
			const feature = destination.kind === 'task' ? 'task'
				: destination.kind === 'home' ? 'dailyEntry'
					: destination.kind === 'import' ? 'imports'
						: destination.kind === 'time-tracking' ? 'timeTracking'
							: ['teams', 'labels', 'directory', 'settings', 'admin', 'oauth'].includes(destination.kind) ? destination.kind : undefined
			if (feature && !this.getChildApp(feature)) {
				region.show(new StatusView({text: t(destination.kind === 'oauth' ? 'user.auth.authenticating' : 'misc.loading')}))
				const current = () => revision === state.routeRevision && state.contentKey === destination.key && this.isRunning()
				try {
					if (!await this.ensureFeature(feature, current)) return
				} catch (error) {
					if (current()) {
						state.contentKey = ''
						region.show(new StatusView({text: errorText(error)}))
						reportError(error)
					}
					return
				}
			}
			if (destination.kind === 'project' || destination.kind === 'task') {
				const child = this.getChildApp(
					destination.kind === 'project' ? 'project' : 'task',
				) as
					| InstanceType<typeof ProjectApplication>
					| InstanceType<typeof TaskApplication>
				state.current = child
				const project =
					destination.kind === 'project'
						? (this.getState()
							.projects.get(Number(destination.params.projectId))
							?.get('project') as IProject | undefined)
						: undefined
				const widgets = this.widgets()
				if (
					project?.views.find(
						(view) => view.id === Number(destination.params.viewId),
					)?.viewKind === 'list'
				)
					region.show(
						new ProjectListPendingView({
							widgets,
							project,
							viewId: Number(destination.params.viewId),
							query: parseListQuery(destination.query, { position: 'asc' }),
							routeQuery: destination.query,
							navigateQuery: (query) => {
								this.options.navigate(queryHref(destination.path, query))
								return Promise.resolve()
							},
						}),
					)
				else if (destination.kind === 'project')
					region.show(
						new ProjectMetadataPendingView({
							context: widgets.context,
							projectId: Number(destination.params.projectId),
							available: (available) => {
								if (
									revision !== state.routeRevision ||
									!this.isRunning() ||
									child.isRunning()
								)
									return
								if (
									available.views.find(
										(view) => view.id === Number(destination.params.viewId),
									)?.viewKind === 'list'
								)
									region.show(
										new ProjectListPendingView({
											widgets,
											project: available,
											viewId: Number(destination.params.viewId),
											query: parseListQuery(destination.query, {
												position: 'asc',
											}),
											routeQuery: destination.query,
											navigateQuery: (query) => {
												this.options.navigate(
													queryHref(destination.path, query),
												)
												return Promise.resolve()
											},
										}),
									)
							},
						}),
					)
				else region.show(new StatusView({ text: t('misc.loading') }))
				try {
					await child.start({ ...destination, region, modal: false })
					if (destination.kind === 'task') {
						state.taskProjectId = (child as InstanceType<typeof TaskApplication>).getState().record?.task.projectId ?? 0
					}
					this.updateShareProject()
				} catch (error) {
					if (state.current === child && state.contentKey === destination.key) {
						child.stop()
						state.contentKey = ''
						const status = (
							error as {
								response?: {
									status?: number
								}
							}
						).response?.status
						if (
							destination.kind === 'task' &&
							(status === 403 || status === 404)
						) {
							region.show(new NotFoundView())
							return
						}
						if (
							destination.kind === 'project' &&
							shell instanceof ShareShellView
						) {
							shell.projectError(true)
							region.empty()
							return
						}
						reportError(error)
						const available =
							destination.kind === 'project'
								? (this.getState()
									.projects.get(Number(destination.params.projectId))
									?.get('project') as IProject | undefined)
								: undefined
						if (
							destination.kind === 'task' ||
							(available &&
								available.views.find(
									(view) => view.id === Number(destination.params.viewId),
								)?.viewKind !== 'list')
						)
							region.show(
								new StatusView({ text: String((error as Error).message) }),
							)
					}
				}
			} else if (
				(destination.kind === 'teams' || destination.kind === 'labels') &&
				this.options.session.getState().get('user')?.type === AUTH_TYPES.USER
			) {
				const child = this.getChildApp(destination.kind) as
					| InstanceType<typeof TeamAdministrationApplication>
					| InstanceType<typeof LabelsApplication>
				state.current = child
				region.show(new StatusView({ text: t('misc.loading') }))
				await child.start({ ...destination, region })
			} else if (
				(destination.kind === 'home' || destination.kind === 'directory') &&
				this.options.session.getState().get('user')?.type === AUTH_TYPES.USER
			) {
				const child = this.getChildApp(
					destination.kind === 'home' ? 'dailyEntry' : 'directory',
				) as
					| InstanceType<typeof DailyEntryApplication>
					| InstanceType<typeof ProjectManagementApplication>
				state.current = child
				region.show(new StatusView({ text: t('misc.loading') }))
				await child.start({ ...destination, region })
			} else if (
				destination.kind === 'settings' &&
				this.options.session.getState().get('user')?.type === AUTH_TYPES.USER
			) {
				const settings = this.getChildApp('settings') as InstanceType<
					typeof SettingsApplication
				>
				state.current = settings
				region.show(new StatusView({ text: t('misc.loading') }))
				await settings.start({ ...destination, region })
			} else if(destination.kind==='time-tracking'&&this.options.session.getState().get('user')?.type===AUTH_TYPES.USER){const child=this.getChildApp('timeTracking') as InstanceType<typeof TimeTrackingApplication>;state.current=child;region.show(new StatusView({text:t('misc.loading')}));await child.start({...destination,region})
			} else if (destination.kind==='admin'&&this.options.session.getState().get('user')?.type===AUTH_TYPES.USER){const child=this.getChildApp('admin') as InstanceType<typeof AdminApplication>;state.current=child;await child.start({...destination,region})
			} else if ((destination.kind==='import'||destination.kind==='oauth')&&this.options.session.getState().get('user')?.type===AUTH_TYPES.USER) {const child=this.getChildApp(destination.kind==='import'?'imports':'oauth') as InstanceType<typeof ImportApplication>;state.current=child;region.show(new StatusView({text:t(destination.kind==='oauth'?'user.auth.authenticating':'misc.loading')}));await child.start({...destination,region})
			} else if (destination.kind==='about'||destination.kind==='not-found') {const child=this.getChildApp('systemPages') as InstanceType<typeof SystemPagesApplication>;state.current=child;await child.start({...destination,region})}
			else
				region.show(
					new StatusView({ text: `Migration incomplete: ${destination.path}` }),
				)
		} else if (destination.kind === 'project' && state.current) {
			const project = state.current as InstanceType<typeof ProjectApplication>
			const query = project.updateRoute(destination)
			await project.start({
				...destination,
				region: shell.getRegion('content')!,
			})
			await query
		} else if (destination.kind === 'home' && state.current) {
			;(
				state.current as InstanceType<typeof DailyEntryApplication>
			).getState().route = destination
			await (state.current as InstanceType<typeof DailyEntryApplication>).load()
		}
		if (
			revision !== state.routeRevision ||
			state.contentKey !== destination.key ||
			!this.isRunning()
		)
			return
		if (destination.kind === 'task') state.backgroundProjectId = state.taskProjectId
		this.syncProjectBackground()
		this.updateProjectHeader(destination)
		if (management && state.managementKey !== route.key) {
			this.getChildApp('projectManagement')?.stop()
			this.getChildApp('projectSharing')?.stop()
			this.getChildApp('organizationCreate')?.stop()
			const feature = route.kind === 'organization-create' ? 'organizationCreate' : route.kind === 'project-sharing' ? 'projectSharing' : 'projectManagement'
			state.managementKey = route.key
			const current = () => revision === state.routeRevision && state.managementKey === route.key && this.isRunning()
			try {
				if (!this.getChildApp(feature)) shell.getRegion('overlay')!.show(new StatusView({text: t('misc.loading')}))
				if (!await this.ensureFeature(feature, current)) return
			} catch (error) {
				if (current()) {state.managementKey = ''; shell.getRegion('overlay')!.show(new StatusView({text: errorText(error)})); reportError(error)}
				return
			}
			const app = this.getChildApp(
				route.kind === 'organization-create'
					? 'organizationCreate'
					: route.kind === 'project-sharing'
						? 'projectSharing'
						: 'projectManagement',
			) as
				| InstanceType<typeof OrganizationCreateApplication>
				| InstanceType<typeof ProjectManagementApplication>
				| InstanceType<typeof ProjectSharingApplication>
			state.managementKey = route.key
			try {
				await app.start({ ...route, region: shell.getRegion('overlay')! })
			} catch (error) {
				if (
					revision === state.routeRevision &&
					state.managementKey === route.key
				) {
					state.managementKey = ''
					shell
						.getRegion('overlay')!
						.show(new StatusView({ text: errorText(error) }))
					reportError(error)
				}
			}
		}
		if (!management && backdrop?.kind === 'project') {
			const project=this.getChildApp('project') as InstanceType<typeof ProjectApplication>
			await project.showTask(route,shell.getRegion('overlay')!)
			if(revision===state.routeRevision){state.taskProjectId=(project.getChildApp('task') as InstanceType<typeof TaskApplication> | undefined)?.getState().record?.task.projectId??0}
		}
	},
	onBeforeStop() {
		this.getChildApp('projectManagement')?.stop()
		this.getChildApp('projectSharing')?.stop()
		this.getChildApp('organizationCreate')?.stop()
		this.getState().managementKey = ''
		this.getState().deletedProjects.clear()
		this.stopListening(this.getState().projects)
		this.getState().current?.stop()
		this.getState().current = undefined
		this.getState().routeRevision++
		this.getState().defaultViewRequest?.abort()
		this.getState().contentKey = ''
		this.getState().route = undefined
		this.getState().headerProjectId = 0
		this.getState().projects.reset([])
		this.getState().labels = []
		this.getState().labelsLoading = true
	},
})
