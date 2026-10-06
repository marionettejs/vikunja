import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, type TemplateResult} from 'lit-html'
import flatpickr from 'flatpickr'
import type {Instance as FlatpickrInstance} from 'flatpickr/dist/types/instance'
import {calculateDayInterval} from '@/helpers/time/calculateDayInterval'
import {formatDate} from '@/shared/dates'
import {closeWhenClickedOutside} from '@/helpers/closeWhenClickedOutside'
import {listIcon, button} from '../../shared/task-list/list-ui'

export interface TaskDateContext {t: (key: string) => string, flatpickrOptions: () => flatpickr.Options.Options, shortcutDate: (date: Date) => Date, displayDate: (date: Date) => string}
const shortcuts = [['today', 'calendar-alt', true], ['tomorrow', 'sun', true], ['nextMonday', 'coffee', false], ['thisWeekend', 'cocktail', false], ['laterThisWeek', 'chess-knight', false], ['nextWeek', 'forward', false]] as const
const TaskCalendarView = View.extend({
	ui: {'close': '.button', 'calendar': '[data-calendar]'},
	events: {keydown: 'escape'},
	className: 'datepicker-popup', attributes() { return {role: 'dialog', 'aria-label': this.options.label, tabindex: '-1'} },
	initialize(options: {context: TaskDateContext, label: string, value: Date | null, showShortcuts?: boolean, changed: (value: Date | null) => void, closed: (escape?: boolean) => void}) { void options },
	createState() { return {date: this.options.value, picker: undefined as FlatpickrInstance | undefined,
		input: (event: Event) => this.timeInput(event)} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult {
		const t = this.options.context.t, now = new Date()
		return html`${(this.options.showShortcuts===false?[]:shortcuts).filter(([name]) => name !== 'today' || now.getHours() < 21).filter(([name]) => name !== 'thisWeekend' || !(now.getDay() === 0 && now.getHours() >= 21)).map(([name, symbol, regular]) => { const day = new Date(); day.setDate(day.getDate() + calculateDayInterval(name)); return html`<button type="button" class="base-button base-button--type-button datepicker__quick-select-date" @click=${(event: Event) => { event.stopPropagation(); this.selectShortcut(name) }}><span class="icon">${listIcon(symbol, regular)}</span><span class="text"><span>${t(`input.datepicker.${name}`)}</span><span class="weekday">${formatDate(day, 'ddd')}</span></span></button>` })}<div class="flatpickr-container"><input class="input" data-calendar></div>${button(t('misc.confirm'), () => this.options.closed(), 'primary')}`
	},
	onRender() { (this.getUI('close')![0] as HTMLButtonElement)!.classList.add('datepicker__close-button', 'has-no-shadow'); ((this.getUI('close')![0] as HTMLButtonElement) as HTMLElement).setAttribute('data-cy', 'closeDatepicker') },
	onAttach() {
		this.getState().picker = flatpickr((this.getUI('calendar')![0] as HTMLInputElement)!, {...this.options.context.flatpickrOptions(), defaultDate: this.getState().date ?? undefined, inline: true, onChange: dates => this.change(dates[0] ?? null)})
		this.el.addEventListener('input', this.getState().input);
		(this.el as HTMLElement).focus()
	},
	selectShortcut(name: string) { const date = new Date(); date.setDate(date.getDate() + calculateDayInterval(name)); const value = this.options.context.shortcutDate(date); this.getState().picker?.setDate(value, false); this.change(value) },
	change(value: Date | null) { if (value && this.getState().date && +value === +this.getState().date) return; this.getState().date = value; this.options.changed(value) },
	timeInput(event: Event) {
		const target = event.target as HTMLInputElement
		if (!target.matches('.flatpickr-minute, .flatpickr-hour, .cur-year')) return
		const value = new Date(this.getState().date ?? new Date())
		if (target.classList.contains('flatpickr-minute')) value.setMinutes(Number(target.value))
		if (target.classList.contains('flatpickr-hour')) value.setHours(Number(target.value))
		if (target.classList.contains('cur-year')) value.setFullYear(Number(target.value))
		this.getState().picker?.setDate(value, false); this.change(value)
	},
	escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.stopPropagation(); this.options.closed(true) } },
	onBeforeDestroy() { this.el.removeEventListener('input', this.getState().input); this.getState().picker?.destroy() },
}).setDomApi(LitDomApi)

export const TaskDatePickerView = View.extend({
	ui: {'trigger': '.show'},
	className: 'datepicker',
	regions: {popup: '[data-popup]'},
	initialize(options: {context: TaskDateContext, label: string, value: Date | null, disabled: boolean, showShortcuts?: boolean, changed: (value: Date | null) => void, committed: () => void, cancelled?: () => void}) { void options },
	createState() { return {value: this.options.value, dirty: false, closeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
		outside: (event: MouseEvent) => { const popup = this.getChildView('popup'); if (popup) closeWhenClickedOutside(event, popup.el as HTMLElement, () => this.close()) }} },
	templateContext() { return {content: this.renderTemplate()} },
	template: ({content}: {content: TemplateResult}) => content,
	renderTemplate(): TemplateResult { return html`<button type="button" class="base-button base-button--type-button simple-button show" ?disabled=${this.options.disabled} @click=${(event: Event) => { event.stopPropagation(); this.toggle() }}>${this.getState().value ? this.options.context.displayDate(this.getState().value) : this.options.label}</button><span data-popup style="display:contents"></span>` },
	onAttach() { document.addEventListener('click', this.getState().outside) },
	update(value: Date | null, disabled: boolean) { this.options.disabled = disabled; if (!this.getState().dirty) this.getState().value = value; if (disabled) { clearTimeout(this.getState().closeTimer); this.getState().closeTimer = undefined; this.getRegion('popup')!.empty(); this.getState().dirty = false; this.getState().value = value } this.refreshTrigger() },
	focusInput() { (this.getUI('trigger')![0] as HTMLButtonElement).focus() },
	refreshTrigger() { const trigger = (this.getUI('trigger')![0] as HTMLButtonElement)!; trigger.disabled = this.options.disabled; trigger.textContent = this.getState().value ? this.options.context.displayDate(this.getState().value) : this.options.label },
	toggle() {
		if (this.options.disabled) return
		if (this.getRegion('popup')!.hasView()) { this.getRegion('popup')!.empty(); return }
		this.showChildView('popup', new TaskCalendarView({context: this.options.context, label: this.options.label, value: this.getState().value, showShortcuts:this.options.showShortcuts, changed: value => { this.getState().value = value; this.getState().dirty = true; this.options.changed(value); this.refreshTrigger() }, closed: (escape?: boolean) => this.close(escape)}))
	},
	close(escape = false) {
		if (escape && this.options.cancelled) { this.getState().dirty = false; this.getRegion('popup')!.empty(); this.options.cancelled(); return }
		if (this.getState().closeTimer || !this.getRegion('popup')!.hasView()) return
		if (escape) (this.getUI('trigger')![0] as HTMLButtonElement)!.focus()
		this.getState().closeTimer = setTimeout(() => { this.getState().closeTimer = undefined; this.getRegion('popup')!.empty(); const changed = this.getState().dirty; this.getState().dirty = false; if (changed && !this.options.disabled) this.options.committed() }, 200)
	},
	onBeforeDestroy() { clearTimeout(this.getState().closeTimer); document.removeEventListener('click', this.getState().outside) },
}).setDomApi(LitDomApi)
