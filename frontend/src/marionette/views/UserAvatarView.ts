import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'
import {fetchAvatarBlobUrl, onAvatarInvalidated} from '@/helpers/avatarCache'

export interface UserAvatarViewOptions {
	username: string
	size?: number
	/** Empty by default: an avatar next to a visible name is decorative. */
	alt?: string
}

export interface UserAvatarViewInstance extends ViewInstance {
	setUser(username: string): void
}

interface UserAvatarViewContext extends ViewInstance {
	_username: string
	_src: string | undefined
	_fetchToken: number
	_stopListening: (() => void) | null
	_options(): UserAvatarViewOptions
	_size(): number
	_load(): Promise<void>
}

const DEFAULT_SIZE = 50

export const UserAvatarView = View.extend({
	className: 'mn-user-avatar',

	_username: '',
	_src: undefined as string | undefined,
	_fetchToken: 0,
	_stopListening: null as (() => void) | null,

	template(data: {src: string | undefined, size: number, alt: string}) {
		if (!data.src) {
			return html`<span
				class="user-avatar-placeholder"
				style=${`--user-avatar-size: ${data.size}px`}
				aria-hidden="true"
			></span>`
		}

		return html`<img
			src=${data.src}
			alt=${data.alt}
			width=${data.size}
			height=${data.size}
		>`
	},

	templateContext(this: UserAvatarViewContext) {
		return {
			src: this._src,
			size: this._size(),
			alt: this._options().alt ?? '',
		}
	},

	initialize(this: UserAvatarViewContext) {
		this._username = this._options().username
		this._stopListening = onAvatarInvalidated(username => {
			if (username === this._username) {
				void this._load()
			}
		})
	},

	onRender(this: UserAvatarViewContext) {
		if (this._src === undefined && this._fetchToken === 0) {
			void this._load()
		}
	},

	onBeforeDestroy(this: UserAvatarViewContext) {
		this._stopListening?.()
		this._stopListening = null
		// Any fetch still in flight resolves into a destroyed view; invalidate it.
		this._fetchToken += 1
	},

	setUser(this: UserAvatarViewContext, username: string) {
		if (username === this._username) {
			return
		}
		this._username = username
		void this._load()
	},

	_options(this: UserAvatarViewContext): UserAvatarViewOptions {
		return this.options as unknown as UserAvatarViewOptions
	},

	_size(this: UserAvatarViewContext): number {
		return this._options().size ?? DEFAULT_SIZE
	},

	async _load(this: UserAvatarViewContext) {
		const token = ++this._fetchToken
		// Back to the placeholder first: the url being replaced may be revoked a frame from now,
		// and a failed fetch must not leave the previous user's face on screen.
		this._src = undefined
		if (this.isRendered()) {
			this.render()
		}

		if (!this._username) {
			return
		}

		let url: string | undefined
		try {
			url = await fetchAvatarBlobUrl({username: this._username}, this._size())
		} catch {
			// A missing avatar is not worth a user-visible error.
			return
		}

		if (token !== this._fetchToken || this.isDestroyed()) {
			return
		}

		this._src = url
		if (this.isRendered()) {
			this.render()
		}
	},
}) as new (options: UserAvatarViewOptions) => UserAvatarViewInstance
