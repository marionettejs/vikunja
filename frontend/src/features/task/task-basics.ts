import {View, CollectionView, type ViewConfiguration} from 'marionette'
import {Collection, DataApi, type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, type TemplateResult} from 'lit-html'
import type {ITask} from '@/modelTypes/ITask'
import {TaskSelectFieldView} from './task-select-field'
import {TaskDatePickerView, type TaskDateContext} from './task-date-picker'
import {listIcon} from '../../shared/task-list/list-ui'
import './task-basics.scss'

export type TaskBasicField = 'priority' | 'percentDone' | 'dueDate' | 'startDate' | 'endDate'
export interface TaskBasicInputs {task: ITask, canWrite: boolean, datesLoading: boolean, active: Record<TaskBasicField, boolean>}
export interface TaskBasicOptions extends TaskBasicInputs {context: TaskDateContext, changed: (field: TaskBasicField, value: number | Date | null) => void, saveTask: (task: ITask, signal: AbortSignal, field: TaskBasicField) => Promise<ITask>, accepted: (task: ITask, field: TaskBasicField) => void, reportError: (error: unknown) => void}
const fields: TaskBasicField[] = ['priority', 'dueDate', 'percentDone', 'startDate', 'endDate']
const dateNames = {dueDate: ['calendar', 'DueDate'], startDate: ['play', 'StartDate'], endDate: ['stop', 'EndDate']} as const
const DateFieldView = View.extend({
	ui: {'remove': '.remove'},
	attributes: {style: 'display:contents'}, regions: {picker: '[data-date-picker]'},
	initialize(options: TaskBasicOptions & {field: keyof typeof dateNames}) { void options },
	createState() { return {request: undefined as AbortController | undefined, taskId: this.options.task.id, draft: undefined as Date | null | undefined} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult { const {field, context, task, canWrite} = this.options; return html`<div class="detail-title">${listIcon(dateNames[field][0])} ${context.t(`task.attributes.${field}`)}</div><div class="date-input"><div data-date-picker style="display:contents"></div><button type="button" class="base-button base-button--type-button remove" aria-label=${context.t(`task.detail.remove${dateNames[field][1]}`)} ?hidden=${!task[field] || !canWrite} @click=${() => { this.change(null); void this.save() }}><span class="icon is-small">${listIcon('times')}</span></button></div>` },
	onAttach() { this.showPicker() },
	change(value: Date | null) { this.getState().draft = value; this.options.changed(this.options.field, value) },
	focusInput() { (this.getChildView('picker') as InstanceType<typeof TaskDatePickerView>).focusInput() },
	showPicker() { this.showChildView('picker', new TaskDatePickerView({context: this.options.context, label: this.options.context.t(`task.detail.choose${dateNames[this.options.field][1]}`), value: this.options.task[this.options.field], disabled: !this.options.canWrite || this.options.datesLoading, changed: value => this.change(value), committed: () => void this.save()})) },
	updateInputs(inputs: TaskBasicInputs) {
		const state = this.getState()
		const replaced = inputs.task.id !== state.taskId
		if (replaced || !inputs.canWrite) {
			state.request?.abort()
			state.draft = undefined
		}
		Object.assign(this.options, inputs)
		state.taskId = inputs.task.id
		if (replaced) this.showPicker()
		;(this.getUI('remove')![0] as HTMLButtonElement).hidden = !inputs.task[this.options.field] || !inputs.canWrite
		const draft = state.draft
		const value = draft === undefined ? inputs.task[this.options.field] : draft
		;(this.getChildView('picker') as InstanceType<typeof TaskDatePickerView> | undefined)?.update(value, !inputs.canWrite || inputs.datesLoading)
	},
	async save() {
		if (!this.options.canWrite || this.isDestroyed()) return
		const state = this.getState()
		const field = this.options.field
		const submitted = state.draft
		const task = {...this.options.task, ...(submitted === undefined ? {} : {[field]: submitted})}
		const request = new AbortController()
		state.request?.abort()
		state.request = request
		try {
			const saved = await this.options.saveTask(task, request.signal, field)
			request.signal.throwIfAborted()
			if (!this.isDestroyed() && state.taskId === task.id && this.options.canWrite) {
				if (state.draft === submitted) state.draft = undefined
				this.options.accepted(saved, field)
			}
		} catch (error) {
			if (!request.signal.aborted) this.options.reportError(error)
		} finally {
			if (state.request === request) state.request = undefined
		}
	},
	onBeforeDestroy() { this.getState().request?.abort() },
}).setDomApi(LitDomApi)

const FieldColumnView = View.extend({
	initialize(options: ViewConfiguration & {model: Model, inputs: TaskBasicOptions}) { void options },
	className: 'column',
	createState() { return {flash: undefined as ReturnType<typeof setTimeout> | undefined} },
	onAttach() { this.el.classList.add('flash-background-enter-active'); this.getState().flash = setTimeout(() => this.el.classList.remove('flash-background-enter-active'), 750) },
	onBeforeDestroy() { clearTimeout(this.getState().flash) },
	template: () => html`<div data-widget style="display:contents"></div>`,
	regions: {widget: '[data-widget]'},
	onRender() {
		const field = this.options.model.get('field') as TaskBasicField;
		(this.el as HTMLElement).dataset.field = field
		this.showChildView('widget', field === 'priority' || field === 'percentDone'
			? new TaskSelectFieldView({...this.options.inputs, field, t: this.options.inputs.context.t, saveTask: (task, signal) => this.options.inputs.saveTask(task, signal, field)})
			: new DateFieldView({...this.options.inputs, field}))
	},
	focusInput() { (this.getChildView('widget') as InstanceType<typeof DateFieldView> | InstanceType<typeof TaskSelectFieldView>).focusInput() },
	updateInputs(inputs: TaskBasicInputs) { (this.getChildView('widget') as InstanceType<typeof DateFieldView> | InstanceType<typeof TaskSelectFieldView>).updateInputs(inputs) },
}).setDomApi(LitDomApi).setDataApi(DataApi)

export const TaskBasicsView = CollectionView.extend({
	className: 'native-task-basics', attributes: {style: 'display:contents'},
	childView: FieldColumnView, viewComparator: 'order',
	initialize(options: TaskBasicOptions & {collection: Collection}) { void options },
	fieldElement(field: TaskBasicField) { return Array.from(this.children).find(child => (child as InstanceType<typeof FieldColumnView>).options.model.get('field') === field)?.el as HTMLElement | undefined },
	focusField(field: TaskBasicField) { (Array.from(this.children).find(child => (child as InstanceType<typeof FieldColumnView>).options.model.get('field') === field) as InstanceType<typeof FieldColumnView> | undefined)?.focusInput() },
	childViewOptions() { return {inputs: this.options} },
	onRender() { this.updateInputs(this.options) },
	updateInputs(inputs: TaskBasicInputs) {
		Object.assign(this.options, inputs)
		this.options.collection.remove(this.options.collection.models.filter(model => !inputs.active[model.id as TaskBasicField]))
		for (const [order, field] of fields.entries()) if (inputs.active[field] && !this.options.collection.get(field)) this.options.collection.add({id: field, field, order})
		this.sort()
		for (const child of this.children.toArray()) child.updateInputs(inputs)
	},
}).setDataApi(DataApi)
