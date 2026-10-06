import AbstractService from '@/services/abstractService'
import AdminOverviewModel from '@/models/adminOverview'
import type {IAdminOverview} from '@/modelTypes/IAdminOverview'

export default class AdminOverviewService extends AbstractService<IAdminOverview> {
	modelFactory(data: Partial<IAdminOverview>) {
		return new AdminOverviewModel(data)
	}

	async getOverview(signal?: AbortSignal) {
		const {data} = await this.http.get('/admin/overview', {signal})
		return this.modelGetFactory(data)
	}
}
