import type {Editor} from '@tiptap/core'
import {html} from 'lit-html'
import type {MentionNodeAttrs} from '@tiptap/extension-mention'

import {SuggestionListView} from '@/marionette/views/SuggestionListView'
import type {SuggestionListViewInstance} from '@/marionette/views/SuggestionListView'
import {UserAvatarView} from '@/marionette/views/UserAvatarView'
import type {UserAvatarViewInstance} from '@/marionette/views/UserAvatarView'
import {getPopupContainer} from '../popupContainer'
import {createSuggestionPopup, type SuggestionPopup} from '../suggestionPopup'
import ProjectUserService from '@/services/projectUsers'
import {getDisplayName} from '@/models/user'
import type {IUser} from '@/modelTypes/IUser'

type TranslateFunction = (key: string) => string

interface MentionItem extends MentionNodeAttrs {
	id: string
	label: string
	username: string
}

interface SuggestionProps {
	editor: Editor
	clientRect?: (() => DOMRect | null) | null
	items: MentionItem[]
	command: (item: MentionItem) => void
}

const AVATAR_SIZE = 32
const SEARCH_DEBOUNCE = 300

async function searchUsersForProject(projectId: number, query: string): Promise<MentionItem[]> {
	const projectUserService = new ProjectUserService()

	// Use server-side search with the 's' parameter
	// @ts-expect-error - projectId is used for URL replacement but not part of IAbstract
	const users = await projectUserService.getAll({projectId}, {s: query}) as IUser[]

	return users.map(user => ({
		id: user.username,
		label: getDisplayName(user),
		username: user.username,
	}))
}

export default function mentionSuggestionSetup(projectId: number, t: TranslateFunction) {
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	return {
		char: '@',

		items: async ({query}: {query: string}): Promise<MentionItem[]> => {
			if (!projectId) {
				return []
			}

			// Clear existing timer
			if (debounceTimer) {
				clearTimeout(debounceTimer)
			}

			// Return a promise that resolves after debounce delay
			return new Promise(resolve => {
				debounceTimer = setTimeout(async () => {
					try {
						// Use server-side search - the backend will handle searching by username and display name
						const users = await searchUsersForProject(projectId, query)

						// Limit results to avoid overwhelming the UI
						const limit = query ? 10 : 5
						resolve(users.slice(0, limit))
					} catch (error) {
						console.error('Failed to fetch users for mentions:', error)
						resolve([])
					}
				}, SEARCH_DEBOUNCE)
			})
		},

		render: () => {
			// onExit runs without a matching onStart when the plugin view is recreated
			// while a suggestion is already active, so this stays null until mounted.
			let list: SuggestionListViewInstance | null = null
			let popup: SuggestionPopup | null = null
			let currentProps: SuggestionProps | null = null
			// The avatars are live views embedded in the list's markup, so this owns their lifetime.
			let avatarViews: UserAvatarViewInstance[] = []

			function destroyAvatars() {
				avatarViews.forEach(view => view.destroy())
				avatarViews = []
			}

			function entries(items: MentionItem[]) {
				destroyAvatars()

				return items.map(item => {
					const avatar = new UserAvatarView({username: item.username, size: AVATAR_SIZE})
					avatar.render()
					avatar.el.classList.add('mention-avatar')
					avatarViews.push(avatar)

					return {
						key: item.username,
						content: html`
							${avatar.el}
							<div class="mention-info">
								<p class="mention-name">${item.label}</p>
								${item.label === item.username ? '' : html`
									<p class="mention-username">@${item.username}</p>
								`}
							</div>
						`,
					}
				})
			}

			return {
				onStart: (props: SuggestionProps) => {
					currentProps = props

					list = new SuggestionListView({
						className: 'mention-items editor-suggestion-popup',
						itemClassName: 'mention-item',
						emptyLabel: t('task.mention.noUsersFound'),
						entries: entries(props.items),
						scrollSelectedIntoView: true,
						onSelect: index => {
							const props = currentProps
							const item = props?.items[index]
							if (props && item) {
								props.command(item)
							}
						},
					})
					list.render()

					if (!props.clientRect) {
						return
					}

					popup = createSuggestionPopup(
						getPopupContainer(props.editor),
						list.el,
						props.clientRect,
						props.editor.view.dom,
					)
				},

				onUpdate(props: SuggestionProps) {
					currentProps = props
					list?.setEntries(entries(props.items))
					popup?.reposition()
				},

				onKeyDown(props: {event: KeyboardEvent}) {
					if (props.event.key === 'Escape') {
						if (props.event.isComposing) {
							return false
						}

						if (popup) {
							popup.element.style.display = 'none'
						}

						return true
					}

					return list?.onKeyDown(props.event) ?? false
				},

				onExit() {
					popup?.destroy()
					popup = null
					list?.destroy()
					list = null
					destroyAvatars()
					currentProps = null
				},
			}
		},
	}
}
