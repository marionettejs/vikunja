import { SettingsSearchView, type SettingsChoice } from '../features/settings/settings-search'
export const RemoteSearchView = SettingsSearchView.extend({
	initialize(options: {
		id: string;
		label: string;
		placeholder: string;
		items: SettingsChoice[];
		selected?: string | number | null;
		changed: (value: string | number | null) => void;
		search: (query: string, signal: AbortSignal) => Promise<SettingsChoice[]>;
		error: (error: unknown) => void;
	}) {
		void options
	},
	createState() {
		return {
			...SettingsSearchView.prototype.createState.call(this),
			request: undefined as AbortController | undefined,
		}
	},
	filtered() {
		return this.options.items
	},
	async search() {
		SettingsSearchView.prototype.search.call(this)
		const state = this.getState(),
			query = (this.getUI('input')![0] as HTMLInputElement).value
		state.request?.abort()
		const request = new AbortController()
		state.request = request
		this.options.items = []
		this.publish()
		this.el.setAttribute('aria-busy', 'true')
		try {
			const rows = await this.options.search(query, request.signal)
			request.signal.throwIfAborted()
			if (this.isDestroyed() || state.request !== request) return
			this.options.items = rows
			this.publish()
		} catch (error) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				state.request === request
			)
				this.options.error(error)
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed())
				this.el.setAttribute('aria-busy', 'false')
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		SettingsSearchView.prototype.onBeforeDestroy.call(this)
	},
})
