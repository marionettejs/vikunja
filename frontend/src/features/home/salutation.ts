import {hourToDaytime} from '@/helpers/hourToDaytime'
import {stringHash} from '@/helpers/stringHash'
import {getDisplayName} from '@/models/user'
import type {IUser} from '@/modelTypes/IUser'
import type {Daytime} from '@/helpers/hourToDaytime'
import {t} from '../../shared/i18n'
const basePools: Record<Daytime, string[]> = {
	night: [
		'home.welcomeNight',
		'home.welcomeNightOwl',
		'home.welcomeNightBurning',
		'home.welcomeNightQuiet',
		'home.welcomeNightLate',
		'home.welcomeNightMoonlit',
	],
	morning: [
		'home.welcomeMorning',
		'home.welcomeMorningHey',
		'home.welcomeMorningFresh',
		'home.welcomeMorningCoffee',
		'home.welcomeMorningRise',
		'home.welcomeMorningBack',
	],
	day: [
		'home.welcomeDay',
		'home.welcomeDayBack',
		'home.welcomeDayFocus',
		'home.welcomeDayKeepGoing',
		'home.welcomeDayWhatsNext',
		'home.welcomeDayGood',
	],
	evening: [
		'home.welcomeEvening',
		'home.welcomeEveningWind',
		'home.welcomeEveningReturns',
		'home.welcomeEveningWrap',
		'home.welcomeEveningOneMore',
		'home.welcomeEveningStill',
	],
}

// One entry per weekday (index = Date.getDay(), Sunday = 0). Appended to the
// morning pool only, on its matching day.
const morningWeekdayExtras: (string | null)[] = [
	'home.welcomeSundaySession', // 0 Sun
	'home.welcomeMondayFresh',   // 1 Mon
	'home.welcomeTuesday',       // 2 Tue
	'home.welcomeWednesdayMid',  // 3 Wed
	'home.welcomeThursday',      // 4 Thu
	'home.welcomeFridayPush',    // 5 Fri
	'home.welcomeSaturday',      // 6 Sat
]

function poolFor(bucket: Daytime, now: Date): string[] {
	if (bucket !== 'morning') {
		return basePools[bucket]
	}
	const extra = morningWeekdayExtras[now.getDay()]
	return extra ? [...basePools.morning, extra] : basePools.morning
}

function dateKey(now: Date): string {
	return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

export function salutation(user:IUser,now=new Date()){const name=getDisplayName(user);if(!name)return '';const bucket=hourToDaytime(now),pool=poolFor(bucket,now),key=`${dateKey(now)}_${bucket}_${user.created?.getTime()??0}`;return t(pool[stringHash(key)%pool.length],{username:name})}
