import type {Sort} from '@/shared/task-list/task-list-query'
export function stored<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }
export function tableDefaultSort(): Sort { return stored('tableViewSortBy', {index: 'desc'}) }
