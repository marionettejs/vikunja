import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'
import type {IProjectView} from '@/modelTypes/IProjectView'
import type {PrefixMode} from '@/modules/quickAddMagic/prefixes'
import type {Label} from '@/client/generated/index'
import type {Options as FlatpickrOptions} from 'flatpickr/dist/types/options'

// Existing auth/stores/router are supplied by the remaining bootstrap boundary.
// Native Views own their DOM, drafts and interaction lifetimes.
export interface ListContext {
	playDoneSound?: () => void
	t: (key: string, values?: Record<string, unknown> | number | unknown[]) => string
	reportError: (error: unknown) => void
	success: (message: string, undo?: () => void) => void
	updateTask: (task: ITask, signal: AbortSignal) => Promise<ITask>
	favoriteTask: (task: ITask, signal: AbortSignal) => Promise<ITask>
	deferTask: (task: ITask, signal: AbortSignal) => Promise<ITask>
	getProject: (id: number) => IProject | undefined
	observeProject: (id: number, changed: (project: IProject) => void) => () => void
	minimumPriority: () => number
	displayDate: (date: Date | null) => string
	flatpickrOptions: () => FlatpickrOptions
	taskHref: (id: number) => string
	viewHref: (project: IProject, view: IProjectView) => string
	pageHref: (page: number) => string
	navigate: (event: MouseEvent) => void
	quickAddMode: () => PrefixMode
	defaultProject: () => number
	concurrentWrites: () => boolean
	ensureLabels: (titles: string[], signal?: AbortSignal) => Promise<Label[]>
	findProject: (title: string) => number | null
	createTasks: (entries: {title: string, projectId: number}[]) => Promise<{tasks: (ITask | null)[], error: unknown}>
}

export interface ListWidgets {filter: import('../filters/filter-context').FilterContext, context: ListContext}
