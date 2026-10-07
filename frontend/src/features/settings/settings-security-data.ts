import ApiTokenService from '@/services/apiToken'
import SessionService from '@/services/session'
import TotpService from '@/services/totp'
import TotpModel from '@/models/totp'
import CaldavTokenService from '@/services/caldavToken'
import type { IApiToken } from '@/modelTypes/IApiToken'
import type { ICaldavToken } from '@/modelTypes/ICaldavToken'
import type { ISession } from '@/modelTypes/ISession'
import type { ITotp } from '@/modelTypes/ITotp'
export type SecurityPage =
	| 'api-tokens'
	| 'sessions'
	| 'totp'
	| 'feeds'
	| 'caldav';
export type PermissionRoutes = Record<string, Record<string, unknown>>;
export interface SecurityData {
	tokens?: IApiToken[];
	routes?: PermissionRoutes;
	sessions?: ISession[];
	caldav?: ICaldavToken[];
	totp?: ITotp;
	error?: unknown;
}
export const securityPages: SecurityPage[] = [
	'api-tokens',
	'sessions',
	'totp',
	'feeds',
	'caldav',
]
export function securityTitle(page: string) {
	return page === 'totp'
		? 'user.settings.totp.title'
		: `user.settings.${page === 'api-tokens' ? 'apiTokens' : page}.title`
}
export async function readSecurity(
	page: SecurityPage,
	signal: AbortSignal,
): Promise<SecurityData> {
	if (page === 'api-tokens') {
		const [tokens, routes] = await Promise.all([
			new ApiTokenService().getAll(undefined, {}, 1, signal),
			new ApiTokenService().getAvailableRoutes(signal),
		])
		return { tokens, routes }
	}
	if (page === 'sessions')
		return {
			sessions: await new SessionService().getAll(undefined, {}, 1, signal),
		}
	if (page === 'caldav')
		return {
			caldav: await new CaldavTokenService().getAll(undefined, {}, 1, signal),
		}
	if (page === 'totp') {
		try {
			return { totp: await new TotpService().get(new TotpModel(), {}, signal) }
		} catch (error) {
			signal.throwIfAborted()
			if (
				(error as { response?: { data?: { code?: number } } }).response?.data
					?.code === 1016
			)
				return { totp: new TotpModel() }
			throw error
		}
	}
	return {}
}
