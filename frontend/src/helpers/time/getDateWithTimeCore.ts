import {calculateNearestHours} from '@/helpers/time/calculateNearestHours'

export function parseUserDefaultTime(defaultDueTime?: string): {hours: number, minutes: number} | null {
	if (!defaultDueTime) {
		return null
	}

	const match = /^(\d{2}):(\d{2})$/.exec(defaultDueTime)
	if (!match) {
		return null
	}

	const hours = Number(match[1])
	const minutes = Number(match[2])
	if (hours > 23 || minutes > 59) {
		return null
	}

	return {hours, minutes}
}

export function getDefaultTimeParts(date: Date, defaultDueTime?: string): {hours: number, minutes: number} {
	const parsedTime = parseUserDefaultTime(defaultDueTime)

	if (parsedTime !== null) {
		return parsedTime
	}

	return {
		hours: calculateNearestHours(date),
		minutes: 0,
	}
}

export function getDateWithTime(date: Date, preferredTime?: string): Date {
	const newDate = new Date(date)
	const defaultDueTime = getDefaultTimeParts(newDate, preferredTime)
	newDate.setHours(defaultDueTime.hours, defaultDueTime.minutes, 0, 0)
	return newDate
}
