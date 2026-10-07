import './project-background-management.scss'
import { View, CollectionView } from 'marionette'
import { Collection, DataApi, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import BackgroundUploadService from '@/services/backgroundUpload'
import BackgroundUnsplashService from '@/services/backgroundUnsplash'
import BackgroundImageModel from '@/models/backgroundImage'
import ProjectService from '@/services/project'
import type { IProject } from '@/modelTypes/IProject'
import type { IBackgroundImage } from '@/modelTypes/IBackgroundImage'
import { getBlobFromBlurHash } from '@/helpers/getBlobFromBlurHash'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
interface Options {
	project: IProject;
	providers: string[];
	commit: (project: IProject) => void;
	close: () => void;
}
const PhotoView = View.extend({
	initialize(options: {
		model: Model;
		choose: (photo: IBackgroundImage) => void;
	}) {
		void options
	},
	tagName: 'li',
	className: 'image-search__result-item',
	ui: { image: 'img', button: '[data-select]', error: '[data-error]' },
	events: { 'click @ui.button': 'choose' },
	createState() {
		return { request: new AbortController(), urls: [] as string[] }
	},
	templateContext() {
		return { photo: this.options.model.get('photo') as IBackgroundImage }
	},
	template({ photo }: { photo: IBackgroundImage }) {
		return html`<button
				type="button"
				data-select
				class="base-button base-button--type-button image-search__image-button"
				aria-label=${photo.info.authorName}
			>
				<img class="image-search__image" alt="" /></button
			><a
				class="image-search__info"
				href=${`https://unsplash.com/@${encodeURIComponent(photo.info.author ?? '')}?utm_source=vikunja&utm_medium=referral`}
				target="_blank"
				rel="noopener noreferrer"
				>${photo.info.authorName}</a
			><span data-error hidden></span>`
	},
	async onAttach() {
		const state = this.getState(),
			photo = this.options.model.get('photo') as IBackgroundImage
		try {
			const blur = await getBlobFromBlurHash(photo.blurHash)
			state.request.signal.throwIfAborted()
			if (blur) {
				const url = URL.createObjectURL(blur)
				state.urls.push(url)
				;(this.el as HTMLElement).style.backgroundImage = `url(${url})`
			}
			const url = await new BackgroundUnsplashService().thumb(
				photo,
				state.request.signal,
			)
			if (state.request.signal.aborted) {
				URL.revokeObjectURL(url)
				return
			}
			state.urls.push(url);
			(this.getUI('image')![0] as HTMLImageElement).src = url
		} catch (error) {
			if (!state.request.signal.aborted) {
				const el = this.getUI('error')![0] as HTMLElement
				el.hidden = false
				el.textContent = errorText(error)
			}
		}
	},
	choose() {
		this.options.choose(this.options.model.get('photo') as IBackgroundImage)
	},
	onBeforeDestroy() {
		this.getState().request.abort()
		for (const url of this.getState().urls) URL.revokeObjectURL(url)
	},
}).setDomApi(LitDomApi).setDataApi(DataApi)
const PhotosView = CollectionView.extend({
	tagName: 'ul',
	className: 'image-search__result-list',
	childView: PhotoView,
}).setDataApi(DataApi)
export const ProjectBackgroundDialogView = View.extend({
	initialize(options: Options) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog default native-project-background native-project-dialog native-list-surface',
	regions: { photos: '[data-photos]' },
	ui: {
		upload: '[data-upload]',
		file: '[data-file]',
		search: '[data-search]',
		more: '[data-more]',
		remove: '[data-remove]',
		error: '[data-error]',
	},
	events: {
		'click @ui.upload': 'chooseFile',
		'change @ui.file': 'upload',
		'input @ui.search': 'searchChanged',
		'click @ui.more': 'more',
		'click @ui.remove': 'remove',
		'click [data-close]': 'close',
		cancel: 'close',
	},
	createState() {
		return {
			project: this.options.project,
			collection: (new Collection() as Collection<Model>),
			search: undefined as AbortController | undefined,
			write: undefined as AbortController | undefined,
			timer: undefined as ReturnType<typeof setTimeout> | undefined,
			page: 0,
			focus: document.activeElement as HTMLElement | null,
		}
	},
	templateContext() {
		return this.options
	},
	template({ project, providers }: Options) {
		const writable = Number(project.maxPermission) > 0
		return html`<div class="modal-container">
			<div class="modal-content is-wide">
				<div class="card">
					<header class="card-header">
						<h2 class="card-header-title">${t('project.background.title')}</h2>
						<button
							type="button"
							data-close
							class="base-button base-button--type-button card-header-icon"
							aria-label=${t('misc.closeDialog')}
						>
							${listIcon('times')}
						</button>
					</header>
					<div class="card-content">
						<div data-error class="message danger" role="alert" hidden></div>
						${providers.includes('upload') && writable
		? html`<input
										data-file
										type="file"
										accept="image/*"
										hidden
									/><button
										data-upload
										type="button"
										class="button is-primary mbe-4"
									>
										${t('project.background.upload')}
									</button>`
		: nothing}
						${providers.includes('unsplash')
		? html`<input
										data-search
										class="input is-expanded"
										type="text"
										placeholder=${t('project.background.searchPlaceholder')}
									/>
									<p class="unsplash-credit">
										<a
											href="https://unsplash.com"
											target="_blank"
											rel="noopener noreferrer"
											>${t('project.background.poweredByUnsplash')}</a
										>
									</p>
									<div data-photos></div>
									<button
										type="button"
										data-more
										class="button is-load-more-button mbs-4"
										hidden
									>
										${t('project.background.loadMore')}
									</button>`
		: nothing}
					</div>
					<footer class="card-footer">
						<button
							type="button"
							class="button is-danger"
							data-remove
							?hidden=${!project.backgroundInformation || !writable}
						>
							${t('project.background.remove')}</button
						><button type="button" data-close class="button is-outlined">
							${t('misc.close')}
						</button>
					</footer>
				</div>
			</div>
		</div>`
	},
	onRender() {
		if (this.options.providers.includes('unsplash'))
			this.showChildView(
				'photos',
				new PhotosView({
					collection: this.getState().collection,
					childViewOptions: () => ({
						choose: (photo: IBackgroundImage) =>
							void this.write('unsplash', photo),
					}),
				}),
			)
	},
	onAttach() {
		(this.el as HTMLDialogElement).showModal()
		if (this.options.providers.includes('unsplash')) void this.search(1)
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = false
		el.textContent = errorText(error)
	},
	chooseFile() {
		(this.getUI('file')![0] as HTMLInputElement).click()
	},
	upload() {
		const file = (this.getUI('file')![0] as HTMLInputElement).files?.[0]
		if (file) void this.write('upload', file)
	},
	remove() {
		void this.write('remove')
	},
	searchChanged() {
		const state = this.getState()
		state.search?.abort()
		clearTimeout(state.timer)
		state.timer = setTimeout(() => void this.search(1), 300)
	},
	more() {
		void this.search(this.getState().page + 1)
	},
	async search(page: number) {
		const state = this.getState()
		state.search?.abort()
		const request = (state.search = new AbortController()),
			query = (this.getUI('search')![0] as HTMLInputElement).value
		if (page === 1) state.collection.reset([]);
		(this.getUI('more')![0] as HTMLButtonElement).disabled = true
		this.el.setAttribute('data-search-busy', 'true')
		try {
			const photos = await new BackgroundUnsplashService().getAll(
				undefined,
				{ s: query, p: page },
				page,
				request.signal,
			)
			request.signal.throwIfAborted()
			state.page = page
			state.collection.add(photos.map((photo) => ({ id: photo.id, photo })));
			(this.getUI('more')![0] as HTMLElement).hidden = !state.collection.length
		} catch (error) {
			if (!request.signal.aborted) this.feedback(error)
		} finally {
			if (state.search === request && !request.signal.aborted) {
				(this.getUI('more')![0] as HTMLButtonElement).disabled = false
				this.el.setAttribute('data-search-busy', 'false')
			}
		}
	},
	async write(kind: string, input?: File | IBackgroundImage) {
		const state = this.getState()
		if (state.write || Number(state.project.maxPermission) <= 0) return
		const request = (state.write = new AbortController()),
			project = state.project
		this.el.setAttribute('aria-busy', 'true')
		for (const name of ['upload', 'remove']) {
			const button = this.getUI(name)?.[0] as HTMLButtonElement | undefined
			if (button) button.disabled = true
		}
		try {
			const updated =
				kind === 'upload'
					? await new BackgroundUploadService().upload(
						project.id,
							input as File,
							request.signal,
					)
					: kind === 'remove'
						? await new ProjectService().removeBackground(
							project,
							request.signal,
						)
						: ((await new BackgroundUnsplashService().update(
							Object.assign(new BackgroundImageModel({}), {
								id: (input as IBackgroundImage).id,
								projectId: project.id,
							}),
							request.signal,
						)) as unknown as IProject)
			request.signal.throwIfAborted()
			updated.maxPermission = project.maxPermission
			state.project = updated;
			(this.getUI('error')![0] as HTMLElement).hidden = true
			this.options.commit(updated);
			(this.getUI('remove')![0] as HTMLElement).hidden =
				!updated.backgroundInformation
			success(
				t(
					kind === 'remove'
						? 'project.background.removeSuccess'
						: 'project.background.success',
				),
			)
			if (kind === 'remove') this.options.close()
		} catch (error) {
			if (!request.signal.aborted) this.feedback(error)
		} finally {
			if (state.write === request) state.write = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				this.el.setAttribute('aria-busy', 'false')
				for (const name of ['upload', 'remove']) {
					const button = this.getUI(name)?.[0] as HTMLButtonElement | undefined
					if (button) button.disabled = false
				}
			}
		}
	},
	close(event: Event) {
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		const state = this.getState()
		state.search?.abort()
		state.write?.abort()
		clearTimeout(state.timer);
		(this.el as HTMLDialogElement).close()
		if (state.focus?.isConnected) state.focus.focus({ preventScroll: true })
	},
}).setDomApi(LitDomApi)
