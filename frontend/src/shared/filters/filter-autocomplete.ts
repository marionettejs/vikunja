import {Extension} from '@tiptap/core'
import {Region, type RegionInstance} from 'marionette'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {FilterSuggestionsView} from './filter-suggestions'
import type {FilterContext} from './filter-context'
import type { EditorView } from '@tiptap/pm/view'
import {computePosition, flip, shift, offset, autoUpdate} from '@floating-ui/dom'

import {
	ASSIGNEE_FIELDS,
	AUTOCOMPLETE_FIELDS,
	CREATED_BY_FIELDS,
	FILTER_OPERATORS_REGEX,
	isMultiValueOperator,
	LABEL_FIELDS,
	PROJECT_FIELDS,
} from '@/helpers/filters'

import UserService from '@/services/user'
import ProjectUserService from '@/services/projectUsers'
import type { IUser } from '@/modelTypes/IUser'
import type { IProject } from '@/modelTypes/IProject'
import type { Label } from '@/client/generated/index'

export interface FilterAutocompleteOptions {
	projectId?: number
	context: FilterContext
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
	quoteChar: string // The quote character surrounding the keyword ('"', "'", or '' if unquoted)
}

interface SuggestionItem {
	id: number
	title?: string
	username?: string
	name?: string
}

export type AutocompleteField = 'labels' | 'users' | 'projects'

/**
 * Calculates the replacement range for autocomplete selection.
 * For single-value operators: replaces the entire keyword
 * For multi-value operators with commas: only replaces the text after the last comma
 * When inside quotes, extends the range to include the closing quote
 *
 * @param context - The autocomplete context containing position and keyword info
 * @param operator - The filter operator (e.g., 'in', '=', '?=')
 * @param hasClosingQuote - Whether there's a closing quote to include in replacement
 * @returns Object with replaceFrom and replaceTo positions
 */
export {calculateReplacementRange} from '@/helpers/filterReplacementRange'
import {calculateReplacementRange} from '@/helpers/filterReplacementRange'

export interface AutocompleteItem {
	id: number | string
	title: string | undefined
	item: Label | IUser | IProject
	fieldType: AutocompleteField
	context: AutocompleteContext
}

export default Extension.create<FilterAutocompleteOptions>({
	name: 'filterAutocomplete',

	addOptions() {
		return {
			projectId: undefined, context: undefined as unknown as FilterContext,
		}
	},

	addProseMirrorPlugins() {
		const filterLabelsByQuery = (_ignored: unknown[], query: string) => this.options.context.filterLabels(query)
		const projectStore = {searchProject: this.options.context.searchProjects}
		const userService = new UserService()
		const projectUserService = new ProjectUserService()

		let popupElement: HTMLElement | null = null
		let component: InstanceType<typeof FilterSuggestionsView> | null = null
		let currentAutocompleteContext: AutocompleteContext | null = null
		let cleanupFloating: (() => void) | null = null
		let suppressNextAutocomplete = false
		let clickOutsideHandler: ((event: MouseEvent) => void) | null = null
		let debounceTimer: ReturnType<typeof setTimeout> | null = null
		let lastSelectionPosition = -1
		let lastSelectionTime = 0
		const life = new AbortController()
		let request: AbortController | undefined
		let generation = 0
		let pendingDebounce: ((items: SuggestionItem[]) => void) | undefined
		let componentRegion: RegionInstance | undefined
		const timers = new Set<ReturnType<typeof setTimeout>>()
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => { timers.delete(timer); if (!life.signal.aborted) callback() }, delay)
			timers.add(timer)
			return timer
		}

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
			// If the keyword is empty, it's definitely not complete
			if (!keyword.trim()) {
				return false
			}

			// Check if cursor is in the middle of a word/value
			// If the character immediately after the cursor is not whitespace, operator, or delimiter,
			// then we're in the middle of a value and shouldn't show autocomplete
			const firstCharAfter = textAfterExpression[0]
			if (firstCharAfter && !/[\s&|(),"']/.test(firstCharAfter)) {
				return true
			}

			// Check if we're immediately after a recent selection
			const timeSinceLastSelection = Date.now() - lastSelectionTime
			if (timeSinceLastSelection < 1000) { // 1 second grace period
				return true
			}

			// For multi-value operators, check if we're in the middle of typing multiple values
			if (isMultiValueOperator(operator) && keyword.includes(',')) {
				const lastValue = keyword.split(',').pop()?.trim() || ''
				// If the last value after comma is empty or very short, we're likely still typing
				return lastValue.length > 1
			}

			// Check what comes after the expression
			const trimmedAfter = textAfterExpression.trim()

			// If at end of expression (nothing after), keep autocomplete open to allow selection
			if (trimmedAfter === '') {
				return false
			}

			// If there's a logical operator after, expression is complete (user has moved on)
			if (trimmedAfter.startsWith('&&') || trimmedAfter.startsWith('||') || trimmedAfter.startsWith(')')) {
				return true
			}

			// If there's a space followed by non-operator text, it's likely complete
			if (trimmedAfter.startsWith(' ') && !trimmedAfter.match(/^\s*[&|()]/)) {
				return true
			}

			return false
		}

		const hidePopup = () => {
			generation++; request?.abort(); pendingDebounce?.([]); pendingDebounce = undefined
			if (popupElement) {
				popupElement.style.display = 'none'
			}
			currentAutocompleteContext = null

			if (clickOutsideHandler) {
				document.removeEventListener('mousedown', clickOutsideHandler)
				clickOutsideHandler = null
			}

			if (component) {
				component.updateProps({
					items: [],
				})
			}
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
						clearTimeout(debounceTimer); timers.delete(debounceTimer)
					}

					return new Promise((resolve) => {
						pendingDebounce = resolve
						request = new AbortController()
						const signal = request.signal
						debounceTimer = schedule(async () => {
							let userSuggestions: SuggestionItem[]
							try {
								if (this.options.projectId) {
									// @ts-expect-error - projectId is used for URL replacement but not part of IAbstract
									userSuggestions = await projectUserService.getAll({projectId: this.options.projectId}, {s: autocompleteContext.search}, 1, signal) as SuggestionItem[]
								} else {
									userSuggestions = await userService.getAll({} as IUser, {s: autocompleteContext.search}, 1, signal) as SuggestionItem[]
								}
								// Show suggestions even with empty search, but limit if we have many
								if (autocompleteContext.search === '' && userSuggestions.length > 10) {
									userSuggestions = userSuggestions.slice(0, 10)
								}
							} catch (error) {
								if (!signal.aborted) console.error('Error fetching user suggestions:', error)
								userSuggestions = []
							}
							resolve(userSuggestions); if (pendingDebounce === resolve) pendingDebounce = undefined
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

		const updateAutocomplete = async (view: EditorView, force: boolean = false) => {
			if (life.signal.aborted) return
			const sequence = ++generation
			request?.abort(); pendingDebounce?.([]); pendingDebounce = undefined
			const {from} = view.state.selection

			if (suppressNextAutocomplete) {
				suppressNextAutocomplete = false
				hidePopup()
				return
			}

			// Check if we're too close to a recent selection (position-based suppression)
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

					// Check if this expression is complete
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

			// If no autocomplete context or same context, and not forced, return
			if (!force && currentAutocompleteContext === autocompleteContext) {
				return
			}

			currentAutocompleteContext = autocompleteContext

			if (!autocompleteContext || !fieldType || autocompleteContext.isComplete) {
				hidePopup()
				return
			}

			const suggestions = await fetchSuggestions(autocompleteContext, fieldType)
			if (life.signal.aborted || sequence !== generation || currentAutocompleteContext !== autocompleteContext) return

			const items = suggestions.map(item => ({
				id: item.id,
				title: fieldType === 'users' ? item.username : item.title,
				description: fieldType === 'users' ? `${item.name || item.username}` : item.title,
				item: item as Label | IUser | IProject,
				fieldType,
				context: autocompleteContext,
			}))

			if (items.length === 0) {
				hidePopup()
				return
			}

			// If there's only one suggestion and it exactly matches the search term,
			// don't show autocomplete - the user has already typed/selected the complete value
			if (items.length === 1 && items[0].title?.toLowerCase() === autocompleteContext.search.toLowerCase()) {
				hidePopup()
				return
			}

			if (!component) {
				component = new FilterSuggestionsView({
					context: this.options.context,
					items,
					command: (item: AutocompleteItem) => {
						// Handle selection
						const newValue = item.fieldType === 'users'
							? (item.item as IUser).username
							: (item.item as IProject | Label).title
							// Use currentAutocompleteContext (outer variable) for up-to-date positions
							// The local autocompleteContext would be stale since this callback
							// was created on first component render
						const context = currentAutocompleteContext
						if (!context) {
							return
						}
						const operator = context.operator

						// Check if there's a closing quote immediately after the keyword
						const docText = view.state.doc.textContent
						const charAfterKeyword = docText[context.endPos] || ''
						const hasClosingQuote = context.quoteChar !== '' && charAfterKeyword === context.quoteChar

						const insertValue: string = newValue ?? ''
						const { replaceFrom, replaceTo } = calculateReplacementRange(context, operator, hasClosingQuote)

						const tr = view.state.tr.replaceWith(
							replaceFrom,
							replaceTo,
							view.state.schema.text(insertValue),
						)
						// Position cursor after the inserted text
						const newPos = replaceFrom + insertValue.length
						// @ts-expect-error - Selection.near is a static method but TypeScript doesn't recognize it on constructor
						tr.setSelection(view.state.selection.constructor.near(tr.doc.resolve(newPos)))
						view.dispatch(tr)

						// Update selection tracking
						lastSelectionPosition = newPos
						lastSelectionTime = Date.now()

						// Return focus to editor and position cursor
						schedule(() => {
							view.focus()
						}, 0)

						// Always suppress and hide after selection
						// User can type comma manually if they want to add more values
						suppressNextAutocomplete = true
						hidePopup()
					},
				})
			} else {
				component.updateProps({
					items,
				})
			}

			// Create popup element on demand
			if (!popupElement) {
				popupElement = document.createElement('div')
				popupElement.style.position = 'fixed'
				popupElement.style.top = '0'
				popupElement.style.left = '0'
				popupElement.style.zIndex = '20000'
				popupElement.id = 'filter-autocomplete-popup'

				// Append to the closest dialog (if inside a modal) so the popup
				// is not blocked by <dialog> inertness, otherwise fall back to body.
				const parentDialog = view.dom.closest('dialog')
				;(parentDialog || document.body).appendChild(popupElement)
				componentRegion = new Region({el: popupElement})
				componentRegion.show(component!)

				cleanupFloating = autoUpdate(virtualReference, popupElement, updatePosition)
			}

			// Update virtual reference to start of the current search token
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
							// Only update if the document or selection changed
							if (
								!prevState ||
								!view.state.doc.eq(prevState.doc) ||
								!view.state.selection.eq(prevState.selection)
							) {
								schedule(() => { void updateAutocomplete(view) }, 0)
							}
						},
						destroy() {
							life.abort(); request?.abort(); pendingDebounce?.([]); pendingDebounce = undefined
							for (const timer of timers) clearTimeout(timer)
							timers.clear(); componentRegion?.destroy()
							if (cleanupFloating) {
								cleanupFloating()
							}
							if (clickOutsideHandler) {
								document.removeEventListener('mousedown', clickOutsideHandler)
								clickOutsideHandler = null
							}
							if (debounceTimer) {
								clearTimeout(debounceTimer); timers.delete(debounceTimer)
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
							if (component) {
								component.destroy()
							}
						},
					}
				},
				props: {
					handleKeyDown(view, event) {
						if (!popupElement || popupElement.style.display === 'none') {
							return false
						}

						// Forward key events to the component
						if (component) return component.onKeyDown({event})

						return false
					},
				},
			}),
		]
	},
})
