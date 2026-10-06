import AbstractService from '@/services/abstractService'
import TaskModel from '@/models/task'

import type {ITask} from '@/modelTypes/ITask'
import BucketModel from '@/models/bucket'
import type {IBucket} from '@/modelTypes/IBucket'

export type ExpandTaskFilterParam = 'subtasks' | 'buckets' | 'reactions' | 'comment_count' | 'is_unread' | null

export interface TaskFilterParams {
	sort_by: ('start_date' | 'end_date' | 'due_date' | 'done' | 'id' | 'position' | 'title' | 'relevance')[],
	order_by: ('asc' | 'desc')[],
	filter: string,
	filter_include_nulls: boolean,
	filter_timezone?: string,
	s: string,
	per_page?: number,
	expand?: ExpandTaskFilterParam,
}

export function getDefaultTaskFilterParams(): TaskFilterParams {
	return {
		sort_by: ['position', 'id'],
		order_by: ['asc', 'desc'],
		filter: '',
		filter_include_nulls: false,
		filter_timezone: '',
		s: '',
		expand: 'subtasks',
	}
}

export default class TaskCollectionService extends AbstractService<ITask, ITask | IBucket> {
	constructor() {
		super({
			getAll: '/projects/{projectId}/views/{viewId}/tasks',
			// /projects/{projectId}/tasks when viewId is not provided
		})
	}

	getReplacedRoute(path: string, pathparams: object): string {
		if (!Reflect.get(pathparams, 'viewId')) {
			return super.getReplacedRoute('/projects/{projectId}/tasks', pathparams)
		}
		return super.getReplacedRoute(path, pathparams)
	}

	modelFactory(data: Partial<ITask>) { return new TaskModel(data) }

	modelGetAllFactory(data: Partial<ITask | IBucket> & {project_view_id?: number}) {
		if (typeof data.project_view_id !== 'undefined') {
			return new BucketModel(data)
		}
		return new TaskModel(data)
	}
	async getTasks(model?: ITask, params: Record<string, unknown> = {}, page = 1, signal?: AbortSignal): Promise<ITask[]> {
		return (await this.getAll(model, params, page, signal)).map(item => {
			if ('tasks' in item) throw new Error('Task endpoint returned a bucket')
			return item
		})
	}

}
