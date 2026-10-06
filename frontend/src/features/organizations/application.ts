import { Application, View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, nothing } from 'lit-html'
import TeamService from '@/services/team'
import TeamModel from '@/models/team'
import type { ITeam } from '@/modelTypes/ITeam'
import { getRandomColorHex } from '@/helpers/color/randomColor'
import { ColorPickerView,publicTeamCheckbox } from './organization-ui'
import { CatalogApplication } from '../projects/catalog'
import { createLabel } from '../labels/label-transport'
import type { Route } from '../../app/routes'
import { t } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
interface Options {
    navigate: (href: string, replace?: boolean) => void;
    config: () => Record<string, unknown>;
    catalog: InstanceType<typeof CatalogApplication>;
}
const CreateView = View.extend({
	initialize(options: {
        family: string;
        publicEnabled: boolean;
        submit: (name: string, color: string, isPublic: boolean) => void;
        close: () => void;
    }) { void options }, tagName: 'dialog', className: 'modal-dialog default native-sharing-confirmation native-organization-create native-list-surface', regions: { color: '[data-color]' },
	ui: { form: 'form', name: 'input[data-name]', public: 'input[data-public]', error: '[data-error]', submit: '[data-submit]' }, events: { 'input @ui.name': 'changed', 'submit @ui.form': 'submit', 'keydown @ui.name': 'key', 'click @ui.submit': 'submit', 'click [data-close]': 'close', cancel: 'close' },
	createState() { return { color: getRandomColorHex(), focus: document.activeElement as HTMLElement | null, overflow: document.body.style.overflow } }, templateContext() { return this.options },
	template({ family, publicEnabled }: {
        family: string;
        publicEnabled: boolean;
    }) { const team = family === 'team'; return html `<div class="modal-container"><button type="button" class="base-button base-button--type-button close" data-close aria-label=${t('misc.closeDialog')}>${listIcon('times')}</button><div class="modal-content"><div class="card"><header class="card-header"><p class="card-header-title">${t(team ? 'team.create.title' : 'label.create.title')}</p></header><div class="p-4"><div role="alert" data-error class="message danger" hidden></div><form><div class="field"><label class="label" for=${team ? 'teamName' : 'labelTitle'}>${t(team ? 'team.attributes.name' : 'label.attributes.title')}</label><input data-name id=${team ? 'teamName' : 'labelTitle'} class="input" placeholder=${t(team ? 'team.attributes.namePlaceholder' : 'label.attributes.titlePlaceholder')}></div>${team ? publicEnabled ? publicTeamCheckbox(false) : nothing : html `<div class="field"><label class="label">${t('label.attributes.color')}</label><div data-color></div></div>`}</form></div><footer class="card-footer"><button type="button" data-close class="button is-outlined">${t('misc.cancel')}</button><button type="button" data-submit class="button is-primary" disabled>${t('misc.create')}</button></footer></div></div></div>` },
	onRender() { if (this.options.family === 'label')
		this.showChildView('color', new ColorPickerView({ value: this.getState().color, changed: value => { this.getState().color = value } })) },
	changed() { (this.getUI('submit')![0] as HTMLButtonElement).disabled = !(this.getUI('name')![0] as HTMLInputElement).value }, onAttach() { this.getState(); document.body.style.overflow = 'hidden'; (this.el as HTMLDialogElement).showModal(); (this.getUI('name')![0] as HTMLInputElement).focus() }, key(event: KeyboardEvent) { if (event.key === 'Enter' && !event.isComposing)
		this.submit(event) }, submit(event: Event) { event.preventDefault(); this.options.submit((this.getUI('name')![0] as HTMLInputElement).value, this.getState().color, (this.getUI('public')?.[0] as HTMLInputElement | undefined)?.checked ?? false) }, close(event: Event) { event.preventDefault(); this.options.close() },
	loading(value: boolean) { for (const el of this.el.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,[data-submit]'))
		el.disabled = value; (this.getUI('submit')![0] as HTMLElement).classList.toggle('is-loading', value); if (value)
		(this.getUI('error')![0] as HTMLElement).hidden = true }, feedback(error: unknown) { const el = this.getUI('error')![0] as HTMLElement; el.hidden = false; el.textContent = errorText(error) },
	onBeforeDestroy() { (this.el as HTMLDialogElement).close(); document.body.style.overflow = this.getState().overflow; if (this.getState().focus?.isConnected)
        this.getState().focus!.focus() },
}).setDomApi(LitDomApi)
export const OrganizationCreateApplication = Application.extend({
	initialize(options: Options) { void options }, createState() { return { route: undefined as Route | undefined, request: undefined as AbortController | undefined } }, onBeforeStart(_app: unknown, route: Route) { this.getState().route = route }, onStart() { const family = this.getState().route!.params.family; this.setView(new CreateView({ family, publicEnabled: Boolean(this.options.config().public_teams_enabled), submit: (name, color, isPublic) => void this.write(name, color, isPublic), close: () => { if (history.state?.backdropView)
		history.back()
	else
		this.options.navigate(family === 'team' ? '/teams' : '/labels', true) } })); this.showView(); document.title = `${t(family === 'team' ? 'team.create.title' : 'label.create.title')} | Vikunja` },
	async write(name: string, color: string, isPublic: boolean) { const state = this.getState(); if (state.request || !name.trim())
		return; const request = state.request = new AbortController(), view = this.getView() as InstanceType<typeof CreateView>, family = state.route!.params.family; view.loading(true); try {
		if (family === 'team') {
			const team = await new TeamService().create(new TeamModel({ name, isPublic }) as ITeam, request.signal)
			request.signal.throwIfAborted()
			if (this.isRunning() && !view.isDestroyed())
				this.options.navigate(`/teams/${team.id}/edit`)
		}
		else {
			const label = await createLabel({ title: name, hex_color: color }, request.signal)
			if (this.isRunning() && !view.isDestroyed()) {
				this.options.catalog.commitLabel(label)
				this.options.navigate('/labels')
			}
		}
		if (!request.signal.aborted && this.isRunning())
			success(t(family === 'team' ? 'team.create.success' : 'label.create.success'))
	}
	catch (error) {
		if (!request.signal.aborted && this.isRunning() && !view.isDestroyed())
			view.feedback(error)
	}
	finally {
		if (state.request === request)
			state.request = undefined
		if (!request.signal.aborted && !view.isDestroyed())
			view.loading(false)
	} }, onBeforeStop() { this.getState().request?.abort(); this.getState().request = undefined; this.getState().route = undefined },
})
