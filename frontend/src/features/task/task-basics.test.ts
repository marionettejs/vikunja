import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {Collection} from '@mnjs/data'
import TaskModel from '@/models/task'
import {TaskBasicsView} from './task-basics'

vi.mock('flatpickr', () => ({default: () => ({setDate: vi.fn(), destroy: vi.fn()})}))
let region: InstanceType<typeof Region> | undefined
afterEach(() => { region?.destroy(); document.body.replaceChildren(); vi.useRealTimers() })
function setup() {
	const task = new TaskModel({id: 1, dueDate: new Date('2026-10-20T12:30:00Z')}), saveTask = vi.fn(async task => task)
	const inputs = {task, canWrite: true, datesLoading: false, active: {dueDate: true, priority: true, percentDone: false, startDate: false, endDate: false}}
	const mount = document.createElement('div'); document.body.append(mount)
	region = new Region({el: mount})
	const view = new TaskBasicsView({...inputs, collection: new Collection(), context: {t: key => key, flatpickrOptions: () => ({}), displayDate: value => value.toISOString(), shortcutDate: date => date}, changed: (field, value) => Object.assign(task, {[field]: value}), accepted: vi.fn(), saveTask, reportError: vi.fn()})
	region.show(view)
	return {view, inputs, saveTask}
}
it('destroying the basic group cancels the deferred calendar commit', () => {
	vi.useFakeTimers()
	const {view, saveTask} = setup()
	view.el.querySelector<HTMLButtonElement>('.datepicker .show')!.click()
	const minute = document.createElement('input'); minute.className = 'flatpickr-minute'; minute.value = '42'
	view.el.querySelector('.datepicker-popup')!.append(minute); minute.dispatchEvent(new Event('input', {bubbles: true}))
	view.el.querySelector<HTMLButtonElement>('[data-cy=closeDatepicker]')!.click()
	region!.destroy(); vi.runAllTimers()
	expect(saveTask).not.toHaveBeenCalled()
})
it('replacing a task in place closes its dirty calendar without writing to the new task', () => {
	vi.useFakeTimers()
	const {view, inputs, saveTask} = setup()
	view.el.querySelector<HTMLButtonElement>('.datepicker .show')!.click()
	const minute = document.createElement('input'); minute.className = 'flatpickr-minute'; minute.value = '42'
	view.el.querySelector('.datepicker-popup')!.append(minute); minute.dispatchEvent(new Event('input', {bubbles: true}))
	inputs.task.id = 2
	view.updateInputs(inputs)
	expect(view.el.querySelector('.datepicker-popup')).toBeNull()
	vi.runAllTimers(); expect(saveTask).not.toHaveBeenCalled()
})
it('field activation focuses the widget owned by its field View', () => {
 const {view}=setup()
 view.focusField('priority');expect(document.activeElement).toBe(view.fieldElement('priority')!.querySelector('select'))
 view.focusField('dueDate');expect(document.activeElement).toBe(view.fieldElement('dueDate')!.querySelector('.datepicker .show'))
})
