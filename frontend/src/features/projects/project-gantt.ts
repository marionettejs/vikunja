import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, svg, render, nothing } from 'lit-html'
import { repeat } from 'lit-html/directives/repeat.js'
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js'
import flatpickr from 'flatpickr'
import type { Instance } from 'flatpickr/dist/types/instance'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import type { ITask } from '@/modelTypes/ITask'
import type { IProject } from '@/modelTypes/IProject'
import type { QueryPatch } from '@/app/routes'
import { buildRelationArrows, type GanttBarPosition } from '@/helpers/ganttRelationArrows'
import { ganttArrowPath } from './gantt-query'
import { buildGanttTaskTree } from '@/helpers/ganttTaskTree'
import { getTextColor } from '@/helpers/color/getTextColor'
import { ListFrameView } from '../../shared/task-list/list-frame'
import type { ListWidgets } from '../../shared/task-list/list-context'
import { listIcon } from '../../shared/task-list/list-ui'
import { defaultGanttQuery, ganttQueryPatch, taskToGanttBar, shiftedDate, ganttDatePatch, type GanttQuery, type GanttBar } from './gantt-query'
import './project-gantt.scss'
interface Options {
    widgets: ListWidgets;
    project: IProject;
    viewId: number;
    openTask: (id: number) => void;
    changeQuery: (query: QueryPatch) => void;
    save: (task: ITask, patch: Partial<ITask>) => Promise<ITask>;
    create: (title: string) => Promise<ITask>;
}
export const ProjectGanttView = View.extend({
	initialize(options: Options) { void options; this.addRegion('frame', { el: this.el }) },
	template: false, className: 'native-list-surface native-gantt-surface',
	createState() { return { query: defaultGanttQuery(), tasks: [] as ITask[], loading: false } },
	onAttach() {
		const frame = new ListFrameView({ context: this.options.widgets.context, project: this.options.project, viewId: this.options.viewId })
		this.showChildView('frame', frame)
		frame.el.classList.remove('project-list')
		frame.el.classList.add('project-gantt')
		frame.showChildView('body', new GanttBodyView({ ...this.options, ...this.getState() }))
		frame.checkOverflow()
	},
	body() { return (this.getChildView('frame') as InstanceType<typeof ListFrameView> | undefined)?.getChildView('body') as InstanceType<typeof GanttBodyView> | undefined },
	pending(query: GanttQuery) { this.getState().query = query; this.body()?.updateQuery(query) },
	publish(tasks: ITask[], query: GanttQuery) { Object.assign(this.getState(), { tasks, query }); this.body()?.publish(tasks, query) },
	taskUpdated(task: ITask) { const state = this.getState(); state.tasks = state.tasks.map(value => value.id === task.id ? task : value); this.body()?.publish(state.tasks, state.query) },
	setLoading(loading: boolean) { this.getState().loading = loading; this.body()?.setLoading(loading) },
})
const GanttBodyView = View.extend({
	initialize(options: Options & {
        tasks: ITask[];
        query: GanttQuery;
        loading: boolean;
    }) { void options },
	ui: { range: '#range', toggle: '[data-dateless]', reset: '[data-reset]', chart: '.gantt-container', content: '[data-chart]', form: '.add-new-task', input: '[data-title]' },
	createState() { return { query: this.options.query, tasks: this.options.tasks, picker: undefined as Instance | undefined, observer: undefined as ResizeObserver | undefined, drafts: new Map<number, {
            start: Date;
            end: Date;
        }>(), collapsed: new Set<number>(), pointer: undefined as AbortController | undefined, life: new AbortController(), cursor: '', width: 30, createBusy: false } },
	templateContext() { return { ctx: this.options.widgets.context, canWrite: Number(this.options.project.maxPermission) > 0 } },
	template: ({ ctx, canWrite }: {
        ctx: ListWidgets['context'];
        canWrite: boolean;
    }) => html `<div class="card"><div class="card-content loader-container"><div class="gantt-options"><div class="field"><label class="label" for="range">${ctx.t('misc.dateRange')}</label><div class="control"><input id="range" class="input" placeholder=${ctx.t('misc.dateRange')}></div></div><div class="field" data-reset><label class="label" for="range">Reset</label><button class="base-button base-button--type-button button" type="button" data-reset-button>Reset</button></div><div class="base-checkbox fancy-checkbox is-block"><label class="base-checkbox__label"><input class="is-sr-only" type="checkbox" data-dateless>${unsafeHTML(checkboxSvg.replace('<svg ', '<svg class="fancy-checkbox__icon" '))}<span class="fancy-checkbox__content">${ctx.t('task.show.noDates')}</span></label></div></div></div></div><div class="gantt-chart-container"><div class="card has-overflow"><div class="gantt-container" role="application" aria-label=${ctx.t('project.gantt.chartLabel')}><div data-chart></div></div>${canWrite ? html `<form class="add-new-task"><input class="input" data-title hidden><button type="button" class="base-button base-button--type-button button" data-create><span class="icon is-small">${listIcon('plus')}</span><span>${ctx.t('task.new')}</span></button></form>` : nothing}</div></div>`,
	events: { 'change @ui.toggle': 'toggleDateless', 'click [data-reset-button]': 'reset', 'click [data-create]': 'createClicked', 'submit @ui.form': 'createSubmitted', 'keydown @ui.input': 'inputKeydown', 'blur @ui.input': 'inputBlur' },
	onAttach() {
		const state = this.getState(), ctx = this.options.widgets.context
		state.picker = flatpickr(this.getUI('range')![0] as HTMLInputElement, { ...ctx.flatpickrOptions(), mode: 'range', inline: false, altFormat: ctx.t('date.altFormatShort'), enableTime: false, altInput: true, defaultDate: [state.query.dateFrom, state.query.dateTo], onChange: dates => { if (dates.length === 2)
			this.options.changeQuery(ganttQueryPatch({ ...state.query, dateFrom: dates[0].toISOString(), dateTo: dates[1].toISOString() })) } })
		state.observer = new ResizeObserver(() => this.draw())
		state.observer.observe(this.getUI('chart')![0])
		this.updateQuery(state.query)
		this.setLoading(this.options.loading)
	},
	updateQuery(query: GanttQuery) {
		const state = this.getState()
		const rangeChanged = state.query.dateFrom !== query.dateFrom || state.query.dateTo !== query.dateTo
		state.query = query
		if (!this.isRendered())
			return
		if (rangeChanged) state.picker?.setDate([query.dateFrom, query.dateTo], false);
		(this.getUI('toggle')![0] as HTMLInputElement).checked = query.showTasksWithoutDates
		const defaults = defaultGanttQuery();
		(this.getUI('reset')![0] as HTMLElement).hidden = query.dateFrom === defaults.dateFrom && query.dateTo === defaults.dateTo && !query.showTasksWithoutDates
		this.draw()
	},
	publish(tasks: ITask[], query: GanttQuery) { this.getState().tasks = tasks; this.updateQuery(query) },
	setLoading(value: boolean) { (this.getUI('chart')![0] as HTMLElement).classList.toggle('is-loading', value && !this.getState().tasks.length) },
	toggleDateless() { this.options.changeQuery(ganttQueryPatch({ ...this.getState().query, showTasksWithoutDates: (this.getUI('toggle')![0] as HTMLInputElement).checked })) },
	reset() { this.options.changeQuery(ganttQueryPatch(defaultGanttQuery())) },
	bars() {
		const state = this.getState(), hidden = new Set<number>()
		return buildGanttTaskTree(new Map(state.tasks.map((task: ITask) => [task.id, task]))).filter(node => { if (hidden.has(node.task.id)) {
			for (const id of node.childIds)
				hidden.add(id)
			return false
		} ; if (state.collapsed.has(node.task.id))
			for (const id of node.childIds)
				hidden.add(id); return true }).map(node => {
			const bar = taskToGanttBar(node), draft = state.drafts.get(bar.id)
			return draft ? { ...bar, ...draft } : bar
		})
	},
	draw() {
		if (!this.isRendered())
			return
		const state = this.getState(), from = new Date(state.query.dateFrom), to = new Date(state.query.dateTo)
		from.setHours(0, 0, 0, 0)
		to.setHours(23, 59, 59, 999)
		const days: Date[] = []
		for (let date = from; date <= to; date = shiftedDate(date, 1))
			days.push(date)
		state.width = Math.max((this.getUI('chart')![0] as HTMLElement).clientWidth / Math.max(days.length, 1), 30)
		const width = state.width * days.length, bars = this.bars()
		const months: {
            label: string;
            days: number;
        }[] = []
		for (const date of days) {
			const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
			if (months[months.length - 1]?.label === label)
                months[months.length - 1]!.days++
			else
				months.push({ label, days: 1 })
		}
		render(html `<div class="gantt-chart-wrapper" style=${`width:${width}px`}><div class="gantt-timeline"><div class="gantt-timeline-months">${months.map(month => html `<div class="timeunit-month" style=${`width:${month.days * state.width}px`}>${month.label}</div>`)}</div><div class="gantt-timeline-days">${days.map(date => html `<div class="timeunit" style=${`width:${state.width}px`}><div class="timeunit-wrapper ${date.toDateString() === new Date().toDateString() ? 'today' : ''}"><span>${date.getDate()}</span><span class="weekday">${date.toLocaleDateString(undefined, { weekday: 'short' })}</span></div></div>`)}</div></div><div class="gantt-rows-container"><div class="gantt-rows" role="grid" tabindex="0" aria-rowcount=${bars.length} aria-colcount=${days.length}>${repeat(bars, bar => bar.id, (bar, index) => this.row(bar, index, from, to, width))}</div>${this.arrows(bars, from, width)}</div></div>`, this.getUI('content')![0] as HTMLElement)
	},
	row(bar: GanttBar, index: number, from: Date, to: Date, width: number) {
		const state = this.getState(), x = (bar.start.getTime() - from.getTime()) / 86400000 * state.width, size = Math.ceil((bar.end.getTime() - bar.start.getTime()) / 86400000) * state.width
		const color = bar.color || (bar.task.startDate || bar.task.endDate || bar.task.dueDate || bar.node.hasDerivedDates ? 'var(--primary)' : 'var(--grey-100)'), text = bar.color ? getTextColor(bar.color) : bar.task.startDate || bar.task.endDate || bar.task.dueDate ? '#fff' : 'var(--grey-800)'
		return html `<div class="gantt-row ${index % 2 ? 'bg-row-alt' : 'bg-row'}" role="row"><div class="gantt-row-content" style=${`width:${width}px;background-image:repeating-linear-gradient(to right,transparent 0,transparent ${state.width - 1}px,var(--grey-200) ${state.width - 1}px,var(--grey-200) ${state.width}px)`}><svg class="gantt-row-bars" width=${width} height="40" role="img" aria-label=${`Task bars for row ${bar.id}`} data-row-id=${bar.id}>${svg `<defs><clipPath id=${`gantt-clip-${bar.id}`}><rect x=${x + 2} y="4" width=${Math.max(size - 4, 0)} height="32"></rect></clipPath><linearGradient id=${`gantt-gradient-${bar.id}`}><stop offset=${bar.dateType === 'endOnly' ? '0%' : '60%'} stop-color=${color} stop-opacity=${bar.dateType === 'endOnly' ? '0' : '1'}></stop><stop offset=${bar.dateType === 'endOnly' ? '40%' : '100%'} stop-color=${color} stop-opacity=${bar.dateType === 'endOnly' ? '1' : '0'}></stop></linearGradient></defs><g role="slider" tabindex="0" aria-label=${`Task: ${bar.task.title}`} aria-valuemin=${from.getTime()} aria-valuemax=${to.getTime()} aria-valuenow=${bar.start.getTime()} aria-valuetext=${`${bar.start.toLocaleString()} – ${bar.end.toLocaleString()}`} @keydown=${(event: KeyboardEvent) => this.keydown(event, bar)} @dblclick=${() => this.open(bar)}><rect class="gantt-bar" x=${x} y="4" width=${size} height="32" rx="4" fill=${bar.dateType === 'both' ? color : `url(#gantt-gradient-${bar.id})`} opacity=${bar.task.done ? '.5' : '1'} stroke=${!bar.task.startDate && !bar.task.endDate && !bar.task.dueDate ? 'var(--grey-300)' : nothing} stroke-dasharray=${bar.node.hasDerivedDates ? '4,2' : !bar.task.startDate && !bar.task.endDate && !bar.task.dueDate ? '5,5' : nothing} @pointerdown=${(event: PointerEvent) => this.pointerDown(event, bar)}></rect>${bar.node.isParent ? svg `<polygon points=${`${x - 6},20 ${x},14 ${x + 6},20 ${x},26`} fill="var(--white)" stroke=${color} pointer-events="none"></polygon><polygon points=${`${x + size - 6},20 ${x + size},14 ${x + size + 6},20 ${x + size},26`} fill="var(--white)" stroke=${color} pointer-events="none"></polygon>` : nothing}<text class="gantt-bar-text" x=${bar.dateType === 'endOnly' ? x + size - 10 : x + 10 + bar.node.indentLevel * 12} y="24" text-anchor=${bar.dateType === 'endOnly' ? 'end' : 'start'} fill=${text} clip-path=${`url(#gantt-clip-${bar.id})`} style=${bar.task.done ? 'text-decoration:line-through' : ''}>${bar.task.title}</text>${bar.dateType !== 'endOnly' ? svg `<rect class="gantt-resize-handle gantt-resize-left" x=${x - 3} y="4" width="6" height="32" role="button" aria-label=${`Resize start date for task ${bar.task.title}`} @pointerdown=${(event: PointerEvent) => this.pointerDown(event, bar, 'start')}></rect>` : nothing}${bar.dateType !== 'startOnly' ? svg `<rect class="gantt-resize-handle gantt-resize-right" x=${x + size - 3} y="4" width="6" height="32" role="button" aria-label=${`Resize end date for task ${bar.task.title}`} @pointerdown=${(event: PointerEvent) => this.pointerDown(event, bar, 'end')}></rect>` : nothing}</g>${bar.node.isParent ? svg `<g class="gantt-collapse-toggle" transform=${`translate(${Math.max(0, x - 14)},14)`} role="button" tabindex="0" aria-label=${this.options.widgets.context.t(state.collapsed.has(bar.id) ? 'project.gantt.expandGroup' : 'project.gantt.collapseGroup', { task: bar.task.title })} @pointerdown=${(event: PointerEvent) => this.toggleGroup(event, bar)} @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter')
			this.toggleGroup(event, bar) }}><rect x="-2" y="-2" width="14" height="14" fill="transparent"></rect><polygon points=${state.collapsed.has(bar.id) ? '2,0 10,5 2,10' : '0,2 10,2 5,10'} fill="var(--grey-500)"></polygon></g>` : nothing}`}</svg></div></div>`
	},
	toggleGroup(event: Event, bar: GanttBar) { event.preventDefault(); event.stopPropagation(); const collapsed = this.getState().collapsed; if (collapsed.has(bar.id))
		collapsed.delete(bar.id)
	else
		collapsed.add(bar.id); this.draw() },
	arrows(bars: GanttBar[], from: Date, width: number) {
		const state = this.getState(), tasks = new Map<number, ITask>(state.tasks.map((task: ITask) => [task.id, task]))
		const positions = new Map<number, GanttBarPosition>(bars.map((bar, rowIndex) => [bar.id, { x: (bar.start.getTime() - from.getTime()) / 86400000 * state.width, y: rowIndex * 40 + 20, width: Math.ceil((bar.end.getTime() - bar.start.getTime()) / 86400000) * state.width, rowIndex }]))
		const hidden = new Map<number, number>()
		for (const node of buildGanttTaskTree(tasks)) {
			const ancestor = hidden.get(node.task.id)
			if (ancestor || state.collapsed.has(node.task.id))
				for (const id of node.childIds)
					hidden.set(id, ancestor ?? node.task.id)
		}
		const arrows = buildRelationArrows(tasks, positions, hidden)
		return html `<svg class="gantt-relation-arrows" width=${width} height=${bars.length * 40} aria-hidden="true">${svg `<defs><marker id="gantt-arrow-danger" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 6,3 0,6" fill="var(--danger)"></polygon></marker><marker id="gantt-arrow-grey" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 6,3 0,6" fill="var(--grey-500)"></polygon></marker></defs>${arrows.map(arrow => svg `<path class="gantt-arrow" d=${ganttArrowPath(arrow)} stroke=${arrow.color} stroke-width="1.5" fill="none" stroke-dasharray=${arrow.relationKind === 'precedes' ? '6,4' : 'none'} marker-end=${arrow.relationKind === 'blocking' ? 'url(#gantt-arrow-danger)' : 'url(#gantt-arrow-grey)'}></path>`)}`}</svg>`
	},
	open(bar: GanttBar) { this.options.openTask(bar.id) },
	keydown(event: KeyboardEvent, bar: GanttBar) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this.open(bar)
			return
		}
		if (Number(this.options.project.maxPermission) <= 0 || !['ArrowLeft', 'ArrowRight'].includes(event.key))
			return
		event.preventDefault()
		const step = event.key === 'ArrowLeft' ? -1 : 1
		const start = shiftedDate(bar.start, event.shiftKey ? step < 0 ? -1 : 0 : event.ctrlKey ? step < 0 ? 1 : 0 : step)
		const end = shiftedDate(bar.end, event.shiftKey ? step > 0 ? 1 : 0 : event.ctrlKey ? step > 0 ? -1 : 0 : step)
		if (start < end)
			void this.save(bar, start, end)
	},
	pointerDown(event: PointerEvent, bar: GanttBar, edge?: 'start' | 'end') {
		event.preventDefault()
		event.stopPropagation()
		const group = (event.target as Element).closest<SVGGElement>('[role="slider"]')
		group?.focus()
		if (event.detail === 2 && !edge) {
			this.open(bar)
			return
		}
		if (Number(this.options.project.maxPermission) <= 0)
			return
		const state = this.getState()
		this.cancelPointer()
		const pointer = new AbortController()
		state.pointer = pointer
		state.cursor = document.body.style.cursor
		const firstX = event.clientX
		let days = 0, moved = false
		document.addEventListener('pointermove', move => { if (Math.abs(move.clientX - firstX) < 5 && !moved)
			return; moved = true; days = Math.round((move.clientX - firstX) / state.width); const start = edge === 'end' ? bar.start : shiftedDate(bar.start, days), end = edge === 'start' ? bar.end : shiftedDate(bar.end, days); if (start >= end)
			return; state.drafts.set(bar.id, { start, end }); document.body.style.cursor = edge ? 'col-resize' : 'grabbing'; this.draw() }, { signal: pointer.signal })
		document.addEventListener('pointercancel', () => { this.cancelPointer(); state.drafts.delete(bar.id); this.draw() }, { signal: pointer.signal, once: true })
		document.addEventListener('pointerup', () => { const draft = state.drafts.get(bar.id); this.cancelPointer(); if (moved && days && draft)
			void this.save(bar, draft.start, draft.end)
		else {
			state.drafts.delete(bar.id)
			this.draw()
		} }, { signal: pointer.signal, once: true })
	},
	cancelPointer() { const state = this.getState(); if (!state.pointer)
		return; state.pointer.abort(); state.pointer = undefined; document.body.style.cursor = state.cursor },
	async save(bar: GanttBar, start: Date, end: Date) {
		const state = this.getState(), draft = { start, end }
		state.drafts.set(bar.id, draft)
		this.draw()
		try {
			const saved = await this.options.save(bar.task, ganttDatePatch(bar.task, start, end))
			if (state.life.signal.aborted)
				return
			state.tasks = state.tasks.map((task: ITask) => task.id === saved.id ? saved : task)
		}
		catch (error) {
			if (!state.life.signal.aborted)
				this.options.widgets.context.reportError(error)
		}
		finally {
			if (!state.life.signal.aborted && state.drafts.get(bar.id) === draft) {
				state.drafts.delete(bar.id)
				this.draw()
			}
		}
	},
	createClicked() { const input = this.getUI('input')![0] as HTMLInputElement; if (input.hidden) {
		input.hidden = false
		input.focus()
	}
	else
		void this.createSubmitted() },
	inputKeydown(event: KeyboardEvent) { if (event.key === 'Escape')
		(this.getUI('input')![0] as HTMLInputElement).hidden = true },
	inputBlur() { const input = this.getUI('input')![0] as HTMLInputElement; if (!input.value)
		input.hidden = true },
	async createSubmitted(event?: Event) {
		event?.preventDefault()
		const state = this.getState(), input = this.getUI('input')![0] as HTMLInputElement
		if (state.createBusy || input.hidden || !input.value.trim())
			return
		state.createBusy = true
		const title = input.value
		try {
			const task = await this.options.create(title)
			if (state.life.signal.aborted)
				return
			state.tasks.push(task)
			if (input.value === title) {
				input.value = ''
				input.hidden = true
			}
			;
			this.draw()
		}
		catch (error) {
			if (!state.life.signal.aborted)
				this.options.widgets.context.reportError(error)
		}
		finally {
			state.createBusy = false
		}
	},
	onBeforeDestroy() { this.getState().life.abort(); this.cancelPointer(); this.getState().observer?.disconnect(); this.getState().picker?.destroy() },
}).setDomApi(LitDomApi)
