import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing, render } from 'lit-html'
import { repeat } from 'lit-html/directives/repeat.js'
import AttachmentService, { PREVIEW_SIZE } from '@/services/attachment'
import AttachmentModel, {
	canPreviewImage,
	canPreviewAudio,
	previewKind,
} from '@/models/attachment'
import type { IAttachment } from '@/modelTypes/IAttachment'
import type { ITask } from '@/modelTypes/ITask'
import type { TaskRecordSession } from '@/features/task/task-record'
import { uploadFiles, generateAttachmentUrl } from '@/helpers/attachments'
import { downloadBlob } from '@/helpers/downloadBlob'
import { getHumanSize } from '@/helpers/getHumanSize'
import { getDisplayName } from '@/models/user'
import { EditorAvatarView } from '@/shared/editor/editor-avatar'
import type { TaskPorts } from './application'
import { EditorLightboxView } from '@/shared/editor/editor-lightbox'
import { ConfirmationView } from '../projects/project-sharing'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import './task-attachments.scss'
interface Options {
	record: TaskRecordSession
	ports: TaskPorts
	active: () => boolean
}
const MediaPreviewView = View.extend({
	initialize(options: {
		url?: string
		kind: string
		name: string
		close: () => void
	}) {
		void options
	},
	tagName: 'dialog',
	className: 'modal-dialog default native-sharing-confirmation',
	attributes() {
		return {
			'aria-label': t(
				this.options.kind === 'pdf' ? 'misc.pdfPreview' : 'misc.videoPreview',
			),
		}
	},
	ui: { body: '[data-media]' },
	events: { cancel: 'close', 'click [data-close]': 'close' },
	templateContext() {
		return { content: this.renderTemplate() }
	},
	template: ({ content }: { content: import('lit-html').TemplateResult }) =>
		content,
	renderTemplate() {
		return html`<div class="modal-container">
			<button
				type="button"
				class="base-button base-button--type-button close"
				data-close
				aria-label=${t('misc.closeDialog')}
			>
				${listIcon('times')}
			</button>
			<div class="modal-content is-wide" data-media>
				${this.options.url
		? this.media()
		: html`<div class="loader-container is-loading"></div>`}
			</div>
		</div>`
	},
	media() {
		return this.options.kind === 'pdf'
			? html`<iframe
					src=${this.options.url}
					title=${this.options.name}
					class="pdf-preview-iframe"
				></iframe>`
			: html`<video
					src=${this.options.url}
					aria-label=${this.options.name}
					class="video-preview"
					controls
					playsinline
				></video>`
	},
	onAttach() {
		;(this.el as HTMLDialogElement).showModal()
	},
	show(url: string) {
		this.options.url = url
		render(this.media(), this.getUI('body')![0] as HTMLElement)
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		;(this.el as HTMLDialogElement).close()
	},
}).setDomApi(LitDomApi)
export const TaskAttachmentsView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'content attachments native-task-attachments native-list-surface',
	regions: { confirmation: '[data-confirmation]', preview: '[data-preview]' },
	ui: {
		panel: '[data-panel]',
		input: 'input[type=file]',
		upload: '[data-upload]',
		rows: '[data-files]',
		error: '[data-error]',
		progress: 'progress',
		status: '[data-status]',
		drop: '[data-drop]',
	},
	events: {
		'change @ui.input': 'selected',
		'click @ui.upload': 'openFilePicker',
	},
	createState() {
		return {
			task: this.options.record.task,
			service: new AttachmentService(),
			write: undefined as AbortController | undefined,
			reads: new Set<AbortController>(),
			thumbnails: new Set<AbortController>(),
			urls: new Set<string>(),
			preview: undefined as AbortController | undefined,
			previewUrl: undefined as string | undefined,
			rowsKey: '',
			avatars: new Set<number>(),
			progressTimer: undefined as ReturnType<typeof setInterval> | undefined,
			life: new AbortController(),
		}
	},
	template() {
		return html`<div data-panel>
				<h2 class="task-section-title">
					<span class="icon is-grey">${listIcon('paperclip')}</span>${t(
	'task.attachment.title',
)}
				</h2>
				<input id="files" multiple type="file" />
				<div data-error class="message danger" role="alert" hidden></div>
				<span data-status role="status"></span
				><progress class="progress is-primary" max="100" hidden></progress>
				<div data-files class="files"></div>
				<button
					type="button"
					data-upload
					class="base-button base-button--type-button button is-outlined mbe-4"
				>
					${listIcon('cloud-upload-alt')}${t('task.attachment.upload')}
				</button>
			</div>
			<div data-confirmation></div>
			<div data-preview></div>
			<div class="dropzone" data-drop hidden>
				<div class="drop-hint">
					<div class="icon">${listIcon('cloud-upload-alt')}</div>
					<div class="hint">${t('task.attachment.drop')}</div>
				</div>
			</div>`
	},
	onAttach() {
		this.publish()
		const signal = this.getState().life.signal
		document.addEventListener('dragover', (event) => this.drag(event), {
			signal,
		})
		document.addEventListener(
			'dragleave',
			(event) => {
				if (!event.relatedTarget) this.hideDrop()
			},
			{ signal },
		)
		document.addEventListener('drop', (event) => this.drop(event), { signal })
	},
	canWrite() {
		return Number(this.getState().task.maxPermission) > 0
	},
	openFilePicker() {
		if (this.canWrite()) (this.getUI('input')![0] as HTMLInputElement).click()
	},
	selected() {
		const input = this.getUI('input')![0] as HTMLInputElement
		if (input.files?.length) void this.upload(Array.from(input.files))
		input.value = ''
	},
	drag(event: DragEvent) {
		if (
			!this.canWrite() ||
			!event.dataTransfer?.types.includes('Files') ||
			(event.target as HTMLElement)?.closest('.tiptap,[contenteditable]')
		) {
			this.hideDrop()
			return
		}
		event.preventDefault()
		;(this.getUI('drop')![0] as HTMLElement).hidden = false
	},
	hideDrop() {
		;(this.getUI('drop')![0] as HTMLElement).hidden = true
	},
	drop(event: DragEvent) {
		this.hideDrop()
		if (
			!this.canWrite() ||
			(event.target as HTMLElement)?.closest('.tiptap,[contenteditable]') ||
			!event.dataTransfer?.files.length
		)
			return
		event.preventDefault()
		void this.upload(Array.from(event.dataTransfer.files))
	},
	updateTask(task: ITask) {
		this.getState().task = task
		this.publish()
	},
	publish() {
		const state = this.getState(),
			write = this.canWrite()
		const active = this.options.active() || state.task.attachments.length > 0
		;(this.getUI('panel')![0] as HTMLElement).hidden = !active
		this.el.classList.toggle('is-inactive', !active)
		;(this.getUI('input')![0] as HTMLInputElement).disabled =
			!write || Boolean(state.write)
		;(this.getUI('upload')![0] as HTMLButtonElement).hidden = !write
		;(this.getUI('upload')![0] as HTMLButtonElement).disabled = Boolean(
			state.write,
		)
		const key = JSON.stringify([
			state.task.attachments,
			state.task.coverImageAttachmentId,
			write,
		])
		if (key === state.rowsKey) return
		state.rowsKey = key
		for (const read of state.thumbnails) read.abort()
		state.thumbnails.clear()
		for (const url of state.urls) URL.revokeObjectURL(url)
		state.urls.clear()
		render(
			html`${repeat(
				state.task.attachments,
				(a: IAttachment) => a.id,
				(a: IAttachment) => this.row(a),
			)}`,
			this.getUI('rows')![0] as HTMLElement,
		)
		const currentIDs = new Set<number>(
			state.task.attachments.map((a: IAttachment) => a.id),
		)
		for (const id of state.avatars) {
			if (!currentIDs.has(id)) {
				this.removeRegion(`avatar-${id}`)
				state.avatars.delete(id)
			}
		}
		for (const a of state.task.attachments) {
			const host = this.el.querySelector<HTMLElement>(
				`[data-thumbnail="${a.id}"]`,
			)
			if (host)
				render(
					listIcon(
						previewKind(a) === 'pdf'
							? 'file-pdf'
							: canPreviewAudio(a)
								? 'volume-high'
								: previewKind(a) === 'video'
									? 'play'
									: 'file',
					),
					host,
				)
			if (!state.avatars.has(a.id)) {
				this.addRegion(`avatar-${a.id}`, `[data-avatar="${a.id}"]`)
				this.showChildView(
					`avatar-${a.id}`,
					new EditorAvatarView({
						user: a.createdBy,
						size: 20,
						context: this.options.ports.editor,
					}),
				)
				state.avatars.add(a.id)
			}
			if (canPreviewImage(a) || canPreviewAudio(a)) void this.thumbnail(a)
		}
	},
	row(a: IAttachment) {
		return html`<div class="attachment">
			<div class="preview-column">
				<button
					class="preview-open"
					tabindex="-1"
					aria-hidden="true"
					@click=${() => void this.open(a)}
				>
					<div data-thumbnail=${a.id} class="icon-wrapper"></div>
				</button>
			</div>
			<div class="attachment-info-column">
				<button class="attachment-open" @click=${() => void this.open(a)}>
					<span class="filename"
						>${a.file.name}${this.getState().task.coverImageAttachmentId ===
						a.id
	? html`<span class="is-task-cover"
									>${t('task.attachment.usedAsCover')}</span
								>`
	: nothing}</span
					>
				</button>
				<p class="attachment-info-meta">
					<span
						class="user"
						title=${getDisplayName(a.createdBy)}
						style="--avatar-size:20px"
						><span class="avatar-wrapper" data-avatar=${a.id}></span></span
					><span>${getHumanSize(a.file.size)}</span>
				</p>
				<span data-audio=${a.id}></span>
				<p class="attachment-actions">
					<button
						class="base-button base-button--type-button attachment-info-meta-button"
						aria-label=${t('task.attachment.downloadTooltip')}
						@click=${() => void this.download(a)}
					>
						${listIcon('download')}</button
					><button
						class="base-button base-button--type-button attachment-info-meta-button"
						aria-label=${t('task.attachment.copyUrlTooltip')}
						@click=${() => void this.copy(a)}
					>
						${listIcon('copy')}</button
					>${this.canWrite()
		? html`<button
									class="base-button base-button--type-button attachment-info-meta-button"
									aria-label=${t('task.attachment.deleteTooltip')}
									@click=${() => this.confirmDelete(a)}
								>
									${listIcon('trash-alt')}</button
								>${canPreviewImage(a)
		? html`<button
											class="base-button base-button--type-button attachment-info-meta-button"
											aria-label=${t(
		this.getState().task.coverImageAttachmentId === a.id
			? 'task.attachment.unsetAsCover'
			: 'task.attachment.setAsCover',
	)}
											@click=${() => void this.cover(a)}
										>
											${listIcon('eye')}
										</button>`
		: nothing}`
		: nothing}
				</p>
			</div>
		</div>`
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = errorText(error)
		;(
			this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		)?.feedback(error)
	},
	async upload(files: File[]) {
		const state = this.getState()
		if (state.write || !this.canWrite()) return
		const taskId = state.task.id,
			request = (state.write = new AbortController())
		;(this.getUI('error')![0] as HTMLElement).hidden = true
		;(this.getUI('status')![0] as HTMLElement).textContent = t('misc.saving')
		state.progressTimer = setInterval(() => {
			const el = this.getUI('progress')![0] as HTMLProgressElement
			el.hidden = state.service.uploadProgress <= 0
			el.value = state.service.uploadProgress
		}, 100)
		this.publish()
		try {
			const uploaded = await uploadFiles(
				state.service,
				taskId,
				files,
				undefined,
				request.signal,
			)
			request.signal.throwIfAborted()
			this.options.record.acceptFields({
				attachments: [...this.options.record.task.attachments, ...uploaded],
			})
		} catch (error) {
			if (!request.signal.aborted) this.feedback(error)
		} finally {
			clearInterval(state.progressTimer)
			if (state.write === request) state.write = undefined
			if (!this.isDestroyed()) {
				;(this.getUI('status')![0] as HTMLElement).textContent = ''
				;(this.getUI('progress')![0] as HTMLElement).hidden = true
				this.publish()
			}
		}
	},
	async blob(a: IAttachment, request: AbortController, size?: PREVIEW_SIZE) {
		const url = await this.getState().service.getAttachmentBlobUrl(
			{ taskId: a.taskId, id: a.id },
			size,
			request.signal,
		)
		if (request.signal.aborted || this.isDestroyed()) {
			URL.revokeObjectURL(url)
			request.signal.throwIfAborted()
			throw new DOMException('View destroyed', 'AbortError')
		}
		return url
	},
	async thumbnail(a: IAttachment) {
		const state = this.getState(),
			request = new AbortController()
		state.thumbnails.add(request)
		try {
			const url = await this.blob(
				a,
				request,
				canPreviewImage(a) ? PREVIEW_SIZE.MD : undefined,
			)
			state.urls.add(url)
			const host = this.el.querySelector<HTMLElement>(
				`[${canPreviewAudio(a) ? 'data-audio' : 'data-thumbnail'}="${a.id}"]`,
			)
			if (host)
				render(
					canPreviewAudio(a)
						? html`<audio
								src=${url}
								controls
								aria-label=${a.file.name}
							></audio>`
						: html`<img
								src=${url}
								alt="Attachment preview"
								class="attachment-preview"
							/>`,
					host,
				)
		} catch {
			/* Same generic preview fallback as Vue. */
		} finally {
			state.thumbnails.delete(request)
		}
	},
	async download(a: IAttachment) {
		const request = new AbortController()
		this.getState().reads.add(request)
		try {
			downloadBlob(await this.blob(a, request), a.file.name)
		} catch (error) {
			if (!request.signal.aborted) this.feedback(error)
		} finally {
			this.getState().reads.delete(request)
		}
	},
	async copy(a: IAttachment) {
		try {
			await navigator.clipboard.writeText(generateAttachmentUrl(a.taskId, a.id))
			if (!this.isDestroyed()) success(t('misc.copied'))
		} catch (error) {
			if (!this.isDestroyed()) this.feedback(error)
		}
	},
	closePreview() {
		const state = this.getState()
		state.preview?.abort()
		state.preview = undefined
		this.getRegion('preview')!.empty()
		if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)
		state.previewUrl = undefined
	},
	async open(a: IAttachment) {
		if (canPreviewAudio(a)) {
			await this.el
				.querySelector<HTMLAudioElement>(`[data-audio="${a.id}"] audio`)
				?.play()
				.catch((error) => this.feedback(error))
			return
		}
		const kind = previewKind(a)
		if (!kind) {
			await this.download(a)
			return
		}
		this.closePreview()
		const state = this.getState(),
			request = (state.preview = new AbortController())
		if (kind === 'video')
			this.showChildView(
				'preview',
				new MediaPreviewView({
					kind,
					name: a.file.name,
					close: () => this.closePreview(),
				}),
			)
		try {
			const url = await this.blob(a, request)
			state.previewUrl = url
			if (kind === 'image')
				this.showChildView(
					'preview',
					new EditorLightboxView({
						url,
						alt: a.file.name,
						t,
						close: () => this.closePreview(),
					}),
				)
			else if (kind === 'video')
				(
					this.getChildView('preview') as InstanceType<typeof MediaPreviewView>
				).show(url)
			else
				this.showChildView(
					'preview',
					new MediaPreviewView({
						url,
						kind,
						name: a.file.name,
						close: () => this.closePreview(),
					}),
				)
		} catch (error) {
			if (!request.signal.aborted) {
				this.closePreview()
				this.feedback(error)
			}
		}
	},
	confirmDelete(a: IAttachment) {
		this.showChildView(
			'confirmation',
			new ConfirmationView({
				title: t('task.attachment.delete'),
				text: `${t('task.attachment.deleteText1', { filename: a.file.name })} ${t('misc.cannotBeUndone')}`,
				close: () => this.getRegion('confirmation')!.empty(),
				submit: () => void this.remove(a),
			}),
		)
	},
	async remove(a: IAttachment) {
		const state = this.getState()
		if (state.write || !this.canWrite()) return
		const attachment = new AttachmentModel({ id: a.id, taskId: state.task.id }),
			request = (state.write = new AbortController())
		;(
			this.getChildView('confirmation') as InstanceType<typeof ConfirmationView>
		).loading(true)
		try {
			await state.service.delete(attachment, request.signal)
			request.signal.throwIfAborted()
			const task = this.options.record.task
			this.options.record.acceptFields({
				attachments: task.attachments.filter(
					(item) => item.id !== attachment.id,
				),
				coverImageAttachmentId:
					task.coverImageAttachmentId === attachment.id
						? null
						: task.coverImageAttachmentId,
			})
			this.getRegion('confirmation')!.empty()
		} catch (error) {
			if (!request.signal.aborted) this.feedback(error)
		} finally {
			if (state.write === request) state.write = undefined
			if (!this.isDestroyed()) {
				;(
					this.getChildView('confirmation') as
						| InstanceType<typeof ConfirmationView>
						| undefined
				)?.loading(false)
				this.publish()
			}
		}
	},
	async cover(a: IAttachment) {
		if (!this.canWrite()) return
		const record = this.options.record,
			signal = this.getState().life.signal,
			coverImageAttachmentId =
				record.task.coverImageAttachmentId === a.id ? null : a.id
		try {
			await record.save({ coverImageAttachmentId }, signal)
			signal.throwIfAborted()
			success(t('task.attachment.successfullyChangedCoverImage'))
		} catch (error) {
			if (!signal.aborted) this.feedback(error)
		}
	},
	onBeforeDestroy() {
		const state = this.getState()
		state.life.abort()
		state.write?.abort()
		for (const request of [...state.reads, ...state.thumbnails]) request.abort()
		clearInterval(state.progressTimer)
		this.closePreview()
		for (const url of state.urls) URL.revokeObjectURL(url)
	},
}).setDomApi(LitDomApi)
