import {t} from './i18n'
export interface Notice {type: 'error' | 'success', message: string, undo?: () => void}
const listeners = new Set<(notice: Notice) => void>()
export function observeNotices(callback: (notice: Notice) => void) { listeners.add(callback); return () => listeners.delete(callback) }
export function errorText(error: unknown): string {
	const value = error as {response?: {data?: {code?: number, message?: string, detail?: string, i18n_params?: Record<string, unknown>}}, message?: string}
	const data = value?.response?.data
	if (data?.code) { const key = `error.${data.code}`, translated = t(key, data.i18n_params); if (translated !== key) return translated }
	return data?.message ?? data?.detail ?? value?.message ?? String(error)
}
export function reportError(error: unknown) { for (const callback of listeners) callback({type: 'error', message: errorText(error)}) }
export function success(message: string, undo?: () => void) { for (const callback of listeners) callback({type: 'success', message, undo}) }
export function translatedError(key: string) { return new Error(t(key)) }
