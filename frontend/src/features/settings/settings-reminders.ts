import {View,CollectionView} from 'marionette'
import {Collection,DataApi,type Model} from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import TaskReminderModel from '@/models/taskReminder'
import {secondsToPeriod,periodToSeconds,type PeriodUnit} from '@/helpers/time/period'
import {t} from '../../shared/i18n'
import {listIcon} from '@/shared/task-list/list-ui'
const presets=[0,-7200,-86400,-259200,-604800,-2592000]
export function reminderLabel(seconds:number){if(seconds===0)return t('task.reminder.onDueDate');const period=secondsToPeriod(seconds),amount=Math.abs(period.amount);return t(seconds<0?'task.reminder.before':'task.reminder.after',{amount,unit:t(`time.units.${period.unit}`,amount),type:t('task.attributes.dueDate')})}
const ReminderPopupView=View.extend({
	initialize(options:{value:number,accepted:(value:number)=>void,closed:()=>void}){void options},className:'card reminder-options-popup',
	ui:{preset:'[data-preset]',custom:'[data-custom]',options:'[data-options]',form:'[data-period-form]',amount:'input',unit:'[data-unit]',direction:'[data-direction]',confirm:'[data-confirm]'},
	events:{'click @ui.preset':'preset','click @ui.custom':'custom','click @ui.confirm':'confirm','submit @ui.form':'confirm','keydown':'key'},
	templateContext(){const period=secondsToPeriod(this.options.value);return {value:this.options.value,amount:Math.abs(period.amount),unit:period.unit}},
	template({value,amount,unit}:{value:number,amount:number,unit:PeriodUnit}){return html`<div class="options" data-options>${presets.map(period=>html`<button type="button" class="base-button base-button--type-button option-button ${period===value?'currently-active':''}" data-preset=${period}>${reminderLabel(period)}</button>`)}<button type="button" class="base-button base-button--type-button option-button" data-custom>${t('task.reminder.custom')}</button></div><form data-period-form hidden><div class="reminder-period control"><input type="number" class="input" min="0" aria-label=${t('task.reminder.custom')} .value=${String(amount)}><div class="select"><select data-unit aria-label=${t('task.reminder.periodUnit')}>${['minutes','hours','days','weeks'].map(item=>html`<option value=${item} ?selected=${unit===item}>${t(`time.units.${item}`,amount)}</option>`)}</select></div><div class="select"><select data-direction aria-label=${t('task.reminder.periodDirection')}><option value="-1" ?selected=${value<=0}>${t('task.reminder.beforeShort')}</option><option value="1" ?selected=${value>0}>${t('task.reminder.afterShort')}</option></select></div></div><button type="submit" data-confirm class="base-button base-button--type-button button is-primary reminder__close-button">${t('misc.confirm')}</button></form>`},
	preset(event:Event){this.options.accepted(Number((event as Event&{delegateTarget:HTMLElement}).delegateTarget.dataset.preset))},
	custom(){(this.getUI('options')![0] as HTMLElement).hidden=true;(this.getUI('form')![0] as HTMLElement).hidden=false;(this.getUI('amount')![0] as HTMLInputElement).focus()},
	confirm(event:Event){event.preventDefault();event.stopPropagation();const amount=Number((this.getUI('amount')![0] as HTMLInputElement).value),unit=(this.getUI('unit')![0] as HTMLSelectElement).value as PeriodUnit,direction=Number((this.getUI('direction')![0] as HTMLSelectElement).value);if(!Number.isFinite(amount))return;this.options.accepted(direction*periodToSeconds(Math.abs(amount),unit))},
	key(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.options.closed()}},
}).setDomApi(LitDomApi)
const ReminderRowView=View.extend({
	initialize(options:{model?:Model,changed:(reminder:ITaskReminder)=>void,remove?:()=>void}){void options},className:'reminder-input',
	regions:{popup:'[data-popup]'},ui:{trigger:'[data-trigger]',remove:'[data-remove]'},events:{'click @ui.trigger':'toggle','click @ui.remove':'remove'},
	createState(){return {outside:(event:MouseEvent)=>{if(!this.el.contains(event.target as Node))this.close(false)}}},
	templateContext(){return {reminder:(this.options.model?.get('reminder') as ITaskReminder|undefined),remove:this.options.remove}},
	template({reminder,remove}:{reminder?:ITaskReminder,remove?:()=>void}){return html`<div class="reminder-detail"><button type="button" class="base-button base-button--type-button simple-button" data-trigger>${reminder?reminderLabel(reminder.relativePeriod):t('task.addReminder')}</button><div data-popup></div></div>${remove?html`<button type="button" class="base-button base-button--type-button remove" data-remove aria-label=${t('task.removeReminder')}>${listIcon('times')}</button>`:''}`},
	onAttach(){document.addEventListener('click',this.getState().outside)},
	toggle(event:Event){event.preventDefault();if(this.getChildView('popup')){this.close(true);return}this.showChildView('popup',new ReminderPopupView({value:(this.options.model?.get('reminder') as ITaskReminder|undefined)?.relativePeriod??0,accepted:(value:number)=>{const reminder=new TaskReminderModel({reminder:null,relativePeriod:value,relativeTo:'due_date'});this.options.changed(reminder);const trigger=this.getUI('trigger')![0] as HTMLElement;trigger.textContent=this.options.model?reminderLabel(value):t('task.addReminder');this.close(true)},closed:()=>this.close(true)}))},
	remove(event:Event){event.preventDefault();this.options.remove?.()},close(focus:boolean){this.getRegion('popup')!.empty();if(focus)(this.getUI('trigger')![0] as HTMLButtonElement).focus()},
	onBeforeDestroy(){document.removeEventListener('click',this.getState().outside)},
}).setDomApi(LitDomApi)
const ReminderRowsView=CollectionView.extend({childView:ReminderRowView}).setDataApi(DataApi)
export const SettingsRemindersView=View.extend({
	initialize(options:{items:ITaskReminder[],changed:(items:ITaskReminder[])=>void}){void options},className:'reminders',regions:{rows:'[data-rows]',add:'[data-add]'},
	createState(){const options=this.options as {items:ITaskReminder[]};return {items:(new Collection(options.items.map((reminder,id)=>({id,reminder}))) as Collection<Model>),next:options.items.length}},
	template:()=>html`<div data-rows></div><div data-add></div>`,
	onRender(){const items=this.getState().items;this.showChildView('rows',new ReminderRowsView({collection:items,childViewOptions:(model:Model)=>({model,changed:(reminder:ITaskReminder)=>{model.set('reminder',reminder);this.changed()},remove:()=>{items.remove(model);this.changed()}})}));this.showChildView('add',new ReminderRowView({changed:(reminder:ITaskReminder)=>{items.add({id:this.getState().next++,reminder});this.changed()}}))},
	changed(){this.options.changed(this.getState().items.models.map(model=>model.get('reminder') as ITaskReminder))},
}).setDomApi(LitDomApi)
