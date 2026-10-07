import AbstractService from './abstractService'
import PasswordResetModel from '@/models/passwordReset'
import type {IPasswordReset} from '@/modelTypes/IPasswordReset'

export default class PasswordResetService extends AbstractService<IPasswordReset> {

	private readonly requestResetPath = '/user/password/token'

	constructor() {
		super({reset: '/user/password/reset'})
	}

	modelFactory(data: Partial<IPasswordReset>) {
		return new PasswordResetModel(data)
	}

	async resetPassword(model: IPasswordReset, signal?: AbortSignal) {
		const cancel = this.setLoading()
		try {
			const response = await this.http.post(this.paths.reset!, model, {signal})
			return this.modelFactory(response.data)
		} finally {
			cancel()
		}
	}

	async requestResetPassword(model: IPasswordReset, signal?: AbortSignal) {
		const cancel = this.setLoading()
		try {
			const response = await this.http.post(this.requestResetPath, model, {signal})
			return this.modelFactory(response.data)
		} finally {
			cancel()
		}
	}
}
