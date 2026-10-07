import type {IAbstract} from '@/modelTypes/IAbstract'

export interface IApiPermission {
	[key: string]: string[]
}

export interface IApiToken extends IAbstract {
	id: number
	title: string
	token: string
	permissions: IApiPermission | null
	expiresAt: Date
	created: Date
	ownerId?: number
}
