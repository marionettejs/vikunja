import AbstractModel from './abstractModel'
import UserSettingsModel from '@/models/userSettings'

import { AUTH_TYPES, type IUser, type AuthType } from '@/modelTypes/IUser'
import type { IUserSettings } from '@/modelTypes/IUserSettings'

export function getDisplayName(user: IUser) {
	if (user.name !== '') {
		return user.name
	}

	return user.username
}

export default class UserModel extends AbstractModel<IUser> implements IUser {
	id = 0
	email = ''
	username = ''
	name = ''
	exp = 0
	type: AuthType = AUTH_TYPES.UNKNOWN

	created: Date
	updated: Date
	settings: IUserSettings

	isLocalUser: boolean
	pendingEmail = ''
	deletionScheduledAt: null
	isAdmin?: boolean
	botOwnerId = 0

	constructor(data: Partial<IUser> = {}) {
		super()
		this.assignData(data)

		this.created = new Date(this.created)
		this.updated = new Date(this.updated)

		this.settings = new UserSettingsModel(this.settings || {})
	}

	get isBot(): boolean {
		return (this.botOwnerId ?? 0) > 0
	}
}
