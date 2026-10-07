import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import type { ITask } from '@/modelTypes/ITask'
import type { TaskRecordSession } from '@/features/task/task-record'
import { ColorPickerView } from '../organizations/organization-ui'
import { SettingsSearchView } from '../settings/settings-search'
import { loadProjects } from '../projects/project-management'
import { getProjectTitle } from '@/helpers/getProjectTitle'
import { listIcon } from '@/shared/task-list/list-ui'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import './task-location.scss'
export const TaskColorView = View.extend({
	initialize(options: {
        record: TaskRecordSession;
    }) { void options },
	className: 'column native-task-color', regions: { picker: '[data-picker]' },
	events: { 'click [data-retry]': 'retry' },
	createState() { return { life: new AbortController(), dirty: false, pending: 0, revision: 0, error: '' } },
	template: () => html `<div class="detail-title">${listIcon('fill-drip')}${t('task.attributes.color')}</div><div data-picker></div><div data-error class="message danger" role="alert" hidden></div><button type="button" data-retry class="button is-outlined" hidden>${t('loadingError.tryAgain')}</button>`,
	onRender() { this.showChildView('picker', new ColorPickerView({ value: this.options.record.task.hexColor, changed: color => void this.save(color) })); this.updateTask(this.options.record.task) },
	updateTask(task: ITask) { const state = this.getState(), picker = this.getChildView('picker') as InstanceType<typeof ColorPickerView>; const canWrite = Number(task.maxPermission) > 0; for (const input of this.el.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button'))
		input.disabled = !canWrite; if (!state.dirty && !state.pending) {
		picker.getState().value = task.hexColor
		picker.publish()
	} },
	async save(color: string) { const state = this.getState(); if (Number(this.options.record.task.maxPermission) <= 0)
		return; const revision = ++state.revision; state.dirty = true; state.pending++; state.error = ''; this.publish(); try {
		await this.options.record.save({ hexColor: color }, state.life.signal)
		if (!state.life.signal.aborted && revision === state.revision) {
			state.dirty = false
			success(t('task.detail.updateSuccess'))
		}
	}
	catch (error) {
		if (!state.life.signal.aborted && revision === state.revision)
			state.error = errorText(error)
	}
	finally {
		state.pending--
		if (!state.life.signal.aborted)
			this.publish()
	} },
	publish() { const error = this.el.querySelector<HTMLElement>('[data-error]')!, retry = this.el.querySelector<HTMLButtonElement>('[data-retry]')!; error.hidden = !this.getState().error; error.textContent = this.getState().error; retry.hidden = !this.getState().error; retry.disabled = Boolean(this.getState().pending) || Number(this.options.record.task.maxPermission) <= 0 },
	retry() { void this.save((this.getChildView('picker') as InstanceType<typeof ColorPickerView>).getState().value) },
	focusInput() { this.el.querySelector<HTMLInputElement>('input')?.focus() },
	onBeforeDestroy() { this.getState().life.abort() },
}).setDomApi(LitDomApi)
export const TaskMoveView = View.extend({
	initialize(options: {
        record: TaskRecordSession;
    }) { void options },
	className: 'content details native-task-move', regions: { search: '[data-search]' },
	events: { 'click [data-retry]': 'retry' },
	createState() { return { life: new AbortController(), reading: undefined as AbortController | undefined, pending: 0, revision: 0, dirty: false, selected: undefined as number | undefined, error: '', readFailed: false } },
	template: () => html `<h2 class="task-section-title"><span class="icon is-grey">${listIcon('list')}</span>${t('task.detail.move')}</h2><div data-search></div><div data-loading role="status" hidden>${t('misc.loading')}</div><div data-error class="message danger" role="alert" hidden></div><button type="button" data-retry class="button is-outlined" hidden>${t('loadingError.tryAgain')}</button>`,
	onRender() { this.showChildView('search', new SettingsSearchView({ id: `move-task-${this.options.record.task.id}`, label: t('task.detail.move'), placeholder: t('input.projectSearch.placeholder'), items: [], selected: null, changed: id => { if (id !== null)
		void this.save(Number(id)) } })); this.updateTask(this.options.record.task); void this.load() },
	async load() { const state = this.getState(), request = new AbortController(); state.reading?.abort(); state.reading = request; state.error = ''; state.readFailed = false; this.publish(); try {
		const projects = await loadProjects(AbortSignal.any([request.signal, state.life.signal]))
		request.signal.throwIfAborted()
		if (state.life.signal.aborted)
			return
		const search = this.getChildView('search') as InstanceType<typeof SettingsSearchView>
		search.options.items = projects.filter(project => project.id > 0 && !project.isArchived && project.id !== this.options.record.task.projectId && Number(project.maxPermission) > 0).map(project => ({ value: project.id, label: getProjectTitle(project) }))
		search.publish()
	}
	catch (error) {
		if (!request.signal.aborted && !state.life.signal.aborted) {
			state.error = errorText(error)
			state.readFailed = true
		}
	}
	finally {
		if (state.reading === request)
			state.reading = undefined
		if (!state.life.signal.aborted)
			this.publish()
	} },
	async save(projectId: number) { const state = this.getState(); if (Number(this.options.record.task.maxPermission) <= 0 || (state.pending && state.selected === projectId) || (!state.pending && this.options.record.task.projectId === projectId))
		return; const revision = ++state.revision; state.selected = projectId; state.dirty = true; state.pending++; state.error = ''; this.publish(); try {
		await this.options.record.save({ projectId }, state.life.signal)
		if (!state.life.signal.aborted && revision === state.revision) {
			state.dirty = false
			success(t('task.detail.updateSuccess'))
			void this.load()
		}
	}
	catch (error) {
		if (!state.life.signal.aborted && revision === state.revision)
			state.error = errorText(error)
	}
	finally {
		state.pending--
		if (!state.life.signal.aborted)
			this.publish()
	} },
	publish() { const state = this.getState(), error = this.el.querySelector<HTMLElement>('[data-error]')!, retry = this.el.querySelector<HTMLButtonElement>('[data-retry]')!; error.hidden = !state.error; error.textContent = state.error; retry.hidden = !state.error; retry.disabled = Boolean(state.pending) || Number(this.options.record.task.maxPermission) <= 0; this.el.querySelector<HTMLElement>('[data-loading]')!.hidden = !state.reading },
	retry() { if (this.getState().readFailed)
		void this.load()
	else if (this.getState().selected)
		void this.save(this.getState().selected!) },
	updateTask(task: ITask) { for (const input of this.el.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button'))
		input.disabled = Number(task.maxPermission) <= 0 },
	focusInput() { (this.getChildView('search') as InstanceType<typeof SettingsSearchView>).focus() },
	onBeforeDestroy() { this.getState().life.abort(); this.getState().reading?.abort() },
}).setDomApi(LitDomApi)
