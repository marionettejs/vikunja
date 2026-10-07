import { Application, type LifecycleContext } from 'marionette'
import ProjectService from '@/services/project'
import type { IProject } from '@/modelTypes/IProject'
import type { Label } from '@/client/generated/index'
import { loadLabels, createLabel } from '../labels/label-transport'
import { getRandomColorHex } from '@/helpers/color/randomColor'
interface Options {
    projects: (projects: IProject[]) => void;
    labels: (labels: Label[]) => void;
}
// Shell and route metadata are independent of these cross-feature catalogs.
export const CatalogApplication = Application.extend({
	initialize(options: Options) { void options },
	createState() { return { labels: [] as Label[], edits: new Map<number, Label | undefined>(), lifetime: new AbortController() } },
	publishLabels(labels: Label[]) { const state = this.getState(), map = new Map(labels.map(label => [label.id!, label])); for (const [id, label] of state.edits) {
		if (label)
			map.set(id, label)
		else
			map.delete(id)
	} state.labels = [...map.values()]; this.options.labels(state.labels); this.trigger('labels:changed', state.labels) },
	commitLabel(label: Label) { this.getState().edits.set(label.id!, label); this.publishLabels(this.getState().labels) },
	removeLabel(id: number) { this.getState().edits.set(id, undefined); this.publishLabels(this.getState().labels) },
	async createLabel(title: string, signal: AbortSignal) { const request = AbortSignal.any([signal, this.getState().lifetime.signal]), label = await createLabel({ title, hex_color: getRandomColorHex() }, request); request.throwIfAborted(); this.commitLabel(label); return label },
	async ensureLabels(titles: string[], signal?: AbortSignal) { const request = signal ?? this.getState().lifetime.signal, result: Label[] = []; for (const title of titles) {
		let label = this.getState().labels.find(label => label.title?.toLowerCase() === title.toLowerCase())
		if (!label)
			label = await this.createLabel(title, request)
		request.throwIfAborted()
		result.push(label)
	} return result },
	async refreshProjects(signal: AbortSignal) {
		const request=AbortSignal.any([signal,this.getState().lifetime.signal]),service=new ProjectService(),projects:IProject[]=[]
		let page=1;do {projects.push(...await service.getAll(undefined,{is_archived:true,expand:'permissions'},page++,request))}while(page<=service.totalPages)
		request.throwIfAborted();this.options.projects(projects)
	},
	onBeforeStop() { this.getState().lifetime.abort(); this.getState().lifetime = new AbortController(); this.getState().labels = []; this.getState().edits.clear() },
	async prepareStart(_options: unknown, { signal }: LifecycleContext) {
		await Promise.all([
			(async () => { const service = new ProjectService(), projects: IProject[] = []; let page = 1; do {
				projects.push(...await service.getAll(undefined, {is_archived:true,expand:'permissions'}, page++, signal))
			} while (page <= service.totalPages); signal.throwIfAborted(); this.options.projects(projects) })(),
			(async () => { this.publishLabels(await loadLabels(signal)) })(),
		])
	},
})
