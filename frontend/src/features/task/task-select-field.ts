import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import type {ITask} from '@/modelTypes/ITask'
import {listIcon} from '../../shared/task-list/list-ui'

export type TaskSelectField = 'priority' | 'percentDone'
interface Inputs {task: ITask, canWrite: boolean}
interface Options extends Inputs {
	field: TaskSelectField
	t: (key: string) => string
	changed: (field: TaskSelectField, value: number) => void
	saveTask: (task: ITask, signal: AbortSignal) => Promise<ITask>
	accepted: (task: ITask, field: TaskSelectField) => void
	reportError: (error: unknown) => void
}
const priorities = ['unset', 'low', 'medium', 'high', 'urgent', 'doNow']
const percentages = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

export const TaskSelectFieldView = View.extend({
	ui: {'select': 'select'},
	attributes: {style: 'display:contents'},
	initialize(options: Options) { void options },
	createState(options: Options) { return {inputs: options as Inputs, taskId: options.task.id, value: options.task[options.field], request: undefined as AbortController | undefined} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const state = this.getState(), {field, t} = this.options
		return html`<div class="detail-title">${listIcon(field === 'priority' ? 'exclamation-circle' : 'percent')} ${t(`task.attributes.${field}`)}</div><div class="select"><select .value=${String(state.value)} ?disabled=${!state.inputs.canWrite} aria-label=${field === 'priority' ? t('task.attributes.priority') : nothing} @change=${(event: Event) => void this.change(Number((event.target as HTMLSelectElement).value))}>${field === 'priority' ? priorities.map((name, value) => html`<option value=${value} .selected=${value === state.value}>${t(`task.priority.${name}`)}</option>`) : percentages.map(value => html`<option value=${value} .selected=${value === state.value}>${value * 100}%</option>`)}</select></div>`
	},
	focusInput() { (this.getUI('select')![0] as HTMLSelectElement).focus() },
	onRender() { (this.getUI('select')![0] as HTMLSelectElement)!.value = String(this.getState().value) },
	updateInputs(inputs: Inputs) {
		const state = this.getState()
		if (inputs.task.id !== state.taskId || !inputs.canWrite) { state.request?.abort(); state.request = undefined }
		state.inputs = inputs; state.taskId = inputs.task.id; state.value = inputs.task[this.options.field]; this.render()
	},
	async change(value: number) {
		const state = this.getState(), {field} = this.options
		if (this.isDestroyed() || !state.inputs.canWrite) return
		state.request?.abort()
		const request = new AbortController(), task = {...state.inputs.task, [field]: value}
		state.request = request; state.value = value
		this.options.changed(field, value)
		try {
			const saved = await this.options.saveTask(task, request.signal)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || state.inputs.task.id !== task.id || !state.inputs.canWrite) return
			this.options.accepted(saved, field)
		} catch (error) { if (!request.signal.aborted) this.options.reportError(error) }
		finally { if (state.request === request) state.request = undefined }
	},
	onBeforeDestroy() { this.getState().request?.abort(); this.getState().request = undefined },
}).setDomApi(LitDomApi)
