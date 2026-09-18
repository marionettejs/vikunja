import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface FilterQueryDocsViewOptions {
	t: (key: string) => string
}

interface TemplateData {
	open: boolean
	t: (key: string) => string
}

const fields = [
	'done',
	'priority',
	'percentDone',
	'dueDate',
	'startDate',
	'endDate',
	'doneAt',
	'assignees',
	'createdBy',
	'labels',
	'project',
	'reminders',
	'created',
	'updated',
] as const

const operators = [
	{key: '!=', i18n: 'notEqual'},
	{key: '=', i18n: 'equal'},
	{key: '>', i18n: 'greaterThan'},
	{key: '>=', i18n: 'greaterThanOrEqual'},
	{key: '<', i18n: 'lessThan'},
	{key: '<=', i18n: 'lessThanOrEqual'},
	{key: 'like', i18n: 'like'},
	{key: 'in', i18n: 'in'},
	{key: 'not in', i18n: 'notIn'},
] as const

const logicalOperators = [
	{key: '&&', i18n: 'and'},
	{key: '||', i18n: 'or'},
] as const

const examples = [
	{code: 'priority = 4', i18n: 'priorityEqual'},
	{code: 'dueDate < now', i18n: 'dueDatePast'},
	{code: 'done = false && priority >= 3', i18n: 'undoneHighPriority'},
	{code: 'assignees in user1, user2', i18n: 'assigneesIn'},
	{code: 'createdBy = user1', i18n: 'createdByEqual'},
	{code: '(priority = 1 || priority = 2) && dueDate <= now', i18n: 'priorityOneOrTwoPastDue'},
] as const

export const FilterQueryDocsView = View.extend({
	_open: false,

	events: {
		'click .filter-docs-toggle': 'onToggleClick',
	},

	template(data: TemplateData) {
		const {open, t} = data

		return html`
			<button
				class="base-button base-button--type-button has-text-primary filter-docs-toggle"
			>
				${t('filters.query.help.link')}
			</button>

			${open ? html`
				<div class="expandable content">
					<p>${t('filters.query.help.intro')}</p>
					<ul>
						${fields.map(field => html`
							<li><code>${field}</code>: ${t(`filters.query.help.fields.${field}`)}</li>
						`)}
					</ul>
					<p>${t('filters.query.help.canUseDatemath')}</p>
					<p>${t('filters.query.help.operators.intro')}</p>
					<ul>
						${operators.map(op => html`
							<li><code>${op.key}</code>: ${t(`filters.query.help.operators.${op.i18n}`)}</li>
						`)}
					</ul>
					<p>${t('filters.query.help.logicalOperators.intro')}</p>
					<ul>
						${logicalOperators.map(op => html`
							<li><code>${op.key}</code>: ${t(`filters.query.help.logicalOperators.${op.i18n}`)}</li>
						`)}
						<li><code>(</code> and <code>)</code>: ${t('filters.query.help.logicalOperators.parentheses')}</li>
					</ul>
					<p>${t('filters.query.help.examples.intro')}</p>
					<ul>
						${examples.map(ex => html`
							<li><code>${ex.code}</code>: ${t(`filters.query.help.examples.${ex.i18n}`)}</li>
						`)}
					</ul>
				</div>
			` : ''}
		`
	},

	templateContext(this: {options: FilterQueryDocsViewOptions; _open: boolean}) {
		const opts = this.options as FilterQueryDocsViewOptions
		return {
			open: this._open,
			t: opts.t,
		}
	},

	onToggleClick(this: {_open: boolean; render(): void}, event: Event) {
		const button = (event.target as Element).closest<HTMLButtonElement>('.filter-docs-toggle')
		if (!button || !this.el.contains(button)) {
			return
		}
		this._open = !this._open
		this.render()
	},
}) as new (options: FilterQueryDocsViewOptions) => ViewInstance