import AbstractService from './abstractService'
import ProjectModel from '@/models/project'
import type {IProject} from '@/modelTypes/IProject'
import TaskService from './task'
import {colorFromHex} from '@/helpers/color/colorFromHex'

export default class ProjectService extends AbstractService<IProject> {
	constructor() {
		super({
			create: '/projects',
			get: '/projects/{id}',
			getAll: '/projects',
			update: '/projects/{id}',
			delete: '/projects/{id}',
		})
	}

	modelFactory(data: ConstructorParameters<typeof ProjectModel>[0]) {
		return new ProjectModel(data)
	}

	beforeUpdate(model: IProject) {
		const taskService = new TaskService()
		return {...model, tasks: model.tasks?.map(task => taskService.beforeUpdate(task)), hexColor: model.hexColor === undefined ? model.hexColor : colorFromHex(model.hexColor)}
	}

	beforeCreate(project: IProject) {
		project.hexColor = colorFromHex(project.hexColor)
		return project
	}

	async background(project: Pick<IProject, 'id' | 'backgroundInformation'>, signal?: AbortSignal) {
		if (project.backgroundInformation === null) {
			return ''
		}

		const response = await this.http({
			url: `/projects/${project.id}/background`,
			method: 'GET',
			responseType: 'blob',
			signal,
		})
		signal?.throwIfAborted()
		return window.URL.createObjectURL(new Blob([response.data]))
	}

	async removeBackground(project: IProject, signal?: AbortSignal) {
		const cancel = this.setLoading()

		try {
			await this.http.delete(`/projects/${project.id}/background`, {signal})
			signal?.throwIfAborted()
			return {
				...project,
				backgroundInformation: null,
				backgroundBlurHash: '',
			}
		} finally {
			cancel()
		}
	}
}
