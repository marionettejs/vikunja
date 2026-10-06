import AbstractService from './abstractService'
import ProjectModel from '@/models/project'

import type { IProject } from '@/modelTypes/IProject'

export default class BackgroundUploadService extends AbstractService<IProject> {
	constructor() {
		super({
			create: '/projects/{projectId}/backgrounds/upload',
		})
	}

	useCreateInterceptor() {
		return false
	}

	modelCreateFactory(data: Partial<IProject>) {
		return new ProjectModel(data)
	}

	/**
	 * Uploads a file to the server
	 */
	upload(projectId: IProject['id'], file: File, signal?: AbortSignal) {
		return this.uploadFile(
			this.getReplacedRoute(this.paths.create, {projectId}),
			file,
			'background',
			signal,
		)
	}
}
