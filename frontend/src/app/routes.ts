export type Query = Record<string, string | null | (string | null)[]>;
export type QueryPatch = Record<
	string,
	string | number | null | undefined | (string | number | null | undefined)[]
>;
export interface Route {
	[key: string]: unknown;
	kind:
		| 'share-auth'
		| 'login'
		| 'register'
		| 'password-request'
		| 'password-reset'
		| 'home'
		| 'teams'
		| 'labels'
		| 'organization-create'
		| 'directory'
		| 'project-management'
		| 'project-sharing'
		| 'settings'
		| 'project'
		| 'task'
		| 'import'
		| 'oauth'
		| 'openid'
		| 'about'
		| 'not-found'
		| 'admin'
		| 'time-tracking'
		| 'unported';
	key: string;
	path: string;
	query: Query;
	params: Record<string, string>;
}
export function parseRoute(url: URL): Route {
	const query: Query = {}
	for (const key of new Set(url.searchParams.keys())) {
		const values = url.searchParams.getAll(key)
		query[key] = values.length === 1 ? values[0] : values
	}
	const share = /^\/share\/([^/]+)\/auth\/?$/.exec(url.pathname)
	if (share)
		return {
			kind: 'share-auth',
			key: `share:${share[1]}`,
			path: url.pathname,
			query,
			params: { share: decodeURIComponent(share[1]) },
		}
	const admin=/^\/admin(?:\/(users|projects))?\/?$/.exec(url.pathname)
	if(admin)return {kind:'admin',key:`admin:${admin[1]??'overview'}`,path:url.pathname,query,params:{page:admin[1]??'overview'}}
	if(url.pathname==='/time-tracking')return {kind:'time-tracking',key:url.href,path:url.pathname,query,params:{}}
	const openid = /^\/auth\/openid\/([^/]+)\/?$/.exec(url.pathname)
	if (openid) return {kind: 'openid', key: url.href, path: url.pathname, query, params: {provider: decodeURIComponent(openid[1])}}
	if(url.pathname==='/oauth/authorize')return {kind:'oauth',key:url.href,path:url.pathname,query,params:{}}
	const migration=/^\/migrate\/([^/]+)\/?$/.exec(url.pathname)
	if(url.pathname==='/user/settings/migrate'||migration)return {kind:'import',key:url.href,path:url.pathname,query,params:migration?{service:decodeURIComponent(migration[1])}:{}}
	if(url.pathname==='/user/export/download')return {kind:'settings',key:'export-download',path:url.pathname,query,params:{page:'export-download'}}
	const settings = /^\/user\/settings(?:\/([^/]+))?\/?$/.exec(url.pathname)
	if (settings && (!settings[1]||['general','password-update','email-update','avatar','totp','data-export','migrate','caldav','feeds','api-tokens','sessions','webhooks','bots','deletion'].includes(settings[1])))
		return {
			kind: 'settings',
			key: `settings:${settings[1] ?? 'general'}`,
			path: url.pathname,
			query,
			params: { page: settings[1] ?? 'general' },
		}
	if (url.pathname === '/teams' || url.pathname === '/labels')
		return {
			kind: url.pathname === '/teams' ? 'teams' : 'labels',
			key: url.pathname,
			path: url.pathname,
			query,
			params: {},
		}
	const create = /^\/(teams|labels)\/new\/?$/.exec(url.pathname)
	if (create)
		return {
			kind: 'organization-create',
			key: `create:${create[1]}`,
			path: url.pathname,
			query,
			params: { family: create[1] === 'teams' ? 'team' : 'label' },
		}
	const team = /^\/teams\/(\d+)\/edit\/?$/.exec(url.pathname)
	if (team)
		return {
			kind: 'teams',
			key: `team:${team[1]}`,
			path: url.pathname,
			query,
			params: { id: team[1] },
		}
	if (url.pathname === '/projects')
		return {
			kind: 'directory',
			key: 'directory',
			path: url.pathname,
			query,
			params: {},
		}
	if (url.pathname === '/tasks/by/upcoming') return {kind: 'home', key: 'upcoming', path: url.pathname, query, params: {page: 'upcoming'}}
	const sharing = /^\/projects\/(\d+)\/settings\/share\/?$/.exec(url.pathname)
	if (sharing)
		return {
			kind: 'project-sharing',
			key: `project-sharing:${sharing[1]}`,
			path: url.pathname,
			query,
			params: { projectId: sharing[1] },
		}
	const savedFilter =
		url.pathname === '/filters/new'
			? { projectId: '0', page: 'new' }
			: (() => {
				const match = /^\/projects\/(-\d+)\/settings\/(edit|delete)\/?$/.exec(
					url.pathname,
				)
				return match ? { projectId: match[1], page: match[2] } : undefined
			})()
	if (savedFilter)
		return {
			kind: 'project-management',
			key: `filter-management:${savedFilter.projectId}:${savedFilter.page}`,
			path: url.pathname,
			query,
			params: { ...savedFilter, family: 'filter' },
		}
	const filterViews = /^\/projects\/(-\d+)\/settings\/views\/?$/.exec(
		url.pathname,
	)
	if (filterViews)
		return {
			kind: 'project-management',
			key: `project-management:${filterViews[1]}:views`,
			path: url.pathname,
			query,
			params: { projectId: filterViews[1], page: 'views' },
		}
	const management =
		/^\/projects(?:\/(\d+))?\/(new|settings\/(edit|archive|delete|views|duplicate|background|webhooks))\/?$/.exec(
			url.pathname,
		)
	if (management)
		return {
			kind: 'project-management',
			key: `project-management:${management[1] ?? 0}:${management[3] ?? 'new'}`,
			path: url.pathname,
			query,
			params: { projectId: management[1] ?? '0', page: management[3] ?? 'new' },
		}
	const info = /^\/projects\/(-?\d+)\/info\/?$/.exec(url.pathname)
	if (info) return {kind: 'project-management', key: `project-info:${info[1]}`, path: url.pathname, query, params: {projectId: info[1], page: 'info'}}
	const project = /^\/projects\/(-?\d+)(?:\/(\d+))?\/?$/.exec(url.pathname)
	const task = /^\/tasks\/(\d+)\/?$/.exec(url.pathname)
	if (project)
		return {
			kind: 'project',
			key: `project:${project[1]}:${project[2] ?? '0'}`,
			path: url.pathname,
			query,
			params: { projectId: project[1], viewId: project[2] ?? '0' },
		}
	if (task)
		return {
			kind: 'task',
			key: `task:${task[1]}`,
			path: url.pathname,
			query,
			params: { id: task[1] },
		}
	const kind =
		url.pathname === '/login'
			? 'login'
			: url.pathname === '/register'
				? 'register'
				: url.pathname === '/get-password-reset'
					? 'password-request'
					: url.pathname === '/password-reset'
						? 'password-reset'
						: url.pathname === '/'
							? 'home'
							: url.pathname==='/about' ? 'about' : /^\/(?:migrate(?:\/.*)?|auth\/openid\/[^/]+|oauth\/authorize|time-tracking|admin(?:\/.*)?)\/?$/.test(url.pathname) ? 'unported' : 'not-found'
	return {
		kind,
		key: `${url.pathname}:${query.userPasswordReset ?? query.userEmailConfirm ?? ''}`,
		path: url.pathname,
		query,
		params: {},
	}
}
export function queryHref(path: string, query: QueryPatch): string {
	const values = new URLSearchParams()
	for (const [key, value] of Object.entries(query))
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== undefined)
				values.append(key, item === null ? '' : String(item))
		}
	return (
		path +
		(values.size
			? `?${values.toString().replace(/%(?:3A|2C|2F|40|3F)/gi, decodeURIComponent)}`
			: '')
	)
}
export function interceptLink(
	event: MouseEvent,
	navigate: (href: string) => void,
) {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey ||
		event.altKey
	)
		return
	const anchor =
		(event as MouseEvent & { delegateTarget?: HTMLAnchorElement })
			.delegateTarget ?? (event.currentTarget as HTMLAnchorElement)
	if (
		anchor.target ||
		anchor.hasAttribute('download') ||
		anchor.origin !== location.origin
	)
		return
	event.preventDefault()
	navigate(anchor.pathname + anchor.search + anchor.hash)
}
