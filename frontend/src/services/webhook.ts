import AbstractService from '@/services/abstractService'
import type {IWebhook} from '@/modelTypes/IWebhook'
import WebhookModel from '@/models/webhook'

export default class WebhookService extends AbstractService<IWebhook> {
	constructor() {
		super({
			getAll: '/projects/{projectId}/webhooks',
			create: '/projects/{projectId}/webhooks',
			update: '/projects/{projectId}/webhooks/{id}',
			delete: '/projects/{projectId}/webhooks/{id}',
		})
	}

	modelFactory(data: ConstructorParameters<typeof WebhookModel>[0]) {
		return new WebhookModel(data)
	}

	async getAvailableEvents(signal?: AbortSignal): Promise<string[]> {
		const cancel = this.setLoading()

		try {
			const response = await this.http.get('/webhooks/events', {signal})
			signal?.throwIfAborted()
			return response.data
		} finally {
			cancel()
		}
	}
}

export class UserWebhookService extends AbstractService<IWebhook> {
	constructor() {
		super({
			getAll: '/user/settings/webhooks',
			create: '/user/settings/webhooks',
			update: '/user/settings/webhooks/{id}',
			delete: '/user/settings/webhooks/{id}',
		})
	}

	modelFactory(data: ConstructorParameters<typeof WebhookModel>[0]) {
		return new WebhookModel(data)
	}

	async getAvailableEvents(signal?: AbortSignal): Promise<string[]> {
		const cancel = this.setLoading()

		try {
			const response = await this.http.get('/user/settings/webhooks/events', {signal})
			signal?.throwIfAborted()
			return response.data
		} finally {
			cancel()
		}
	}
}
