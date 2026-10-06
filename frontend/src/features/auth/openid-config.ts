import type { IProvider } from '@/types/IProvider'
export function openIdProviders(
	config: Record<string, unknown> = {},
): IProvider[] {
	const auth = config.auth as
		| {
				openid_connect?: {
					enabled?: boolean;
					providers?: {
						name: string;
						key: string;
						auth_url: string;
						client_id: string;
						logout_url: string;
						scope: string;
					}[];
				};
		  }
		| undefined
	if (!auth?.openid_connect?.enabled) return []
	return (auth.openid_connect.providers ?? []).map((p) => ({
		name: p.name,
		key: p.key,
		authUrl: p.auth_url,
		clientId: p.client_id,
		logoutUrl: p.logout_url,
		scope: p.scope,
	}))
}
