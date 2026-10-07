import {expect, it} from 'vitest'
import TaskModel from '@/models/task'
import {buildGanttTaskTree} from '@/helpers/ganttTaskTree'
import {ganttDatePatch, taskToGanttBar} from './gantt-query'
it('partial endpoints retain their original field authority', () => {
	const start = new Date('2026-10-05T00:00:00Z'), end = new Date('2026-10-12T23:59:59Z')
	expect(Object.keys(ganttDatePatch(new TaskModel({startDate: start}), start, end))).toEqual(['startDate'])
	expect(Object.keys(ganttDatePatch(new TaskModel({dueDate: end}), start, end))).toEqual(['dueDate'])
	expect(Object.keys(ganttDatePatch(new TaskModel({startDate: start, dueDate: end}), start, end))).toEqual(['startDate', 'dueDate'])
	expect(Object.keys(ganttDatePatch(new TaskModel(), start, end))).toEqual(['startDate', 'endDate'])
})
it('dateless parent uses derived child dates while retaining synthetic endpoint authority', () => {
	const child = new TaskModel({id: 2, startDate: new Date('2026-10-05T00:00:00Z'), endDate: new Date('2026-10-08T23:59:59Z')})
	const parent = new TaskModel({id: 1, relatedTasks: {subtask: [child]}})
	child.relatedTasks = {parenttask: [parent]}
	const tree = buildGanttTaskTree(new Map([[1, parent], [2, child]]))
	const bar = taskToGanttBar(tree[0])
	expect(bar.start).toEqual(child.startDate); expect(bar.end.toISOString()).toBe('2026-10-08T23:59:59.999Z')
	expect(bar.node.hasDerivedDates).toBe(true); expect(bar.actualDates).toBe(false)
})
