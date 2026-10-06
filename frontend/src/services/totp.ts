import AbstractService from './abstractService'
import TotpModel from '@/models/totp'
import type {ITotp} from '@/modelTypes/ITotp'

export default class TotpService extends AbstractService<ITotp> {
	urlPrefix = '/user/settings/totp'

	constructor() {
		super({})

		this.paths.get = this.urlPrefix
	}

	modelFactory(data: ConstructorParameters<typeof TotpModel>[0]) {
		return new TotpModel(data)
	}

	enroll(signal?: AbortSignal) {
		return this.post(`${this.urlPrefix}/enroll`, new TotpModel(), signal)
	}

	enable(model: {passcode: string}, signal?: AbortSignal) {
		return this.http.post(`${this.urlPrefix}/enable`, model, {signal})
	}

	disable(model: {password: string}, signal?: AbortSignal) {
		return this.http.post(`${this.urlPrefix}/disable`, model, {signal})
	}

	async qrcode(signal?: AbortSignal) {
		const response = await this.http({
			url: `${this.urlPrefix}/qrcode`,
			method: 'GET',
			responseType: 'blob',
			signal,
		})
		signal?.throwIfAborted()
		return new Blob([response.data])
	}
}
