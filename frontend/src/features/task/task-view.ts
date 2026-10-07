import {TaskActionsView} from './task-actions-view'
import type {TaskActionsApplication} from './task-actions-application'
import type {TaskPorts} from './application'
import {TaskBucketView} from '@/features/task/task-bucket'
import {ReactionsView} from '@/features/task/reactions'
import {TaskColorView,TaskMoveView} from './task-location'
import { TimeEntriesView } from '../time-tracking/entries-view'
import {View} from 'marionette'
import { Collection } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, render } from 'lit-html'
import { getHexColor, getTaskIdentifier } from '@/models/task'
import type { ITask } from '@/modelTypes/ITask'
import type { IProject } from '@/modelTypes/IProject'
import { TaskRecordSession } from '@/features/task/task-record'
import { TaskHeadingView } from '@/features/task/task-heading'
import { TaskBasicsView, type TaskBasicField } from '@/features/task/task-basics'
import { TaskMembershipView } from '@/features/task/task-membership'
import { TaskDescriptionView } from '@/features/task/task-description'
import { TaskCommentsView } from '@/features/task/task-comments'
import { AUTH_TYPES } from '@/modelTypes/IUser'
import { t } from '../../shared/i18n'
import { reportError, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import { getDateWithTime } from '@/helpers/time/getDateWithTimeCore'
import './application.scss'
import { TaskRelationsView } from './task-relations'
import { TaskAttachmentsView } from './task-attachments'
import { TaskRemindersView, TaskRepeatView } from './task-timing'
const MembershipSectionView = View.extend({
	initialize(options: {
		kind: 'labels' | 'assignees'
		record: TaskRecordSession
		ports: TaskPorts
	}) {
		void options
	},
	className() {
		return this.options.kind === 'labels'
			? 'labels-list details'
			: 'column assignees'
	},
	regions: { widget: '[data-widget]' },
	templateContext() {
		return { kind: this.options.kind }
	},
	template: ({ kind }: { kind: 'labels' | 'assignees' }) =>
		html`<div class="detail-title">
				${listIcon(kind === 'labels' ? 'tags' : 'users')}
				${t(`task.attributes.${kind}`)}
			</div>
			<div data-widget class="native-task-membership"></div>`,
	onAttach() {
		const { kind, record, ports } = this.options,
			task = record.task
		this.showChildView(
			'widget',
			new TaskMembershipView({
				kind,
				taskId: task.id,
				projectId: task.projectId,
				items: task[kind],
				canWrite: Number(task.maxPermission) > 0,
				canCreate: this.options.ports.user().type !== AUTH_TYPES.LINK_SHARE,
				context: ports.membership,
				accepted: (items) => record.acceptFields({ [kind]: items }),
			}),
		)
	},
	updateTask(task: ITask) {
		;(
			this.getChildView('widget') as InstanceType<typeof TaskMembershipView>
		).updateInputs({
			taskId: task.id,
			projectId: task.projectId,
			items: task[this.options.kind],
			canWrite: Number(task.maxPermission) > 0,
			canCreate: this.options.ports.user().type !== AUTH_TYPES.LINK_SHARE,
		})
	},
	focusInput() {
		;(
			(this.getChildView('widget') as InstanceType<typeof TaskMembershipView>)
				.el as HTMLElement
		).focus()
	},
}).setDomApi(LitDomApi)
const fields: TaskBasicField[] = [
	'priority',
	'dueDate',
	'percentDone',
	'startDate',
	'endDate',
]
export const TaskDetailView = View.extend({
	ui: {
		back: '[data-back]',
		project: '[data-project]',
		projectLink: '[data-project-link]', ancestors:'[data-ancestors]',
		actions: '[data-actions]',
		content: '.detail-content',
		bottomMarker: '[data-bottom-marker]', scrollBottom: '[data-scroll-bottom]',
	},
	initialize(options: {
		record: TaskRecordSession
		ports: TaskPorts
        workflow: InstanceType<typeof TaskActionsApplication>
		modal: boolean
	}) {
		void options
	},
	className() {
		return `loader-container task-view-container ${this.options.modal ? 'is-modal' : ''}`
	},
	events: {'click @ui.scrollBottom': 'scrollToBottom'},
	regions: {
		actions: '[data-actions]',
		bucket: '[data-bucket]',
		heading: '[data-heading]',
		basics: '[data-basics]',
		color:'[data-color]',moveProject:'[data-move]',
		assignees: '[data-assignee-column]',
		labels: '[data-label-column]',
		description: '[data-description]',
		reactions: '[data-reactions]',
		comments: '[data-comments]',
		relations: '[data-relations]',
		timeTracking: '[data-time-tracking]',
		attachments: '[data-attachments]',
		reminders: '[data-reminders]',
		repeatAfter: '[data-repeat]',
	},
	createState() {
		const task = this.options.record.task
		return {
			task,
			stopScroll: undefined as (() => void) | undefined,
			active: Object.fromEntries(
				fields.map((field) => [field, Boolean(task[field])]),
			) as Record<TaskBasicField, boolean>,
			timeActive:(task.timeEntriesCount??0)>0,
			colorActive:false,moveActive:false,
			relatedActive: (
				Object.values(task.relatedTasks) as (ITask[] | undefined)[]
			).some((tasks) => tasks?.length),
			extraActive: {
				attachments: task.attachments.length > 0,
				reminders: task.reminders.length > 0,
				repeatAfter:
					task.repeatMode !== 0 ||
					(typeof task.repeatAfter === 'object' && task.repeatAfter.amount > 0),
			},
			membersActive: {
				labels: task.labels.length > 0,
				assignees: task.assignees.length > 0,
			},
			stop: undefined as (() => void) | undefined,
			stopProject: undefined as (() => void) | undefined,
			stopFlusher: undefined as (() => void) | undefined,
			observedProject: 0,
		}
	},
	template: () =>
		html`<div class="task-view">
			<div data-back></div>
			<div data-heading style="display:contents"></div>
			<nav aria-label="Breadcrumb" class="subtitle" data-project>
				<span data-ancestors></span><a data-project-link></a><span data-bucket style="display:contents"></span>
			</nav>
			<div class="columns mbs-2">
				<div class="column detail-content is-two-thirds">
					<div class="columns details">
						<div data-assignee-column style="display:contents"></div>
						<div data-basics style="display:contents"></div><div data-color style="display:contents"></div>
						<div data-reminders style="display:contents"></div>
						<div data-repeat style="display:contents"></div>
					</div>
					<div data-label-column style="display:contents"></div>
					<div data-description></div><div data-reactions style="display:contents"></div>
					<div data-time-tracking></div><div data-attachments></div>
					<div data-relations></div>
					<div data-move></div><div data-comments></div><div class="content-bottom-marker" data-bottom-marker></div>
				</div>
				<div class="column is-one-third action-buttons d-print-none" data-actions></div>
			</div>
		</div><button type="button" class="base-button base-button--type-button scroll-to-comments-button d-print-none" data-scroll-bottom hidden aria-label=${t('task.detail.scrollToBottom')}></button>`,
	onAttach() {
		this.observeScroll()
		const { record, ports, modal } = this.options,
			task = record.task,
			canWrite = Number(task.maxPermission) > 0
		this.showChildView(
			'heading',
			new TaskHeadingView({
				task,
				canWrite,
				hasClose: modal,
				identifier: getTaskIdentifier(task),
				color: getHexColor(task.hexColor),
				t,
				saveTask: (value, signal) =>
					record.save({ title: value.title }, signal),
				accepted: () => {},
				close: ports.close,
				reportError,
				copyUrl: ports.copy,
			}),
		)
		this.showChildView(
			'basics',
			new TaskBasicsView({
				task,
				canWrite,
				datesLoading: false,
				active: this.getState().active,
				collection: new Collection(),
				context: {
					...ports.ui,
					shortcutDate: (date) =>
						getDateWithTime(
							date,
							ports.user().settings.frontendSettings.defaultDueTime,
						),
				},
				changed: (field, value) => {
					this.getState().task = { ...this.getState().task, [field]: value }
				},
				saveTask: (value, signal, field) =>
					record.save({ [field]: value[field] }, signal),
				accepted: () => success(t('task.detail.updateSuccess')),
				reportError,
			}),
		)
		for (const kind of ['labels', 'assignees'] as const)
			if (this.getState().membersActive[kind]) this.showMembership(kind)
		const description = new TaskDescriptionView({
			task,
			canWrite,
			context: ports.editor,
			upload: ports.upload(task.id),
			save: (description, signal) => record.save({ description }, signal),
			accepted: () => {},
		})
		this.showChildView('description', description)
		this.showChildView('reactions', new ReactionsView({className: 'reactions details d-print-none', user: ports.user, canWrite: () => Number(record.task.maxPermission) > 0, reactions: () => record.task.reactions, t, reportError, transport: (value, remove, signal) => ports.reaction(record.task.id, value, remove, signal), accepted: reactions => record.acceptFields({reactions})}))
		this.showChildView('bucket', new TaskBucketView({record, project: () => ports.getProject(record.task.projectId), activeView: ports.activeView, t, reportError, success: () => success(t('task.detail.bucketChangedSuccess')), load: (projectId, projectViewId, signal) => this.options.workflow.loadBuckets(projectId,projectViewId,signal), move: (bucket, signal) => this.options.workflow.moveBucket(bucket,signal)}))
		this.getState().stopFlusher = record.beforeClose(() => description.flush())
		if(this.getState().timeActive)this.showTime()
		this.showLocation()
		if (ports.commentsEnabled())
			this.showChildView(
				'comments',
				new TaskCommentsView({
					taskId: task.id,
					projectId: task.projectId,
					canWrite,
					user: ports.user(),
					initialComments: task.comments,
					context: ports.comments(task.id),
				}),
			)
		this.getState().stop = record.observe((value) => {
			this.getState().task = value
			this.updateInputs()
			ports.accepted(value)
		})
		if (!modal) {
			const button = document.createElement('button')
			button.className =
				'base-button base-button--type-button back-button mbs-2'
			render(html`${listIcon('arrow-left')} ${t('task.detail.back')}`,button)
			button.onclick = ports.close
			;(this.getUI('back')![0] as HTMLElement)!.append(button)
		}
		;(this.getUI('projectLink')![0] as HTMLAnchorElement).onclick =
			ports.ui.navigate
		this.actions()
		this.updateInputs()
	},
	showTime(){const time=this.options.ports.timeTracking?.();if(time&&!this.getChildView('timeTracking'))this.showChildView('timeTracking',new TimeEntriesView({ports:time,taskId:this.options.record.task.id}))},
	showExtra(kind: 'attachments' | 'reminders' | 'repeatAfter') {
		if (
			(kind !== 'attachments' && !this.getState().extraActive[kind]) ||
			this.getChildView(kind)
		)
			return
		const options = {
			record: this.options.record,
			ports: this.options.ports,
			active: () => this.getState().extraActive.attachments,
		}
		const view =
			kind === 'attachments'
				? new TaskAttachmentsView(options)
				: kind === 'reminders'
					? new TaskRemindersView(options)
					: new TaskRepeatView(options)
		this.showChildView(kind, view)
		if (kind === 'repeatAfter')
			this.listenTo(view, 'removed', () => {
				this.getState().extraActive.repeatAfter = false
				this.getRegion('repeatAfter')!.empty()
			})
	},
	showRelations() {
		if (this.getState().relatedActive && !this.getChildView('relations'))
			this.showChildView(
				'relations',
				new TaskRelationsView({
					record: this.options.record,
					ports: this.options.ports,
				}),
			)
	},
	bindProject() {
		const state = this.getState()
		const { ports } = this.options
		if (state.observedProject !== state.task.projectId) {
			state.stopProject?.()
			state.observedProject = state.task.projectId
			state.stopProject = ports.ui.observeProject?.(
				state.task.projectId,
				(project) => this.publishProject(project),
			)
		}
		this.publishProject(ports.getProject(state.task.projectId))
	},
	publishProject(project: IProject | undefined) {
		if (this.isDestroyed()) return
		const link = this.getUI('projectLink')![0] as HTMLAnchorElement
		link.href = project?.views[0]
			? this.options.ports.ui.viewHref(project, project.views[0])
			: '/'
		link.textContent = project?.title ?? ''
		const ancestors: IProject[] = [], seen = new Set<number>()
		let parent = project?.parentProjectId ? this.options.ports.getProject(project.parentProjectId) : undefined
		while (parent && !seen.has(parent.id)) {seen.add(parent.id); ancestors.unshift(parent); parent = parent.parentProjectId ? this.options.ports.getProject(parent.parentProjectId) : undefined}
		render(html`${ancestors.map(value => html`<a href=${`/projects/${value.id}`} @click=${this.options.ports.ui.navigate}>${value.title}</a><span class="has-text-grey-light"> &gt; </span>`)}`, this.getUI('ancestors')![0] as HTMLElement)
		;(this.getChildView('bucket') as InstanceType<typeof TaskBucketView> | undefined)?.updateInputs()
	},
	showMembership(kind: 'labels' | 'assignees') {
		if (!this.getChildView(kind))
			this.showChildView(
				kind,
				new MembershipSectionView({
					kind,
					record: this.options.record,
					ports: this.options.ports,
				}),
			)
	},
	showLocation(){const state=this.getState();if(state.colorActive&&!this.getChildView('color'))this.showChildView('color',new TaskColorView({record:this.options.record}));if(state.moveActive&&!this.getChildView('moveProject'))this.showChildView('moveProject',new TaskMoveView({record:this.options.record}))},
	actions() {
		this.showChildView(
			'actions',
			new TaskActionsView({workflow:this.options.workflow,
				record: this.options.record,
				ports:this.options.ports,
				timeTracking:Boolean(this.options.ports.timeTracking?.()),
				active: (field) => {
					if(field==='color'||field==='moveProject'){if(field==='color')this.getState().colorActive=true;else this.getState().moveActive=true;this.showLocation();(this.getChildView(field) as InstanceType<typeof TaskColorView>|InstanceType<typeof TaskMoveView>).focusInput()}else if (fields.includes(field as TaskBasicField)) {
						this.getState().active[field as TaskBasicField] = true
						this.updateInputs()
						;(
							this.getChildView('basics') as InstanceType<typeof TaskBasicsView>
						).focusField(field as TaskBasicField)
					} else if (
						field === 'attachments' ||
						field === 'reminders' ||
						field === 'repeatAfter'
					) {
						this.getState().extraActive[field] = true
						this.showExtra(field)
						if (field === 'attachments')
							(
								this.getChildView(field) as InstanceType<
									typeof TaskAttachmentsView
								>
							).publish()
						if (field === 'attachments')
							(
								this.getChildView(field) as InstanceType<
									typeof TaskAttachmentsView
								>
							).openFilePicker()
						else if (field === 'repeatAfter')
							(
								this.getChildView(field) as InstanceType<typeof TaskRepeatView>
							).focusInput()
					} else if(field==='timeTracking'){this.getState().timeActive=true;this.showTime();this.getChildView('timeTracking')?.el.scrollIntoView({block:'center'})
					} else if (field === 'relatedTasks') {
						this.getState().relatedActive = true
						this.showRelations()
						;(
							this.getChildView('relations') as InstanceType<
								typeof TaskRelationsView
							>
						).focusInput()
					} else {
						this.getState().membersActive[field as 'labels' | 'assignees'] =
							true
						this.showMembership(field as 'labels' | 'assignees')
						;(
							this.getChildView(field) as InstanceType<
								typeof MembershipSectionView
							>
						).focusInput()
					}
				},
			}),
		)
	},
	updateInputs() {
		const state = this.getState();this.showLocation();for(const field of ['color','moveProject'] as const)(this.getChildView(field) as InstanceType<typeof TaskColorView>|InstanceType<typeof TaskMoveView>|undefined)?.updateTask(state.task)
		if (state.task.attachments.length) state.extraActive.attachments = true
		for (const kind of ['attachments', 'reminders', 'repeatAfter'] as const) {
			this.showExtra(kind)
			;(
				this.getChildView(kind) as
					| InstanceType<typeof TaskAttachmentsView>
					| InstanceType<typeof TaskRemindersView>
					| InstanceType<typeof TaskRepeatView>
					| undefined
			)?.updateTask(state.task)
		}
		this.showRelations()
		;(
			this.getChildView('relations') as
				| InstanceType<typeof TaskRelationsView>
				| undefined
		)?.updateTask(this.getState().task)
		this.bindProject()
		const task = this.getState().task,
			canWrite = Number(task.maxPermission) > 0
		;(
			this.getChildView('heading') as InstanceType<typeof TaskHeadingView>
		).updateInputs({
			task,
			canWrite,
			hasClose: this.options.modal,
			identifier: getTaskIdentifier(task),
			color: getHexColor(task.hexColor),
		})
		;(
			this.getChildView('basics') as InstanceType<typeof TaskBasicsView>
		).updateInputs({
			task,
			canWrite,
			active: this.getState().active,
			datesLoading: false,
		})
		for (const kind of ['labels', 'assignees'] as const)
			(
				this.getChildView(kind) as
					| InstanceType<typeof MembershipSectionView>
					| undefined
			)?.updateTask(task)
		;(
			this.getChildView('description') as InstanceType<
				typeof TaskDescriptionView
			>
		).updateInputs(task, canWrite)
		;(this.getChildView('reactions') as InstanceType<typeof ReactionsView>).updateInputs()
		;(
			this.getChildView('comments') as
				| InstanceType<typeof TaskCommentsView>
				| undefined
		)?.updateInputs({
			taskId: task.id,
			projectId: task.projectId,
			canWrite,
			user: this.options.ports.user(),
		})
		;(
			this.getChildView('actions') as
				| InstanceType<typeof TaskActionsView>
				| undefined
		)?.updateTask()
		;(this.getUI('actions')![0] as HTMLElement)!.hidden = !canWrite
		;(this.getUI('content')![0] as HTMLElement)!.classList.toggle(
			'is-two-thirds',
			canWrite,
		)
	},
	observeScroll() {
		const marker = this.getUI('bottomMarker')![0] as HTMLElement, button = this.getUI('scrollBottom')![0] as HTMLElement
		render(listIcon('chevron-down'), button)
		let visible = true, scroller: HTMLElement = this.el as HTMLElement
		while (scroller.parentElement && !['auto','scroll','overlay'].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
		if (!['auto','scroll','overlay'].includes(getComputedStyle(scroller).overflowY)) scroller = document.scrollingElement as HTMLElement
		const update = () => {button.hidden = !(scroller.scrollHeight > scroller.clientHeight + 1 && !visible)}
		const intersection = new IntersectionObserver(([entry]) => {visible = entry?.isIntersecting ?? true; update()}, {threshold: 0.1})
		const resize = new ResizeObserver(update), mutations = new MutationObserver(update)
		intersection.observe(marker); resize.observe(scroller); resize.observe(this.el as HTMLElement); mutations.observe(this.el, {childList: true, subtree: true})
		update()
		this.getState().stopScroll = () => {intersection.disconnect(); resize.disconnect(); mutations.disconnect()}
	},
	scrollToBottom() {(this.getUI('bottomMarker')![0] as HTMLElement).scrollIntoView({behavior:'smooth',block:'end',inline:'nearest'})},
	onBeforeDestroy() {
		this.getState().stopScroll?.()
		this.getState().stop?.()
		this.getState().stopProject?.()
		this.getState().stopFlusher?.()
	},
}).setDomApi(LitDomApi)
export const TaskModalView = View.extend({
	initialize(options: { record: TaskRecordSession; ports: TaskPorts; workflow: InstanceType<typeof TaskActionsApplication> }) {
		void options
	},
	tagName: 'dialog',
	className: 'modal-dialog scrolling task-detail native-task-dialog',
	templateContext() {
		return { close: this.options.ports.close }
	},
	template: ({ close }: { close: () => void }) =>
		html`<div class="modal-container">
			<button
				type="button"
				class="base-button base-button--type-button close d-print-none"
				aria-label=${t('misc.closeDialog')}
				@click=${close}
			>
				${listIcon('times')}
			</button>
			<div class="modal-content"><div data-task></div></div>
		</div>`,
	regions: { task: '[data-task]' },
	createState() {
		return {
			focus: document.activeElement as HTMLElement | null,
			overflow: document.body.style.overflow,
			scrollX: window.scrollX,
			scrollY: window.scrollY,
		}
	},
	onAttach() {
		this.showChildView(
			'task',
			new TaskDetailView({ ...this.options, modal: true }),
		)
		document.body.style.overflow = 'hidden'
		;(this.el as HTMLDialogElement).showModal()
	},
	events: { cancel: 'cancel' },
	cancel(event: Event) {
		event.preventDefault()
		this.options.ports.close()
	},
	onBeforeDestroy() {
		;(this.el as HTMLDialogElement).close()
		document.body.style.overflow = this.getState().overflow
		if (this.getState().focus?.isConnected)
			this.getState().focus?.focus({ preventScroll: true })
		window.scrollTo(this.getState().scrollX, this.getState().scrollY)
	},
}).setDomApi(LitDomApi)
