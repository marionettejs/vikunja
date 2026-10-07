import { View, CollectionView, Region, type RegionInstance } from 'marionette'
import { Collection, DataApi, type Model } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import { listIcon } from '@/shared/task-list/list-ui'
import WebhookService, { UserWebhookService } from '@/services/webhook'
import WebhookModel from '@/models/webhook'
import UserModel from '@/models/user'
import type { IWebhook } from '@/modelTypes/IWebhook'
import { isValidHttpUrl } from '@/helpers/isValidHttpUrl'
import { getDisplayName, fetchAvatarBlobUrl, observeAvatar } from '@/models/user'
import { EditorAvatarView } from '../../shared/editor/editor-avatar'
import { AvatarTooltipView } from '../task/task-membership-user'
import { getTopLayerContainer } from '@/helpers/getTopLayerContainer'
import { formatDateShort } from '../../shared/dates'
import { ConfirmationView } from '../projects/project-sharing'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import '../settings/application.scss'
export interface WebhookData {
	records?: IWebhook[];
	events?: string[];
	error?: unknown;
}
const serviceFor = (projectId?: number) =>
	projectId ? new WebhookService() : new UserWebhookService()
export async function readWebhooks(
	projectId: number | undefined,
	signal: AbortSignal,
): Promise<WebhookData> {
	const service = serviceFor(projectId)
	const [records, events] = await Promise.all([
		service.getAll(
			{
				...new WebhookModel({ projectId: projectId ?? 0 }),
				createdBy: new UserModel(),
			},
			{},
			1,
			signal,
		),
		service.getAvailableEvents(signal),
	])
	signal.throwIfAborted()
	return { records, events }
}
interface EditorOptions {
	availableEvents: string[];
	projectId?: number;
	submit: (
		record: IWebhook,
		editor: InstanceType<typeof WebhookEditorView>,
	) => void;
	cancel: () => void;
}
export const WebhookEditorView = View.extend({
	initialize(options: EditorOptions) {
		void options
	},
	tagName: 'form',
	className: 'p-4 native-webhook-editor',
	attributes: { novalidate: '' },
	ui: {
		url: '#targetUrl',
		secret: '#webhookSecret',
		basicUser: '#webhookBasicUser',
		basicPassword: '#webhookBasicPassword',
		basic: '[data-basic]',
		basicToggle: '[data-basic-toggle]',
		events: '[data-event]',
		save: '[data-save]',
		error: '[data-error]',
		urlError: '[data-url-error]',
		eventsError: '[data-events-error]',
	},
	events: { submit: 'submit', 'click @ui.basicToggle': 'toggleBasic' },
	createState() {
		return { busy: false }
	},
	templateContext() {
		return this.options
	},
	template({ availableEvents }: EditorOptions) {
		return html`<div
				data-error
				role="alert"
				class="message danger"
				hidden
			></div>
			<div class="field">
				<label class="label" for="targetUrl"
					>${t('project.webhooks.targetUrl')}</label
				><input
					id="targetUrl"
					class="input"
					placeholder=${t('project.webhooks.targetUrl')}
				/>
				<p data-url-error class="help is-danger" hidden>
					${t('project.webhooks.targetUrlInvalid')}
				</p>
			</div>
			<div class="field">
				<label class="label" for="webhookSecret"
					>${t('project.webhooks.secret')}</label
				><input id="webhookSecret" class="input" />
			</div>
			<p class="help">
				${t('project.webhooks.secretHint')}
				<a class="base-button" href="https://vikunja.io/docs/webhooks/"
					>${t('project.webhooks.secretDocs')}</a
				>
			</p>
			<button
				type="button"
				class="base-button base-button--type-button has-text-primary mbe-2"
				data-basic-toggle
			>
				${t('project.webhooks.basicauthlink')}
			</button>
			<div data-basic hidden>
				<div class="field">
					<label class="label" for="webhookBasicUser"
						>${t('project.webhooks.basicauthuser')}</label
					><input class="input" id="webhookBasicUser" />
				</div>
				<div class="field">
					<label class="label" for="webhookBasicPassword"
						>${t('project.webhooks.basicauthpassword')}</label
					><input class="input" id="webhookBasicPassword" />
				</div>
			</div>
			<div class="field">
				<label class="label">${t('project.webhooks.events')}</label>
				<p class="help">${t('project.webhooks.eventsHint')}</p>
				<div class="control">
					${availableEvents.map(
		(event) =>
			html`<div class="base-checkbox fancy-checkbox available-events-check"><label class="base-checkbox__label"
								><input
									type="checkbox"
									class="is-sr-only"
									data-event
									value=${event}
								/>${unsafeHTML(checkboxSvg.replace('<svg ', '<svg class="fancy-checkbox__icon" '))}<span class="fancy-checkbox__content">${event}</span></label></div>`,
	)}
				</div>
				<p data-events-error class="help is-danger" hidden>
					${t('project.webhooks.mustSelectEvents')}
				</p>
			</div>
			<button data-save class="base-button base-button--type-button button is-primary" type="submit">
				<span class="icon is-small">${listIcon('plus')}</span><span>${t('project.webhooks.create')}</span>
			</button>`
	},
	toggleBasic() {
		const el = this.getUI('basic')![0] as HTMLElement
		el.hidden = !el.hidden
	},
	values() {
		return {
			...new WebhookModel({
				projectId: this.options.projectId ?? 0,
				targetUrl: (this.getUI('url')![0] as HTMLInputElement).value,
				secret: (this.getUI('secret')![0] as HTMLInputElement).value,
				basicAuthUser: (this.getUI('basicUser')![0] as HTMLInputElement).value,
				basicAuthPassword: (this.getUI('basicPassword')![0] as HTMLInputElement)
					.value,
				events: (Array.from(this.getUI('events') ?? []) as HTMLInputElement[])
					.filter((e) => e.checked)
					.map((e) => e.value),
			}),
			createdBy: new UserModel(),
		}
	},
	signature() {
		const { targetUrl, secret, basicAuthUser, basicAuthPassword, events } =
			this.values()
		return JSON.stringify({
			targetUrl,
			secret,
			basicAuthUser,
			basicAuthPassword,
			events,
		})
	},
	submit(event: Event) {
		event.preventDefault()
		if (this.getState().busy) return
		const record = this.values(),
			valid = isValidHttpUrl(record.targetUrl);
		(this.getUI('urlError')![0] as HTMLElement).hidden = valid;
		(this.getUI('eventsError')![0] as HTMLElement).hidden =
			record.events.length > 0
		if (!valid) {
			(this.getUI('url')![0] as HTMLInputElement).focus()
			return
		}
		if (!record.events.length) return
		this.options.submit(record, this)
	},
	loading(value: boolean) {
		this.getState().busy = value
		const button = this.getUI('save')![0] as HTMLButtonElement
		button.disabled = value
		button.classList.toggle('is-loading', value)
	},
	feedback(error: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = error ? errorText(error) : ''
		el.hidden = !error
	},
	cancel() {
		this.options.cancel()
	},
}).setDomApi(LitDomApi)
const WebhookRowView = View.extend({
	initialize(options: {
		model: Model;
		editable: boolean;
		remove: (record: IWebhook) => void;
	}) {
		void options
	},
	tagName: 'tr',
	createState() { return { tooltip: undefined as RegionInstance | undefined, tooltipHost: undefined as HTMLElement | undefined, tooltipTimer: undefined as ReturnType<typeof setTimeout> | undefined } },
	regions: { avatar: '[data-avatar]' },
	ui: { remove: '[data-delete]' },
	events: { 'click @ui.remove': 'remove' },
	templateContext() {
		return {
			...this.options,
			record: this.options.model.get('record') as IWebhook,
			showTip: (trigger: HTMLElement, text: string) => this.showTip(trigger, text),
			hideTip: () => this.hideTip(),
		}
	},
	template({ record, editable, showTip, hideTip }: { record: IWebhook; editable: boolean; showTip: (trigger: HTMLElement, text: string) => void; hideTip: () => void }) {
		return html`<td class="webhook-target-url">${record.targetUrl}</td>
			<td>${record.events.join(', ')}</td>
			<td>${formatDateShort(record.created)}</td>
			<td><div class="user" style="--avatar-size:25px"><span class="avatar-wrapper"><span data-avatar style="display:contents" @mouseenter=${(event: Event) => showTip((event.currentTarget as HTMLElement).querySelector<HTMLElement>('.avatar')!, getDisplayName(record.createdBy))} @mouseleave=${hideTip} @click=${hideTip}></span>${(record.createdBy.botOwnerId ?? 0) > 0 ? html`<span class="bot-badge" aria-label="Bot" @mouseenter=${(event: Event) => showTip(event.currentTarget as HTMLElement, t('user.settings.bots.badge'))} @mouseleave=${hideTip} @click=${hideTip}>B</span>` : nothing}</span><span class="username">${getDisplayName(record.createdBy)}</span></div></td>
			<td class="actions">
				<button
					data-delete
					class="base-button base-button--type-button button is-danger"
					aria-label=${t('project.webhooks.delete')}
					?hidden=${!editable}
				>
					${listIcon('trash-alt')}<span></span>
				</button>
			</td>`
	},
	onRender() {
		const record = this.options.model.get('record') as IWebhook
		this.showChildView('avatar', new EditorAvatarView({
			user: record.createdBy,
			size: 25,
			imageClass: 'avatar',
			context: { avatar: (username, size) => fetchAvatarBlobUrl({ username }, size), observeAvatar: (username, changed) => observeAvatar(username, () => { this.hideTip(); changed() }) },
		}))
	},
	showTip(trigger: HTMLElement, text: string) {
		this.hideTip()
		const state = this.getState()
		state.tooltipTimer = setTimeout(() => {
			if (this.isDestroyed() || !trigger.isConnected) return
			const host = document.createElement('div')
			getTopLayerContainer(this.el).append(host)
			state.tooltipHost = host
			state.tooltip = new Region({el: host})
			state.tooltip.show(new AvatarTooltipView({trigger, text}))
		}, 200)
	},
	hideTip() {
		const state = this.getState()
		clearTimeout(state.tooltipTimer)
		state.tooltip?.destroy()
		state.tooltipHost?.remove()
		state.tooltip = undefined
		state.tooltipHost = undefined
	},
	onBeforeDestroy() { this.hideTip() },
	remove() {
		this.options.remove(this.options.model.get('record') as IWebhook)
	},
}).setDomApi(LitDomApi)
const WebhookRowsView = CollectionView.extend({
	tagName: 'tbody',
	childView: WebhookRowView,
}).setDataApi(DataApi)
interface Options {
	projectId?: number;
	editable: boolean;
	data: WebhookData;
	current: () => boolean;
}
export const WebhookManagerView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'native-webhook-manager',
	regions: {
		rows: { el: '[data-rows]', replaceElement: true },
		editor: '[data-editor]',
		confirmation: '[data-confirmation]',
	},
	ui: {
		table: '[data-table]',
		create: '[data-create]',
		error: '[data-error]',
		retry: '[data-retry]',
	},
	events: { 'click @ui.create': 'create', 'click @ui.retry': 'retry' },
	createState() {
		return {
			records: (new Collection() as Collection<Model>),
			data: this.options.data as WebhookData,
			read: undefined as AbortController | undefined,
			write: undefined as AbortController | undefined,
		}
	},
	template() {
		return html`<div
				data-error
				class="message danger"
				role="alert"
				hidden
			></div>
			<button data-retry class="button is-outlined" hidden>
				${t('sharing.retry')}</button
			><button data-create class="base-button base-button--type-button button is-primary mbe-4" hidden>
				<span class="icon is-small">${listIcon('plus')}</span><span>${t('project.webhooks.create')}</span>
			</button>
			<div data-editor></div>
			<div class="has-horizontal-overflow">
				<table
					class="table has-actions is-striped is-hoverable is-fullwidth"
					data-table
					hidden
				>
					<thead>
						<tr>
							${[
		'project.webhooks.targetUrl',
		'project.webhooks.events',
		'misc.created',
		'misc.createdBy',
	].map((key) => html`<th>${t(key)}</th>`)}
							<th></th>
						</tr>
					</thead>
					<tbody data-rows></tbody>
				</table>
			</div>
			<div data-confirmation></div>`
	},
	onRender() {
		this.showChildView(
			'rows',
			new WebhookRowsView({
				collection: this.getState().records,
				childViewOptions: () => ({
					editable: this.options.editable,
					remove: (record: IWebhook) => this.remove(record),
				}),
			}),
		)
		if (this.options.data.error) this.feedback(this.options.data.error, true)
		else this.applyData(this.options.data)
	},
	applyData(data: WebhookData) {
		this.getState().data = data
		this.getState().records.reset(
			(data.records ?? []).map((record) => ({ id: record.id, record })),
		)
		this.count()
		if (this.options.editable && !this.getState().records.length) this.create()
	},
	count() {
		(this.getUI('table')![0] as HTMLElement).hidden =
			!this.getState().records.length;
		(this.getUI('create')![0] as HTMLElement).hidden =
			!this.options.editable || !!this.getChildView('editor')
	},
	create() {
		const state = this.getState()
		if (!this.options.editable || !state.data.events) return
		this.showChildView(
			'editor',
			new WebhookEditorView({
				availableEvents: state.data.events,
				projectId: this.options.projectId,
				submit: (
					record: IWebhook,
					editor: InstanceType<typeof WebhookEditorView>,
				) => void this.write('create', record, editor),
				cancel: () => this.closeEditor(),
			}),
		)
		this.count()
	},
	closeEditor() {
		this.getRegion('editor')!.empty()
		this.count();
		(this.getUI('create')![0] as HTMLElement).focus()
	},
	feedback(error: unknown, retry = false) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = errorText(error)
		el.hidden = false;
		(this.getUI('retry')![0] as HTMLElement).hidden = !retry;
		(
			this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		)?.feedback(errorText(error))
	},
	async retry() {
		const state = this.getState()
		state.read?.abort()
		const request = (state.read = new AbortController()),
			projectId = this.options.projectId
		try {
			const data = await readWebhooks(projectId, request.signal)
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
	remove(record: IWebhook) {
		if (!this.options.editable || this.getState().write) return
		this.showChildView(
			'confirmation',
			new ConfirmationView({
				title: t('project.webhooks.delete'),
				text: t('project.webhooks.deleteText'),
				close: () => this.getRegion('confirmation')!.empty(),
				submit: () => void this.write('delete', record),
			}),
		)
	},
	async write(
		kind: 'create' | 'delete',
		record: IWebhook,
		editor?: InstanceType<typeof WebhookEditorView>,
	) {
		const state = this.getState()
		if (state.write || !this.options.editable) return
		const request = (state.write = new AbortController()),
			projectId = this.options.projectId,
			signature = editor?.signature(),
			confirmation = this.getChildView('confirmation') as
				| InstanceType<typeof ConfirmationView>
				| undefined
		editor?.loading(true)
		confirmation?.loading(true)
		this.el.setAttribute('aria-busy', 'true')
		try {
			const service = serviceFor(projectId)
			if (kind === 'create') {
				const accepted = await service.create(record, request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.records.add({ id: accepted.id, record: accepted })
				if (editor && !editor.isDestroyed()) {
					editor.feedback('')
					if (editor.signature() === signature) this.closeEditor()
				}
			} else {
				await service.delete(record, request.signal)
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				state.records.remove(record.id)
				this.getRegion('confirmation')!.empty()
				success(t('project.webhooks.deleteSuccess'))
				if (!state.records.length && !this.getChildView('editor'))
					this.create()
			}
			this.count();
			(this.getUI('error')![0] as HTMLElement).hidden = true
		} catch (error) {
			if (
				!request.signal.aborted &&
				this.options.current() &&
				!this.isDestroyed()
			) {
				if (editor && !editor.isDestroyed()) editor.feedback(error)
				else this.feedback(error)
			}
		} finally {
			if (state.write === request) state.write = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				if(editor && !editor.isDestroyed()) editor.loading(false)
				if(confirmation&&!confirmation.isDestroyed())confirmation.loading(false)
				this.el.setAttribute('aria-busy', 'false')
			}
		}
	},
	onBeforeDestroy() {
		this.getState().read?.abort()
		this.getState().write?.abort()
	},
}).setDomApi(LitDomApi)
export const WebhookSettingsView = View.extend({
	initialize(options: Options) {
		void options
	},
	regions: { manager: '[data-manager]' },
	template() {
		return html`<div class="card">
			<header class="card-header">
				<p class="card-header-title">${t('user.settings.webhooks.title')}</p>
			</header>
			<div class="card-content">
				<p class="mbe-4">${t('user.settings.webhooks.description')}</p>
				<div data-manager></div>
			</div>
		</div>`
	},
	onRender() {
		this.showChildView('manager', new WebhookManagerView(this.options))
	},
}).setDomApi(LitDomApi)
export const ProjectWebhookDialogView = View.extend({
	initialize(options: Options & { close: () => void }) {
		void options
	},
	tagName: 'dialog',
	className:
		'modal-dialog default native-project-dialog native-settings native-list-surface native-webhook-dialog',
	regions: { manager: '[data-manager]' },
	ui: { close: '[data-close]' },
	events: { cancel: 'close', 'click @ui.close': 'close' },
	template() {
		return html`<div class="modal-container">
			<button data-close class="base-button base-button--type-button close" aria-label=${t('misc.closeDialog')}>${listIcon('times')}</button>
			<div class="modal-content is-wide">
				<div class="card has-text-start has-no-shadow">
					<header class="card-header">
						<p class="card-header-title">${t('project.webhooks.title')}</p>
						<button data-close class="base-button base-button--type-button card-header-icon close" aria-label=${t('misc.close')}><span class="icon">${listIcon('times')}</span></button>
					</header>
					<div class="card-content p-0"><div class="content p-4"><div data-manager></div></div></div>
					<footer class="card-footer">
						<button data-close class="base-button base-button--type-button button is-outlined">
							${t('misc.cancel')}
						</button>
					</footer>
				</div>
			</div>
		</div>`
	},
	onRender() {
		this.showChildView('manager', new WebhookManagerView(this.options))
	},
	onAttach() {
		document.body.style.overflow = 'hidden';
		(this.el as HTMLDialogElement).showModal()
	},
	close(event: Event) {
		if ((event.target as Element).closest('dialog') !== this.el) return
		event.preventDefault()
		this.options.close()
	},
	onBeforeDestroy() {
		(this.el as HTMLDialogElement).close()
		document.body.style.overflow = ''
	},
}).setDomApi(LitDomApi)
