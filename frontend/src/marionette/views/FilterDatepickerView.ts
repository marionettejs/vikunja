import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {PopupView, type PopupViewOptions} from './PopupView'
import {ModalCardView, type ModalCardViewOptions} from './ModalCardView'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import {DATE_VALUES} from '@/components/date/dateRanges'
import {formatDateShort} from '@/helpers/time/formatDate'
import {parseDateOrString} from '@/helpers/time/parseDateOrString'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'

export interface FilterDatepickerViewOptions {
	modelValue: string | Date | null
	onChange: (value: string | Date | null) => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
	ignoreClickClasses?: string[]
	t: (key: string) => string
	flatpickrLocale: object
	weekStart?: number
	dateFormat?: string
}

interface FilterDatepickerViewContext extends ViewInstance {
	_date: string | Date | null
	_flatpickr: flatpickr.Instance | null
	_flatpickrEl: HTMLElement | null
	_helpOpen: boolean
	_helpModal: ModalCardViewInstance | null
	_customRangeActive: boolean
	_popupView: PopupViewInstance | null
	_panelView: PanelViewInstance | null
	_options(): FilterDatepickerViewOptions
	_computeCustomRangeActive(): boolean
	_initFlatpickr(): void
	_destroyFlatpickr(): void
	_updateFlatpickrDate(): void
	_emitChanged(): void
	_setDate(value: string | null): void
	_handleInputChange(event: Event): void
	_handleCalendarClick(): void
	_handleLearnHowClick(): void
	_closeHelpModal(): void
	_onPopupOpenChange(open: boolean): void
	_renderDatemathHelpContent(t: (key: string) => string): ViewInstance
	_updateSelectionsActiveState(): void
	_updateInputValue(): void
	setModelValue(value: string | Date | null): void
	setOpen(open: boolean): void
}

export interface PanelViewOptions {
	t: (key: string) => string
	dateValue: string
	customRangeActive: boolean
	onSetDate: (value: string | null) => void
	onInputChange: (event: Event) => void
	onCalendarClick: () => void
	onLearnHowClick: () => void
}

interface PanelViewContext extends ViewInstance {
	_options(): PanelViewOptions
	_onSetDateClick(event: Event): void
	_handleInputChange(event: Event): void
	_handleCalendarClick(): void
	_handleLearnHowClick(): void
}

type PopupViewInstance = ViewInstance & {
	_open: boolean
	toggle: () => boolean
	close: () => void
	showChildView(region: string, view: ViewInstance): void
}

type ModalCardViewInstance = ViewInstance & {
	setPrimaryDisabled: (disabled: boolean) => void
	setDismissible: (dismissible: boolean) => void
}

type PanelViewInstance = ViewInstance & {
	render(): PanelViewInstance
}

const DEFAULT_DATE_FORMAT = 'Y-m-d H:i'

const PanelView = View.extend({
	className: 'datepicker-with-range',

	template(data: {
		customRangeActive: boolean
		dateValue: string
		t: (key: string) => string
		dateKeys: string[]
		dateValueEntries: [string, string][]
	}) {
		return html`
			<div class="selections">
				<button
					class="${data.customRangeActive ? 'is-active' : ''}"
					data-action="set-date"
					data-value=""
				>
					${data.t('misc.custom')}
				</button>
				${data.dateValueEntries.map(([text, value]) => html`
					<button
						class="${data.dateValue === value ? 'is-active' : ''}"
						data-action="set-date"
						data-value="${value}"
					>
						${data.t(`input.datepickerRange.values.${text}`)}
					</button>
				`)}
			</div>
			<div class="flatpickr-container input-group">
				<label class="label">
					${data.t('input.datepickerRange.date')}
					<div class="field has-addons">
						<div class="control is-fullwidth">
							<input
								data-role="date-input"
								class="input"
								type="text"
								.value="${data.dateValue}"
							>
						</div>
						<div class="control">
							<button
								class="button"
								data-action="open-calendar"
								aria-label="${data.t('input.datepickerRange.openCalendar')}"
								data-toggle
							>
								<span class="icon"><i class="fa fa-calendar"></i></span>
							</button>
						</div>
					</div>
				</label>
					<input data-input type="text" tabindex="-1" aria-hidden="true">
				<p>${data.t('input.datemathHelp.canuse')}</p>
				<button
					class="button has-text-primary"
					data-action="learn-how"
				>
					${data.t('input.datemathHelp.learnhow')}
				</button>
			</div>
		`
	},

	_options(this: PanelViewContext): PanelViewOptions {
		return (this.options ?? {}) as PanelViewOptions
	},

	templateContext(this: PanelViewContext) {
		const opts = this._options()
		return {
			customRangeActive: opts.customRangeActive ?? false,
			dateValue: opts.dateValue ?? '',
			t: opts.t ?? (() => ''),
			dateKeys: Object.keys(DATE_VALUES),
			dateValueEntries: Object.entries(DATE_VALUES),
		}
	},

	events: {
		'click [data-action="set-date"]': '_onSetDateClick',
		'input [data-role="date-input"]': '_handleInputChange',
		'click [data-action="open-calendar"]': '_handleCalendarClick',
		'click [data-action="learn-how"]': '_handleLearnHowClick',
	},

	_onSetDateClick(this: PanelViewContext, event: Event) {
		const target = (event.target as Element).closest('[data-action="set-date"]') as HTMLElement | null
		if (!target) {
			return
		}
		const value = target.dataset.value ?? ''
		this._options().onSetDate?.(value === '' ? null : value)
	},

	_handleInputChange(this: PanelViewContext, event: Event) {
		this._options().onInputChange?.(event)
	},

	_handleCalendarClick(this: PanelViewContext) {
		this._options().onCalendarClick?.()
	},

	_handleLearnHowClick(this: PanelViewContext) {
		this._options().onLearnHowClick?.()
	},
}) as unknown as new (options?: PanelViewOptions) => PanelViewContext & PanelViewInstance

export const FilterDatepickerView = View.extend({
	className: 'mn-filter-datepicker',

	_date: null as string | Date | null,
	_flatpickr: null as flatpickr.Instance | null,
	_flatpickrEl: null as HTMLElement | null,
	_helpOpen: false,
	_helpModal: null as ModalCardViewInstance | null,
	_customRangeActive: false,
	_popupView: null as PopupViewInstance | null,
	_panelView: null as PanelViewInstance | null,

	regions: {
		popup: '[data-region="popup"]',
	},

	template() {
		return html`<div data-region="popup"></div>`
	},

	initialize(this: FilterDatepickerViewContext) {
		const opts = this._options()
		this._date = opts.modelValue
		this._customRangeActive = this._computeCustomRangeActive()
	},

	onRender(this: FilterDatepickerViewContext) {
		const opts = this._options()
		const popupOptions: PopupViewOptions = {
			open: Boolean(opts.open),
			ignoreClickClasses: opts.ignoreClickClasses ?? [],
			onOpenChange: this._onPopupOpenChange.bind(this),
			hasOverflow: true,
		}
		this._popupView = new PopupView(popupOptions) as PopupViewInstance
		this.showChildView('popup', this._popupView)

		const dateValue = this._date instanceof Date ? toISOStringOrNull(this._date) ?? '' : (this._date ?? '')
		this._panelView = new PanelView({
			t: opts.t,
			dateValue,
			customRangeActive: this._customRangeActive,
			onSetDate: this._setDate.bind(this),
			onInputChange: this._handleInputChange.bind(this),
			onCalendarClick: this._handleCalendarClick.bind(this),
			onLearnHowClick: this._handleLearnHowClick.bind(this),
		})
		this._popupView.showChildView('content', this._panelView)
		this._initFlatpickr()
	},

	onBeforeDestroy(this: FilterDatepickerViewContext) {
		this._destroyFlatpickr()
		this._helpModal?.destroy()
		this._helpModal = null
		this._panelView = null
	},

	_options(this: FilterDatepickerViewContext): FilterDatepickerViewOptions {
		return this.options as FilterDatepickerViewOptions
	},

	_computeCustomRangeActive(this: FilterDatepickerViewContext): boolean {
		const dateValues = Object.values(DATE_VALUES)
		return !dateValues.some(d => this._date === d)
	},

	_initFlatpickr(this: FilterDatepickerViewContext) {
		// Mirror vue-flatpickr-component: in wrap mode flatpickr attaches to the
		// container holding [data-input] and binds [data-toggle] inside it.
		const container = this._panelView?.el.querySelector('.flatpickr-container') as HTMLElement | null
		if (!container) {
			return
		}
		if (this._flatpickr && this._flatpickrEl === container) {
			return
		}
		this._destroyFlatpickr()
		this._flatpickrEl = container

		const opts = this._options()

		const locale = {...opts.flatpickrLocale} as Record<string, unknown>
		if (typeof opts.weekStart === 'number') {
			locale.firstDayOfWeek = opts.weekStart
		}

		const config = {
			altFormat: opts.t('date.altFormatLong'),
			altInput: true,
			dateFormat: opts.dateFormat ?? DEFAULT_DATE_FORMAT,
			enableTime: false,
			wrap: true,
			locale,
			onChange: (selectedDates: Date[], dateStr: string) => {
				if (dateStr === '') {
					return
				}
				this._date = dateStr
				this._emitChanged()
				this._updateInputValue()
				this._updateSelectionsActiveState()
			},
		}

		this._flatpickr = flatpickr(container, config)

		this._updateFlatpickrDate()
	},

	_destroyFlatpickr(this: FilterDatepickerViewContext) {
		if (this._flatpickr) {
			this._flatpickr.destroy()
			this._flatpickr = null
		}
		this._flatpickrEl = null
	},

	_updateFlatpickrDate(this: FilterDatepickerViewContext) {
		if (!this._flatpickr) {
			return
		}
		const dateValueAsString = this._date instanceof Date ? toISOStringOrNull(this._date) : this._date
		const parsed = parseDateOrString(dateValueAsString, false)
		if (parsed instanceof Date) {
			this._flatpickr.setDate(parsed, false)
		}
	},

	_emitChanged(this: FilterDatepickerViewContext) {
		const opts = this._options()
		opts.onChange(this._date === '' ? null : this._date)
	},

	_setDate(this: FilterDatepickerViewContext, value: string | null) {
		if (value === null) {
			this._date = ''
		} else {
			this._date = value
		}
		this._customRangeActive = this._computeCustomRangeActive()
		this._updateFlatpickrDate()
		this._emitChanged()
		this._updateInputValue()
		this._updateSelectionsActiveState()
	},

	_updateSelectionsActiveState(this: FilterDatepickerViewContext) {
		const selectionsEl = this._panelView?.el.querySelector('.selections')
		if (!selectionsEl) {
			return
		}
		const buttons = selectionsEl.querySelectorAll('[data-action="set-date"]')
		const dateValue = this._date instanceof Date ? toISOStringOrNull(this._date) ?? '' : (this._date ?? '')
		buttons.forEach(btn => {
			const btnValue = btn.getAttribute('data-value') ?? ''
			const isActive = this._customRangeActive && btnValue === '' || dateValue === btnValue
			btn.classList.toggle('is-active', isActive)
		})
	},

	_updateInputValue(this: FilterDatepickerViewContext) {
		const inputEl = this._panelView?.el.querySelector('[data-role="date-input"]') as HTMLInputElement | null
		if (inputEl) {
			const dateValue = this._date instanceof Date ? toISOStringOrNull(this._date) ?? '' : (this._date ?? '')
			if (inputEl.value !== dateValue) {
				inputEl.value = dateValue
			}
		}
	},

	_handleInputChange(this: FilterDatepickerViewContext, event: Event) {
		const target = event.target as HTMLInputElement
		this._date = target.value
		this._customRangeActive = this._computeCustomRangeActive()
		this._updateFlatpickrDate()
		this._emitChanged()
		this._updateSelectionsActiveState()
	},

	_handleCalendarClick(this: FilterDatepickerViewContext) {
		this._flatpickr?.open()
	},

	_handleLearnHowClick(this: FilterDatepickerViewContext) {
		if (this._helpOpen) {
			return
		}
		this._helpOpen = true

		const opts = this._options()
		const modalOptions: ModalCardViewOptions = {
			title: opts.t('input.datemathHelp.title'),
			primaryLabel: '',
			cancelLabel: '',
			closeLabel: opts.t('misc.close'),
			primaryDisabled: false,
			onPrimary: this._closeHelpModal.bind(this),
			onClose: this._closeHelpModal.bind(this),
		}
		this._helpModal = new ModalCardView(modalOptions) as ModalCardViewInstance

		const bodyContent = this._renderDatemathHelpContent(opts.t)
		this._helpModal.showChildView('body', bodyContent)
	},

	_closeHelpModal(this: FilterDatepickerViewContext) {
		if (!this._helpOpen) {
			return
		}
		this._helpOpen = false
		this._helpModal?.destroy()
		this._helpModal = null
	},

	_onPopupOpenChange(this: FilterDatepickerViewContext, open: boolean) {
		const opts = this._options()
		if (opts.onOpenChange) {
			opts.onOpenChange(open)
		}
	},

	_renderDatemathHelpContent(this: FilterDatepickerViewContext, t: (key: string) => string): ViewInstance {
		const expressionStr = t('input.datemathHelp.expression')
		const similarStr = t('input.datemathHelp.similar')
		const datePlusMonthStr = t('input.datemathHelp.examples.datePlusMonth')
		const exampleDate = formatDateShort(new Date())

		const exprParts = expressionStr.split('{0}').map((part, i) => {
			if (i === 0) return part
			const [after0, ...rest] = part.split('{1}')
			return [
				html`<code>now</code>`,
				after0,
				html`<code>||</code>`,
				rest.join('{1}'),
			].flat()
		}).flat()

		const similarParts = similarStr.split('{0}').map((part, i) => {
			if (i === 0) return part
			const [after0, ...rest] = part.split('{1}')
			return [
				html`<a href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls/" target="_blank" rel="noopener noreferrer" class="button">Grafana</a>`,
				after0,
				html`<a href="https://www.elastic.co/guide/en/elasticsearch/reference/7.3/common-options.html#date-math" target="_blank" rel="noopener noreferrer" class="button">Elasticsearch</a>`,
				rest.join('{1}'),
			].flat()
		}).flat()

		const datePlusMonthParts = datePlusMonthStr.split('{0}').map((part, i) => {
			if (i === 0) return part
			return [html`<strong>${exampleDate}</strong>`, part]
		}).flat()

		const ChildView = View.extend({
			template() {
				return html`
					<div class="how-it-works-modal">
						<p>${t('input.datemathHelp.intro')}</p>
						<p>${exprParts}</p>
						<p>${similarParts}</p>
						<p>${t('misc.forExample')}</p>
						<ul>
							<li><code>+1d</code>: ${t('input.datemathHelp.add1Day')}</li>
							<li><code>-1d</code>: ${t('input.datemathHelp.minus1Day')}</li>
							<li><code>/d</code>: ${t('input.datemathHelp.roundDay')}</li>
						</ul>
						<h3>${t('input.datemathHelp.supportedUnits')}</h3>
						<table class="table">
							<tbody>
								<tr><td><code>s</code></td><td>${t('input.datemathHelp.units.seconds')}</td></tr>
								<tr><td><code>m</code></td><td>${t('input.datemathHelp.units.minutes')}</td></tr>
								<tr><td><code>h</code></td><td>${t('input.datemathHelp.units.hours')}</td></tr>
								<tr><td><code>H</code></td><td>${t('input.datemathHelp.units.hours')}</td></tr>
								<tr><td><code>d</code></td><td>${t('input.datemathHelp.units.days')}</td></tr>
								<tr><td><code>w</code></td><td>${t('input.datemathHelp.units.weeks')}</td></tr>
								<tr><td><code>M</code></td><td>${t('input.datemathHelp.units.months')}</td></tr>
								<tr><td><code>y</code></td><td>${t('input.datemathHelp.units.years')}</td></tr>
							</tbody>
						</table>
						<h3>${t('input.datemathHelp.someExamples')}</h3>
						<table class="table">
							<tbody>
								<tr><td><code>now</code></td><td>${t('input.datemathHelp.examples.now')}</td></tr>
								<tr><td><code>now+24h</code></td><td>${t('input.datemathHelp.examples.in24h')}</td></tr>
								<tr><td><code>now/d</code></td><td>${t('input.datemathHelp.examples.today')}</td></tr>
								<tr><td><code>now/w</code></td><td>${t('input.datemathHelp.examples.beginningOfThisWeek')}</td></tr>
								<tr><td><code>now/w+1w</code></td><td>${t('input.datemathHelp.examples.endOfThisWeek')}</td></tr>
								<tr><td><code>now+30d</code></td><td>${t('input.datemathHelp.examples.in30Days')}</td></tr>
								<tr>
									<td><code>${exampleDate}||+1M/d</code></td>
									<td>${datePlusMonthParts}</td>
								</tr>
							</tbody>
						</table>
					</div>
				`
			},
		}) as new () => ViewInstance
		return new ChildView()
	},

	setModelValue(this: FilterDatepickerViewContext, value: string | Date | null) {
		this._date = value
		this._customRangeActive = this._computeCustomRangeActive()
		this._updateFlatpickrDate()
		this._updateInputValue()
		this._updateSelectionsActiveState()
	},

	setOpen(this: FilterDatepickerViewContext, open: boolean) {
		if (this._popupView) {
			if (open && !this._popupView._open) {
				this._popupView.toggle()
			} else if (!open && this._popupView._open) {
				this._popupView.close()
			}
		}
	},
}) as new (options: FilterDatepickerViewOptions) => FilterDatepickerViewContext

export {PanelView}