export const SUPPORTED_LOCALES = {
	'en': 'English',
	'de-DE': 'Deutsch',
	'de-swiss': 'Schwizertütsch',
	'ru-RU': 'Русский',
	'fr-FR': 'Français',
	'vi-VN': 'Tiếng Việt',
	'it-IT': 'Italiano',
	'cs-CZ': 'Čeština',
	'pl-PL': 'Polski',
	'nl-NL': 'Nederlands',
	'pt-PT': 'Português',
	'zh-CN': '简体中文',
	'zh-TW': '繁體中文',
	'no-NO': 'Norsk Bokmål',
	'es-ES': 'Español',
	'da-DK': 'Dansk',
	'ja-JP': '日本語',
	'hu-HU': 'Magyar',
	'ar-SA': 'اَلْعَرَبِيَّةُ',
	'fa-IR': 'فارسی',
	'sl-SI': 'Slovenščina',
	'pt-BR': 'Português Brasileiro',
	'hr-HR': 'Hrvatski',
	'uk-UA': 'Українська',
	'lt-LT': 'Lietuvių Kalba',
	'bg-BG': 'Български',
	'ko-KR': '한국어',
	'tr-TR': 'Türkçe',
	'fi-FI': 'Suomi',
	'he-IL': 'עִבְרִית',
	'sv-SE': 'Svenska',
	'el-GR': 'Ελληνικά',
	// IMPORTANT: Also add new languages to useDayjsLanguageSync
	// IMPORTANT: Also add new languages to pkg/i18n/i18n.go
} as const

export type SupportedLocale = keyof typeof SUPPORTED_LOCALES

