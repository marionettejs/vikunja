import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {FilterDatepickerView, PanelView, type FilterDatepickerViewOptions} from './FilterDatepickerView'
import flatpickr from 'flatpickr'

type FilterDatepickerViewInstance = ViewInstance & {
	_date: string | Date | null
	_flatpickr: any
	_popupView: any
	_panelView: any
	_helpModal: any
	_customRangeActive: boolean
	_helpOpen: boolean
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
	_updateSelectionsActiveState(): void
	_updateInputValue(): void
	setModelValue(value: string | Date | null): void
	setOpen(open: boolean): void
}

const flatpickrMock = {
	setDate: vi.fn(),
	destroy: vi.fn(),
	open: vi.fn(),
}

interface FlatpickrTestConfig {
	wrap: boolean
	altInput: boolean
	dateFormat: string
	locale: unknown
	onChange: (dates: Date[], dateStr: string) => void
}

vi.mock('flatpickr', () => ({
	default: vi.fn((_el: Element, _config: FlatpickrTestConfig) => flatpickrMock),
	__esModule: true,
}))

describe('FilterDatepickerView', () => {
	let views: ViewInstance[] = []

	const createView = (overrides: Partial<FilterDatepickerViewOptions> = {}) => {
		const onChange = vi.fn()
		const onOpenChange = vi.fn()
		const t = vi.fn((key: string) => {
			const translations: Record<string, string> = {
				'misc.custom': 'Custom',
				'input.datepickerRange.values.now': 'Now',
				'input.datepickerRange.values.startOfToday': 'Start of today',
				'input.datepickerRange.values.endOfToday': 'End of today',
				'input.datepickerRange.date': 'Date',
				'input.datepickerRange.openCalendar': 'Open calendar',
				'input.datemathHelp.canuse': 'You can use date math',
				'input.datemathHelp.learnhow': 'Learn how',
				'input.datemathHelp.title': 'Date Math',
				'input.datemathHelp.intro': 'Specify relative dates...',
				'input.datemathHelp.expression': 'Anchor is {0} or date ending with {1}',
				'input.datemathHelp.similar': 'Similar to {0} and {1}',
				'input.datemathHelp.add1Day': 'Add one day',
				'input.datemathHelp.minus1Day': 'Subtract one day',
				'input.datemathHelp.roundDay': 'Round down to day',
				'input.datemathHelp.supportedUnits': 'Supported units',
				'input.datemathHelp.someExamples': 'Examples',
				'input.datemathHelp.units.seconds': 'Seconds',
				'input.datemathHelp.units.minutes': 'Minutes',
				'input.datemathHelp.units.hours': 'Hours',
				'input.datemathHelp.units.days': 'Days',
				'input.datemathHelp.units.weeks': 'Weeks',
				'input.datemathHelp.units.months': 'Months',
				'input.datemathHelp.units.years': 'Years',
				'input.datemathHelp.examples.now': 'Right now',
				'input.datemathHelp.examples.in24h': 'In 24h',
				'input.datemathHelp.examples.today': 'Today at 00:00',
				'input.datemathHelp.examples.beginningOfThisWeek': 'Beginning of week',
				'input.datemathHelp.examples.endOfThisWeek': 'End of week',
				'input.datemathHelp.examples.in30Days': 'In 30 days',
				'input.datemathHelp.examples.datePlusMonth': '{0} plus one month',
				'input.datemathHelp.examples.exampleDate': '2024-01-15',
				'date.altFormatLong': 'Y-m-d H:i',
				'misc.close': 'Close',
				'misc.forExample': 'For example',
			}
			return translations[key] ?? key
		})
		const flatpickrLocale = {firstDayOfWeek: 1}

		const options: FilterDatepickerViewOptions = {
			modelValue: null,
			onChange,
			open: false,
			onOpenChange,
			ignoreClickClasses: [],
			t,
			flatpickrLocale,
			weekStart: 1,
			dateFormat: 'Y-m-d H:i',
			...overrides,
		}
		const view = new FilterDatepickerView(options) as FilterDatepickerViewInstance
		views.push(view)
		view.render()
		document.body.appendChild(view.el)
		return {view, options, onChange, onOpenChange, t}
	}

	beforeEach(() => {
		views = []
		flatpickrMock.setDate.mockClear()
		flatpickrMock.destroy.mockClear()
		flatpickrMock.open.mockClear()
		vi.mocked(flatpickr).mockClear()
	})

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
		vi.resetModules()
	})

	describe('structure', () => {
		it('renders only the popup region in its template', () => {
			const {view} = createView()
			const popupRegion = view.el.querySelector('[data-region="popup"]')
			expect(popupRegion).not.toBeNull()
			// The template only has the popup region; panel is nested inside PopupView's content region
			const panelInRoot = view.el.querySelector(':scope > .datepicker-with-range')
			expect(panelInRoot).toBeNull()
		})

		it('shows panel view inside PopupView content region after render', () => {
			const {view} = createView()
			const popupView = view._popupView
			const contentEl = popupView.el.querySelector('[data-region="content"]')
			expect(contentEl).not.toBeNull()
			const panelEl = contentEl.querySelector('.datepicker-with-range')
			expect(panelEl).not.toBeNull()
			expect(panelEl.classList.contains('datepicker-with-range')).toBe(true)
		})

		it('panel view is accessible as _panelView', () => {
			const {view} = createView()
			expect(view._panelView).not.toBeNull()
			expect(view._panelView.el.classList.contains('datepicker-with-range')).toBe(true)
		})
	})

	describe('selections', () => {
		it('renders Custom button and DATE_VALUES buttons', () => {
			const {view} = createView()
			const panelEl = view._panelView.el
			const buttons = panelEl.querySelectorAll('.selections button[data-action="set-date"]')
			expect(buttons.length).toBeGreaterThan(0)
			const customBtn = panelEl.querySelector('.selections button[data-value=""]')
			expect(customBtn).not.toBeNull()
			expect(customBtn?.textContent?.trim()).toBe('Custom')
		})

		it('selecting a DATE_VALUES button emits the value and sets active class', () => {
			const {view, onChange} = createView()
			const panelEl = view._panelView.el
			const firstValueBtn = panelEl.querySelector('.selections button[data-value="now"]') as HTMLButtonElement
			expect(firstValueBtn).not.toBeNull()
			firstValueBtn.click()
			expect(onChange).toHaveBeenCalledWith('now')
			expect(firstValueBtn.classList.contains('is-active')).toBe(true)
		})

		it('selecting Custom button emits null and sets active class', () => {
			const {view, onChange} = createView({modelValue: 'now'})
			view.render()
			const panelEl = view._panelView.el
			const customBtn = panelEl.querySelector('.selections button[data-value=""]') as HTMLButtonElement
			expect(customBtn).not.toBeNull()
			customBtn.click()
			expect(onChange).toHaveBeenCalledWith(null)
			expect(customBtn.classList.contains('is-active')).toBe(true)
		})

		it('only one button has is-active at a time', () => {
			const {view} = createView({modelValue: 'now'})
			view.render()
			const panelEl = view._panelView.el
			const nowBtn = panelEl.querySelector('.selections button[data-value="now"]') as HTMLButtonElement
			const customBtn = panelEl.querySelector('.selections button[data-value=""]') as HTMLButtonElement
			expect(nowBtn?.classList.contains('is-active')).toBe(true)
			expect(customBtn?.classList.contains('is-active')).toBe(false)
			customBtn?.click()
			expect(nowBtn?.classList.contains('is-active')).toBe(false)
			expect(customBtn?.classList.contains('is-active')).toBe(true)
		})
	})

	describe('input handling', () => {
		it('typing in input emits without moving focus/cursor', () => {
			const {view, onChange} = createView()
			view.setOpen(true)
			const inputEl = view._panelView.el.querySelector('[data-role="date-input"]') as HTMLInputElement
			expect(inputEl).not.toBeNull()
			inputEl.focus()
			inputEl.value = 'now+5d'
			const inputEvent = new Event('input', {bubbles: true})
			inputEl.dispatchEvent(inputEvent)
			expect(onChange).toHaveBeenCalledWith('now+5d')
			expect(document.activeElement).toBe(inputEl)
		})

		it('input value updates via property binding', () => {
			const {view} = createView({modelValue: 'now/d'})
			view.render()
			const inputEl = view._panelView.el.querySelector('[data-role="date-input"]') as HTMLInputElement
			expect(inputEl.value).toBe('now/d')
		})
	})

	describe('setModelValue', () => {
		it('updates display without emitting', () => {
			const {view, onChange} = createView()
			onChange.mockClear()
			view.setModelValue('now+7d')
			expect(onChange).not.toHaveBeenCalled()
			const inputEl = view._panelView.el.querySelector('[data-role="date-input"]') as HTMLInputElement
			expect(inputEl.value).toBe('now+7d')
		})

		it('updates active selection button', () => {
			const {view} = createView()
			view.setModelValue('now')
			const panelEl = view._panelView.el
			const nowBtn = panelEl.querySelector('.selections button[data-value="now"]') as HTMLButtonElement
			const customBtn = panelEl.querySelector('.selections button[data-value=""]') as HTMLButtonElement
			expect(nowBtn?.classList.contains('is-active')).toBe(true)
			expect(customBtn?.classList.contains('is-active')).toBe(false)
		})

		it('sets custom range active when value not in DATE_VALUES', () => {
			const {view} = createView()
			view.setModelValue('now+5d')
			const panelEl = view._panelView.el
			const customBtn = panelEl.querySelector('.selections button[data-value=""]') as HTMLButtonElement
			expect(customBtn?.classList.contains('is-active')).toBe(true)
			const nowBtn = panelEl.querySelector('.selections button[data-value="now"]') as HTMLButtonElement
			expect(nowBtn?.classList.contains('is-active')).toBe(false)
		})
	})

	describe('setOpen', () => {
		it('opens the popup when true', () => {
			const {view} = createView({open: false})
			expect(view._popupView._open).toBe(false)
			view.setOpen(true)
			expect(view._popupView._open).toBe(true)
		})

		it('closes the popup when false', () => {
			const {view} = createView({open: true})
			view.render()
			expect(view._popupView._open).toBe(true)
			view.setOpen(false)
			expect(view._popupView._open).toBe(false)
		})
	})

	describe('flatpickr', () => {
		it('initializes flatpickr with correct config', () => {
			const {view, t} = createView()
			expect(vi.mocked(flatpickr).mock).toBeDefined()
			const flatpickrCalls = vi.mocked(flatpickr).mock.calls
			expect(flatpickrCalls.length).toBe(1)
			const call = flatpickrCalls[0]
			expect(call).toBeDefined()
			const config = call?.[1]
			expect(call?.[0]).toBeTruthy()
			expect(config?.wrap).toBe(true)
			expect(config?.altInput).toBe(true)
			expect(config?.dateFormat).toBe('Y-m-d H:i')
			expect(config?.locale).toBeDefined()
			expect(config?.onChange).toBeDefined()
		})

		it('calls flatpickr.setDate on model change', () => {
			const {view} = createView({modelValue: '2024-01-15 10:30'})
			view.render()
			expect(flatpickrMock.setDate).toHaveBeenCalled()
		})

		it('destroys flatpickr on view destroy', () => {
			const {view} = createView()
			view.destroy()
			expect(flatpickrMock.destroy).toHaveBeenCalled()
		})

		it('flatpickr onChange updates date and emits', () => {
			const {view, onChange} = createView()
			onChange.mockClear()
			const config = vi.mocked(flatpickr).mock.calls[0]?.[1]
			const flatpickrOnChange = config?.onChange as ((dates: Date[], dateStr: string) => void) | undefined
			expect(typeof flatpickrOnChange).toBe('function')
			if (typeof flatpickrOnChange === 'function') {
				flatpickrOnChange([], '2024-02-20 14:00')
			}
			expect(onChange).toHaveBeenCalledWith('2024-02-20 14:00')
		})

		it('flatpickr onChange does nothing for empty string', () => {
			const {view, onChange} = createView()
			onChange.mockClear()
			const config = vi.mocked(flatpickr).mock.calls[0]?.[1]
			const flatpickrOnChange = config?.onChange as ((dates: Date[], dateStr: string) => void) | undefined
			expect(typeof flatpickrOnChange).toBe('function')
			if (typeof flatpickrOnChange === 'function') {
				flatpickrOnChange([], '')
			}
			expect(onChange).not.toHaveBeenCalled()
		})
	})

	describe('help modal', () => {
		it('opens modal with real links when clicking learn-how', () => {
			const {view} = createView()
			const learnHowBtn = view._panelView.el.querySelector('[data-action="learn-how"]') as HTMLButtonElement
			expect(learnHowBtn).not.toBeNull()
			learnHowBtn.click()
			expect(view._helpModal).not.toBeNull()
			const bodyEl = view._helpModal.el.querySelector('.card-content')
			expect(bodyEl).not.toBeNull()
			const grafanaLink = bodyEl?.querySelector('a[href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls/"]')
			const elasticLink = bodyEl?.querySelector('a[href="https://www.elastic.co/guide/en/elasticsearch/reference/7.3/common-options.html#date-math"]')
			expect(grafanaLink).not.toBeNull()
			expect(elasticLink).not.toBeNull()
			expect(grafanaLink?.getAttribute('target')).toBe('_blank')
			expect(grafanaLink?.getAttribute('rel')).toBe('noopener noreferrer')
			expect(grafanaLink?.textContent).toBe('Grafana')
			expect(elasticLink?.textContent).toBe('Elasticsearch')
		})

		it('modal has no action buttons in footer (empty primaryLabel/cancelLabel)', () => {
			const {view} = createView()
			const learnHowBtn = view._panelView.el.querySelector('[data-action="learn-how"]') as HTMLButtonElement
			learnHowBtn.click()
			const cancelBtn = view._helpModal.el.querySelector('[data-role="cancel"]')
			const primaryBtn = view._helpModal.el.querySelector('[data-role="primary"]')
			expect(cancelBtn?.textContent?.trim()).toBe('')
			expect(primaryBtn?.textContent?.trim()).toBe('')
		})

		it('close button in header has correct aria-label', () => {
			const {view, t} = createView()
			const learnHowBtn = view._panelView.el.querySelector('[data-action="learn-how"]') as HTMLButtonElement
			learnHowBtn.click()
			const closeBtn = view._helpModal.el.querySelector('[data-role="close"]')
			expect(closeBtn).not.toBeNull()
			expect(closeBtn?.getAttribute('aria-label')).toBe('Close')
		})

		it('clicking close button closes modal', () => {
			const {view} = createView()
			const learnHowBtn = view._panelView.el.querySelector('[data-action="learn-how"]') as HTMLButtonElement
			learnHowBtn.click()
			const closeBtn = view._helpModal.el.querySelector('[data-role="close"]') as HTMLElement
			closeBtn.click()
			expect(view._helpOpen).toBe(false)
			expect(view._helpModal).toBeNull()
		})

		it('expression text has code elements for now and ||', () => {
			const {view} = createView()
			const learnHowBtn = view._panelView.el.querySelector('[data-action="learn-how"]') as HTMLButtonElement
			learnHowBtn.click()
			const bodyEl = view._helpModal.el.querySelector('.card-content')
			const exprPara = bodyEl?.querySelector('p:nth-of-type(2)')
			const codeElements = exprPara?.querySelectorAll('code')
			expect(codeElements?.length).toBe(2)
			expect(codeElements?.[0]?.textContent).toBe('now')
			expect(codeElements?.[1]?.textContent).toBe('||')
		})

		it('datePlusMonth example has strong element for exampleDate', () => {
			const {view} = createView()
			const learnHowBtn = view._panelView.el.querySelector('[data-action="learn-how"]') as HTMLButtonElement
			learnHowBtn.click()
			const bodyEl = view._helpModal.el.querySelector('.card-content')
			const lastRow = bodyEl?.querySelector('table:last-of-type tbody tr:last-child')
			const strongEl = lastRow?.querySelector('strong')
			const codeEl = lastRow?.querySelector('code')
			// exampleDate is the live formatted current date, shared by both cells
			expect(strongEl?.textContent).not.toBe('')
			expect(codeEl?.textContent?.startsWith(strongEl?.textContent ?? '###')).toBe(true)
		})
	})

	describe('popup open change', () => {
		it('forwards open change to onOpenChange callback', () => {
			const {view, onOpenChange} = createView()
			view._onPopupOpenChange(true)
			expect(onOpenChange).toHaveBeenCalledWith(true)
			view._onPopupOpenChange(false)
			expect(onOpenChange).toHaveBeenCalledWith(false)
		})
	})

	describe('PanelView (exported for tests)', () => {
		it('can be instantiated and rendered standalone', () => {
			const panel = new PanelView()
			views.push(panel)
			panel.render()
			expect(panel.el.classList.contains('datepicker-with-range')).toBe(true)
			expect(panel.el.querySelector('.selections')).not.toBeNull()
			expect(panel.el.querySelector('[data-role="date-input"]')).not.toBeNull()
			expect(panel.el.querySelector('input[data-input]')).not.toBeNull()
		})

		it('delegates set-date clicks to parent', () => {
			const onSetDate = vi.fn()
			const panel = new PanelView({
				t: (key: string) => key,
				dateValue: '',
				customRangeActive: false,
				onSetDate,
				onInputChange: vi.fn(),
				onCalendarClick: vi.fn(),
				onLearnHowClick: vi.fn(),
			})
			views.push(panel)
			panel.render()

			const btn = panel.el.querySelector('[data-action="set-date"][data-value="now"]') as HTMLButtonElement
			btn.click()
			expect(onSetDate).toHaveBeenCalledWith('now')
		})
	})
})