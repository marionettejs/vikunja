import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface TeamsListOptions {
	teams: ReadonlyArray<{id: number, name: string}>
	labels: {title: string, create: string, noTeams: string}
	hrefFor: (path: string) => string
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
		if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
		if (event.defaultPrevented) return
		if (event.button !== void 0 && event.button !== 0) return
		const target = anchor.getAttribute('target')
		if (target && /\b_blank\b/i.test(target)) return
		const path = anchor.getAttribute('data-path')
		if (!path) {
			return
		}
		event.preventDefault()
		const opts = this.options as TeamsListOptions
		opts.navigate(path)
	},

	template(data: TemplateData) {
		return html`
			<a class="button is-pulled-end" href="${data.hrefFor('/teams/new')}" data-path="/teams/new">${data.labels.create}</a>
			<h1>${data.labels.title}</h1>
			${data.teams.length > 0
			? html`
					<div class="card">
						<div class="card-content loader-container p-0">
							<div>
								<ul class="teams">
									${data.teams.map(team => html`
										<li><a href="${data.hrefFor(`/teams/${team.id}/edit`)}" data-path="/teams/${team.id}/edit"><p>${team.name}</p></a></li>
									`)}
								</ul>
							</div>
						</div>
					</div>
				`
			: html`
					<p class="has-text-centered has-text-grey is-italic">${data.labels.noTeams} <a href="${data.hrefFor('/teams/new')}" data-path="/teams/new">${data.labels.create}.</a></p>
				`}
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as TeamsListOptions
		return {
			teams: opts.teams,
			labels: opts.labels,
			hrefFor: opts.hrefFor,
			navigate: opts.navigate,
		}
	},
}) as new (options: TeamsListOptions) => ViewInstance

export default TeamsListView
