import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import flatpickr from 'flatpickr'
import type { Instance as Picker } from 'flatpickr/dist/types/instance'
import type { IApiToken } from '@/modelTypes/IApiToken'
import type { IUserSettings } from '@/modelTypes/IUserSettings'
import type { PermissionRoutes } from './settings-security-data'
import { TOKEN_PRESETS } from '../../shared/token-presets'
import { t } from '../../shared/i18n'
const label = (value: string) => value.replace(/_/g, ' ')
interface Options {
	routes: PermissionRoutes;
	title: string;
	scopes: string;
	settings: IUserSettings;
	submit: (
		token: IApiToken,
		view: InstanceType<typeof TokenEditorView>,
	) => void;
	cancel: () => void;
}
export const TokenEditorView = View.extend({
	initialize(options: Options) {
		void options
	},
	tagName: 'form',
	className: 'native-token-editor',
	ui: {
		title: '[data-token-title]',
		titleLabel: '[data-title-label]',
		expiryLabel: '[data-expiry-label]',
		expiry: '[data-token-expiry]',
		custom: '[data-custom]',
		date: '[data-date]',
		permissions: '[data-permission]',
		groups: '[data-group]',
		save: '[data-save]',
		error: '[data-error]',
		titleError: '[data-title-error]',
		permissionError: '[data-permission-error]',
		preset: '[data-preset]',
		cancel: '[data-cancel]',
	},
	events: {
		submit: 'submit',
		'change @ui.expiry': 'expiry',
		'change @ui.permissions': 'syncGroups',
		'change @ui.groups': 'group',
		'click @ui.preset': 'preset',
		'click @ui.cancel': 'cancel',
	},
	createState() {
		return { busy: false, picker: undefined as Picker | undefined }
	},
	templateContext() {return this.options
	},
	template({ routes,title }:Options) {
		return html`<div
				class="message danger"
				data-error
				role="alert"
				hidden
			></div>
			<div class="field">
				<label class="label" data-title-label
					>${t('user.settings.apiTokens.attributes.title')}</label
				><input
					class="input"
					data-token-title
					.value=${title}
					placeholder=${t(
		'user.settings.apiTokens.attributes.titlePlaceholder',
	)}
				/>
				<p class="help is-danger" data-title-error hidden>
					${t('user.settings.apiTokens.titleRequired')}
				</p>
			</div>
			<div class="field">
				<label class="label" data-expiry-label
					>${t('user.settings.apiTokens.attributes.expiresAt')}</label
				>
				<div class="is-flex">
					<div class="control select">
						<select data-token-expiry>
							${[30, 60, 90].map(
		(days) =>
			html`<option value=${days}>
										${t(`user.settings.apiTokens.${days}d`)}
									</option>`,
	)}
							<option value="custom">${t('misc.custom')}</option>
						</select>
					</div>
					<div class="control mis-2" data-custom hidden>
						<input data-date class="input" />
					</div>
				</div>
			</div>
			<div class="field">
				<label class="label"
					>${t('user.settings.apiTokens.attributes.permissions')}</label
				>
				<p>${t('user.settings.apiTokens.permissionExplanation')}</p>
				<div class="preset-buttons mbe-4">
					<label class="label"
						>${t('user.settings.apiTokens.presets.title')}</label
					>
					<div class="is-flex" style="gap:.5rem;flex-wrap:wrap">
						${TOKEN_PRESETS.map(
		(preset) =>
			html`<button
									type="button"
									class="button is-outlined"
									data-preset=${preset.id}
								>
									${t(`user.settings.apiTokens.presets.${preset.id}`)}
								</button>`,
	)}
					</div>
				</div>
				${Object.keys(routes)
		.sort((a, b) => (a === 'other' ? 1 : b === 'other' ? -1 : 0))
		.map(
			(group) =>
				html`<div class="mbe-2">
								<label class="checkbox is-capitalized has-text-weight-bold"
									><input type="checkbox" data-group=${group} />${label(
	group,
)}</label
								>${Object.keys(routes[group]).map(
		(permission) =>
			html`<label class="checkbox mis-4 is-capitalized"
											><input
												type="checkbox"
												data-permission=${permission}
												data-owner=${group}
											/>${label(permission)}</label
										>`,
	)}
							</div>`,
		)}
			</div>
			<p class="help is-danger" data-permission-error hidden>
				${t('user.settings.apiTokens.permissionRequired')}
			</p>
			<button class="button is-primary" type="submit" data-save>
				${t('user.settings.apiTokens.createToken')}</button
			><button type="button" class="button is-text" data-cancel>
				${t('misc.cancel')}
			</button>`
	},
	onRender() {
		for (const name of ['title', 'expiry'] as const) {
			const input = this.getUI(name)![0] as HTMLInputElement
			input.id = `${this.cid}-${name}`;
			(this.getUI(`${name}Label`)![0] as HTMLLabelElement).htmlFor = input.id
		}

		(this.getUI('expiry')![0] as HTMLSelectElement).value = '30'
		const scopes = this.options.scopes.split(',')
		for (const input of Array.from(
			this.getUI('permissions') ?? [],
		) as HTMLInputElement[])
			input.checked = scopes.includes(
				`${input.dataset.owner}:${input.dataset.permission}`,
			)
		this.syncGroups()
	},
	onAttach() {
		if (window.innerWidth > 769)
			(this.getUI('title')![0] as HTMLInputElement).focus()
	},
	syncGroups() {
		for (const group of Array.from(
			this.getUI('groups') ?? [],
		) as HTMLInputElement[]) {
			const children = (
				Array.from(this.getUI('permissions') ?? []) as HTMLInputElement[]
			).filter((child) => child.dataset.owner === group.dataset.group)
			group.checked =
				children.length > 0 && children.every((child) => child.checked)
		}
	},
	group(event: Event) {
		const group = (event as Event & { delegateTarget: HTMLInputElement })
			.delegateTarget
		for (const child of Array.from(
			this.getUI('permissions') ?? [],
		) as HTMLInputElement[])
			if (child.dataset.owner === group.dataset.group)
				child.checked = group.checked
		this.syncGroups()
	},
	preset(event: Event) {
		const id = (event as Event & { delegateTarget: HTMLElement }).delegateTarget
				.dataset.preset,
			preset = TOKEN_PRESETS.find((p) => p.id === id)!
		for (const input of Array.from(
			this.getUI('permissions') ?? [],
		) as HTMLInputElement[]) {
			const permissions =
				preset.groups['*'] ?? preset.groups[input.dataset.owner!]
			input.checked =
				permissions === '*' ||
				(Array.isArray(permissions) &&
					permissions.includes(input.dataset.permission!))
		}
		this.syncGroups();
		(this.getUI('permissionError')![0] as HTMLElement).hidden = true
	},
	expiry() {
		const custom =
			(this.getUI('expiry')![0] as HTMLSelectElement).value === 'custom';
		(this.getUI('custom')![0] as HTMLElement).hidden = !custom
		if (custom && !this.getState().picker) {
			const now = new Date()
			now.setSeconds(0, 0)
			this.getState().picker = flatpickr(
				this.getUI('date')![0] as HTMLInputElement,
				{
					altFormat: t('date.altFormatLong'),
					altInput: true,
					dateFormat: 'Y-m-d H:i',
					enableTime: true,
					time_24hr:
						this.options.settings.frontendSettings.timeFormat === '24h',
					locale: { firstDayOfWeek: this.options.settings.weekStart ?? 0 },
					minDate: now,
					defaultDate: now,
					onReady: (_dates, _str, instance) =>
						(instance.mobileInput ?? instance.altInput)?.setAttribute(
							'aria-label',
							t('user.settings.apiTokens.attributes.expiresAt'),
						),
				},
			)
		}
	},
	draftSignature() {
		return JSON.stringify({
			title: (this.getUI('title')![0] as HTMLInputElement).value,
			permissions: this.values().permissions,
			expiry: (this.getUI('expiry')![0] as HTMLSelectElement).value,
			custom: this.getState().picker?.selectedDates[0]?.toISOString(),
		})
	},
	values(): IApiToken {
		const expiry = Number(
				(this.getUI('expiry')![0] as HTMLSelectElement).value,
			),
			permissions: Record<string, string[]> = {}
		for (const input of Array.from(
			this.getUI('permissions') ?? [],
		) as HTMLInputElement[])
			if (input.checked)
				(permissions[input.dataset.owner!] ??= []).push(
					input.dataset.permission!,
				)
		return {
			id: 0,
			token: '',
			maxPermission: null,
			created: new Date(0),
			title: (this.getUI('title')![0] as HTMLInputElement).value,
			permissions,
			expiresAt: Number.isNaN(expiry)
				? (this.getState().picker?.selectedDates[0] ?? new Date('invalid'))
				: new Date(Date.now() + expiry * 86400000),
		}
	},
	submit(event: Event) {
		event.preventDefault()
		if (this.getState().busy) return
		const token = this.values();
		(this.getUI('titleError')![0] as HTMLElement).hidden = Boolean(
			token.title.trim(),
		);
		(this.getUI('permissionError')![0] as HTMLElement).hidden =
			Object.keys(token.permissions ?? {}).length > 0
		if (!token.title.trim()) {
			(this.getUI('title')![0] as HTMLInputElement).focus()
			return
		}
		if (!Object.keys(token.permissions ?? {}).length) return
		this.options.submit(token, this)
	},
	cancel() {
		this.options.cancel()
	},
	loading(value: boolean) {
		this.getState().busy = value
		const save = this.getUI('save')![0] as HTMLButtonElement
		save.disabled = value
		save.classList.toggle('is-loading', value)
		this.el.setAttribute('aria-busy', String(value))
	},
	feedback(error: string) {
		const el = this.getUI('error')![0] as HTMLElement
		el.textContent = error
		el.hidden = !error
	},
	onBeforeDestroy() {
		this.getState().picker?.destroy()
	},
}).setDomApi(LitDomApi)
