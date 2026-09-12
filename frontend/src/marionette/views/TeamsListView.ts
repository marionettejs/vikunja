import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface TeamsListOptions {
	teams: ReadonlyArray<{id: number, name: string}>
	labels: {title: string, create: string, noTeams: string}
	navigate: (path: string) => void
}

type TemplateData = TeamsListOptions

const TeamsListView = View.extend({
	className: 'content loader-container is-max-width-desktop',

	events: {
		'click a': 'onClickLink',
	},

	onClickLink(event: MouseEvent) {
		const anchor = (event.target as Element | null)?.closest('a')
		if (!anchor) {
			return
		}
		const href = anchor.getAttribute('href')
		if (!href) {
			return
		}
		event.preventDefault()
		const opts = this.options as TeamsListOptions
		opts.navigate(href)
	},

	template(data: TemplateData) {
		return html`
			<a class="button is-pulled-end" href="/teams/new">${data.labels.create}</a>
			<h1>${data.labels.title}</h1>
			${data.teams.length > 0
			? html`
					<div class="card">
						<div class="card-content loader-container p-0">
							<div>
								<ul class="teams">
									${data.teams.map(team => html`
										<li><a href="/teams/${team.id}/edit"><p>${team.name}</p></a></li>
									`)}
								</ul>
							</div>
						</div>
					</div>
				`
			: html`
					<p class="has-text-centered has-text-grey is-italic">${data.labels.noTeams} <a href="/teams/new">${data.labels.create}.</a></p>
				`}
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as TeamsListOptions
		return {
			teams: opts.teams,
			labels: opts.labels,
			navigate: opts.navigate,
		}
	},
}) as new (options: TeamsListOptions) => ViewInstance

export default TeamsListView
