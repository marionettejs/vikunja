import { View, CollectionView } from 'marionette'
import { Collection, DataApi, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import BotUserService from '@/services/botUser'
import ApiTokenService from '@/services/apiToken'
import UserModel from '@/models/user'
import type { IUser } from '@/modelTypes/IUser'
import type { IApiToken } from '@/modelTypes/IApiToken'
import type { PermissionRoutes } from './settings-security-data'
import { TokenEditorView } from './settings-token-editor'
import { ConfirmationView } from '../projects/project-sharing'
import { displayDate } from '../../shared/dates'
import {listIcon} from '@/shared/task-list/list-ui'
import { t } from '../../shared/i18n'
import { errorText } from '../../shared/notifications'
type BotRecord = IUser & { status: number };
export interface BotData {
	bots?: BotRecord[];
	tokens?: Record<number, IApiToken[]>;
	routes?: PermissionRoutes;
	error?: unknown;
}
export async function readBots(signal: AbortSignal): Promise<BotData> {
	const [bots, routes] = await Promise.all([
		new BotUserService().getAll(undefined, {}, 1, signal),
		new ApiTokenService().getAvailableRoutes(signal),
	])
	const tokens: Record<number, IApiToken[]> = {}
	for (const bot of bots) {
		tokens[bot.id] = await new ApiTokenService().getAll(
			undefined,
			{ owner_id: bot.id },
			1,
			signal,
		)
	}
	signal.throwIfAborted()
	return { bots: bots as BotRecord[], tokens, routes }
}
interface RowOptions {
	model: Model;
	tokens: IApiToken[];
	routes: PermissionRoutes;
	user: UserModel;
	current: () => boolean;
	remove: (id: number) => void;
}
const TokenRowView = View.extend({
	initialize(options: {
		model: Model;
		user: UserModel;
		remove: (token: IApiToken) => void;
	}) {
		void options
	},
	tagName: 'tr',
	ui: { remove: '[data-delete]' },
	events: { 'click @ui.remove': 'remove' },
	templateContext() {
		return {
			token: this.options.model.get('record') as IApiToken,
			user: this.options.user,
		}
	},
	template({ token, user }: { token: IApiToken; user: UserModel }) {
		return html`<td>${token.title}</td>
			<td>${displayDate(token.expiresAt, user.settings.frontendSettings)}</td>
			<td>${displayDate(token.created, user.settings.frontendSettings)}</td>
			<td>
				<button data-delete class="button is-outlined">
					${t('misc.delete')}
				</button>
			</td>`
	},
	remove() {
		this.options.remove(this.options.model.get('record') as IApiToken)
	},
}).setDomApi(LitDomApi)
const TokenRowsView = CollectionView.extend({
	tagName: 'tbody',
	childView: TokenRowView,
}).setDataApi(DataApi)
const BotRowView = View.extend({
	initialize(options: RowOptions) {
		void options
	},
	className: 'bot-card',
	regions: {
		tokens: { el: '[data-tokens]', replaceElement: true },
		editor: '[data-editor]',
		confirmation: '[data-confirmation]',
	},
	ui: {
		nameText: '[data-name-text]',
		name: '[data-name]',
		nameEdit: '[data-name-edit]',
		edit: '[data-edit]',
		save: '[data-bot-name-save]',
		cancel: '[data-bot-name-cancel]',
		status: '[data-status]',
		toggle: '[data-toggle]',
		remove: '[data-bot-delete]',
		createToken: '[data-create-token]',
		table: '[data-table]',
		secret: '[data-secret]',
		secretToken: '[data-secret-token]',
		error: '[data-error]',
		actions: '[data-actions] button',
	},
	events: {
		'click @ui.edit': 'edit',
		'click @ui.save': 'saveName',
		'click @ui.cancel': 'cancelName',
		'keydown @ui.name': 'nameKey',
		'click @ui.toggle': 'toggle',
		'click @ui.remove': 'remove',
		'click @ui.createToken': 'createToken',
	},
	createState() {
		return {
			bot: this.options.model.get('record') as BotRecord,
			tokens: (new Collection(
				(this.options.tokens ?? []).map((record: IApiToken) => ({
					id: record.id,
					record,
				})),
			) as Collection<Model>),
			request: undefined as AbortController | undefined,
		}
	},
	templateContext() {
		return this.getState()
	},
	template({ bot }: { bot: BotRecord }) {
		return html`<div
				data-error
				class="message danger"
				role="alert"
				hidden
			></div>
			<div class="bot-header">
				<strong>${bot.username}</strong
				><span data-name-text
					>${bot.name ? `— ${bot.name}` : t('project.share.links.noName')}</span
				><button data-edit type="button" class="button is-text">
					<span class="icon is-small">${listIcon('pencil-alt')}</span><span>${t('menu.edit')}</span></button
				><span data-name-edit hidden
					>—
					<input
						data-name
						class="input bot-name-input"
						aria-label=${t('admin.users.nameLabel')}
						placeholder=${t('user.settings.bots.namePlaceholder')}
					/><button data-bot-name-save type="button" class="button is-outlined">
						${t('misc.save')}</button
					><button data-bot-name-cancel type="button" class="button is-text">
						${t('misc.cancel')}
					</button></span
				><span class="status" data-status></span>
			</div>
			<div class="bot-actions" data-actions>
				<button data-toggle class="button is-outlined"></button
				><button data-bot-delete class="button is-text is-danger">
					${t('misc.delete')}
				</button>
			</div>
			<div class="tokens">
				<h4>${t('user.settings.apiTokens.title')}</h4>
				<div data-secret class="message-wrapper" hidden><div class="message warning">${t('user.settings.apiTokens.tokenCreatedNotSeeAgain')}<br/><code data-secret-token></code></div></div>
				<div class="has-horizontal-overflow">
					<table data-table class="table" hidden>
						<thead>
							<tr>
								${[
		'user.settings.apiTokens.attributes.title',
		'user.settings.apiTokens.attributes.expiresAt',
		'misc.created',
		'misc.actions',
	].map((key) => html`<th>${t(key)}</th>`)}
							</tr>
						</thead>
						<tbody data-tokens></tbody>
					</table>
				</div>
				<div data-editor></div>
				<button data-create-token class="button is-primary mbe-4">
					<span class="icon is-small">${listIcon('plus')}</span><span>${t('user.settings.apiTokens.createToken')}</span>
				</button>
			</div>
			<div data-confirmation></div>`
	},
	onRender() {
		this.showChildView(
			'tokens',
			new TokenRowsView({
				collection: this.getState().tokens,
				childViewOptions: () => ({
					user: this.options.user,
					remove: (token: IApiToken) => void this.write('token-delete', token),
				}),
			}),
		)
		this.publishBot()
		this.tokenCount()
	},
	publishBot() {
		const bot = this.getState().bot;
		(this.getUI('nameText')![0] as HTMLElement).textContent = bot.name
			? `— ${bot.name}`
			: t('project.share.links.noName');
		(this.getUI('status')![0] as HTMLElement).textContent = t(
			bot.status === 0
				? 'admin.users.statusActive'
				: 'admin.users.statusDisabled',
		);
		(this.getUI('toggle')![0] as HTMLElement).textContent = t(
			bot.status === 0 ? 'misc.disable' : 'user.settings.bots.enable',
		)
	},
	tokenCount() {
		(this.getUI('table')![0] as HTMLElement).hidden =
			!this.getState().tokens.length;
		(this.getUI('createToken')![0] as HTMLElement).hidden =
			!!this.getChildView('editor')
	},
	edit() {
		(this.getUI('nameText')![0] as HTMLElement).hidden = true;
		(this.getUI('edit')![0] as HTMLElement).hidden = true;
		(this.getUI('nameEdit')![0] as HTMLElement).hidden = false
		const input = this.getUI('name')![0] as HTMLInputElement
		input.value = this.getState().bot.name ?? ''
		input.focus()
	},
	cancelName() {
		(this.getUI('nameText')![0] as HTMLElement).hidden = false;
		(this.getUI('edit')![0] as HTMLElement).hidden = false;
		(this.getUI('nameEdit')![0] as HTMLElement).hidden = true;
		(this.getUI('edit')![0] as HTMLElement).focus()
	},
	nameKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault()
			this.cancelName()
		} else if (event.key === 'Enter') {
			event.preventDefault()
			this.saveName()
		}
	},
	saveName() {
		void this.write('name')
	},
	toggle() {
		void this.write('toggle')
	},
	createToken() {
		this.showChildView(
			'editor',
			new TokenEditorView({
				routes: this.options.routes,
				title: '',
				scopes: '',
				settings: this.options.user.settings,
				submit: (
					token: IApiToken,
					editor: InstanceType<typeof TokenEditorView>,
				) =>
					void this.write(
						'token-create',
						{ ...token, ownerId: this.getState().bot.id },
						editor,
					),
				cancel: () => this.closeToken(),
			}),
		)
		this.tokenCount()
	},
	closeToken() {
		this.getRegion('editor')!.empty()
		this.tokenCount();
		(this.getUI('createToken')![0] as HTMLElement).focus()
	},
	remove() {
		if (this.getState().request) return
		const bot = this.getState().bot
		this.showChildView(
			'confirmation',
			new ConfirmationView({
				title: t('user.settings.bots.delete.header'),
				text: `${t('user.settings.bots.delete.text1', { username: bot.username })}\n${t('user.settings.bots.delete.text2')}`,
				close: () => this.getRegion('confirmation')!.empty(),
				submit: () => void this.write('delete'),
			}),
		)
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = errorText(error)
		el.hidden = false;
		(
			this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		)?.feedback(errorText(error))
	},
	async write(
		kind: string,
		token?: IApiToken,
		editor?: InstanceType<typeof TokenEditorView>,
	) {
		const state = this.getState()
		if (state.request) return
		const request = (state.request = new AbortController()),
			bot = state.bot,
			input = this.getUI('name')![0] as HTMLInputElement,
			name = input.value,
			signature = editor?.draftSignature(),
			confirmation = this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		editor?.loading(true)
		confirmation?.loading(true)
		for (const button of Array.from(
			this.getUI('actions') ?? [],
		) as HTMLButtonElement[])
			button.disabled = true;
		(this.getUI('save')![0] as HTMLButtonElement).disabled = true
		try {
			if (kind === 'token-create') {
				const accepted = await new ApiTokenService().create(
					token!,
					request.signal,
				)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.tokens.add({ id: accepted.id, record: accepted })
				const secret = this.getUI('secret')![0] as HTMLElement
				;(this.getUI('secretToken')![0] as HTMLElement).textContent = accepted.token
				secret.hidden = false
				if (editor && !editor.isDestroyed()) {
					editor.feedback('')
					if (editor.draftSignature() === signature) this.closeToken()
				}
				this.tokenCount()
			} else if (kind === 'token-delete') {
				await new ApiTokenService().delete(token!, request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.tokens.remove(token!.id)
				this.tokenCount()
			} else if (kind === 'delete') {
				await new BotUserService().delete(bot, request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				this.options.remove(bot.id)
				return
			} else {
				const result = await new BotUserService().update(
					new UserModel({
						...bot,
						...(kind === 'name'
							? { name: name.trim() }
							: { status: bot.status === 0 ? 2 : 0 }),
					}),
					request.signal,
				)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.bot = result as BotRecord
				this.options.model.set('record', result)
				this.publishBot()
				if (kind === 'name' && input.value === name) this.cancelName()
			}
			(this.getUI('error')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				this.options.current() &&
				!this.isDestroyed()
			) {
				if (editor && !editor.isDestroyed()) editor.feedback(errorText(error))
				else this.feedback(error)
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				for (const button of Array.from(
					this.getUI('actions') ?? [],
				) as HTMLButtonElement[])
					button.disabled = false;
				(this.getUI('save')![0] as HTMLButtonElement).disabled = false
				if (editor && !editor.isDestroyed()) editor.loading(false)
				if (confirmation && !confirmation.isDestroyed())
					confirmation.loading(false)
			}
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
	},
}).setDomApi(LitDomApi)
const BotRowsView = CollectionView.extend({ childView: BotRowView }).setDataApi(
	DataApi,
)
interface Options {
	data: BotData;
	user: UserModel;
	current: () => boolean;
}
export const BotsSettingsView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'content native-bots',
	regions: { bots: '[data-bots]' },
	ui: {
		form: '[data-bot-create-form]',
		username: '#newBotUsername',
		name: '#newBotName',
		create: '[data-create]',
		show: '[data-show]',
		error: '[data-error]',
		retry: '[data-retry]',
	},
	events: {
		'submit @ui.form': 'create',
		'click @ui.show': 'showForm',
		'click @ui.retry': 'retry',
	},
	createState() {
		return {
			data: this.options.data as BotData,
			bots: (new Collection() as Collection<Model>),
			request: undefined as AbortController | undefined,
			read: undefined as AbortController | undefined,
		}
	},
	template() {
		return html`<h2>${t('user.settings.bots.title')}</h2>
			<p>${t('user.settings.bots.description')}</p>
			<div data-error class="message danger" role="alert" hidden></div>
			<button data-retry class="button is-outlined" hidden>
				${t('sharing.retry')}
			</button>
			<form data-bot-create-form class="create-form" novalidate>
				<div class="field">
					<label class="label" for="newBotUsername"
						>${t('user.auth.username')}</label
					><input
						id="newBotUsername"
						class="input"
						placeholder="bot-myassistant"
					/>
				</div>
				<div class="field">
					<label class="label" for="newBotName"
						>${t('admin.users.nameLabel')}</label
					><input
						id="newBotName"
						class="input"
						placeholder=${t('user.settings.bots.namePlaceholder')}
					/>
				</div>
				<button data-create class="button is-primary" type="submit">
					<span class="icon is-small">${listIcon('plus')}</span><span>${t('user.settings.bots.create')}</span>
				</button>
			</form>
			<button data-show class="button is-primary mbe-4" hidden>
				<span class="icon is-small">${listIcon('plus')}</span><span>${t('user.settings.bots.create')}</span>
			</button>
			<div data-bots></div>`
	},
	onRender() {
		this.showChildView(
			'bots',
			new BotRowsView({
				collection: this.getState().bots,
				childViewOptions: (model: Model) => ({
					tokens: this.getState().data.tokens?.[Number(model.get('id'))] ?? [],
					routes: this.getState().data.routes ?? {},
					user: this.options.user,
					current: this.options.current,
					remove: (id: number) => {
						this.getState().bots.remove(id)
						if (!this.getState().bots.length) this.showForm()
					},
				}),
			}),
		)
		if (this.options.data.error) this.feedback(this.options.data.error, true)
		else this.applyData(this.options.data)
	},
	applyData(data: BotData) {
		this.getState().data = data
		this.getState().bots.reset(
			(data.bots ?? []).map((record) => ({ id: record.id, record })),
		);
		(this.getUI('form')![0] as HTMLElement).hidden = !!data.bots?.length;
		(this.getUI('show')![0] as HTMLElement).hidden = !data.bots?.length
	},
	showForm() {
		(this.getUI('form')![0] as HTMLElement).hidden = false;
		(this.getUI('show')![0] as HTMLElement).hidden = true;
		(this.getUI('username')![0] as HTMLElement).focus()
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
		const request = (state.read = new AbortController())
		try {
			const data = await readBots(request.signal)
			if (!this.options.current() || this.isDestroyed()) return
			this.applyData(data);
			(this.getUI('error')![0] as HTMLElement).hidden = true;
			(this.getUI('retry')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				this.options.current() &&
				!this.isDestroyed()
			)
				this.feedback(error, true)
		}
	},
	async create(event: Event) {
		event.preventDefault()
		const state = this.getState()
		if (state.request || !state.data.routes) return
		const input = this.getUI('username')![0] as HTMLInputElement,
			nameInput = this.getUI('name')![0] as HTMLInputElement,
			username = input.value,
			name = nameInput.value,
			request = (state.request = new AbortController()),
			button = this.getUI('create')![0] as HTMLButtonElement
		button.disabled = true
		button.classList.add('is-loading')
		try {
			const bot = await new BotUserService().create(
				new UserModel({
					username: username.startsWith('bot-') ? username : `bot-${username}`,
					...(name.trim() ? { name: name.trim() } : {}),
				}),
				request.signal,
			)
			request.signal.throwIfAborted()
			if (!this.options.current() || this.isDestroyed()) return
			state.bots.add({ id: bot.id, record: bot })
			if (input.value === username && nameInput.value === name) {
				input.value = ''
				nameInput.value = '';
				(this.getUI('form')![0] as HTMLElement).hidden = true;
				(this.getUI('show')![0] as HTMLElement).hidden = false
			}
			(this.getUI('error')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				this.options.current() &&
				!this.isDestroyed()
			)
				this.feedback(error)
		} finally {
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				button.disabled = false
				button.classList.remove('is-loading')
			}
		}
	},
	onBeforeDestroy() {
		this.getState().read?.abort()
		this.getState().request?.abort()
	},
}).setDomApi(LitDomApi)
