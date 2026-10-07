import AbstractModel from '@/models/abstractModel'
import type {IApiToken} from '@/modelTypes/IApiToken'

export default class ApiTokenModel extends AbstractModel<IApiToken> {
	id = 0
	title = ''
	token = ''
	permissions: IApiToken['permissions'] = null
	expiresAt: Date = new Date(0)
	created: Date = new Date(0)
	updated = new Date(NaN)
	ownerId = 0
	
	constructor(data: Partial<IApiToken> = {}) {
		super()
		
		this.assignData(data)
		
		this.expiresAt = new Date(this.expiresAt)
		this.created = new Date(this.created)
		this.updated = new Date(this.updated)
	}
}
