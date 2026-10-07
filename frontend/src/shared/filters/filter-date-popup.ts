import {View, Region, type RegionInstance} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, type TemplateResult} from 'lit-html'
import flatpickr from 'flatpickr'
import type {Instance as FlatpickrInstance} from 'flatpickr/dist/types/instance'
import {DATE_VALUES} from '@/components/date/dateRanges'
import {parseDateOrString} from '@/helpers/time/parseDateOrString'
import {HintDialogView} from '../task-list/list-help'
import {DatemathHelpView} from './filter-datemath-help'
import {button} from '../task-list/list-ui'
import type {ListContext} from '../task-list/list-context'

export const FilterDatePopupView = View.extend({
	ui: {'calendar': '[data-calendar]', 'pickerHost': '.flatpickr-container'},
	className: 'datepicker-with-range-container filter-datepicker',
	initialize(options: {context: ListContext, value: string, changed: (value: string | null) => void, closed: () => void}) { void options },
	createState() { return {date: this.options.value, previous: document.activeElement as HTMLElement | null, picker: undefined as FlatpickrInstance | undefined, help: undefined as RegionInstance | undefined,
		outside: (event: MouseEvent) => { const target = event.target as HTMLElement; if (!this.el.contains(target) && !target.closest('.date-value') && !this.getState().help?.hasView()) this.options.closed() },
		escape: (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && this.el.contains(event.target as Node) && !this.getState().help?.hasView()) { event.preventDefault(); this.options.closed() } }} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const state = this.getState(), t = this.options.context.t
		const custom = !Object.values(DATE_VALUES).some(date => date === state.date)
		return html`<div class="popup is-open"><div class="datepicker-with-range is-open"><div class="selections"><button type="button" class="base-button base-button--type-button ${custom ? 'is-active' : ''}" @click=${() => this.changeDate('')}>${t('misc.custom')}</button>${Object.entries(DATE_VALUES).map(([key, value]) => html`<button type="button" class="base-button base-button--type-button ${state.date === value ? 'is-active' : ''}" @click=${() => this.changeDate(value)}>${t(`input.datepickerRange.values.${key}`)}</button>`)}</div>
			<div class="flatpickr-container input-group"><label class="label">${t('input.datepickerRange.date')}<div class="field has-addons"><div class="control is-fullwidth"><input class="input" type="text" .value=${state.date} @input=${(event: Event) => this.changeDate((event.target as HTMLInputElement).value)}></div><div class="control">${button('', () => this.getState().picker?.toggle(), 'secondary', 'calendar', t('input.datepickerRange.openCalendar'))}</div></div></label><input class="form-control input" data-calendar>
			<p>${t('input.datemathHelp.canuse')}</p><button type="button" class="base-button base-button--type-button has-text-primary" @click=${() => this.openHelp()}>${t('input.datemathHelp.learnhow')}</button></div></div></div>`
	},
	onAttach() {
		const ctx = this.options.context
		this.getState().picker = flatpickr((this.getUI('calendar')![0] as HTMLInputElement)!, {...ctx.flatpickrOptions(), enableTime: false, wrap: false, inline: false, appendTo: (this.getUI('pickerHost')![0] as HTMLElement)!, onChange: (_dates, value) => this.changeDate(value)})
		this.syncCalendar()
		document.addEventListener('click', this.getState().outside); document.addEventListener('keydown', this.getState().escape)
	},
	changeDate(value: string) { this.getState().date = value; this.render(); this.syncCalendar(); this.options.changed(value === '' ? null : value) },
	syncCalendar() { const value = parseDateOrString(this.getState().date, false); if (value instanceof Date) this.getState().picker?.setDate(value, false) },
	openHelp() {
		if (this.getState().help?.hasView()) return
		const el = document.createElement('div'); this.el.closest('dialog')!.append(el)
		const region = new Region({el}); this.getState().help = region
		const dialog = new HintDialogView({context: this.options.context, content: new DatemathHelpView({context: this.options.context})})
		this.listenTo(dialog, 'destroy', () => { if (el.isConnected) el.remove() })
		region.show(dialog)
	},
	onBeforeDestroy() { const previous = this.getState().previous; if (previous?.isConnected && (this.el.contains(document.activeElement) || document.activeElement === document.body)) previous.focus(); this.getState().picker?.destroy(); this.getState().help?.destroy(); document.removeEventListener('click', this.getState().outside); document.removeEventListener('keydown', this.getState().escape) },
}).setDomApi(LitDomApi)
