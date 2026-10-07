import {View, Region, type RegionInstance} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, nothing, type TemplateResult} from 'lit-html'
import {parseSubtasksViaIndention, type TaskWithParent} from '@/helpers/parseSubtasksViaIndention'
import {getLabelsFromPrefix} from '@/modules/quickAddMagic/prefixParser'
import {PREFIXES} from '@/modules/quickAddMagic/prefixes'
import {RELATION_KIND} from '@/types/IRelationKind'
import {runWrites} from '@/helpers/runWrites'
import TaskRelationService from '@/services/taskRelation'
import TaskRelationModel from '@/models/taskRelation'
import type {ITask} from '@/modelTypes/ITask'
import {setModuleLoading} from '@/stores/helper'
import type {ListContext} from './list-context'
import {listIcon} from './list-ui'
import {ListHelpView} from './list-help'

export const ListAddTaskView = View.extend({
	ui: {'input': 'textarea'},
	className: 'task-add list-view__add-task d-print-none',
	initialize(options: {context: ListContext, projectId: number, added: (tasks: ITask[]) => void}) { void options },
	createState() { return {draft: '', error: '', busy: false, loading: false, hovered: false, id: `task-add-textarea-${Math.random().toString(36).substring(2, 11)}`,
		request: undefined as AbortController | undefined, help: undefined as RegionInstance | undefined, resizeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
		resize: () => { clearTimeout(this.getState().resizeTimer); this.getState().resizeTimer = setTimeout(() => this.resizeInput(), 200) }} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult | typeof nothing}) => content,
	renderTemplate(): TemplateResult | typeof nothing {
		const ctx = this.options.context, state = this.getState()
		return html`<div class="add-task__field field" @mouseenter=${() => { state.hovered = true; this.render() }} @mouseleave=${() => { state.hovered = false; this.render() }}>
			<p class="control task-input-wrapper"><label class="is-sr-only" for=${state.id}>${ctx.t('project.list.addPlaceholder')}</label><span class="icon is-small task-icon">${listIcon('tasks')}</span>
				<textarea id=${state.id} class="add-task-textarea input ${state.draft === '' ? 'textarea-empty' : ''}" placeholder=${ctx.t('project.list.addPlaceholder')} rows="1" .value=${state.draft}
					@input=${(event: Event) => { state.draft = (event.target as HTMLTextAreaElement).value; this.render() }}
					@keydown=${(event: KeyboardEvent) => { if (!state.draft) state.error = ''; if (event.key === 'Escape') (event.target as HTMLElement).blur(); if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void this.addTask() } }}></textarea>
				${PREFIXES[ctx.quickAddMode()] ? html`<button type="button" class="base-button base-button--type-button icon is-small show-helper-text quick-add-magic-trigger-btn ${state.hovered ? 'is-highlighted' : ''}" aria-label=${ctx.t('task.quickAddMagic.hint')} title=${ctx.t('task.quickAddMagic.hint')} @click=${() => this.openHelp()}>${listIcon('circle-question', true)}</button>` : nothing}
			</p><p class="control"><button type="button" class="base-button base-button--type-button button is-primary add-task-button ${state.loading ? 'is-loading' : ''}" style="--button-white-space:break-spaces" ?disabled=${state.draft === '' || state.loading} aria-label=${ctx.t('project.list.add')} @click=${() => void this.addTask()}><span class="icon is-small">${listIcon('plus')}</span><span><span class="button-text">${ctx.t('project.list.add')}</span></span></button></p>
		</div><div class="expandable">${state.error ? html`<p class="pbs-3 mbs-0 help is-danger">${state.error}</p>` : nothing}</div>`
	},
	focusInput() { (this.getUI('input')![0] as HTMLTextAreaElement).focus() },
	onAttach() { this.resizeInput(); if (window.innerWidth > 769) (this.getUI('input')![0] as HTMLTextAreaElement)!.focus(); window.addEventListener('resize', this.getState().resize) },
	onRender() { if (this.isAttached()) this.resizeInput() },
	resizeInput() {
		const input = (this.getUI('input')![0] as HTMLTextAreaElement)!
		if (!input) return
		const empty = !input.value
		if (empty) input.value = input.placeholder
		input.style.overflowY = 'hidden'; input.style.minHeight = ''; input.style.height = '0'; input.style.height = `${input.scrollHeight}px`
		if (empty) input.value = ''
	},
	openHelp() {
		if (this.getState().help?.hasView()) return
		if (!this.getState().help) { const el = document.createElement('div'); document.body.append(el); this.getState().help = new Region({el}) }
		this.getState().help!.show(new ListHelpView({context: this.options.context}))
	},
	async addTask() {
		const state = this.getState(), ctx = this.options.context
		if (!state.draft) { state.error = ctx.t('project.create.addTitleRequired'); this.render(); return }
		if (state.busy) return
		state.error = ''; state.busy = true
		const request = new AbortController(); state.request = request
		const backup = state.draft
		const created = new Map<ITask['title'], ITask>()
		const tasksToCreate = parseSubtasksViaIndention(backup, ctx.quickAddMode())
		let stopLoading = () => {}
		try {
			const requested = [...new Set(tasksToCreate.flatMap(({title}) => getLabelsFromPrefix(title, ctx.quickAddMode()) ?? []))]
			const resolved = await ctx.ensureLabels(requested)
			request.signal.throwIfAborted()
			const resolvedTitles = new Set(resolved.map(label => (label.title ?? '').toLowerCase()))
			const failed = requested.filter(title => !resolvedTitles.has(title.toLowerCase()))
			if (failed.length) ctx.reportError({message: ctx.t('task.label.createFailed', {labels: failed.join(', ')})})
			state.draft = ''; this.render()
			const entries = await Promise.all(tasksToCreate.filter(({title}) => title !== '').map(async ({title, project}) => ({title, projectId: (project !== null ? await ctx.findProject(project) : this.options.projectId) || ctx.defaultProject() || 0})))
			request.signal.throwIfAborted()
			if (!entries.length) { state.draft = backup; state.error = ctx.t('project.create.addTitleRequired'); return }
			stopLoading = setModuleLoading(loading => { if (!request.signal.aborted) { state.loading = loading; this.render() } })
			const bulk = await ctx.createTasks(entries)
			request.signal.throwIfAborted()
			const allCreated: ITask[] = []
			entries.forEach(({title}, index) => { const task = bulk.tasks[index]; if (task) { created.set(title, task); allCreated.push(task) } })
			const service = new TaskRelationService()
			const parents = tasksToCreate.filter(task => task.parent !== null).map(task => task.parent)
			const createRelation = async (task: TaskWithParent) => {
				request.signal.throwIfAborted()
				const child = created.get(task.title), parent = created.get(task.parent ?? '')
				if (!child || !parent || (task.parent === null && !parents.includes(task.title))) return
				const relation = await service.create(new TaskRelationModel({taskId: child.id, otherTaskId: parent.id, relationKind: RELATION_KIND.PARENTTASK}))
				request.signal.throwIfAborted()
				child.relatedTasks ??= {}; parent.relatedTasks ??= {}
				;(child.relatedTasks[RELATION_KIND.PARENTTASK] ??= []).push({...parent, relatedTasks: {}})
				;(parent.relatedTasks[RELATION_KIND.SUBTASK] ??= []).push({...child, relatedTasks: {}})
				return relation
			}
			try { await runWrites(tasksToCreate, createRelation, ctx.concurrentWrites()) } catch (error) { if (!request.signal.aborted) ctx.reportError(error) }
			request.signal.throwIfAborted()
			if (allCreated.length) this.options.added(allCreated)
			if (bulk.error !== null) { state.draft = backup; ctx.reportError(bulk.error) }
		} catch (error) {
			if (!request.signal.aborted) { state.draft = backup; if ((error as Error)?.message === 'NO_PROJECT') state.error = ctx.t('project.create.addProjectRequired'); else ctx.reportError(error) }
		} finally { stopLoading(); if (!request.signal.aborted) { state.busy = false; state.loading = false; this.render() } }
	},
	onBeforeDestroy() {
		this.getState().request?.abort(); clearTimeout(this.getState().resizeTimer)
		window.removeEventListener('resize', this.getState().resize)
		const region = this.getState().help, el = region?.el
		region?.destroy(); if (el instanceof Element) el.remove()
	},
}).setDomApi(LitDomApi)
