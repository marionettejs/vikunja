import {createCoreContext, translate, compile, resolveValue, registerMessageCompiler, registerMessageResolver, registerLocaleFallbacker, fallbackWithLocaleChain} from '@intlify/core-base'
import {loadDayjsLocale} from './dayjs-locales'
import messages from '@/i18n/lang/en.json'
import {SUPPORTED_LOCALES, type SupportedLocale} from './locales'
registerMessageCompiler(compile)
registerMessageResolver(resolveValue)
registerLocaleFallbacker(fallbackWithLocaleChain)
const context = createCoreContext({locale: 'en' as string, fallbackLocale: 'en' as string, messages: {en: messages} as Record<string, typeof messages>, missingWarn: false, fallbackWarn: false,
	pluralRules: {'ru-RU': (choice, length, rule) => { if (length !== 3) return rule ? rule(choice, length) : 0; const n = Math.abs(choice) % 100; return n > 10 && n < 20 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2 }},
})
export function t(key: string, values?: Record<string, unknown> | number | unknown[]): string { return String(typeof values === 'number' ? translate(context, key, values) : Array.isArray(values) ? translate(context, key, values) : translate(context, key, values ?? {})) }
export function getBrowserLanguage(): SupportedLocale {
	const locales = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]
	const browserLanguage = navigator.language
	return locales.find(locale => locale === browserLanguage || locale.startsWith(browserLanguage + '-')) ?? 'en'
}
export async function setLanguage(language: string, signal?: AbortSignal) {
	const files = import.meta.glob<{default: typeof messages}>('../i18n/lang/*.json')
	const load = files[`../i18n/lang/${language}.json`] as (() => Promise<{default: typeof messages}>) | undefined
	if (language !== 'en' && load) { const result = await load(); signal?.throwIfAborted(); context.messages[language] = result.default }
	await loadDayjsLocale(language, signal)
	signal?.throwIfAborted(); context.locale = language === 'en' || load ? language : 'en'
	document.documentElement.lang = String(context.locale)
	document.documentElement.dir = ['ar-SA', 'he-IL', 'fa-IR'].includes(String(context.locale)) ? 'rtl' : 'ltr'
}
export function locale() { return String(context.locale) }
