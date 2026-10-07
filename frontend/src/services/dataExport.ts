import AbstractService from './abstractService'
import {downloadBlob} from '../helpers/downloadBlob'

const DOWNLOAD_NAME = 'vikunja-export.zip'

export default class DataExportService extends AbstractService {
	request(password: string, signal?: AbortSignal) {
		return this.http.post('/user/export/request', {password}, {signal})
	}

	status(signal?: AbortSignal) {
		return this.http.get('/user/export', {signal}).then(response=>response.data)
	}
	
	downloadUrl(password: string, signal?: AbortSignal) {return this.getBlobUrl('/user/export/download', 'POST', {password}, signal)}
	async download(password: string) {
		const clear = this.setLoading()
		try {
			const url = await this.getBlobUrl('/user/export/download', 'POST', {password})
			downloadBlob(url, DOWNLOAD_NAME)
		} finally {
			clear()
		}
	}
}
