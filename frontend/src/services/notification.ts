import AbstractService from '@/services/abstractService'
import NotificationModel from '@/models/notification'
import type {INotification} from '@/modelTypes/INotification'

export default class NotificationService extends AbstractService<INotification> {
	constructor() {
		super({
			getAll: '/notifications',
			update: '/notifications/{id}',
			delete: '/notifications',
		})
	}

	modelFactory(data: Partial<INotification>) {
		return new NotificationModel(data)
	}

	async markAllRead(signal?: AbortSignal) {
		const {data} = await this.http.post('/notifications', false, {signal})
		return data
	}
}
