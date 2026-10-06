import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, render} from 'lit-html'
import {t} from '../../shared/i18n'
import {listIcon} from '@/shared/task-list/list-ui'
export interface SettingsChoice {value:string|number,label:string,context?:string}
export const SettingsSearchView=View.extend({
	initialize(options:{id:string,label:string,placeholder:string,items:SettingsChoice[],selected:string|number|null|undefined,changed:(value:string|number|null)=>void}){void options},
	className:'multiselect native-settings-search',
	ui:{input:'input',clear:'[data-clear]',results:'[data-results]',options:'[role=option]'},
	events:{'input @ui.input':'search','focus @ui.input':'open','keydown @ui.input':'key','click @ui.clear':'clear','click @ui.options':'select','focusout':'blur'},
	createState(){const options=this.options as {items:SettingsChoice[],selected:string|number|null|undefined};return {open:false,index:0,query:'',selected:options.items.find(item=>item.value===options.selected),outside:(event:MouseEvent)=>{if(!this.el.contains(event.target as Node))this.close()}}},
	templateContext(){return this.options},
	template({id,label,placeholder}:{id:string,label:string,placeholder:string}){return html`<div class="control"><div class="input-wrapper input has-removal-button"><input id=${id} type="text" class="input" role="combobox" aria-label=${label} placeholder=${placeholder} aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls=${`${id}-results`} autocomplete="off" spellcheck="false"><button type="button" data-clear class="base-button base-button--type-button removal-button" aria-label=${t('input.multiselect.clear')} hidden>${listIcon('times')}</button></div></div><div data-results id=${`${id}-results`} class="search-results" role="listbox" aria-label=${label} hidden></div>`},
	onRender(){(this.getUI('input')![0] as HTMLInputElement).value=this.getState().selected?.label??'';(this.getUI('clear')![0] as HTMLElement).hidden=!this.getState().selected},
	focus(){(this.getUI('input')![0] as HTMLInputElement).focus()},
	onAttach(){document.addEventListener('click',this.getState().outside)},
	filtered(){const query=this.getState().query.toLocaleLowerCase();return this.options.items.filter(item=>`${item.context??''} ${item.label}`.toLocaleLowerCase().includes(query))},
	open(){this.getState().open=true;this.getState().query='';this.getState().index=0;this.publish()},
	search(){const state=this.getState();state.query=(this.getUI('input')![0] as HTMLInputElement).value;state.open=true;state.index=0;if(!state.query&&state.selected){state.selected=undefined;this.options.changed(null);(this.getUI('clear')![0] as HTMLElement).hidden=true}this.publish()},
	publish(){const state=this.getState(),items=this.filtered(),input=this.getUI('input')![0] as HTMLInputElement,results=this.getUI('results')![0] as HTMLElement;results.hidden=!state.open;input.setAttribute('aria-expanded',String(state.open));input.setAttribute('aria-activedescendant',state.open&&items[state.index]?`${this.options.id}-option-${state.index}`:'');render(html`${items.map((item,index)=>html`<button type="button" role="option" id=${`${this.options.id}-option-${index}`} data-index=${index} aria-selected=${String(index===state.index)} class="base-button base-button--type-button search-result-button is-fullwidth"><span>${item.context?html`<span class="has-text-grey">${item.context} &gt; </span>`:''}${item.label}</span></button>`)}`,results)},
	key(event:KeyboardEvent){if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();this.close();return}if(event.key==='Tab'){this.close();return}if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;event.preventDefault();if(!this.getState().open)this.open();else if(event.key==='Enter'){this.choose(this.getState().index);return}else{const count=this.filtered().length;if(count)this.getState().index=(this.getState().index+count+(event.key==='ArrowUp'?-1:1))%count}this.publish()},
	select(event:Event){const target=(event as Event&{delegateTarget:HTMLElement}).delegateTarget;this.choose(Number(target.dataset.index))},
	choose(index:number){const item=this.filtered()[index];if(!item)return;this.getState().selected=item;(this.getUI('input')![0] as HTMLInputElement).value=item.label;(this.getUI('clear')![0] as HTMLElement).hidden=false;this.options.changed(item.value);this.close();(this.getUI('input')![0] as HTMLInputElement).focus();this.getState().open=false;this.publish()},
	clear(event:Event){event.preventDefault();this.getState().selected=undefined;this.options.changed(null);(this.getUI('input')![0] as HTMLInputElement).value='';(this.getUI('clear')![0] as HTMLElement).hidden=true;this.close();(this.getUI('input')![0] as HTMLInputElement).focus()},
	blur(event:FocusEvent){if(!this.el.contains(event.relatedTarget as Node))this.close()},
	close(){this.getState().open=false;this.publish()},
	onBeforeDestroy(){document.removeEventListener('click',this.getState().outside)},
}).setDomApi(LitDomApi)
