import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import flatpickr from 'flatpickr'
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance'
import { DATE_RANGES } from '@/components/date/dateRanges'
import { parseDateOrString } from '@/helpers/time/parseDateOrString'
import { formatDate } from '../../shared/dates'
import { t } from '../../shared/i18n'
import { listIcon } from '@/shared/task-list/list-ui'
import type { Route, QueryPatch } from '../../app/routes'
import type { ListContext } from '@/shared/task-list/list-context'
import { HintDialogView } from '@/shared/task-list/list-help'
import { DatemathHelpView } from '@/shared/filters/filter-datemath-help'

export function upcomingRange(route: Route) {
	const now = new Date(),
		next = new Date(now)
	next.setDate(next.getDate() + 7)
	const value = (raw: unknown, fallback: Date) => {
		const parsed = parseDateOrString(
			typeof raw === 'string' ? raw : undefined,
			fallback,
		)
		return parsed instanceof Date ? parsed.toISOString() : String(parsed)
	}
	return {
		from: value(route.query.from, now),
		to: value(route.query.to, next),
	}
}
export function upcomingTitle(route: Route) {
	const range = upcomingRange(route),
		preset = Object.entries(DATE_RANGES).find(
			([, values]) => values[0] === range.from && values[1] === range.to,
		)
	return preset
		? t(`input.datepickerRange.ranges.${preset[0]}`)
		: t('task.show.fromuntil', {
			from: formatDate(range.from, 'LL'),
			until: formatDate(range.to, 'LL'),
		})
}
const RangeView = View.extend({
	initialize(options: {
		route: Route;
		context: ListContext;
		changed: (query: QueryPatch) => void;
		closed: () => void;
	}) {
		void options
	},
	className: 'datepicker-with-range-container native-upcoming-range',
	regions: { help: '[data-help]' },
	ui: {
		from: '[data-from]',
		to: '[data-to]',
		calendar: '[data-calendar]',
		host: '.flatpickr-container',
	},
	events: {
		'change @ui.from': 'changed',
		'change @ui.to': 'changed',
		'click [data-preset]': 'preset',
		'click [data-calendar-toggle]': 'calendar',
		'click [data-help-button]': 'help',
		keydown: 'key',
	},
	createState() {
		return {
			picker: undefined as FlatpickrInstance | undefined,
			previous: document.activeElement as HTMLElement | null,
			outside: (event: MouseEvent) => {
				const target = event.target as HTMLElement
				if (
					!this.el.contains(target) &&
					!target.closest('[data-select-range]') &&
					!this.getChildView('help')
				)
					this.options.closed()
			},
		}
	},
	templateContext() {
		return { range: upcomingRange(this.options.route) }
	},
	template({ range }: { range: { from: string; to: string } }) {
		return html`<div class="popup is-open">
				<div class="datepicker-with-range is-open">
					<div class="selections">
						${Object.entries(DATE_RANGES).map(
		([key]) =>
			html`<button
									type="button"
									class="base-button base-button--type-button"
									data-preset=${key}
								>
									${t(`input.datepickerRange.ranges.${key}`)}
								</button>`,
	)}
					</div>
					<div class="flatpickr-container input-group">
						<label class="label"
							>${t('input.datepickerRange.from')}
							<div class="field has-addons">
								<div class="control is-fullwidth">
									<input
										data-from
										aria-label=${t('input.datepickerRange.from')}
										class="input"
										type="text"
										.value=${range.from}
									/>
								</div>
								<div class="control">
									<button
										type="button"
										data-calendar-toggle
										class="button is-secondary"
										aria-label=${t('input.datepickerRange.openCalendar')}
									>
										${listIcon('calendar')}
									</button>
								</div>
							</div>
						</label>
						<label class="label"
							>${t('input.datepickerRange.to')}
							<div class="field has-addons">
								<div class="control is-fullwidth">
									<input data-to aria-label=${t('input.datepickerRange.to')} class="input" type="text" .value=${range.to} />
								</div>
								<div class="control">
									<button
										type="button"
										data-calendar-toggle
										class="button is-secondary"
										aria-label=${t('input.datepickerRange.openCalendar')}
									>
										${listIcon('calendar')}
									</button>
								</div>
							</div>
						</label>
						<input data-calendar class="form-control input" />
						<p>${t('input.datemathHelp.canuse')}</p>
						<button
							type="button"
							data-help-button
							class="base-button base-button--type-button has-text-primary"
						>
							${t('input.datemathHelp.learnhow')}
						</button>
					</div>
				</div>
			</div>
			<div data-help></div>`
	},
	onAttach() {
		const state = this.getState()
		state.picker = flatpickr(this.getUI('calendar')![0] as HTMLInputElement, {
			...this.options.context.flatpickrOptions(),
			enableTime: false,
			inline: false,
			mode: 'range',
			appendTo: this.getUI('host')![0] as HTMLElement,
			onChange: (dates) => {
				if (dates.length !== 2) return;
				(this.getUI('from')![0] as HTMLInputElement).value =
					dates[0].toISOString();
				(this.getUI('to')![0] as HTMLInputElement).value =
					dates[1].toISOString()
				this.changed()
			},
		})
		document.addEventListener('click', state.outside);
		(this.getUI('from')![0] as HTMLInputElement).focus()
	},
	changed() {
		const from = (this.getUI('from')![0] as HTMLInputElement).value,
			to = (this.getUI('to')![0] as HTMLInputElement).value
		this.options.changed({
			from: from || undefined,
			to: to || undefined,
			page: undefined,
		})
	},
	preset(event: Event) {
		const key = (event as Event & { delegateTarget: HTMLElement })
			.delegateTarget.dataset.preset!
		const [from, to] = DATE_RANGES[key as keyof typeof DATE_RANGES];
		(this.getUI('from')![0] as HTMLInputElement).value = from;
		(this.getUI('to')![0] as HTMLInputElement).value = to
		this.changed()
	},
	calendar() {
		this.getState().picker?.toggle()
	},
	help() {
		if (!this.getChildView('help'))
			this.showChildView(
				'help',
				new HintDialogView({
					context: this.options.context,
					content: new DatemathHelpView({ context: this.options.context }),
				}),
			)
	},
	key(event: KeyboardEvent) {
		if (event.key === 'Escape' && !this.getChildView('help')) {
			event.preventDefault()
			this.options.closed()
		}
	},
	onBeforeDestroy() {
		const state = this.getState()
		document.removeEventListener('click', state.outside)
		state.picker?.destroy()
		if (state.previous?.isConnected)
			state.previous.focus({ preventScroll: true })
	},
}).setDomApi(LitDomApi)
export const UpcomingControlsView = View.extend({
	initialize(options: {
		route: Route;
		context: ListContext;
		changed: (query: QueryPatch) => void;
	}) {
		void options
	},
	className: 'show-tasks-options',
	regions: { range: '[data-range]' },
	ui: {
		nulls: '[data-nulls]',
		overdue: '[data-overdue]',
		trigger: '[data-select-range]',
	},
	events: {
		'click @ui.trigger': 'toggle',
		'change @ui.nulls': 'flags',
		'change @ui.overdue': 'flags',
	},
	template() {
		return html`<button
				type="button"
				class="button is-primary mbe-2"
				data-select-range
				aria-expanded="false"
			>
				${t('task.show.select')}</button
			><label class="checkbox mie-2"
				><input type="checkbox" data-nulls /> ${t('task.show.noDates')}</label
			><label class="checkbox"
				><input type="checkbox" data-overdue /> ${t('task.show.overdue')}</label
			>
			<div data-range></div>`
	},
	onRender() {
		this.updateRoute(this.options.route)
	},
	updateRoute(route: Route) {
		this.options.route = route;
		(this.getUI('nulls')![0] as HTMLInputElement).checked =
			route.query.showNulls === 'true';
		(this.getUI('overdue')![0] as HTMLInputElement).checked =
			route.query.showOverdue === 'true'
	},
	flags() {
		this.options.changed({
			showNulls: String((this.getUI('nulls')![0] as HTMLInputElement).checked),
			showOverdue: String(
				(this.getUI('overdue')![0] as HTMLInputElement).checked,
			),
			page: undefined,
		})
	},
	toggle() {
		if (this.getChildView('range')) this.closeRange()
		else {
			(this.getUI('trigger')![0] as HTMLElement).setAttribute(
				'aria-expanded',
				'true',
			)
			this.showChildView(
				'range',
				new RangeView({ ...this.options, closed: () => this.closeRange() }),
			)
		}
	},
	closeRange() {
		this.getRegion('range')!.empty();
		(this.getUI('trigger')![0] as HTMLElement).setAttribute(
			'aria-expanded',
			'false',
		)
	},
}).setDomApi(LitDomApi)
