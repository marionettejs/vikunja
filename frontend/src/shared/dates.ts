import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import {createDateFromString} from '@/helpers/time/createDateFromString'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'
import type {IFrontendSettings} from '@/modelTypes/IUserSettings'
import {DAYJS_LOCALE_MAPPING} from './dayjs-locales'
import {locale} from './i18n'
dayjs.extend(localizedFormat); dayjs.extend(relativeTime)
export function formatDate(date: Date | string | null | undefined, format: string) { const value = date == null ? null : parseDateOrNull(createDateFromString(date)); return value ? dayjs(value).locale(DAYJS_LOCALE_MAPPING[locale().toLowerCase()] ?? 'en').format(format) : '' }
export function formatDateLong(date: Date | null) { return formatDate(date, 'LLLL') }
export function formatISO(date: Date | null) { return toISOStringOrNull(date) ?? '' }
export function displayDate(date: Date | null, settings?: Pick<IFrontendSettings,'dateDisplay'|'timeFormat'>) {
	if(!date)return ''
	const format=settings?.dateDisplay??'relative',time=settings?.timeFormat==='24h'?'HH:mm':'hh:mm A'
	const formats:Record<string,string>={'mm-dd-yyyy':'MM-DD-YYYY','dd-mm-yyyy':'DD-MM-YYYY','yyyy-mm-dd':'YYYY-MM-DD','mm/dd/yyyy':'MM/DD/YYYY','dd/mm/yyyy':'DD/MM/YYYY','yyyy/mm/dd':'YYYY/MM/DD'}
	if(formats[format])return formatDate(date,`${formats[format]} ${time}`)
	if(format==='dayMonthYear'||format==='weekdayDayMonthYear')return new Intl.DateTimeFormat(locale(),{...(format==='weekdayDayMonthYear'?{weekday:'long' as const}:{}),day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'numeric',hour12:settings?.timeFormat!=='24h'}).format(date)
	return dayjs(date).locale(DAYJS_LOCALE_MAPPING[locale().toLowerCase()] ?? 'en').fromNow()
}

export function formatDateShort(date: Date | null) { return formatDate(date, 'lll') }
