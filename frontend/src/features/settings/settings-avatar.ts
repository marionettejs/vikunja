import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import AvatarService from '@/services/avatar'
import AvatarModel from '@/models/avatar'
import UserModel, { invalidateAvatarCache } from '@/models/user'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import './settings-avatar.scss'
interface Options {
	user: UserModel;
	provider?: string;
	error?: unknown;
	authProvider: string;
	current: () => boolean;
}
export async function readAvatar(signal: AbortSignal) {
	const data = await new AvatarService().get(new AvatarModel({}), {}, signal)
	signal.throwIfAborted()
	return data.avatarProvider
}
const CropView = View.extend({
	initialize(options: {
		file: File;
		current: () => boolean;
		accepted: () => void;
	}) {
		void options
	},
	ui: { image: 'img', save: '[data-upload]', error: '[data-error]' },
	events: { 'click @ui.save': 'upload' },
	createState() {
		return {
			url: URL.createObjectURL(this.options.file),
			cropper: undefined as Cropper | undefined,
			request: undefined as AbortController | undefined,
			ready: false,
		}
	},
	templateContext() {
		return this.getState()
	},
	template({ url }: { url: string }) {
		return html`<div class="avatar-cropper mbe-4">
				<img src=${url} alt=${t('user.settings.avatar.title')} />
			</div>
			<div data-error class="message danger" role="alert" hidden></div>
			<button data-upload class="button is-primary" disabled>
				${t('user.settings.avatar.uploadAvatar')}
			</button>`
	},
	onAttach() {
		const state = this.getState()
		state.cropper = new Cropper(this.getUI('image')![0] as HTMLImageElement, {
			aspectRatio: 1,
			viewMode: 1,
			background: false,
			autoCropArea: 1,
			rotatable: false,
			scalable: false,
			ready: () => {
				if (this.isDestroyed()) return
				state.ready = true;
				(this.getUI('save')![0] as HTMLButtonElement).disabled = false
			},
		})
	},
	async upload() {
		const state = this.getState()
		if (!state.ready || state.request) return
		const canvas = state.cropper?.getCroppedCanvas()
		if (!canvas) return
		const request = (state.request = new AbortController()),
			button = this.getUI('save')![0] as HTMLButtonElement
		button.disabled = true
		button.classList.add('is-loading')
		try {
			const blob = await new Promise<Blob>((resolve, reject) =>
				canvas.toBlob((value) =>
					value ? resolve(value) : reject(new Error(t('misc.error'))),
				),
			)
			request.signal.throwIfAborted()
			await new AvatarService().uploadAvatar(blob, request.signal)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || !this.options.current()) return
			this.options.accepted()
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			) {
				const el = this.getUI('error')![0] as HTMLElement
				el.textContent = errorText(error)
				el.hidden = false
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				button.disabled = false
				button.classList.remove('is-loading')
			}
		}
	},
	disposeCropper() {
		this.getState().cropper?.destroy()
		this.getState().cropper = undefined
	},
	onDomRemove() {
		this.disposeCropper()
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.disposeCropper()
		URL.revokeObjectURL(this.getState().url)
	},
}).setDomApi(LitDomApi)
export const AvatarSettingsView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'native-avatar-settings',
	regions: { crop: '[data-crop]' },
	ui: {
		providers: '[name=avatarProvider]',
		controls: '[data-controls]',
		external: '[data-external]',
		save: '[data-save]',
		upload: '[data-upload]',
		file: '[data-file]',
		error: '[data-error]',
		retry: '[data-retry]',
	},
	events: {
		'change @ui.providers': 'choose',
		'click @ui.save': 'save',
		'click @ui.upload': 'pick',
		'change @ui.file': 'fileSelected',
		'click @ui.retry': 'retry',
	},
	createState() {
		return {
			read: undefined as AbortController | undefined,
			write: undefined as AbortController | undefined,
			provider: this.options.provider ?? '',
			file: undefined as File | undefined,
		}
	},
	template() {
		return html`<div class="card">
			<header class="card-header">
				<p class="card-header-title">${t('user.settings.avatar.title')}</p>
			</header>
			<div class="card-content">
				<div data-error role="alert" class="message danger" hidden></div>
				<button data-retry class="button is-outlined" hidden>
					${t('sharing.retry')}
				</button>
				<div data-external class="message info" hidden></div>
				<div data-controls>
					<div class="control mbe-4">
						${['default', 'initials', 'gravatar', 'marble', 'upload'].map(
		(provider) =>
			html`<label class="radio"
									><input
										name="avatarProvider"
										type="radio"
										value=${provider}
									/>${t(
		provider === 'default'
			? 'misc.default'
			: `user.settings.avatar.${provider}`,
	)}</label
								>`,
	)}
					</div>
					<input
						data-file
						type="file"
						accept="image/*"
						class="is-hidden"
					/><button data-upload class="button is-primary" hidden>
						${t('user.settings.avatar.uploadAvatar')}
					</button>
					<div data-crop></div>
					<button data-save class="button is-primary is-fullwidth mbs-2">
						${t('misc.save')}
					</button>
				</div>
			</div>
		</div>`
	},
	onRender() {
		this.publish()
		if (this.options.error) this.feedback(this.options.error, true)
	},
	publish() {
		const provider = this.getState().provider,
			external = ['ldap', 'openid'].includes(provider);
		(this.getUI('controls')![0] as HTMLElement).hidden = external
		const message = this.getUI('external')![0] as HTMLElement
		message.hidden = !external
		message.textContent = external
			? t(`user.settings.avatar.${provider}`, {
				provider: this.options.authProvider,
			})
			: ''
		for (const input of Array.from(
			this.getUI('providers') ?? [],
		) as HTMLInputElement[])
			input.checked = input.value === provider;
		(this.getUI('save')![0] as HTMLElement).hidden = provider === 'upload';
		(this.getUI('upload')![0] as HTMLElement).hidden =
			provider !== 'upload' || !!this.getChildView('crop')
	},
	choose(event: Event) {
		this.getState().provider = (event.target as HTMLInputElement).value
		this.getRegion('crop')!.empty()
		if (this.getState().provider === 'upload' && this.getState().file)
			this.showCrop(this.getState().file!)
		this.publish()
	},
	pick() {
		(this.getUI('file')![0] as HTMLInputElement).click()
	},
	fileSelected() {
		const input = this.getUI('file')![0] as HTMLInputElement,
			file = input.files?.[0]
		input.value = ''
		if (!file) return
		this.getState().file = file
		this.showCrop(file)
		this.publish()
	},
	showCrop(file: File) {
		this.showChildView(
			'crop',
			new CropView({
				file,
				current: this.options.current,
				accepted: () => {
					this.getState().file = undefined
					invalidateAvatarCache(this.options.user)
					success(t('user.settings.avatar.setSuccess'))
					this.getRegion('crop')!.empty()
					this.publish();
					(this.getUI('upload')![0] as HTMLButtonElement).focus()
				},
			}),
		)
		this.publish()
	},
	feedback(error: unknown, retry = false) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = errorText(error)
		el.hidden = false;
		(this.getUI('retry')![0] as HTMLElement).hidden = !retry
	},
	async retry() {
		const state = this.getState()
		state.read?.abort()
		const request = (state.read = new AbortController()),
			draft = state.provider
		try {
			const provider = await readAvatar(request.signal)
			if (this.isDestroyed() || !this.options.current()) return
			if (state.provider === draft) state.provider = provider
			this.publish();
			(this.getUI('error')![0] as HTMLElement).hidden = true;
			(this.getUI('retry')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			)
				this.feedback(error, true)
		}
	},
	async save() {
		const state = this.getState()
		if (state.write) return
		const request = (state.write = new AbortController()),
			provider = state.provider,
			button = this.getUI('save')![0] as HTMLButtonElement
		button.disabled = true
		button.classList.add('is-loading')
		try {
			await new AvatarService().update(
				new AvatarModel({ avatarProvider: provider }),
				request.signal,
			)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || !this.options.current()) return
			invalidateAvatarCache(this.options.user)
			success(t('user.settings.avatar.statusUpdateSuccess'));
			(this.getUI('error')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			)
				this.feedback(error)
		} finally {
			if (state.write === request) state.write = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				button.disabled = false
				button.classList.remove('is-loading')
			}
		}
	},
	onBeforeDestroy() {
		this.getState().read?.abort()
		this.getState().write?.abort()
	},
}).setDomApi(LitDomApi)
