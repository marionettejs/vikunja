import { Application, View, type LifecycleContext } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html, render } from 'lit-html'
import type { Label } from '@/client/generated/index'
import { getTextColor } from '@/helpers/color/getTextColor'
import { NativeEditorView, type NativeEditorOptions } from '@/shared/editor/editor'
import { ConfirmationView } from '../projects/project-sharing'
import { ColorPickerView } from '../organizations/organization-ui'
import { CatalogApplication } from '../projects/catalog'
import { loadLabels, updateLabel, deleteLabel } from './label-transport'
import { interceptLink, type Route } from '../../app/routes'
import { t, locale } from '../../shared/i18n'
import { errorText, success } from '../../shared/notifications'
import { listIcon } from '@/shared/task-list/list-ui'
import '../organizations/organization.scss'
interface Options {
    userId: () => number;
    editor: NativeEditorOptions['context'];
    catalog: InstanceType<typeof CatalogApplication>;
    navigate: (href: string) => void;
}
const LabelEditView = View.extend({
	initialize(options: {
        label: Label;
        editor: Options['editor'];
        submit: (label: Label) => void;
        remove: (label: Label) => void;
        close: () => void;
    }) { void options }, className: 'column is-4 native-label-editor', regions: { description: '[data-description]', color: '[data-color]', confirmation: '[data-confirmation]' },
	ui: { form: 'form', title: 'input', error: '[data-error]', submit: '[data-submit]' }, events: { 'submit @ui.form': 'submit', 'click [data-delete]': 'confirm', 'click [data-close]': 'close' },
	createState() { return { draft: { ...this.options.label } } }, templateContext() { return this.options }, template({ label }: {
        label: Label;
    }) { return html `<section class="card"><header class="card-header"><p class="card-header-title">${t('label.edit.header')}</p><button type="button" class="base-button base-button--type-button card-header-icon" data-close aria-label=${t('misc.closeDialog')}>${listIcon('times')}</button></header><div class="card-content"><div role="alert" data-error class="message danger" hidden></div><form><div class="field"><label class="label" for="label-edit-title">${t('label.attributes.title')}</label><input id="label-edit-title" class="input" placeholder=${t('label.attributes.titlePlaceholder')} .value=${label.title ?? ''}></div><div class="field"><label class="label">${t('label.attributes.description')}</label><div data-description></div></div><div class="field"><label class="label">${t('label.attributes.color')}</label><div data-color></div></div><div class="field has-addons"><div class="control is-expanded"><button type="submit" data-submit class="button is-primary is-fullwidth">${t('misc.save')}</button></div><div class="control"><button type="button" data-delete class="button is-danger" aria-label=${t('task.label.delete.header')}>${listIcon('trash-alt')}</button></div></div></form></div></section><div data-confirmation></div>` },
	onRender() { const draft = this.getState().draft; this.showChildView('description', new NativeEditorView({ value: draft.description ?? '', canWrite: true, projectId: 0, storageKey: `label-${draft.id}-description`, placeholder: t('label.attributes.description'), context: this.options.editor, changed: value => { draft.description = value }, save: async (value) => value, showSave: false, enableDiscard: false, editShortcut: '' })); this.showChildView('color', new ColorPickerView({ value: draft.hex_color ?? '', changed: value => { draft.hex_color = value } })) },
	values() { return { ...this.getState().draft, title: (this.getUI('title')![0] as HTMLInputElement).value } }, submit(event: Event) { event.preventDefault(); this.options.submit(this.values()) }, confirm() { this.showChildView('confirmation', new ConfirmationView({ title: t('task.label.delete.header'), text: `${t('task.label.delete.text1')} ${t('task.label.delete.text2')}`, close: () => this.getRegion('confirmation')!.empty(), submit: () => this.options.remove(this.values()) })) }, close() { this.options.close() },
	loading(value: boolean) { for (const button of this.el.querySelectorAll<HTMLButtonElement>('[data-submit],[data-delete]')) {
		button.disabled = value
		button.classList.toggle('is-loading', value)
	} (this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.loading(value); if (value)
		(this.getUI('error')![0] as HTMLElement).hidden = true }, feedback(error: unknown) { const el = this.getUI('error')![0] as HTMLElement; el.hidden = false; el.textContent = errorText(error); (this.getChildView('confirmation') as InstanceType<typeof ConfirmationView> | undefined)?.feedback(error) },
}).setDomApi(LitDomApi)
const LabelsView = View.extend({
	initialize(options: {
        labels: Label[];
        userId: number;
        editor: Options['editor'];
        navigate: Options['navigate'];
        write: (action: string, label: Label, view: InstanceType<typeof LabelEditView>) => void;
    }) { void options }, className: 'loader-container native-labels native-list-surface', regions: { editor: '[data-editor]' }, ui: { tags: '[data-tags]', description: '[data-description]' }, events: { 'click [data-edit]': 'edit' },
	templateContext() { return this.options }, template({ navigate }: {
        navigate: Options['navigate'];
    }) { return html `<a href="/labels/new" class="button is-primary is-pulled-end" @click=${(event: MouseEvent) => interceptLink(event, navigate)}><span class="icon is-small">${listIcon('plus')}</span><span>${t('label.create.header')}</span></a><div class="content"><h1>${t('label.manage')}</h1><p data-description></p></div><div class="columns"><div class="labels-list column" data-tags></div><div data-editor style="display:contents"></div></div>` },
	onRender() { this.publish(this.options.labels) }, publish(labels: Label[]) { this.options.labels = labels; const sorted = [...labels].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', locale(), { ignorePunctuation: true })); const el = this.getUI('description')![0] as HTMLElement; el.textContent = t(labels.length ? 'label.description' : 'label.newCTA'); render(html `${sorted.map(label => { const color = label.hex_color ? label.hex_color.startsWith('#') || label.hex_color.startsWith('var(') ? label.hex_color : `#${label.hex_color}` : ''; return html `<a class="tag" href=${`/?labels=${label.id}`} style=${`background:${color || 'var(--grey-200)'};color:${color ? getTextColor(color) : 'var(--grey-800)'}`} @click=${(event: MouseEvent) => { if ((event.target as Element).closest('[data-edit]'))
		return; interceptLink(event, this.options.navigate) }}><span>${label.title}</span>${label.created_by?.id === this.options.userId ? html `<button type="button" data-edit=${label.id} class="base-button base-button--type-button label-edit-button is-small" aria-label=${t('label.edit.header')}>${listIcon('pen')}</button>` : ''}</a>` })}`, (this.getUI('tags')![0] as HTMLElement)) },
	edit(event: Event) { event.preventDefault(); event.stopPropagation(); const label = this.options.labels.find(label => label.id === Number((event as Event & {
        delegateTarget: HTMLElement;
    }).delegateTarget.dataset.edit)); if (!label || label.created_by?.id !== this.options.userId)
		return; const view = new LabelEditView({ label, editor: this.options.editor, submit: value => this.options.write('save', value, view), remove: value => this.options.write('delete', value, view), close: () => this.getRegion('editor')!.empty() }); this.showChildView('editor', view) },
}).setDomApi(LitDomApi)
export const LabelsApplication = Application.extend({
	initialize(options: Options) { void options }, createState() { return { request: undefined as AbortController | undefined, labels: [] as Label[] } }, async prepareStart(_route: Route, { signal }: LifecycleContext) { return loadLabels(signal) },
	onStart(_app: unknown, _route: unknown, labels: Label[]) { this.options.catalog.publishLabels(labels); this.getState().labels = this.options.catalog.getState().labels; this.setView(new LabelsView({ ...this.options, labels: this.getState().labels, userId: this.options.userId(), write: (action, label, view) => void this.write(action, label, view) })); this.showView(); this.listenTo(this.options.catalog, 'labels:changed', (labels: Label[]) => { this.getState().labels = labels; (this.getView() as InstanceType<typeof LabelsView>).publish(labels) }); document.title = `${t('label.title')} | Vikunja` },
	async write(action: string, label: Label, view: InstanceType<typeof LabelEditView>) { const state = this.getState(); if (state.request)
		return; const request = state.request = new AbortController(); view.loading(true); try {
		if (action === 'delete') {
			await deleteLabel(label.id!, request.signal)
			if (request.signal.aborted || !this.isRunning())
				return
			state.labels = state.labels.filter(item => item.id !== label.id)
			this.options.catalog.removeLabel(label.id!)
			if (!view.isDestroyed())
                (this.getView() as InstanceType<typeof LabelsView>).getRegion('editor')!.empty()
		}
		else {
			const updated = await updateLabel(label, request.signal)
			if (request.signal.aborted || !this.isRunning())
				return
			state.labels = state.labels.map(item => item.id === updated.id ? updated : item)
			this.options.catalog.commitLabel(updated)
		}
		if (!request.signal.aborted && this.isRunning()) {
			(this.getView() as InstanceType<typeof LabelsView>).publish(state.labels)
			success(t(action === 'delete' ? 'label.deleteSuccess' : 'label.edit.success'))
		}
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
	} },
	onBeforeStop() { this.stopListening(this.options.catalog); this.getState().request?.abort(); this.getState().request = undefined; this.getState().labels = [] },
})
