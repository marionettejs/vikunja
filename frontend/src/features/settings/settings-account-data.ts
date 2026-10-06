import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import DataExportService from '@/services/dataExport'
import AccountDeleteService from '@/services/accountDelete'
import UserModel from '@/models/user'
import type { SessionApplication } from '../../app/session'
import { AuthenticatedHTTPFactory } from '@/helpers/fetcher'
import { parseDateOrNull } from '@/helpers/parseDateOrNull'
import { downloadBlob } from '@/helpers/downloadBlob'
import { translatedParts } from '@/shared/task-list/list-ui'
import { interceptLink } from '../../app/routes'
import { displayDate, formatDateLong } from '../../shared/dates'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
export interface ExportInfo {
	id: number;
	size: number;
	created: string;
	expires: string;
}
export type AccountDataPage = 'data-export' | 'export-download' | 'deletion';
export const accountDataPages: AccountDataPage[] = [
	'data-export',
	'export-download',
	'deletion',
]
export function accountDataTitle(page: string) {
	return page === 'deletion'
		? 'user.deletion.title'
		: page === 'export-download'
			? 'user.export.downloadTitle'
			: 'user.export.title'
}
export async function readExport(
	signal: AbortSignal,
): Promise<ExportInfo | null> {
	const data = await new DataExportService().status(signal)
	signal.throwIfAborted()
	return data?.id ? data : null
}
interface Options {
	page: AccountDataPage;
	user: UserModel;
	session: InstanceType<typeof SessionApplication>;
	current: () => boolean;
	navigate: (href: string) => void;
	info?: ExportInfo | null;
	error?: unknown;
}
const ExportStatusView = View.extend({
	initialize(options: Pick<Options, 'info' | 'user' | 'navigate'>) {
		void options
	},
	templateContext() {
		return this.options
	},
	template({
		info,
		user,
		navigate,
	}: Pick<Options, 'info' | 'user' | 'navigate'>) {
		return info
			? html`<div class="message info mbe-4 export-message">
					<p>
						${translatedParts(t, 'user.export.ready', [
		html`<time
								datetime=${info.expires}
								title=${formatDateLong(new Date(info.expires))}
								>${displayDate(
		new Date(info.expires),
		user.settings.frontendSettings,
	)}</time
							>`,
	])}
					</p>
					<a
						class="button is-primary"
						href="/user/export/download"
						@click=${(e: MouseEvent) => interceptLink(e, navigate)}
						>${t('misc.download')}</a
					>
				</div>`
			: nothing
	},
}).setDomApi(LitDomApi)
export const AccountDataView = View.extend({
	initialize(options: Options) {
		void options
	},
	className: 'native-account-data',
	regions: { ready: '[data-ready]' },
	ui: {
		password: '#accountDataPassword',
		required: '[data-required]',
		error: '[data-error]',
		retry: '[data-retry]',
		submit: '[data-submit]',
		ready: '[data-ready]',
	},
	events: {
		submit: 'submit',
		'click @ui.retry': 'retry',
		'input @ui.password': 'validate',
	},
	createState() {
		return {
			request: undefined as AbortController | undefined,
			read: undefined as AbortController | undefined,
		}
	},
	templateContext() {
		return this.options
	},
	template({ page, user, navigate }: Options) {
		const scheduled = parseDateOrNull(user.deletionScheduledAt),
			local = user.isLocalUser,
			title = accountDataTitle(page)
		const content = html`<div
				data-error
				role="alert"
				class="message danger"
				hidden
			></div>
			<button data-retry type="button" class="button is-outlined" hidden>
				${t('sharing.retry')}
			</button>
			<div data-ready></div>
			<form novalidate>
				${page === 'export-download'
		? nothing
		: html`<p>
							${t(
		page === 'deletion'
			? scheduled
				? 'user.deletion.scheduled'
				: 'user.deletion.text1'
			: 'user.export.description',
		scheduled
			? {
				date: displayDate(
					scheduled,
					user.settings.frontendSettings,
				),
				dateSince: displayDate(scheduled),
			}
			: {},
	)}
						</p>`}
				${local
		? html`<p>
								${t(
		page === 'deletion'
			? scheduled
				? 'user.deletion.scheduledCancelText'
				: 'user.deletion.text2'
			: 'user.export.descriptionPasswordRequired',
	)}
							</p>
							<div class="field">
								<label class="label" for="accountDataPassword"
									>${t('user.settings.currentPassword')}</label
								><input
									id="accountDataPassword"
									type="password"
									class="input"
									autocomplete="current-password"
									placeholder=${t('user.settings.currentPasswordPlaceholder')}
									aria-describedby="accountDataRequired"
								/>
								<p
									id="accountDataRequired"
									data-required
									class="help is-danger"
									hidden
								>
									${t('user.deletion.passwordRequired')}
								</p>
							</div>`
		: page === 'deletion'
			? html`<p>
								${t(
		scheduled
			? 'user.deletion.scheduledCancelButton'
			: 'user.deletion.text3',
	)}
							</p>`
			: nothing}<button
					data-submit
					class=${`button mbs-4 ${page === 'deletion' && !scheduled ? 'is-danger' : 'is-primary'} ${page === 'export-download' ? 'mie-4' : 'is-fullwidth'}`}
					type="submit"
				>
					${t(
		page === 'deletion'
			? scheduled
				? 'user.deletion.scheduledCancelConfirm'
				: 'user.deletion.confirm'
			: page === 'export-download'
				? 'misc.download'
				: 'user.export.request',
	)}</button
				>${page === 'export-download'
		? html`<a
							class="button is-text mbs-4"
							href="/user/settings/data-export"
							@click=${(e: MouseEvent) => interceptLink(e, navigate)}
							>${t('user.export.requestNew')}</a
						>`
		: nothing}
			</form>`
		return page === 'export-download'
			? html`<div class="content">
					<h1>${t(title)}</h1>
					${content}
				</div>`
			: html`<div class="card">
					<header class="card-header">
						<p class="card-header-title">${t(title)}</p>
					</header>
					<div class="card-content loader-container">${content}</div>
				</div>`
	},
	onRender() {
		this.showStatus()
		if (this.options.error) this.feedback(this.options.error, true)
	},
	showStatus() {
		this.showChildView(
			'ready',
			new ExportStatusView({
				info: this.options.info,
				user: this.options.user,
				navigate: this.options.navigate,
			}),
		)
	},
	onAttach() {
		if (this.options.page === 'export-download')
			(this.getUI('submit')![0] as HTMLButtonElement).focus()
	},
	validate() {
		const input = this.getUI('password')?.[0] as HTMLInputElement | undefined
		if (input) {
			(this.getUI('required')![0] as HTMLElement).hidden = !!input.value
			input.setAttribute('aria-invalid', String(!input.value))
		}
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
			const info = await readExport(request.signal)
			if (!this.options.current() || this.isDestroyed()) return
			this.options.info = info
			this.options.error = undefined
			this.showStatus();
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
	async submit(event: Event) {
		event.preventDefault()
		const state = this.getState()
		if (state.request) return
		const input = this.getUI('password')?.[0] as HTMLInputElement | undefined,
			password = input?.value ?? ''
		if (input && !password) {
			this.validate()
			input.focus()
			return
		}
		const page = this.options.page,
			scheduled = parseDateOrNull(this.options.user.deletionScheduledAt),
			request = (state.request = new AbortController()),
			button = this.getUI('submit')![0] as HTMLButtonElement,
			buttonFocused = document.activeElement === button
		button.disabled = true
		button.classList.add('is-loading')
		this.el.setAttribute('aria-busy', 'true')
		let url = ''
		try {
			if (page === 'deletion') {
				const service = new AccountDeleteService()
				if (scheduled) await service.cancel(password, request.signal)
				else await service.request(password, request.signal)
			} else if (page === 'export-download')
				url = await new DataExportService().downloadUrl(
					password,
					request.signal,
				)
			else await new DataExportService().request(password, request.signal)
			request.signal.throwIfAborted()
			if (!this.options.current() || this.isDestroyed()) return
			if (url) {
				downloadBlob(url, 'vikunja-export.zip')
				url = ''
			} else
				success(
					t(
						page === 'deletion'
							? scheduled
								? 'user.deletion.scheduledCancelSuccess'
								: 'user.deletion.requestSuccess'
							: 'user.export.success',
					),
				)
			if (input?.value === password) input.value = '';
			(this.getUI('error')![0] as HTMLElement).hidden = true
			if (page === 'deletion' && scheduled) {
				const { data } = await AuthenticatedHTTPFactory().get('user', {
					signal: request.signal,
				})
				request.signal.throwIfAborted()
				if (!this.options.current() || this.isDestroyed()) return
				const updated = new UserModel({
					...data,
					type: this.options.user.type,
				})
				Object.assign(this.options.user, updated)
				this.options.session.getState().trigger('change:user')
				const draft = input?.value,
					focused = document.activeElement === input,
					start = input?.selectionStart,
					end = input?.selectionEnd
				this.render()
				const field = this.getUI('password')?.[0] as
					| HTMLInputElement
					| undefined
				if (field && draft !== undefined) {
					field.value = draft
					if (focused) {
						field.focus()
						field.setSelectionRange(start ?? 0, end ?? 0)
					}
				}
			}
		} catch (error) {
			if (
				!request.signal.aborted &&
				this.options.current() &&
				!this.isDestroyed()
			)
				this.feedback(error)
		} finally {
			if (url) URL.revokeObjectURL(url)
			if (state.request === request) state.request = undefined
			if (!request.signal.aborted && !this.isDestroyed()) {
				const currentButton = this.getUI('submit')![0] as HTMLButtonElement
				currentButton.disabled = false
				currentButton.classList.remove('is-loading')
				if (buttonFocused && document.activeElement === document.body)
					currentButton.focus()
				this.el.setAttribute('aria-busy', 'false')
			}
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.getState().read?.abort()
	},
}).setDomApi(LitDomApi)
