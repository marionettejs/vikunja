import AbstractService from './abstractService'
import AttachmentModel from '../models/attachment'

import type { IAttachment } from '@/modelTypes/IAttachment'

import {downloadBlob} from '@/helpers/downloadBlob'
import {toISOStringOrNull} from '@/helpers/time/toISOStringOrNull'

export enum PREVIEW_SIZE {
	SM = 'sm',
	MD = 'md',
	LG = 'lg',
	XL = 'xl',
}

export interface AttachmentUploadResult {
 success: IAttachment[]
 errors: {message: string}[] | null
}
export default class AttachmentService extends AbstractService<IAttachment, IAttachment, AttachmentUploadResult> {
	constructor() {
		super({
			create: '/tasks/{taskId}/attachments',
			getAll: '/tasks/{taskId}/attachments',
			delete: '/tasks/{taskId}/attachments/{id}',
		})
	}

	processModel(model: IAttachment) {
		return {
			...model,
			created: toISOStringOrNull(model.created),
		}
	}

	useCreateInterceptor() {
		return false
	}

	modelFactory(data: Partial<IAttachment>) {
		return new AttachmentModel(data)
	}

	modelCreateFactory(data: Partial<AttachmentUploadResult>): AttachmentUploadResult {
		return {...data, success: (data.success ?? []).map(attachment => this.modelFactory(attachment)), errors: data.errors ?? null}
	}

	getAttachmentBlobUrl(model: Pick<IAttachment, 'id' | 'taskId'>, size?: PREVIEW_SIZE, signal?: AbortSignal): Promise<string> {
		let mainUrl = '/tasks/' + model.taskId + '/attachments/' + model.id
		if (size !== undefined) {
			mainUrl += `?preview_size=${size}`
		}

		return super.getBlobUrl(mainUrl, 'GET', {}, signal)
	}

	async download(model: IAttachment) {
		const url = await this.getAttachmentBlobUrl(model)
		return downloadBlob(url, model.file.name)
	}

	/**
	 * Uploads a file to the server
	 * @param files
	 * @returns {Promise<any|never>}
	 */
	upload(model: IAttachment, files: File[] | FileList, signal?: AbortSignal) {
		const data = new FormData()
		for (let i = 0; i < files.length; i++) {
			// TODO: Validation of file size
			data.append('files', new Blob([files[i]]), files[i].name)
		}

		return this.uploadFormData(
			this.getReplacedRoute(this.paths.create, model),
			data,
			signal,
		)
	}
}
