import type {Label} from '@/client/generated/index'
import type {IProject} from '@/modelTypes/IProject'
import type {ListContext} from '../task-list/list-context'

export interface FilterContext {
	ui: ListContext
	labels: () => Label[]
	labelsPending: () => boolean
	observeLabels: (changed: () => void) => () => void
	labelByTitle: (title: string) => Label | undefined
	labelById: (id: number) => Label | undefined
	filterLabels: (query: string) => Label[]
	projectByTitle: (title: string) => IProject | undefined
	searchProjects: (query: string) => IProject[]
}
