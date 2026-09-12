import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {getDisplayName} from '@/models/user'
import {View} from '../index'

export interface TeamMemberSummary {
	id: number
	name: string
	username: string
	admin: boolean
}

export interface TeamMembersViewOptions {
	members: ReadonlyArray<TeamMemberSummary>
	currentUserId: number
	canManage: boolean
	labels: {admin: string, member: string, you: string, makeAdmin: string, makeMember: string, remove: string}
	onToggleAdmin: (member: TeamMemberSummary) => void
	onRemove: (member: TeamMemberSummary) => void
}

interface TemplateData {
	sortedMembers: ReadonlyArray<TeamMemberSummary>
	currentUserId: number
	canManage: boolean
	labels: {admin: string, member: string, you: string, makeAdmin: string, makeMember: string, remove: string}
}

export const TeamMembersView = View.extend({
	template(data: TemplateData) {
		return html`
			<table class="table has-actions is-striped is-hoverable is-fullwidth">
				<tbody>
					${data.sortedMembers.map(member => {
			const isCurrentUser = member.id === data.currentUserId
			return html`
							<tr data-member-id="${member.id}">
								<td>
									${getDisplayName(member)}
									${isCurrentUser ? html` <span>${data.labels.you}</span>` : ''}
								</td>
								<td>${member.admin ? data.labels.admin : data.labels.member}</td>
								${data.canManage
				? html`
											<td>
												${!isCurrentUser
					? html`
															<button
																type="button"
																class="button toggle-admin"
																data-member-id="${member.id}"
															>
																${member.admin ? data.labels.makeMember : data.labels.makeAdmin}
															</button>
															<button
																type="button"
																class="button remove-member"
																aria-label="${data.labels.remove}"
																data-member-id="${member.id}"
															>
																${data.labels.remove}
															</button>
														`
					: ''}
											</td>
										`
				: ''}
							</tr>
						`
		})}
				</tbody>
			</table>
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as TeamMembersViewOptions
		const sortedMembers = [...opts.members].sort((a, b) => {
			const nameA = getDisplayName(a)
			const nameB = getDisplayName(b)
			return nameA.localeCompare(nameB, undefined, {sensitivity: 'base'})
		})

		return {
			sortedMembers,
			currentUserId: opts.currentUserId,
			canManage: opts.canManage,
			labels: opts.labels,
		}
	},

	events: {
		'click .toggle-admin': 'onToggleAdminClick',
		'click .remove-member': 'onRemoveClick',
	},

	onToggleAdminClick(e: MouseEvent) {
		const opts = this.options as TeamMembersViewOptions
		const el = (e.target as Element | null)?.closest('[data-member-id]')
		if (!el) {
			return
		}
		const memberId = Number(el.getAttribute('data-member-id'))
		const member = opts.members.find(m => m.id === memberId)
		if (member) {
			opts.onToggleAdmin(member)
		}
	},

	onRemoveClick(e: MouseEvent) {
		const opts = this.options as TeamMembersViewOptions
		const el = (e.target as Element | null)?.closest('[data-member-id]')
		if (!el) {
			return
		}
		const memberId = Number(el.getAttribute('data-member-id'))
		const member = opts.members.find(m => m.id === memberId)
		if (member) {
			opts.onRemove(member)
		}
	},
}) as new (options: TeamMembersViewOptions) => ViewInstance
