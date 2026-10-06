interface TokenPreset {
	id: string
	groups: Record<string, string[] | '*'>
}

export const TOKEN_PRESETS: TokenPreset[] = [
	{
		id: 'readOnly',
		groups: {
			'*': ['read_one', 'read_all'],
		},
	},
	{
		id: 'tasks',
		groups: {
			'tasks': '*',
			'tasks_attachments': '*',
			'tasks_assignees': '*',
			'tasks_labels': '*',
			'tasks_comments': '*',
			'tasks_relations': '*',
			'labels': ['read_one', 'read_all', 'create'],
			'projects': ['read_one', 'read_all', 'views_buckets_tasks'],
			'projects_views': ['read_one', 'read_all'],
			'projects_views_tasks': ['read_one', 'read_all'],
		},
	},
	{
		id: 'projects',
		groups: {
			'projects': '*',
			'projects_views': '*',
			'projects_teams': '*',
			'projects_users': '*',
			'projects_shares': '*',
			'projects_webhooks': '*',
			'projects_buckets': '*',
			'projects_views_tasks': '*',
			'tasks': ['read_one', 'read_all'],
			'teams': ['read_one', 'read_all'],
		},
	},
	{
		id: 'fullAccess',
		groups: {
			'*': '*',
		},
	},
]

