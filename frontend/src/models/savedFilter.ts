import { objectToSnakeCase } from '@/helpers/case'
import AbstractModel from './abstractModel'
import UserModel from '@/models/user'

import type {ISavedFilter} from '@/modelTypes/ISavedFilter'
import type {IUser} from '@/modelTypes/IUser'

export default class SavedFilterModel extends AbstractModel<ISavedFilter> implements ISavedFilter {
	id = 0
	title = ''
	description = ''
	filters: ISavedFilter['filters'] = {
		sort_by: ['done', 'id'],
		order_by: ['asc', 'desc'],
		filter: 'done = false',
		filter_include_nulls: true,
		s: '',
	}
	isFavorite = false

	owner: IUser = new UserModel()
	created: Date = new Date(0)
	updated: Date = new Date(0)

	constructor(data: Partial<ISavedFilter> = {}) {
		super()
		this.assignData(data)

		this.owner = new UserModel(this.owner)

		// Filters are in snake_case for the API - this makes it consistent with the way filter params are used with one-off filters.
		// Should probably be camelCase everywhere, but that's a task for another day.
		const filters = objectToSnakeCase(this.filters)
		this.filters = {...filters, sort_by: filters.sort_by, order_by: filters.order_by, filter: filters.filter, filter_include_nulls: filters.filter_include_nulls, s: filters.s}

		this.created = new Date(this.created)
		this.updated = new Date(this.updated)
	}
}
