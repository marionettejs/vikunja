import { SettingsFrameView } from '../settings/application'
import type UserModel from '@/models/user'
import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import { MIGRATORS, type Migrator } from '@/views/migrate/migrators'
import AbstractMigrationService, {
	type MigrationConfig,
} from '@/services/migrator/abstractMigration'
import AbstractMigrationFileService from '@/services/migrator/abstractMigrationFile'
import type { CatalogApplication } from '../projects/catalog'
import type { ListContext } from '@/shared/task-list/list-context'
import { CSVImportView } from './import-csv'
import { NotFoundView } from '../../app/system-pages'
import type { Route } from '../../app/routes'
import { interceptLink } from '../../app/routes'
import { t } from '../../shared/i18n'
import { formatDateLong } from '../../shared/dates'
import { parseDateOrNull } from '@/helpers/parseDateOrNull'
import { errorText } from '../../shared/notifications'
import logo from '@/assets/logo.svg?url'
import './import.scss'
interface Data {
	url?: string;
	started_at?: string | null;
	finished_at?: string | null;
	error?: unknown;
}
interface Options {
	user: () => UserModel;
	config: () => Record<string, unknown>;
	navigate: (href: string) => void;
	catalog: InstanceType<typeof CatalogApplication>;
	context: ListContext;
	current: () => boolean;
}
const ChoiceView = View.extend({
	className: 'content native-import',
	initialize(options: { ids: string[]; navigate: (href: string) => void }) {
		void options
	},
	ui: { links: 'a' },
	events: { 'click @ui.links': 'navigate' },
	navigate(event: MouseEvent) {
		interceptLink(event, this.options.navigate)
	},
	templateContext() {
		return this.options
	},
	template({ ids }: { ids: string[] }) {
		return html`<h1>${t('migrate.title')}</h1>
			<p>${t('migrate.description')}</p>
			<div class="migration-services">
				${ids
		.filter((id) => id in MIGRATORS)
		.map((id) => {
			const m = MIGRATORS[id as keyof typeof MIGRATORS] as Migrator
			return html`<a
							class="migration-service-link"
							href=${'/migrate/' + m.id}
							><img
								class="migration-service-image"
								alt=${m.name}
								src=${m.icon}
							/>${m.name}</a
						>`
		})}
			</div>`
	},
}).setDomApi(LitDomApi)
async function read(service: string, signal: AbortSignal): Promise<Data> {
	const m = MIGRATORS[service as keyof typeof MIGRATORS] as Migrator
	if (m.isFileMigrator) return {}
	const transport = new AbstractMigrationService(service)
	const url = m.isCredentialsMigrator
		? undefined
		: ((await transport.getAuthUrl(signal)) as unknown as { url: string }).url
	const status =
		m.isCredentialsMigrator ||
		location.hash.startsWith('#token=') ||
		new URL(location.href).searchParams.get('code')
			? await transport.getStatus(signal)
			: {}
	signal.throwIfAborted()
	return {
		url,
		...status,
		started_at:
			parseDateOrNull((status as Data).started_at)?.toISOString() ?? null,
		finished_at:
			parseDateOrNull((status as Data).finished_at)?.toISOString() ?? null,
	}
}
const ServiceImportView = View.extend({
	className: 'content native-import native-list-surface',
	initialize(options: Options & { service: string; data: Data; code: string }) {
		void options
	},
	ui: {
		form: 'form',
		file: '[data-file]',
		pick: '[data-pick]',
		submit: '[data-submit]',
		error: '[data-error]',
		retry: '[data-retry]',
		method: '[name=auth-method]',
		token: '[data-token]',
		password: '[data-password]',
		field: '[data-field]',
		fieldErrors: '[data-field-error]',
		status: '[data-status]',
		controls: '[data-controls]',
		again: '[data-again]',
		overview: '[data-overview]',
		progress: '[data-progress]',
		actions: '[data-actions]',
		home: '[data-home]',
	},
	events: {
		'submit @ui.form': 'submit',
		'change @ui.file': 'fileSelected',
		'click @ui.pick': 'pick',
		'change @ui.method': 'method',
		'click @ui.retry': 'retry',
		'click @ui.again': 'again',
		'click @ui.overview': 'navigate',
	},
	createState() {
		return {
			request: undefined as AbortController | undefined,
			read: undefined as AbortController | undefined,
			data: this.options.data,
		}
	},
	templateContext() {
		return {
			m: MIGRATORS[this.options.service as keyof typeof MIGRATORS] as Migrator,
			id: this.cid,
		}
	},
	template({ m, id }: { m: Migrator; id: string }) {
		return html`<h1>${t('migrate.titleService', { name: m.name })}</h1>
			<p>${t('migrate.descriptionDo')}</p>
			<div data-error role="alert" class="message danger mbe-4" hidden></div>
			<button data-retry class="button" hidden>${t('sharing.retry')}</button>
			<div data-status></div>
			<div data-controls>
				${m.isFileMigrator
		? html`<p>${t('migrate.importUpload', { name: m.name })}</p>
							<input data-file class="is-hidden" type="file" /><button
								data-pick
								class="button is-primary"
							>
								${t('migrate.upload')}
							</button>`
		: m.isCredentialsMigrator
			? html`<form class="credentials-form" novalidate>
								<p>${t('migrate.credentials.description', { name: m.name })}</p>
								<div class="field">
									<label class="label" for=${id + 'url'}
										>${t('migrate.credentials.url', { name: m.name })}</label
									><input
										id=${id + 'url'}
										data-field="url"
										type="url"
										autocomplete="url"
										class="input"
										placeholder=${'https://' +
										m.name.toLowerCase() +
										'.example.com'}
									/>
									<p
										data-field-error="url"
										id=${id + 'url-error'}
										class="help is-danger"
										role="alert"
										hidden
									></p>
								</div>
								<fieldset class="field">
									<legend class="label">
										${t('migrate.credentials.authMethod')}
									</legend>
									<div class="auth-method">
										<label class="radio"
											><input
												type="radio"
												name="auth-method"
												value="token"
												checked
											/>${t('migrate.credentials.apiKey')}</label
										><label class="radio"
											><input
												type="radio"
												name="auth-method"
												value="password"
											/>${t('migrate.credentials.authPassword')}</label
										>
									</div>
								</fieldset>
								<div data-token class="field">
									<label class="label" for=${id + 'token'}
										>${t('migrate.credentials.apiKey')}</label
									><input
										id=${id + 'token'}
										data-field="token"
										type="password"
										autocomplete="off"
										class="input"
									/>
									<p
										data-field-error="token"
										id=${id + 'token-error'}
										class="help is-danger"
										role="alert"
										hidden
									></p>
									<p class="help">${t('migrate.planka.apiKeyHelp')}</p>
								</div>
								<div data-password hidden>
									<div class="field">
										<label class="label" for=${id + 'username'}
											>${t('user.auth.usernameEmail')}</label
										><input
											id=${id + 'username'}
											data-field="username"
											type="text"
											autocomplete="off"
											class="input"
										/>
										<p
											data-field-error="username"
											id=${id + 'username-error'}
											class="help is-danger"
											role="alert"
											hidden
										></p>
									</div>
									<div class="field">
										<label class="label" for=${id + 'password'}
											>${t('user.auth.password')}</label
										><input
											id=${id + 'password'}
											data-field="password"
											type="password"
											autocomplete="off"
											class="input"
										/>
										<p
											data-field-error="password"
											id=${id + 'password-error'}
											class="help is-danger"
											role="alert"
											hidden
										></p>
										<p class="help">${t('migrate.planka.passwordHelp')}</p>
									</div>
								</div>
								<button data-submit type="submit" class="button is-primary">
									${t('migrate.credentials.start')}
								</button>
							</form>`
			: html`<p>${t('migrate.authorize', { name: m.name })}</p>
								<a
									data-submit
									class="button is-primary"
									href=${this.options.data.url || '#'}
									>${t('migrate.getStarted')}</a
								>`}
			</div>
			<div data-progress class="migration-in-progress-container" hidden>
				<div class="migration-in-progress">
					<img class="logo" alt=${m.name} src=${m.icon} />
					<div class="progress-dots">
						${Array.from({ length: 8 }, () => html`<span></span>`)}
					</div>
					<img class="logo" alt="Vikunja" src=${logo} />
				</div>
				<p>${t('migrate.inProgress')}</p>
			</div>
			<div data-actions hidden>
				<button data-again class="button is-primary">
					${t('migrate.confirm')}</button
				><a data-overview class="button is-text" href="/"
					>${t('misc.cancel')}</a
				>
			</div>
			<a data-overview data-home class="button is-primary" href="/" hidden
				>${t('home.goToOverview')}</a
			>`
	},
	onRender() {
		this.publish()
		if (this.options.data.error) this.feedback(this.options.data.error, true)
	},
	onAttach() {
		const m = MIGRATORS[
			this.options.service as keyof typeof MIGRATORS
		] as Migrator
		if (
			!m.isFileMigrator &&
			!m.isCredentialsMigrator &&
			this.options.code &&
			!this.getState().data.started_at &&
			!this.getState().data.finished_at &&
			!this.getState().data.error
		)
			void this.migrate({ code: this.options.code })
		if (m.isCredentialsMigrator)
			(this.getUI('field')![0] as HTMLElement).focus()
	},
	alive(r: AbortController) {
		return !r.signal.aborted && !this.isDestroyed() && this.options.current()
	},
	publish() {
		const state = this.getState(),
			m = MIGRATORS[this.options.service as keyof typeof MIGRATORS] as Migrator,
			data = state.data,
			busy = !!state.request,
			complete = !!data.finished_at || !!data.started_at
		const controls = this.getUI('controls')![0] as HTMLElement
		controls.hidden = complete || (busy && !m.isCredentialsMigrator)
		for (const b of [this.getUI('submit')?.[0], this.getUI('pick')?.[0]])
			if (b) {
				(b as HTMLButtonElement).disabled = busy
				b.classList.toggle('is-loading', busy)
			}
		const auth = this.getUI('submit')?.[0]
		if (auth instanceof HTMLAnchorElement && data.url) auth.href = data.url
		const status = this.getUI('status')![0] as HTMLElement
		status.textContent = data.finished_at
			? t('migrate.alreadyMigrated1', {
				name: m.name,
				date: formatDateLong(new Date(data.finished_at)),
			}) +
				' ' +
				t('migrate.alreadyMigrated2')
			: data.started_at
				? t('migrate.migrationInProgress')
				: ''
		status.className =
			data.started_at && !data.finished_at ? 'message mbe-4' : '';
		(this.getUI('actions')![0] as HTMLElement).hidden = !data.finished_at;
		(this.getUI('home')![0] as HTMLElement).hidden =
			!data.started_at || !!data.finished_at;
		(this.getUI('progress')![0] as HTMLElement).hidden =
			!busy || !!m.isCredentialsMigrator
	},
	method() {
		const token = (this.getUI('method')![0] as HTMLInputElement).checked;
		(this.getUI('token')![0] as HTMLElement).hidden = !token;
		(this.getUI('password')![0] as HTMLElement).hidden = token
	},
	navigate(event: MouseEvent) {
		interceptLink(event, this.options.navigate)
	},
	pick() {
		(this.getUI('file')![0] as HTMLInputElement).click()
	},
	fileSelected() {
		const input = this.getUI('file')![0] as HTMLInputElement,
			file = input.files?.[0]
		input.value = ''
		if (file) void this.migrate(file)
	},
	feedback(error?: unknown, retry = false) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = !error
		el.textContent = error ? errorText(error) : '';
		(this.getUI('retry')![0] as HTMLElement).hidden = !retry
	},
	submit(event: Event) {
		event.preventDefault()
		const values: Record<string, string> = {}
		for (const el of Array.from(
			this.getUI('field') ?? [],
		) as HTMLInputElement[])
			values[el.dataset.field!] = el.value
		const token = (this.getUI('method')![0] as HTMLInputElement).checked,
			errors: Record<string, string> = {
				url: !values.url.trim() ? 'apiConfig.urlRequired' : '',
				token:
					token && !values.token.trim()
						? 'migrate.credentials.apiKeyRequired'
						: '',
				username:
					!token && !values.username.trim() ? 'user.auth.usernameRequired' : '',
				password:
					!token && !values.password ? 'user.auth.passwordRequired' : '',
			}
		this.feedback()
		for (const el of Array.from(
			this.getUI('fieldErrors') ?? [],
		) as HTMLElement[]) {
			const key = el.dataset.fieldError!,
				error = errors[key]
			el.hidden = !error
			el.textContent = error ? t(error) : ''
			const input = Array.from(this.getUI('field') ?? []).find(
				(el) => (el as HTMLInputElement).dataset.field === key,
			) as HTMLInputElement
			input.setAttribute('aria-invalid', String(!!error))
			if (error) input.setAttribute('aria-describedby', el.id)
			else input.removeAttribute('aria-describedby')
		}
		if (Object.values(errors).some(Boolean)) return
		void this.migrate(
			token
				? { url: values.url.trim(), token: values.token.trim() }
				: {
					url: values.url.trim(),
					username: values.username.trim(),
					password: values.password,
				},
		)
	},
	again() {
		const m = MIGRATORS[
			this.options.service as keyof typeof MIGRATORS
		] as Migrator
		this.getState().data = { url: this.getState().data.url }
		this.publish()
		if (!m.isCredentialsMigrator)
			void this.migrate({ code: this.options.code })
	},
	async retry() {
		const state = this.getState()
		state.read?.abort()
		const request = (state.read = new AbortController())
		try {
			const data = await read(this.options.service, request.signal)
			if (this.alive(request)) {
				state.data = data
				this.publish()
				this.feedback()
			}
		} catch (e) {
			if (this.alive(request)) this.feedback(e, true)
		}
	},
	async migrate(input: MigrationConfig | File) {
		const state = this.getState()
		if (state.request) return
		const request = (state.request = new AbortController())
		this.feedback()
		this.publish()
		try {
			const m = MIGRATORS[
				this.options.service as keyof typeof MIGRATORS
			] as Migrator
			const result = m.isFileMigrator
				? await new AbstractMigrationFileService(m.id).migrate(
						input as File,
						request.signal,
				)
				: await new AbstractMigrationService(m.id).migrate(
						input as MigrationConfig,
						request.signal,
				)
			if (!this.alive(request)) return
			if (m.isFileMigrator)
				await this.options.catalog.refreshProjects(request.signal)
			if (!this.alive(request)) return;
			(this.getUI('status')![0] as HTMLElement).textContent = m.isFileMigrator
				? (result as unknown as { message: string }).message
				: t('migrate.migrationStartedWillReciveEmail', { service: m.name });
			(this.getUI('status')![0] as HTMLElement).className = 'message mbe-4';
			(this.getUI('controls')![0] as HTMLElement).hidden = true;
			(this.getUI('home')![0] as HTMLElement).hidden = false;
			(this.getUI('progress')![0] as HTMLElement).hidden = true
			state.data.started_at = new Date().toISOString()
		} catch (e) {
			if (this.alive(request)) this.feedback(e)
		} finally {
			if (state.request === request) state.request = undefined
			if (this.alive(request) && !state.data.started_at) this.publish()
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
		this.getState().read?.abort()
	},
}).setDomApi(LitDomApi)
export const ImportApplication = Application.extend({
	initialize(options: Options) {
		void options
	},
	createState() {
		return { route: undefined as Route | undefined }
	},
	async prepareStart(route: Route, { signal }: LifecycleContext) {
		this.getState().route = route
		if (
			!route.params.service ||
			route.params.service === 'csv' ||
			!(route.params.service in MIGRATORS)
		)
			return {}
		try {
			return await read(route.params.service, signal)
		} catch (error) {
			signal.throwIfAborted()
			return { error }
		}
	},
	onStart(_app: unknown, route: Route, data: Data) {
		const current = () =>
			this.isRunning() &&
			this.getState().route === route &&
			this.options.current()
		const service = route.params.service
		document.title =
			(service
				? t('migrate.titleService', {
					name:
							(
								MIGRATORS[service as keyof typeof MIGRATORS] as
									| Migrator
									| undefined
							)?.name || service,
				})
				: t('migrate.title')) + ' | Vikunja'
		const view = !service
			? new ChoiceView({
				ids: (this.options.config().available_migrators as string[]) || [],
				navigate: this.options.navigate,
			})
			: service === 'csv'
				? new CSVImportView({
					current,
					context: this.options.context,
					navigate: this.options.navigate,
					refresh: (signal: AbortSignal) =>
						this.options.catalog.refreshProjects(signal),
				})
				: service in MIGRATORS
					? new ServiceImportView({
						...this.options,
						current,
						service,
						data,
						code: location.hash.startsWith('#token=')
							? location.hash.slice(7)
							: String(route.query.code || ''),
					})
					: new NotFoundView()
		if (service && !(service in MIGRATORS)) {
			document.title='404 | Vikunja'
			this.setView(view)
			this.showView()
			return
		}
		const frame = this.setView(
			new SettingsFrameView({
				user: this.options.user(),
				config: this.options.config(),
				page: 'migrate',
				navigate: this.options.navigate,
			}),
		)
		this.showView()
		frame.showChildView('form', view)
	},
})
