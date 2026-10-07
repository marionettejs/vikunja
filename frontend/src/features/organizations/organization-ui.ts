import { View } from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import { t } from '../../shared/i18n'
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js'
import checkboxSvg from '@/assets/checkbox.svg?raw'
import { createRandomID } from '@/helpers/randomId'
export const ColorPickerView = View.extend({
	initialize(options: {
        value: string;
        changed: (color: string) => void;
    }) { void options }, className: 'color-picker-container',
	ui: { input: 'input', reset: '[data-reset]', pattern: 'svg' }, events: { 'input @ui.input': 'change', 'click @ui.reset': 'reset' },
	createState() { return { value: this.options.value, id: createRandomID() } },
	templateContext() { return this.getState() }, template({ id }: {
        id: string;
    }) { return html `<datalist id=${id}>${['#1973ff', '#7F23FF', '#ff4136', '#ff851b', '#ffeb10', '#00db60'].map(color => html `<option value=${color}></option>`)}</datalist><div class="picker"><input class="picker__input" type="color" list=${id} aria-label=${t('input.projectColor')}><svg class="picker__pattern" viewBox="0 0 22 22"><pattern id=${`${id}-checker`} width="11" height="11" patternUnits="userSpaceOnUse"><rect fill="#ccc" width="5.5" height="5.5"></rect><rect fill="#ccc" x="5.5" y="5.5" width="5.5" height="5.5"></rect></pattern><rect width="22" height="22" fill=${`url(#${id}-checker)`}></rect></svg></div><button type="button" data-reset class="button is-small is-outlined mis-2">${t('input.resetColor')}</button>` },
	onRender() { this.publish() }, publish() { const value = this.getState().value, empty = !value || value.startsWith('var('); (this.getUI('input')![0] as HTMLInputElement).value = empty ? '#000000' : value.startsWith('#') ? value : `#${value}`; (this.getUI('input')![0] as HTMLElement).classList.toggle('is-empty', empty); (this.getUI('pattern')![0] as SVGElement).style.display = empty ? '' : 'none'; (this.getUI('reset')![0] as HTMLElement).hidden = empty },
	change() { this.getState().value = (this.getUI('input')![0] as HTMLInputElement).value; this.publish(); this.options.changed(this.getState().value) }, reset() { this.getState().value = ''; this.publish(); this.options.changed('') },
}).setDomApi(LitDomApi)

export const publicTeamCheckbox=(checked:boolean)=>html`<div class="field"><label class="label">${t('team.attributes.isPublic')}</label><div class="base-checkbox fancy-checkbox"><label class="base-checkbox__label"><input data-public class="is-sr-only" type="checkbox" .checked=${checked}>${unsafeHTML(checkboxSvg.replace('<svg ', '<svg class="fancy-checkbox__icon" '))}<span class="fancy-checkbox__content">${t('team.attributes.isPublicDescription')}</span></label></div></div>`
