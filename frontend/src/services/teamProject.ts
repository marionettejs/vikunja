import AbstractService from './abstractService'
import TeamProjectModel from '@/models/teamProject'
import type {ITeamProject} from '@/modelTypes/ITeamProject'
import TeamModel from '@/models/team'

export default class TeamProjectService extends AbstractService<ITeamProject, TeamModel> {
	constructor() {
		super({
			create: '/projects/{projectId}/teams',
			getAll: '/projects/{projectId}/teams',
			update: '/projects/{projectId}/teams/{teamId}',
			delete: '/projects/{projectId}/teams/{teamId}',
		})
	}

	modelFactory(data: ConstructorParameters<typeof TeamProjectModel>[0]) {
		return new TeamProjectModel(data)
	}

	modelGetAllFactory(data: ConstructorParameters<typeof TeamModel>[0]) {
		return new TeamModel(data)
	}
}
