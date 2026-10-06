import {Application, type LifecycleContext} from 'marionette'
import {TaskActionsApplication} from './task-actions-application'
import {TaskDetailView, TaskModalView} from './task-view'
import TaskService from '@/services/task'
import TaskModel from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'
import type {IUser} from '@/modelTypes/IUser'
import {TaskRecordSession} from '@/features/task/task-record'
import type {ListContext} from '@/shared/task-list/list-context'
import type {MembershipContext} from '@/features/task/task-membership'
import type {DescriptionOptions} from '@/features/task/task-description'
import type {CommentsContext} from '@/features/task/task-comments'
import type {TimePorts} from '../time-tracking/time-form'
import type {Route} from '../../app/routes'
export interface TaskPorts {
    ui: ListContext;
    user: () => IUser;
    activeView: () => number;
    getProject: (id: number) => IProject | undefined;
    membership: MembershipContext;
    editor: DescriptionOptions['context'];
    upload: (id: number) => DescriptionOptions['upload'];
    comments: (id: number) => CommentsContext;
    reaction: (id: number, value: string, remove: boolean, signal: AbortSignal) => Promise<unknown>;
    timeTracking?: () => TimePorts | undefined;
    commentsEnabled: () => boolean;
    close: () => void;
    copy: () => Promise<unknown>;
    accepted: (task: ITask) => void;
    open?: (href: string) => void;
    removed?: (id: number) => void;
}
interface Options {
    recordFor?: (task: ITask) => TaskRecordSession | undefined;
    ports: TaskPorts;
}
interface Start extends Route {
    modal: boolean;
}
export const TaskApplication = Application.extend({
	initialize(options: Options) {
		void options
		this.addChildApp('actions',new TaskActionsApplication({record:()=>this.getState().record,ports:options.ports}))
	},
	createState() {
		return {
			ownedRecord: true,
			record: undefined as TaskRecordSession | undefined,
		}
	},
	async prepareStart(route: Start, { signal }: LifecycleContext) {
		const task = await new TaskService().get(
			new TaskModel({ id: Number(route.params.id) }),
			{ expand: ['comments', 'reactions', 'is_unread', 'buckets'] },
			signal,
		)
		signal.throwIfAborted()
		await this.getChildApp('actions')!.start()
		signal.throwIfAborted()
		return task
	},
	onStart(_app: unknown, route: Start, task: ITask) {
		const borrowed = this.options.recordFor?.(task)
		this.getState().ownedRecord = !borrowed
		const record =
			borrowed ??
			new TaskRecordSession(task, (value, signal) =>
				new TaskService().update(value, signal),
			)
		this.getState().record = record
		this.setView(
			route.modal
				? new TaskModalView({ workflow:this.getChildApp('actions') as InstanceType<typeof TaskActionsApplication>, record, ports: this.options.ports })
				: new TaskDetailView({workflow:this.getChildApp('actions') as InstanceType<typeof TaskActionsApplication>,
					record,
					ports: this.options.ports,
					modal: false,
				}),
		)
		this.showView()
	},
	flush() {
		return this.getState().record?.flush() ?? Promise.resolve()
	},
	onBeforeStop() {
		if (this.getState().ownedRecord) this.getState().record?.close()
		this.getState().record = undefined
	},
})
