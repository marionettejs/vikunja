import AbstractService from './abstractService'
import BackgroundImageModel from '../models/backgroundImage'
import ProjectModel from '@/models/project'
import type { IBackgroundImage } from '@/modelTypes/IBackgroundImage'

export default class BackgroundUnsplashService extends AbstractService<IBackgroundImage, IBackgroundImage, IBackgroundImage, ProjectModel> {
	constructor() {
		super({
			getAll: '/backgrounds/unsplash/search',
			update: '/projects/{projectId}/backgrounds/unsplash',
		})
	}

	modelFactory(data: Partial<IBackgroundImage>) {
		return new BackgroundImageModel(data)
	}

	modelUpdateFactory(data: ConstructorParameters<typeof ProjectModel>[0]) {
		return new ProjectModel(data)
	}

	async thumb(model: IBackgroundImage, signal?: AbortSignal) {
		const response = await this.http({
			url: `/backgrounds/unsplash/images/${model.id}/thumb`,
			method: 'GET',
			responseType: 'blob',
			signal,
		})
		signal?.throwIfAborted()
		return window.URL.createObjectURL(new Blob([response.data]))
	}
}
