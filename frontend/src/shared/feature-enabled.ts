import type {SessionApplication} from '../app/session'
import {AUTH_TYPES} from '@/modelTypes/IUser'
export function featureEnabled(
	session: InstanceType<typeof SessionApplication>,
	feature: string,
) {
	return (
		session.getState().get('user')?.type === AUTH_TYPES.USER &&
		(
			(session.getState().get('config')?.enabled_pro_features ?? []) as string[]
		).includes(feature)
	)
}
