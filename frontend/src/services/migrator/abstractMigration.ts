import AbstractService from '../abstractService'
import {apiV2Url} from '@/helpers/fetcher'

export type MigrationConfig =
	| { code: string }
	| { url: string, token: string }
	| { url: string, username: string, password: string }

// This service builds on top of the abstract service and basically just hides away method names.
// It enables migration services to be created with minimal overhead and even better method names.
export default class AbstractMigrationService extends AbstractService<MigrationConfig> {
	serviceUrlKey = ''

	constructor(serviceUrlKey: string) {
		super({
			update: apiV2Url(`migration/${serviceUrlKey}/migrate`),
		})
		this.serviceUrlKey = serviceUrlKey
	}

	getAuthUrl(signal?: AbortSignal) {
		return this.getM(apiV2Url(`migration/${this.serviceUrlKey}/auth`), undefined, {}, signal)
	}

	getStatus(signal?: AbortSignal) {
		return this.getM(apiV2Url(`migration/${this.serviceUrlKey}/status`), undefined, {}, signal)
	}

	migrate(data: MigrationConfig, signal?: AbortSignal) {
		return this.update(data, signal)
	}
}
