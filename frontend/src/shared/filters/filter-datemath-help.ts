import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html, type TemplateResult} from 'lit-html'
import {formatDateShort} from '@/shared/dates'
import type {ListContext} from '../task-list/list-context'
import {translatedParts} from '../task-list/list-ui'

export const DatemathHelpView = View.extend({
	className: 'card has-no-shadow how-it-works-modal',
	initialize(options: {context: ListContext}) { void options },
	templateContext() { return {t: this.options.context.t, exampleDate: formatDateShort(new Date())} },
	template: ({t, exampleDate}: {t: ListContext['t'], exampleDate: string}): TemplateResult => html`<header class="card-header"><p class="card-header-title">${t('input.datemathHelp.title')}</p></header><div class="card-content loader-container"><div class="content">
		<p>
			${t('input.datemathHelp.intro')}
		</p>
		<p>
			${translatedParts(t, 'input.datemathHelp.expression', [html`<code>now</code>`, html`<code>||</code>`])}
		</p>
		<p>
			${translatedParts(t, 'input.datemathHelp.similar', [html`<a class="base-button"
					href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls/"
					target="_blank"
				>
					Grafana
				</a>`, html`<a class="base-button"
					href="https://www.elastic.co/guide/en/elasticsearch/reference/7.3/common-options.html#date-math"
					target="_blank"
				>
					Elasticsearch
				</a>`])}
		</p>
		<p>${t('misc.forExample')}</p>
		<ul>
			<li><code>+1d</code>: ${t('input.datemathHelp.add1Day')}</li>
			<li><code>-1d</code>: ${t('input.datemathHelp.minus1Day')}</li>
			<li><code>/d</code>: ${t('input.datemathHelp.roundDay')}</li>
		</ul>
		<h3>${t('input.datemathHelp.supportedUnits')}</h3>
		<table class="table">
			<tbody>
				<tr>
					<td><code>s</code></td>
					<td>${t('input.datemathHelp.units.seconds')}</td>
				</tr>
				<tr>
					<td><code>m</code></td>
					<td>${t('input.datemathHelp.units.minutes')}</td>
				</tr>
				<tr>
					<td><code>h</code></td>
					<td>${t('input.datemathHelp.units.hours')}</td>
				</tr>
				<tr>
					<td><code>H</code></td>
					<td>${t('input.datemathHelp.units.hours')}</td>
				</tr>
				<tr>
					<td><code>d</code></td>
					<td>${t('input.datemathHelp.units.days')}</td>
				</tr>
				<tr>
					<td><code>w</code></td>
					<td>${t('input.datemathHelp.units.weeks')}</td>
				</tr>
				<tr>
					<td><code>M</code></td>
					<td>${t('input.datemathHelp.units.months')}</td>
				</tr>
				<tr>
					<td><code>y</code></td>
					<td>${t('input.datemathHelp.units.years')}</td>
				</tr>
			</tbody>
		</table>

		<h3>${t('input.datemathHelp.someExamples')}</h3>
		<table class="table">
			<tbody>
				<tr>
					<td><code>now</code></td>
					<td>${t('input.datemathHelp.examples.now')}</td>
				</tr>
				<tr>
					<td><code>now+24h</code></td>
					<td>${t('input.datemathHelp.examples.in24h')}</td>
				</tr>
				<tr>
					<td><code>now/d</code></td>
					<td>${t('input.datemathHelp.examples.today')}</td>
				</tr>
				<tr>
					<td><code>now/w</code></td>
					<td>${t('input.datemathHelp.examples.beginningOfThisWeek')}</td>
				</tr>
				<tr>
					<td><code>now/w+1w</code></td>
					<td>${t('input.datemathHelp.examples.endOfThisWeek')}</td>
				</tr>
				<tr>
					<td><code>now+30d</code></td>
					<td>${t('input.datemathHelp.examples.in30Days')}</td>
				</tr>
				<tr>
					<td><code>${exampleDate}||+1M/d</code></td>
					<td>
						${translatedParts(t, 'input.datemathHelp.examples.datePlusMonth', [html`<strong>${exampleDate}</strong>`])}
					</td>
				</tr>
			</tbody>
		</table></div></div>`,
}).setDomApi(LitDomApi)
