import {AuthenticatedHTTPFactory} from '@/helpers/fetcher'

export interface TaskTransport {
	load(id: number): Promise<Record<string, unknown>>
	update(id: number, payload: Record<string, unknown>): Promise<Record<string, unknown>>
}

function parseMaxPermission(raw: unknown): number | null {
	return raw === '0' || raw === '1' || raw === '2' ? Number(raw) : null
}

export function createTaskTransport(): TaskTransport {
	const http = AuthenticatedHTTPFactory()

	return {
		async load(id: number): Promise<Record<string, unknown>> {
			const response = await http.get<Record<string, unknown>>(`/tasks/${id}`)
			const maxPermission = parseMaxPermission(response.headers['x-max-permission'])
			return {
				...response.data,
				max_permission: maxPermission,
			}
		},

		async update(id: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
			const response = await http.post<Record<string, unknown>>(`/tasks/${id}`, payload)
			return response.data
		},
	}
}
