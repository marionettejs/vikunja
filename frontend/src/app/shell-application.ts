import {Application, type LifecycleContext} from 'marionette'
import type {Collection} from '@mnjs/data'
import {AUTH_TYPES} from '@/modelTypes/IUser'
import type {IProject} from '@/modelTypes/IProject'
import type {SessionApplication} from './session'
import {ShellView} from './shell-view'
import {ShareShellView} from './share-shell'
import {NavigationView} from './navigation'
import {AccountMenuView} from '@/features/account/account-menu'
import {ProjectBackgroundView} from '../features/projects/project-background'
import {ProjectMenuView} from '../features/projects/project-cards'
import {WorkspaceRealtime} from './realtime'
import {TimerApplication} from '../features/timer/application'
import {NotificationApplication} from '../features/notifications/application'
import {QuickActionsApplication, type QuickActionsOptions} from '../features/quick-actions/application'
import {featureEnabled} from '../features/admin/application'
import {PRO_FEATURE} from '@/constants/proFeatures'
import type {Route} from './routes'
import {isSavedFilter} from '@/services/savedFilterCore'
import {reportError} from '../shared/notifications'
interface Options {
 session: InstanceType<typeof SessionApplication>
 navigate: (href: string) => void
 openProject: (href: string) => void
 retry: () => void
 projects: Collection
 quickActions: QuickActionsOptions
}
// The persistent chrome owns its feature Applications and presentation;
// Workspace owns destination decisions and supplies observable project data.
export const ShellApplication = Application.extend({
	initialize(options: Options) {
		void options
		const realtime = new WorkspaceRealtime(options.session)
		this.addChildApp('timer', new TimerApplication({...options, realtime}))
		this.addChildApp('notifications', new NotificationApplication({...options, realtime}))
		this.addChildApp('quickActions', new QuickActionsApplication(options.quickActions))
		this.listenTo(options.session, 'profile:changed', () => {
			if (!this.isRunning()) return
			this.updateAccount()
			this.updateBackground(this.getState().project)
		})
	},
	createState() { return {project: undefined as IProject | undefined,routeKey:'',route:undefined as Pick<Route,'kind'|'path'>|undefined} },
	shared() { return this.options.session.getState().get('user')?.type === AUTH_TYPES.LINK_SHARE },
	async prepareStart(_options: unknown, {signal}: LifecycleContext) {
		const session = this.options.session, shared = this.shared()
		const shell = this.setView(shared ? new ShareShellView({session: session.getState(), logoVisible: session.getState().get('logoVisible') ?? true, hash: session.getState().get('shareHash') ?? '', navigate: this.options.navigate, retry: this.options.retry}) : new ShellView({routeName:()=>this.routeName(), session:session.getState()}))
		shell.showChildView('background', new ProjectBackgroundView({brightness: shared ? null : session.getState().get('user')!.settings.frontendSettings.backgroundBrightness}))
		if (!shared) {
			this.updateAccount()
			shell.showChildView('navigation', new NavigationView({session, backgroundEnabled: this.backgroundEnabled(), projects: this.options.projects, admin: featureEnabled(session, PRO_FEATURE.ADMIN_PANEL) && session.getState().get('user')?.isAdmin === true, time: featureEnabled(session, PRO_FEATURE.TIME_TRACKING), navigate: this.options.navigate}))
			await Promise.all([
    this.getChildApp('quickActions')!.start({region:shell.getRegion('search')!,overlay:shell.getRegion('quickActions')!}),
    this.getChildApp('notifications')!.start({region:shell.getRegion('notifications')!}),
    this.getChildApp('timer')!.start({region:shell.getRegion('timer')!}),
			])
			signal.throwIfAborted()
			;(shell as InstanceType<typeof ShellView>).updateMenu()
		}
	},
	onStart() { this.showView() },
	backgroundEnabled() { return ((this.options.session.getState().get('config')?.enabled_background_providers ?? []) as unknown[]).length > 0 },
	updateAccount() {
		const shell = this.getView() as InstanceType<typeof ShellView> | undefined
		if (!shell || this.shared()) return
		shell.showChildView('account', new AccountMenuView({user:this.options.session.getState().get('user')!,navigate:this.options.navigate,logout:()=>this.options.session.logout(),openShortcuts:()=>shell.openShortcuts(),reportError}))
	},
	updateBackground(project: IProject | undefined) {
		this.getState().project = project
		const view = (this.getView() as InstanceType<typeof ShellView> | undefined)?.getChildView('background') as InstanceType<typeof ProjectBackgroundView> | undefined
		view?.setBrightness(this.shared() ? null : this.options.session.getState().get('user')!.settings.frontendSettings.backgroundBrightness)
		void view?.setProject(project)
	},
	updateHeader(project: IProject | undefined, fallback = '') {
		const shell = this.getView() as InstanceType<typeof ShellView> | undefined
		if (!shell || shell instanceof ShareShellView) return
		;(shell as InstanceType<typeof ShellView>).projectInfo(project, project?.title ?? fallback)
		if (project && (project.id > 0 || isSavedFilter(project))) {
			const menu = shell.getChildView('projectMenu') as InstanceType<typeof ProjectMenuView> | undefined
			if (menu?.options.project.id === project.id) menu.updateProject(project)
			else shell.showChildView('projectMenu', new ProjectMenuView({project,backgroundEnabled:this.backgroundEnabled(),navigate:this.options.openProject}))
		} else shell.getRegion('projectMenu')!.empty()
	},
	updateNavigation(path: string, projectId: number) {
		if (this.shared()) return
		const navigation = (this.getView() as InstanceType<typeof ShellView> | undefined)?.getChildView('navigation') as InstanceType<typeof NavigationView> | undefined
		navigation?.updateRoute(path, projectId)
	},
	routeChanged(route: Pick<Route, 'key' | 'path' | 'kind'>, projectId: number) {
		const state = this.getState(), changed = state.routeKey !== route.key
		if (state.routeKey && changed) (this.getChildApp('quickActions') as InstanceType<typeof QuickActionsApplication>).close()
		state.routeKey = route.key;state.route=route
		this.updateNavigation(route.path, projectId)
		return changed
	},
	setTaskDragging(active: boolean) {
		if (this.shared()) return
		((this.getView() as InstanceType<typeof ShellView> | undefined)?.getChildView('navigation') as InstanceType<typeof NavigationView> | undefined)?.setTaskDragging(active)
	},
	projectAtPoint(event: MouseEvent) {
		if (this.shared()) return null
		return ((this.getView() as InstanceType<typeof ShellView> | undefined)?.getChildView('navigation') as InstanceType<typeof NavigationView> | undefined)?.projectAtPoint(event) ?? null
	},
	updateShareProject(project: IProject | undefined, viewId?: number) {
		if (this.shared()) (this.getView() as InstanceType<typeof ShareShellView> | undefined)?.updateProject(project, viewId)
	},
	routeName() {const route=this.getState().route;return route?.kind==='task'?'task.detail':route?.kind==='project'?'project.view':route?.path.startsWith('/projects/')?'project.settings':route?.kind??''},
	onBeforeStop() { this.getState().project = undefined;this.getState().routeKey='' },
})
