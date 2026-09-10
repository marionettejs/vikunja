import type { PluralizationRule } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import langEN from './lang/en.json'

import { DEFAULT_LANGUAGE, getBrowserLanguage, isRTLLanguage, type SupportedLocale } from './locales'
import { loadDayJsLocale } from '@/i18n/useDayjsLanguageSync.ts'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)

// we load all messages async
export const i18n = createI18n({
	fallbackLocale: DEFAULT_LANGUAGE,
	legacy: false,
	pluralRules: {
		'ru-RU': (choice: number, choicesLength: number, orgRule?: PluralizationRule) => {
			if (choicesLength !== 3) {
				return orgRule ? orgRule(choice, choicesLength) : 0
			}
			const n = Math.abs(choice) % 100
			if (n > 10 && n < 20) {
				return 2
			}
			if (n % 10 === 1) {
				return 0
			}
			if (n % 10 >= 2 && n % 10 <= 4) {
				return 1
			}
			return 2
		},
	},
	messages: {
		[DEFAULT_LANGUAGE]: langEN,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as Record<SupportedLocale, any>,
})

export async function setLanguage(lang: SupportedLocale): Promise<SupportedLocale | undefined> {
	if (!lang) {
		throw new Error('language is empty')
	}

	// do not change language to the current one
	if (i18n.global.locale.value === lang) {
		return
	}

	// If the language hasn't been loaded yet
	if (!i18n.global.availableLocales.includes(lang)) {
		try {
			const messages = await import(`./lang/${lang}.json`)
			i18n.global.setLocaleMessage(lang, messages.default)
		} catch (e) {
			console.error(`Failed to load language ${lang}:`, e)
			return setLanguage(getBrowserLanguage())
		}
	}
	
	await loadDayJsLocale(lang)

	i18n.global.locale.value = lang
	document.documentElement.lang = lang
	document.documentElement.dir = isRTLLanguage(lang) ? 'rtl' : 'ltr'
	return lang
}
