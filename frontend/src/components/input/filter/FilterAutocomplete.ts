import {Extension} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import type {EditorView} from '@tiptap/pm/view'
import {computePosition, flip, shift, offset, autoUpdate} from '@floating-ui/dom'
import {html} from 'lit-html'
import type {TemplateResult} from 'lit-html'

import {
	ASSIGNEE_FIELDS,
	AUTOCOMPLETE_FIELDS,
	CREATED_BY_FIELDS,
	FILTER_OPERATORS_REGEX,
	isMultiValueOperator,
	LABEL_FIELDS,
	PROJECT_FIELDS,
} from '@/helpers/filters'

import {useLabels} from '@/composables/useLabels'
import {getLabelColor} from '@/composables/useLabelStyles'
import {getTextColor} from '@/helpers/color/getTextColor'
import {useProjectStore} from '@/stores/projects'
import UserService from '@/services/user'
import ProjectUserService from '@/services/projectUsers'
import type {IUser} from '@/modelTypes/IUser'
import type {IProject} from '@/modelTypes/IProject'
import type {Label} from '@/client/generated'
import {SuggestionListView, type SuggestionListViewInstance} from '@/marionette/views/SuggestionListView'
import {UserAvatarView, type UserAvatarViewInstance} from '@/marionette/views/UserAvatarView'

export interface FilterAutocompleteOptions {
	projectId?: number
	emptyLabel: string
}

interface AutocompleteContext {
	field: string
	prefix: string
	keyword: string
	search: string
	operator: string
	startPos: number
	endPos: number
	isComplete: boolean
	quoteChar: string
}

interface SuggestionItem {
	id: number
	title?: string
	username?: string
	name?: string
}

export type AutocompleteField = 'labels' | 'users' | 'projects'

export function calculateReplacementRange(
	context: {startPos: number; endPos: number; keyword: string},
	operator: string,
	hasClosingQuote: boolean = false,
): {replaceFrom: number; replaceTo: number} {
	// Add 1 to convert from string indices to ProseMirror positions.
	// In ProseMirror, position 0 is before the document, text starts at position 1.
	let replaceFrom = context.startPos + 1
	let replaceTo = context.endPos + 1

	// Handle multi-value operators - only replace the last value after comma
	if (isMultiValueOperator(operator) && context.keyword.includes(',')) {
		const lastCommaIndex = context.keyword.lastIndexOf(',')
		const textAfterComma = context.keyword.substring(lastCommaIndex + 1)
		const leadingSpaces = textAfterComma.length - textAfterComma.trimStart().length
		replaceFrom = context.startPos + lastCommaIndex + 1 + leadingSpaces + 1
	}

	// Extend range to include closing quote if present
	if (hasClosingQuote) {
		replaceTo += 1
	}

	return {replaceFrom, replaceTo}
}

export interface AutocompleteItem {
	id: number | string
	title: string | undefined
	item: Label | IUser | IProject
	fieldType: AutocompleteField
	context: AutocompleteContext
}

export interface FilterEntry {
	key: string
	content: TemplateResult
}

export function buildFilterEntries(items: AutocompleteItem[], avatarViews: UserAvatarViewInstance[]): FilterEntry[] {
	return items.map(item => {
		const key = `${item.fieldType}-${item.id}`

		if (item.fieldType === 'users') {
			const user = item.item as IUser
			const avatar = new UserAvatarView({username: user.username, size: 20})
			avatar.render()
			avatar.el.classList.add('filter-autocomplete__avatar')
			avatarViews.push(avatar)

			return {
				key,
				content: html`
					${avatar.el}
					<span class="filter-autocomplete__username">${user.username}</span>
				`,
			}
		}

		if (item.fieldType === 'labels') {
			const label = item.item as Label
			const color = getLabelColor(label)
			const background = color || 'var(--grey-200)'
			const textColor = color ? getTextColor(color) : 'var(--grey-800)'
			return {
				key,
				content: html`
					<span class="filter-autocomplete__label tag" style=${`background: ${background}; color: ${textColor}`}>${label.title ?? ''}</span>
				`,
			}
		}

		const project = item.item as IProject
		return {
			key,
			content: html`
				<span class="filter-autocomplete__project">${project.title ?? ''}</span>
			`,
		}
	})
}

export default Extension.create<FilterAutocompleteOptions>({
	name: 'filterAutocomplete',

	addOptions() {
		return {
			projectId: undefined,
			emptyLabel: 'No result',
		}
	},

	addProseMirrorPlugins() {
		const {filterLabelsByQuery} = useLabels()
		const projectStore = useProjectStore()
		const userService = new UserService()
		const projectUserService = new ProjectUserService()

		let popupElement: HTMLElement | null = null
		let listView: SuggestionListViewInstance | null = null
		let avatarViews: UserAvatarViewInstance[] = []
		let currentItems: AutocompleteItem[] = []
		let currentAutocompleteContext: AutocompleteContext | null = null
		let cleanupFloating: (() => void) | null = null
		let suppressNextAutocomplete = false
		let clickOutsideHandler: ((event: MouseEvent) => void) | null = null
		let debounceTimer: NodeJS.Timeout | null = null
		let lastSelectionPosition = -1
		let lastSelectionTime = 0

		const virtualReference = {
			getBoundingClientRect: () => ({
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
			} as DOMRect),
		}

		const isFilterExpressionComplete = (textAfterExpression: string, keyword: string, operator: string): boolean => {
			if (!keyword.trim()) {
				return false
			}

			const firstCharAfter = textAfterExpression[0]
			if (firstCharAfter && !/[\s&|(),"']/.test(firstCharAfter)) {
				return true
			}

			const timeSinceLastSelection = Date.now() - lastSelectionTime
			if (timeSinceLastSelection < 1000) {
				return true
			}

			if (isMultiValueOperator(operator) && keyword.includes(',')) {
				const lastValue = keyword.split(',').pop()?.trim() || ''
				return lastValue.length > 1
			}

			const trimmedAfter = textAfterExpression.trim()

			if (trimmedAfter === '') {
				return false
			}

			if (trimmedAfter.startsWith('&&') || trimmedAfter.startsWith('||') || trimmedAfter.startsWith(')')) {
				return true
			}

			if (trimmedAfter.startsWith(' ') && !trimmedAfter.match(/^\s*[&|()]/)) {
				return true
			}

			return false
		}

		const destroyAvatars = () => {
			avatarViews.forEach(view => view.destroy())
			avatarViews = []
		}

		const hidePopup = () => {
			if (popupElement) {
				popupElement.style.display = 'none'
			}
			currentAutocompleteContext = null

			if (clickOutsideHandler) {
				document.removeEventListener('mousedown', clickOutsideHandler)
				clickOutsideHandler = null
			}

			if (listView) {
				listView.setEntries([])
			}
			currentItems = []
			destroyAvatars()
		}

		const showPopup = () => {
			if (popupElement) {
				popupElement.style.display = 'block'

				if (!clickOutsideHandler) {
					clickOutsideHandler = (event: MouseEvent) => {
						const target = event.target as Node
						const editorElement = (this.editor?.view?.dom) as Node

						if (popupElement?.contains(target) || editorElement?.contains(target)) {
							return
						}

						hidePopup()
					}
					document.addEventListener('mousedown', clickOutsideHandler)
				}
			}
		}

		const fetchSuggestions = async (autocompleteContext: AutocompleteContext, fieldType: AutocompleteField): Promise<SuggestionItem[]> => {
			try {
				if (fieldType === 'labels') {
					return filterLabelsByQuery([], autocompleteContext.search) as SuggestionItem[]
				}

				if (fieldType === 'users') {
					if (debounceTimer) {
						clearTimeout(debounceTimer)
					}

					return new Promise((resolve) => {
						debounceTimer = setTimeout(async () => {
							let userSuggestions: SuggestionItem[]
							try {
								if (this.options.projectId) {
									// @ts-expect-error - projectId is used for URL replacement but not part of IAbstract
									userSuggestions = await projectUserService.getAll({projectId: this.options.projectId}, {s: autocompleteContext.search}) as SuggestionItem[]
								} else {
									userSuggestions = await userService.getAll({} as IUser, {s: autocompleteContext.search}) as SuggestionItem[]
								}
								if (autocompleteContext.search === '' && userSuggestions.length > 10) {
									userSuggestions = userSuggestions.slice(0, 10)
								}
							} catch (error) {
								console.error('Error fetching user suggestions:', error)
								userSuggestions = []
							}
							resolve(userSuggestions)
						}, 300)
					})
				}

				if (fieldType === 'projects' && !this.options.projectId) {
					return projectStore.searchProject(autocompleteContext.search).filter((project): project is IProject => project !== undefined) as SuggestionItem[]
				}
			} catch (error) {
				console.error('Error fetching suggestions:', error)
				return []
			}

			console.error('Unknown field type:', fieldType)

			return []
		}

		const updatePosition = async () => {
			if (!popupElement) return
			await computePosition(virtualReference, popupElement, {
				placement: 'bottom-start',
				strategy: 'fixed',
				middleware: [
					offset(25),
					flip(),
					shift({padding: 8}),
				],
			}).then(({x, y}) => {
				if (popupElement) {
					popupElement.style.left = `${x}px`
					popupElement.style.top = `${y}px`
				}
			})
		}

		const buildEntries = (items: AutocompleteItem[]): FilterEntry[] => {
			destroyAvatars()
			return buildFilterEntries(items, avatarViews)
		}

		const updateAutocomplete = async (view: EditorView, force: boolean = false) => {
			const {from} = view.state.selection

			if (suppressNextAutocomplete) {
				suppressNextAutocomplete = false
				hidePopup()
				return
			}

			if (lastSelectionPosition >= 0 && Math.abs(from - lastSelectionPosition) <= 2) {
				const timeSinceLastSelection = Date.now() - lastSelectionTime
				if (timeSinceLastSelection < 500) {
					hidePopup()
					return
				}
			}

			const text = view.state.doc.textContent
			const textUpToCursor = text.substring(0, from)

			let autocompleteContext: AutocompleteContext | null = null
			let fieldType: AutocompleteField | null = null

			for (const field of AUTOCOMPLETE_FIELDS) {
				const pattern = new RegExp(`(${field}\\s*${FILTER_OPERATORS_REGEX}\\s*)(["']?)([^"'&|()]*)?$`, 'ig')
				const match = pattern.exec(textUpToCursor)

				if (match && match.index !== undefined) {
					const [, prefix = '', , quoteChar = '', keyword = ''] = match

					let search = keyword.trim()
					const operator = match[0].match(new RegExp(FILTER_OPERATORS_REGEX))?.[0] || ''
					if (operator === 'in' || operator === '?=') {
						const keywords = keyword.split(',')
						search = keywords[keywords.length - 1]?.trim() ?? ''
					}

					const textAfterExpression = text.substring(from)
					const isComplete = isFilterExpressionComplete(textAfterExpression, keyword, operator)

					autocompleteContext = {
						field,
						prefix,
						keyword,
						search,
						operator,
						startPos: match.index + prefix.length,
						endPos: match.index + prefix.length + keyword.length,
						isComplete,
						quoteChar,
					}

					if (LABEL_FIELDS.includes(field)) {
						fieldType = 'labels'
					} else if (ASSIGNEE_FIELDS.includes(field) || CREATED_BY_FIELDS.includes(field)) {
						fieldType = 'users'
					} else if (PROJECT_FIELDS.includes(field)) {
						fieldType = 'projects'
					}
					break
				}
			}

			if (!force && currentAutocompleteContext === autocompleteContext) {
				return
			}

			currentAutocompleteContext = autocompleteContext

			if (!autocompleteContext || !fieldType || autocompleteContext.isComplete) {
				hidePopup()
				return
			}

			const suggestions = await fetchSuggestions(autocompleteContext, fieldType)

			const items = suggestions.map(item => ({
				id: item.id,
				title: fieldType === 'users' ? item.username : item.title,
				description: fieldType === 'users' ? `${item.name || item.username}` : item.title,
				item,
				fieldType,
				context: autocompleteContext,
			}))

			if (items.length === 0) {
				hidePopup()
				return
			}

			if (items.length === 1 && items[0].title?.toLowerCase() === autocompleteContext.search.toLowerCase()) {
				hidePopup()
				return
			}

			const entries = buildEntries(items)
			currentItems = items

			if (!listView) {
				listView = new SuggestionListView({
					className: 'filter-autocompletes',
					itemClassName: 'filter-autocomplete',
					emptyLabel: this.options.emptyLabel,
					entries,
					onSelect: (index: number) => {
						const selectedItem = currentItems[index]
						if (!selectedItem) {
							return
						}

						const newValue = selectedItem.fieldType === 'users'
							? (selectedItem.item as IUser).username
							: (selectedItem.item as IProject | Label).title

						// Read positions from the outer variable: the entries shown may
						// predate the latest keystroke, so a captured context would be stale.
						const context = currentAutocompleteContext
						if (!context) {
							return
						}
						const operator = context.operator

						const docText = view.state.doc.textContent
						const charAfterKeyword = docText[context.endPos] || ''
						const hasClosingQuote = context.quoteChar !== '' && charAfterKeyword === context.quoteChar

						const insertValue: string = newValue ?? ''
						const {replaceFrom, replaceTo} = calculateReplacementRange(context, operator, hasClosingQuote)
						const tr = view.state.tr.replaceWith(
							replaceFrom,
							replaceTo,
							view.state.schema.text(insertValue),
						)
						const newPos = replaceFrom + insertValue.length
						// @ts-expect-error - Selection.near is a static method but TypeScript doesn't recognize it on constructor
						tr.setSelection(view.state.selection.constructor.near(tr.doc.resolve(newPos)))
						view.dispatch(tr)

						lastSelectionPosition = newPos
						lastSelectionTime = Date.now()

						setTimeout(() => {
							view.focus()
						}, 0)

						suppressNextAutocomplete = true
						hidePopup()
					},
					scrollSelectedIntoView: true,
				})
				listView.render()

				popupElement = document.createElement('div')
				popupElement.style.position = 'fixed'
				popupElement.style.top = '0'
				popupElement.style.left = '0'
				popupElement.style.zIndex = '20000'
				popupElement.id = 'filter-autocomplete-popup'
				popupElement.appendChild(listView.el)
				// Append to the closest dialog (if inside a modal) so the popup
				// is not blocked by <dialog> inertness, otherwise fall back to body.
				const parentDialog = view.dom.closest('dialog')
				;(parentDialog || document.body).appendChild(popupElement)

				cleanupFloating = autoUpdate(virtualReference, popupElement, updatePosition)
			} else {
				listView.setEntries(entries)
			}

			const anchorFrom = autocompleteContext ? Math.max(0, from - (autocompleteContext.search?.length || 0)) : from
			const coords = view.coordsAtPos(anchorFrom)
			const rect = {
				width: 0,
				height: 0,
				x: coords.left,
				y: coords.top,
				top: coords.top,
				left: coords.left,
				right: coords.left,
				bottom: coords.bottom,
			} as DOMRect
			virtualReference.getBoundingClientRect = () => rect

			showPopup()
			await updatePosition()
		}

		return [
			new Plugin({
				key: new PluginKey('filterAutocomplete'),
				view() {
					return {
						update: (view, prevState) => {
							if (
								!prevState ||
								!view.state.doc.eq(prevState.doc) ||
								!view.state.selection.eq(prevState.selection)
							) {
								setTimeout(() => updateAutocomplete(view), 0)
							}
						},
						destroy() {
							if (cleanupFloating) {
								cleanupFloating()
							}
							if (clickOutsideHandler) {
								document.removeEventListener('mousedown', clickOutsideHandler)
								clickOutsideHandler = null
							}
							if (debounceTimer) {
								clearTimeout(debounceTimer)
								debounceTimer = null
							}
							if (popupElement && popupElement.parentNode) {
								popupElement.parentNode.removeChild(popupElement)
							}
							popupElement = null
							suppressNextAutocomplete = false
							currentAutocompleteContext = null
							lastSelectionPosition = -1
							lastSelectionTime = 0
							if (listView) {
								listView.destroy()
								listView = null
							}
							destroyAvatars()
						},
					}
				},
				props: {
					handleKeyDown(view, event) {
						if (!popupElement || popupElement.style.display === 'none') {
							return false
						}

						if (listView) {
							return listView.onKeyDown(event)
						}

						return false
					},
				},
			}),
		]
	},
})
