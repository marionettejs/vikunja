import BucketService from '@/services/bucket'
import TaskBucketService from '@/services/taskBucket'
import TaskBucketModel from '@/models/taskBucket'
import type {IBucket} from '@/modelTypes/IBucket'
import {Application} from 'marionette'
import type {TaskRecordSession} from '@/features/task/task-record'
import type {TaskPorts} from './application'
import TaskService from '@/services/task'
import TaskModel from '@/models/task'
import SubscriptionService from '@/services/subscription'
import SubscriptionModel from '@/models/subscription'
import TaskDuplicateService from '@/services/taskDuplicateService'
import TaskDuplicateModel from '@/models/taskDuplicateModel'
import {success} from '../../shared/notifications'
import {t} from '../../shared/i18n'
interface Options {record: () => TaskRecordSession | undefined, ports: TaskPorts}
export const TaskActionsApplication = Application.extend({
	initialize(options: Options) { void options },
	createState() { return {life:new AbortController(),busy:false} },
	onStart() {this.getState().life = new AbortController()},
	async run(action: 'subscribe' | 'duplicate' | 'delete', caller: AbortSignal, confirmation?: AbortSignal) {
		const state = this.getState(), record = this.options.record(), life = state.life
		if (!this.isRunning() || !record || state.busy || Number(record.task.maxPermission) <= 0) return
		const signal = AbortSignal.any([life.signal,caller,...(confirmation ? [confirmation] : [])])
		signal.throwIfAborted()
		state.busy = true
		this.trigger('busy:changed',true)
		try {
			if (action === 'subscribe') {
				const subscribed = Boolean(record.task.subscription), model = new SubscriptionModel({entity:'task',entityId:record.task.id}), service = new SubscriptionService()
				if (subscribed) await service.delete(model,signal)
				else await service.create(model,signal)
				signal.throwIfAborted()
				record.acceptFields({subscription:subscribed ? null : model})
				success(t(subscribed ? 'task.subscription.unsubscribeSuccessTask' : 'task.subscription.subscribeSuccessTask'))
			} else {
				await record.flush()
				signal.throwIfAborted()
				if (action === 'duplicate') {
					const result = await new TaskDuplicateService().create(new TaskDuplicateModel({taskId:record.task.id}),signal)
					signal.throwIfAborted()
					if (!result.duplicatedTask) throw new Error('Task duplication returned no task')
					this.options.ports.open?.(`/tasks/${result.duplicatedTask.id}`)
				} else {
					await new TaskService().delete(new TaskModel(record.task),signal)
					signal.throwIfAborted()
					success(t('task.detail.deleteSuccess'))
					this.options.ports.removed?.(record.task.id)
					this.trigger('deleted')
					this.options.ports.close()
				}
			}
		} catch (error) {
			if (!signal.aborted) throw error
		} finally {
			if (state.life === life) {
				state.busy = false
				if (!life.signal.aborted) this.trigger('busy:changed',false)
			}
		}
	},
	loadBuckets(projectId: number, projectViewId: number, caller: AbortSignal) {
		const signal = AbortSignal.any([this.getState().life.signal, caller])
		signal.throwIfAborted()
		return new BucketService().getAll({projectId, projectViewId} as IBucket, {}, 1, signal)
	},
	moveBucket(bucket: IBucket, caller: AbortSignal) {
		const signal = AbortSignal.any([this.getState().life.signal, caller]), task = this.options.record()?.task
		signal.throwIfAborted()
		if (!task || Number(task.maxPermission) <= 0) throw new DOMException('Task is no longer writable', 'AbortError')
		return new TaskBucketService().update(new TaskBucketModel({taskId: task.id, projectId: task.projectId, projectViewId: bucket.projectViewId, bucketId: bucket.id}), signal)
	},
	onBeforeStop() {this.getState().life.abort();this.getState().busy=false},
})
