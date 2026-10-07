import AbstractService from './abstractService'
import UserModel from '@/models/user'
import type {IUser} from '@/modelTypes/IUser'

export default class UserService extends AbstractService<IUser> {
	constructor() {
		super({
			getAll: '/users',
		})
	}

	modelFactory(data: ConstructorParameters<typeof UserModel>[0]) {
		return new UserModel(data)
	}
}
