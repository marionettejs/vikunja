import {PRIORITIES} from '@/constants/priorities'
import TaskModel from '@/models/task'
import TaskReminderModel from '@/models/taskReminder'
import TaskService from '@/services/task'
import ProjectUserService from '@/services/projectUsers'
import type {IAbstract} from '@/modelTypes/IAbstract'
import type {IUser} from '@/modelTypes/IUser'
import type {IUserSettings} from '@/modelTypes/IUserSettings'
import type {Label} from '@/client/generated/index'
import {parseTaskText} from '@/modules/quickAddMagic/quickAddMagicCore'
import {cleanupItemText} from '@/modules/quickAddMagic/textCleanup'
import {PREFIXES, PrefixMode} from '@/modules/quickAddMagic/prefixes'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'
import {REPEAT_TYPES} from '@/types/IRepeatAfter'
import {TASK_REPEAT_MODES} from '@/types/IRepeatMode'
import {REMINDER_PERIOD_RELATIVE_TO_TYPES} from '@/types/IReminderPeriodRelativeTo'
import {AuthenticatedHTTPFactory, apiV2Url} from '@/helpers/fetcher'
interface Context {settings: IUserSettings, labels: Label[], reportError: (error: unknown) => void}
export async function createTasks(entries: {title: string, projectId: number, bucketId?: number}[], {settings, labels, reportError}: Context, signal?: AbortSignal) {
	const mode = settings.frontendSettings.quickAddMagicMode ?? PrefixMode.Default
	const built = await Promise.all(entries.map(async ({title, projectId, bucketId}) => {
		const parsed = parseTaskText(title, mode, new Date(), settings.frontendSettings.defaultDueTime)
		if (!parsed.text) return {task: new TaskModel({title, projectId, bucketId}), labels: [] as string[]}
		const matches: (IUser & {match: string})[] = []
		for (const name of parsed.assignees) { const users = await new ProjectUserService().getAll({projectId} as unknown as IAbstract, {s: name}, 1, signal) as IUser[]; const user = users.find(user => user.username.toLowerCase() === name.toLowerCase() || user.name.toLowerCase() === name.toLowerCase()); if (user) matches.push({...user, match: name}) }
		const dueDate = toISOStringOrNull(parsed.date), task = new TaskModel({title: matches.length && PREFIXES[mode] ? cleanupItemText(parsed.text, matches.map(user => user.match), PREFIXES[mode].assignee) : parsed.text, projectId, bucketId, dueDate: parsed.date, priority: Object.values(PRIORITIES).find(priority => priority === parsed.priority) ?? PRIORITIES.UNSET, assignees: matches})
		if (parsed.repeats) task.repeatAfter = parsed.repeats
		task.reminders = dueDate ? (settings.frontendSettings.quickAddDefaultReminders ?? []).map(reminder => new TaskReminderModel({reminder: null, relativePeriod: reminder.relativePeriod, relativeTo: REMINDER_PERIOD_RELATIVE_TO_TYPES.DUEDATE})) : []
		if (parsed.repeats?.type === REPEAT_TYPES.Months && parsed.repeats.amount === 1) task.repeatMode = TASK_REPEAT_MODES.REPEAT_MODE_MONTH
		return {task, labels: parsed.labels}
	}))
	const result = await new TaskService().bulkCreate(built.map(value => value.task), signal)
	for (const [index, value] of built.entries()) { const task = result.tasks[index]; if (!task) continue; for (const title of value.labels) { const label = labels.find(label => label.title?.toLowerCase() === title.toLowerCase()); if (!label) continue; try { await AuthenticatedHTTPFactory().post(apiV2Url(`tasks/${task.id}/labels`), {label_id: label.id}, {signal}); task.labels.push(label) } catch (error) { reportError(error) } } }
	return result
}
