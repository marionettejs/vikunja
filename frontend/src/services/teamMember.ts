import AbstractService from './abstractService'
import TeamMemberModel from '@/models/teamMember'
import type {ITeamMember} from '@/modelTypes/ITeamMember'

export default class TeamMemberService extends AbstractService<ITeamMember> {
	constructor() {
		super({
			create: '/teams/{teamId}/members',
			delete: '/teams/{teamId}/members/{username}',
			update: '/teams/{teamId}/members/{username}/admin',
		})
	}

	modelFactory(data: ConstructorParameters<typeof TeamMemberModel>[0]) {
		return new TeamMemberModel(data)
	}

	beforeCreate(model: ITeamMember) {
		return {...model, userId: model.id, admin: model.admin === null ? false : model.admin}
	}
}
