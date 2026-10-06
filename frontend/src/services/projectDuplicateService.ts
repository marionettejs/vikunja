import AbstractService from './abstractService'
import projectDuplicateModel from '@/models/projectDuplicateModel'
import type {IProjectDuplicate} from '@/modelTypes/IProjectDuplicate'

export default class ProjectDuplicateService extends AbstractService<IProjectDuplicate> {
	constructor() {
		super({
			create: '/projects/{projectId}/duplicate',
		})
	}

	beforeCreate(model: IProjectDuplicate) {

		return {...model, project: null}
	}

	modelFactory(data: ConstructorParameters<typeof projectDuplicateModel>[0]) {
		return new projectDuplicateModel(data)
	}
}
