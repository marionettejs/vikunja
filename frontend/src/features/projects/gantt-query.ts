import type {Query, QueryPatch} from '@/app/routes'
import type {ITask} from '@/modelTypes/ITask'
import type {TaskFilterParams} from '@/services/taskCollection'
import {parseDateProp} from '@/helpers/time/parseDateProp'
import {parseBooleanProp} from '@/helpers/time/parseBooleanProp'
import {isoToKebabDate} from '@/helpers/time/isoToKebabDate'
import {roundToNaturalDayBoundary} from '@/helpers/time/roundToNaturalDayBoundary'
import {getHexColor} from '@/models/task'
import type {GanttTaskTreeNode} from '@/helpers/ganttTaskTree'

export interface GanttQuery {dateFrom: string, dateTo: string, showTasksWithoutDates: boolean}
export interface GanttBar {
	id: number
	task: ITask
	start: Date
	end: Date
	dateType: 'both' | 'startOnly' | 'endOnly'
	actualDates: boolean
	color: string
	node: GanttTaskTreeNode
}

export function defaultGanttQuery(now = new Date()): GanttQuery {
	return {
		dateFrom: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15).toISOString(),
		dateTo: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 55).toISOString(),
		showTasksWithoutDates: false,
	}
}
export function parseGanttQuery(query: Query, now = new Date()): GanttQuery {
	const defaults = defaultGanttQuery(now)
	return {
		dateFrom: parseDateProp(typeof query.dateFrom === 'string' ? query.dateFrom : undefined) ?? defaults.dateFrom,
		dateTo: parseDateProp(typeof query.dateTo === 'string' ? query.dateTo : undefined) ?? defaults.dateTo,
		showTasksWithoutDates: parseBooleanProp(typeof query.showTasksWithoutDates === 'string' ? query.showTasksWithoutDates : undefined) || false,
	}
}
export function ganttQueryPatch(query: GanttQuery): QueryPatch {
	const defaults = defaultGanttQuery()
	return {
		dateFrom: query.dateFrom === defaults.dateFrom && query.dateTo === defaults.dateTo ? undefined : isoToKebabDate(query.dateFrom),
		dateTo: query.dateFrom === defaults.dateFrom && query.dateTo === defaults.dateTo ? undefined : isoToKebabDate(query.dateTo),
		showTasksWithoutDates: query.showTasksWithoutDates ? 'true' : undefined,
	}
}
export function ganttRequestParams(query: GanttQuery): TaskFilterParams {
	const from = isoToKebabDate(query.dateFrom), to = isoToKebabDate(query.dateTo)
	return {
		sort_by: ['start_date', 'done', 'id'], order_by: ['asc', 'asc', 'desc'],
		filter: `((start_date >= "${from}" && start_date <= "${to}") || (end_date >= "${from}" && end_date <= "${to}") || (due_date >= "${from}" && due_date <= "${to}") || (start_date <= "${from}" && end_date >= "${to}"))`,
		filter_include_nulls: query.showTasksWithoutDates, expand: 'subtasks', s: '',
	}
}
export function taskToGanttBar(node: GanttTaskTreeNode, now = new Date()): GanttBar {
	const task = node.task
	const start = task.startDate || (node.hasDerivedDates ? node.derivedStartDate : null)
	const end = task.endDate || task.dueDate || (node.hasDerivedDates ? node.derivedEndDate : null)
	let first = start ? new Date(start) : end ? shiftedDate(new Date(end), -7) : new Date(now)
	let last = end ? new Date(end) : start ? shiftedDate(new Date(start), 7) : shiftedDate(new Date(now), 7)
	first = roundToNaturalDayBoundary(first, true)
	if (!end && !start) last.setHours(23, 59, 0, 0)
	last = roundToNaturalDayBoundary(last)
	return {id: task.id, task, start: first, end: last, dateType: start && !end ? 'startOnly' : !start && end ? 'endOnly' : 'both', actualDates: Boolean(task.startDate && (task.endDate || task.dueDate)), color: getHexColor(task.hexColor) || '', node}
}
export function shiftedDate(date: Date, days: number) {
	const shifted = new Date(date)
	shifted.setDate(shifted.getDate() + days)
	return shifted
}
// Preserve the original distinction between real and synthetic endpoints.
export function ganttDatePatch(task: ITask, start: Date, end: Date): Partial<ITask> {
	if (task.startDate && task.endDate) return {startDate: roundToNaturalDayBoundary(start, true), endDate: roundToNaturalDayBoundary(end)}
	if (task.startDate && task.dueDate) return {startDate: roundToNaturalDayBoundary(start, true), dueDate: roundToNaturalDayBoundary(end)}
	if (task.startDate) return {startDate: roundToNaturalDayBoundary(start, true)}
	if (task.endDate || task.dueDate) return {...(task.endDate ? {endDate: roundToNaturalDayBoundary(end)} : {}), ...(task.dueDate ? {dueDate: roundToNaturalDayBoundary(end)} : {})}
	return {startDate: roundToNaturalDayBoundary(start, true), endDate: roundToNaturalDayBoundary(end)}
}

// Public GanttRelationArrows.vue path geometry, independent of its Vue wrapper.
export function ganttArrowPath({startX, startY, endX, endY}: import('@/helpers/ganttRelationArrows').GanttArrow) {
	const dx = endX - startX, offset = Math.min(Math.abs(dx) * 0.4, 60)
	if (dx >= 0) return `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX - offset} ${endY}, ${endX} ${endY}`
	const midY = startY + (endY > startY ? 30 : -30)
	return `M ${startX} ${startY} C ${startX + 30} ${startY}, ${startX + 30} ${midY}, ${startX + 30} ${midY} L ${endX - 30} ${midY} C ${endX - 30} ${midY}, ${endX - 30} ${endY}, ${endX} ${endY}`
}
