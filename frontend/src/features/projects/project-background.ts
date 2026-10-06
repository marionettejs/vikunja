import { View } from 'marionette'
import ProjectService from '@/services/project'
import type { IProject } from '@/modelTypes/IProject'
import { getBlobFromBlurHash } from '@/helpers/getBlobFromBlurHash'
import { errorText } from '../../shared/notifications'

export const ProjectBackgroundView = View.extend({
	initialize(options: { brightness: number | null }) {
		void options
	},
	className: 'app-container-background background-fade-in',
	template: false,
	createState() {
		return {
			key: '',
			request: undefined as AbortController | undefined,
			urls: [] as string[],
		}
	},
	onAttach() {
		this.setBrightness(this.options.brightness)
	},
	setBrightness(value: number | null) {
		this.options.brightness = value
		;(this.el as HTMLElement).style.filter = value ? `brightness(${value}%)` : ''
	},
	clear() {
		const state = this.getState()
		state.request?.abort()
		state.request = undefined
		for (const url of state.urls) URL.revokeObjectURL(url)
		state.urls = []
		;(this.el as HTMLElement).style.backgroundImage = ''
		this.el.classList.remove('is-visible')
		this.el.removeAttribute('data-error')
		const container = this.el.parentElement
		container?.classList.remove('has-background')
		if (container) container.style.backgroundImage = ''
	},
	async setProject(project: IProject | undefined) {
		const state = this.getState(),
			key = JSON.stringify([
				project?.id,
				project?.backgroundInformation,
				project?.backgroundBlurHash,
			])
		if (state.key === key) return
		state.key = key
		this.clear()
		if (!project?.backgroundInformation && !project?.backgroundBlurHash) return
		const request = (state.request = new AbortController()),
			container = this.el.parentElement
		container?.classList.add('has-background')
		try {
			const blur = await getBlobFromBlurHash(project.backgroundBlurHash)
			request.signal.throwIfAborted()
			if (blur) {
				const url = URL.createObjectURL(blur)
				state.urls.push(url)
				if (container) container.style.backgroundImage = `url(${url})`
			}
			if (!project.backgroundInformation) return
			const url = await new ProjectService().background(
				project,
				request.signal,
			)
			if (request.signal.aborted || this.isDestroyed()) {
				URL.revokeObjectURL(url)
				return
			}
			state.urls.push(url)
			;(this.el as HTMLElement).style.backgroundImage = `url(${url})`
			this.el.classList.add('is-visible')
		} catch (error) {
			if (!request.signal.aborted) {
				state.key = ''
				this.el.setAttribute('data-error', errorText(error))
			}
		}
	},
	onBeforeDestroy() {
		this.clear()
	},
})
