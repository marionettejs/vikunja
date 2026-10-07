import AbstractService from './abstractService'

export default class AccountDeleteService extends AbstractService<{token: string}> {
	request(password: string, signal?: AbortSignal) {
		return this.http.post('/user/deletion/request', {password}, {signal})
	}
	
	confirm(token: string) {
		return this.post('/user/deletion/confirm', {token})
	}
	
	cancel(password: string, signal?: AbortSignal) {
		return this.http.post('/user/deletion/cancel', {password}, {signal})
	}
}
