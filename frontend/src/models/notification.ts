import AbstractModel from './abstractModel'
import { parseDateOrNull } from '@/helpers/parseDateOrNull'
import UserModel, { getDisplayName } from './user'
import TaskModel from './task'
import TaskCommentModel from './taskComment'
import ProjectModel from './project'
import TeamModel from './team'
import { NOTIFICATION_NAMES as names, type INotification } from '@/modelTypes/INotification'
import type { IUser } from '@/modelTypes/IUser'
export default class NotificationModel extends AbstractModel<INotification> implements INotification {
	id = 0
	name = ''
	notification: INotification['notification'] = {}
	read = false
	readAt: Date | null = null
	created = new Date(NaN)
	constructor(data: Partial<INotification> = {}) {
		super()
		this.assignData(data)
		const payload = this.notification
		this.notification = { ...payload, ...(payload.doer ? { doer: new UserModel(payload.doer) } : {}), ...(payload.task ? { task: new TaskModel(payload.task) } : {}), ...(payload.comment ? { comment: new TaskCommentModel(payload.comment) } : {}), ...(payload.assignee ? { assignee: new UserModel(payload.assignee) } : {}), ...(payload.project ? { project: new ProjectModel(payload.project) } : {}), ...(payload.member ? { member: new UserModel(payload.member) } : {}), ...(payload.team ? { team: new TeamModel(payload.team) } : {}) }
		this.created = new Date(this.created)
		this.readAt = parseDateOrNull(this.readAt)
	}
	toText(user: IUser | null = null) {
		const { task, project, assignee, member, team, doer } = this.notification, identifier = task ? (task.identifier || `#${task.index}`) : ''
		switch (this.name) {
			case names.TASK_COMMENT: return task ? `commented on ${identifier}` : ''
			case names.TASK_ASSIGNED: return task && assignee ? `assigned ${user?.id === assignee.id ? 'you' : getDisplayName(assignee)} to ${identifier}` : ''
			case names.TASK_DELETED: return task ? `deleted ${identifier}` : ''
			case names.TASK_CREATED: return task ? `created ${identifier}` : ''
			case names.PROJECT_CREATED: return project ? `created ${project.title}` : ''
			case names.TEAM_MEMBER_ADDED: return member && team ? `added ${user?.id === member.id ? 'you' : getDisplayName(member)} to the ${team.name} team` : ''
			case names.TASK_REMINDER: return task && project ? `Reminder for ${identifier} ${task.title} (${project.title})` : ''
			case names.TASK_MENTIONED: return task && doer ? `${getDisplayName(doer)} mentioned you on ${identifier}` : ''
		}
		return ''
	}
}
