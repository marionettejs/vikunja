import type {IProject} from '@/modelTypes/IProject'
import type {ISavedFilter} from '@/modelTypes/ISavedFilter'
import AbstractService from '@/services/abstractService'
import SavedFilterModel from '@/models/savedFilter'

/**
* Calculates the corresponding project id to this saved filter.
* This function matches the one in the api.
*/
export function getProjectId(savedFilter: ISavedFilter) {
	let projectId = savedFilter.id * -1 - 1
	if (projectId > 0) {
		projectId = 0
	}
	return projectId
}

export function getSavedFilterIdFromProjectId(projectId: IProject['id']) {
	let filterId = projectId * -1 - 1
	// FilterIds from projectIds are always positive
	if (filterId < 0) {
		filterId = 0
	}
	return filterId
}

export function isSavedFilter(project: IProject | undefined | null) {
	return getSavedFilterIdFromProjectId(project?.id || 0) > 0
}

export default class SavedFilterService extends AbstractService<ISavedFilter> {
	constructor() {
		super({
			get: '/filters/{id}',
			create: '/filters',
			update: '/filters/{id}',
			delete: '/filters/{id}',
		})
	}

	modelFactory(data: Partial<ISavedFilter>) {
		return new SavedFilterModel(data)
	}
}

