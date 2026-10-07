import type {IAbstract} from './IAbstract'
import type {IUser} from './IUser'
import type {ITask} from './ITask'
import type {ITaskComment} from './ITaskComment'
import type {ITeam} from './ITeam'
import type { IProject } from './IProject'

export const NOTIFICATION_NAMES = {
	'TASK_COMMENT': 'task.comment',
	'TASK_ASSIGNED': 'task.assigned',
	'TASK_DELETED': 'task.deleted',
	'TASK_CREATED': 'task.created',
	'TASK_REMINDER': 'task.reminder',
	'PROJECT_CREATED': 'project.created',
	'TEAM_MEMBER_ADDED': 'team.member.added',
	'TASK_MENTIONED': 'task.mentioned',
} as const

export interface NotificationData {
	doer?: IUser
	task?: Pick<ITask,'id'|'title'|'identifier'|'index'>
	comment?: ITaskComment
	assignee?: IUser
	project?: IProject
	member?: IUser
	team?: Pick<ITeam,'id'|'name'>
}

export interface INotification extends IAbstract {
	id: number
	name: string
	notification: NotificationData
	read: boolean
	readAt: Date | null

	created: Date
}
