import type {Query as LocationQuery, QueryPatch as LocationQueryRaw} from '@/app/routes'
import {getDefaultTaskFilterParams} from '@/services/taskCollection'

export type Sort = Record<string, 'asc' | 'desc'>
export interface ListQuery {sort: Sort, filter: string, s: string, page: number, explicitSort: boolean, includeNulls: boolean}
const fields = new Set(['id', 'index', 'done', 'title', 'priority', 'due_date', 'start_date', 'end_date', 'percent_done', 'created', 'updated', 'done_at', 'position'])
const scalar = (value: LocationQuery[string]) => typeof value === 'string' ? value : ''
export function parseListQuery(query: LocationQuery, fallback: Sort = {position: 'asc'}): ListQuery {
	const raw = scalar(query.sort)
	const sort: Sort = {}
	for (const part of raw.split(',')) {
		const [field, order] = part.split(':')
		if (fields.has(field) && (order === 'asc' || order === 'desc')) sort[field] = order
	}
	return {sort: Object.keys(sort).length ? sort : fallback, filter: scalar(query.filter), s: scalar(query.s), page: Number(scalar(query.page) || '1'), explicitSort: Boolean(raw), includeNulls: false}
}
export function storedListQuery(query: ListQuery): LocationQueryRaw {
	return {...(query.explicitSort ? {sort: Object.entries(query.sort).map(([key, order]) => `${key}:${order}`).join(',')} : {}), ...(query.filter ? {filter: query.filter} : {}), ...(query.s ? {s: query.s} : {}), ...(query.page > 1 ? {page: String(query.page)} : {})}
}
export function listRequestParams(query: ListQuery, timezone: string) {
	const keys = Object.keys(query.sort)
	// Preserve the reference's request order, including its first-key removal when id is present.
	const id = keys.indexOf('id')
	if (id >= 0) { keys.splice(0, 1); keys.push('id') }
	return {...getDefaultTaskFilterParams(), filter: query.filter, s: query.s, filter_include_nulls: query.includeNulls, filter_timezone: timezone,
		sort_by: query.s && !query.explicitSort ? [] : keys,
		order_by: query.s && !query.explicitSort ? [] : keys.map(key => query.sort[key]),
		expand: ['subtasks', 'comment_count', 'is_unread'],
	}
}
