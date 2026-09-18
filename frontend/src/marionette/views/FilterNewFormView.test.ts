import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import StarterKit from '@tiptap/starter-kit'
import {View} from '../index'
import type {RichTextEditorViewInstance} from './RichTextEditorView'
import type {EditorControls} from './createEditorControls'
import type {Label} from '@/client/generated'

vi.mock('@/components/input/editor/editorExtensions', () => ({
	createEditorExtensions: () => [StarterKit],
}))

vi.mock('@/composables/useLabels', () => ({
	useLabels: () => ({
		labels: [] as Label[],
		isPending: false,
		filterLabelsByQuery: vi.fn(),
		getLabelByExactTitle: vi.fn(),
		getLabelById: vi.fn(),
	}),
}))

vi.mock('@/stores/projects', () => ({
	useProjectStore: () => ({
		searchProject: vi.fn(() => []),
	}),
}))

import {FilterNewFormView} from './FilterNewFormView'
import type {FilterNewFormViewOptions} from './FilterNewFormView'

type FilterNewFormViewInstance = ViewInstance & {
	_titleInput: HTMLInputElement | null
	_descriptionEditorView: RichTextEditorViewInstance | null
	_queryInputView: any
	_editorControls: EditorControls | null
	_editorGeneration: number
	_options(): FilterNewFormViewOptions
	_initExtensions(): unknown
	_createDescriptionEditor(): void
	_createQueryInput(): void
	_destroyDescriptionEditor(): void
	_destroyQueryInput(): void
	_setTitle(value: string): void
	_setDescription(value: string): void
	_setQuery(value: string): void
	setLoading(loading: boolean): void
	setTitleValid(valid: boolean): void
	updateLabels(labels: Label[], pending: boolean): void
}

const createMockLabel = (id: number, title: string): Label => ({
	id,
	title,
	hex_color: '3b82f6',
	description: '',
	created: new Date().toISOString(),
	updated: new Date().toISOString(),
})

describe('FilterNewFormView', () => {
	let views: FilterNewFormViewInstance[] = []

	const mockLabels: Label[] = [
		createMockLabel(1, 'bug'),
		createMockLabel(2, 'feature'),
	]

	function createView(overrides: Partial<FilterNewFormViewOptions> = {}): FilterNewFormViewInstance {
		const onTitleChange = vi.fn()
		const onTitleValidate = vi.fn()
		const onDescriptionChange = vi.fn()
		const onQueryChange = vi.fn()
		const t = vi.fn((key: string) => {
			const translations: Record<string, string> = {
				'filters.attributes.title': 'Title',
				'filters.attributes.description': 'Description',
				'filters.title': 'Query',
				'filters.attributes.titlePlaceholder': 'Enter title...',
				'filters.attributes.descriptionPlaceholder': 'Enter description...',
				'filters.create.titleRequired': 'Title is required',
				'filters.create.description': 'Create a new filter to organize your tasks',
				'input.editor.label': 'Description editor',
			}
			return translations[key] ?? key
		})

		const options: FilterNewFormViewOptions = {
			t,
			labels: mockLabels,
			labelsPending: false,
			getLabelByExactTitle: (title: string) => mockLabels.find(l => l.title === title),
			getLabelById: (id: number) => mockLabels.find(l => l.id === id),
			findProjectByExactname: (title: string) => ({id: 1, title}),
			getProjectTitle: (id: number) => `Project ${id}`,
			flatpickrLocale: {firstDayOfWeek: 1},
			weekStart: 1,
			onTitleChange,
			onTitleValidate,
			onDescriptionChange,
			onQueryChange,
			loading: false,
			titleValid: true,
			initialTitle: '',
			initialDescription: '',
			initialQuery: '',
			...overrides,
		}

		const view = new FilterNewFormView(options) as FilterNewFormViewInstance
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return view
	}

	beforeEach(() => {
		views = []
		document.body.innerHTML = ''
	})

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
	})

	describe('initialization', () => {
		it('renders title, description editor, and query input regions', () => {
			const view = createView()
			expect(view.el.querySelector('#Title')).not.toBeNull()
			expect(view.el.querySelector('[data-region="toolbar"]')).not.toBeNull()
			expect(view.el.querySelector('[data-region="description-editor"]')).not.toBeNull()
			expect(view.el.querySelector('[data-region="query-input"]')).not.toBeNull()
		})

		it('autofocuses the title input on render', () => {
			const view = createView()
			expect(document.activeElement).toBe(view._titleInput)
		})

		it('renders title with initial value', () => {
			const view = createView({initialTitle: 'My Filter'})
			expect(view._titleInput?.value).toBe('My Filter')
		})

		it('renders the intro description text', () => {
			const view = createView()
			expect(view.el.textContent).toContain('Create a new filter to organize your tasks')
		})

		it('initializes description editor and query input child views', () => {
			const view = createView()
			expect(view._descriptionEditorView).not.toBeNull()
			expect(view._queryInputView).not.toBeNull()
		})
	})

	describe('title error classes toggle via setTitleValid', () => {
		it('adds is-danger class and help text when invalid', () => {
			const view = createView({titleValid: true})
			expect(view._titleInput?.classList.contains('is-danger')).toBe(false)
			expect(view.el.querySelector('.help.is-danger')).toBeNull()

			view.setTitleValid(false)

			expect(view._titleInput?.classList.contains('is-danger')).toBe(true)
			expect(view._titleInput?.getAttribute('aria-invalid')).toBe('true')
			expect(view.el.querySelector('.help.is-danger')).not.toBeNull()
			expect(view.el.querySelector('.help.is-danger')?.textContent).toBe('Title is required')
		})

		it('removes is-danger class and help text when valid', () => {
			const view = createView({titleValid: false})
			view.render()
			document.body.appendChild(view.el)

			expect(view._titleInput?.classList.contains('is-danger')).toBe(true)

			view.setTitleValid(true)

			expect(view._titleInput?.classList.contains('is-danger')).toBe(false)
			expect(view._titleInput?.getAttribute('aria-invalid')).toBe('false')
			expect(view.el.querySelector('.help.is-danger')).toBeNull()
		})

		it('keeps title input enabled when invalid but not loading', () => {
			const view = createView({titleValid: true, loading: false})
			view.setTitleValid(false)
			expect(view._titleInput?.disabled).toBe(false)
		})

		it('enables title input when valid and not loading', () => {
			const view = createView({titleValid: false, loading: false})
			view.setTitleValid(true)
			expect(view._titleInput?.disabled).toBe(false)
		})

		it('keeps title input disabled when loading even if valid', () => {
			const view = createView({titleValid: true, loading: true})
			view.setTitleValid(true)
			expect(view._titleInput?.disabled).toBe(true)
		})
	})

	describe('description editor toolbar and bubble menu DOM present', () => {
		it('mounts toolbar view in toolbar region', () => {
			const view = createView()
			const toolbarRegion = view.el.querySelector('[data-region="toolbar"]')
			expect(toolbarRegion).not.toBeNull()
			expect(view._editorControls).not.toBeNull()
			expect(toolbarRegion?.querySelectorAll('button').length).toBeGreaterThan(0)
		})

		it('creates editor controls with bubble menu mounted to document.body', () => {
			createView()
			expect(document.body.querySelector('.mn-editor-bubble')).not.toBeNull()
		})
	})

	describe('query input present', () => {
		it('initializes FilterInputView in query input region', () => {
			const view = createView()
			const queryRegion = view.el.querySelector('[data-region="query-input"]')
			expect(queryRegion).not.toBeNull()
			expect(view._queryInputView).not.toBeNull()
		})

		it('passes correct options to FilterInputView', () => {
			const view = createView({
				labels: mockLabels,
				labelsPending: false,
				flatpickrLocale: {firstDayOfWeek: 1},
				weekStart: 1,
			})
			expect(view._queryInputView).toBeDefined()
		})
	})

	describe('setLoading disables fields', () => {
		it('disables title input when loading', () => {
			const view = createView({loading: false})
			view.setLoading(true)
			expect(view._titleInput?.disabled).toBe(true)
		})

		it('enables title input when not loading and valid', () => {
			const view = createView({loading: true, titleValid: true})
			view.setLoading(false)
			expect(view._titleInput?.disabled).toBe(false)
		})

		it('sets description editor editable state', () => {
			const view = createView({loading: false})
			const setEditableSpy = vi.spyOn(view._descriptionEditorView!, 'setEditable')
			view.setLoading(true)
			expect(setEditableSpy).toHaveBeenCalledWith(false)
		})

		it('sets query input editable state', () => {
			const view = createView({loading: false})
			const setEditableSpy = vi.spyOn(view._queryInputView!, 'setEditable')
			view.setLoading(true)
			expect(setEditableSpy).toHaveBeenCalledWith(false)
		})
	})

	describe('updateLabels passes through to FilterInputView', () => {
		it('calls FilterInputView.updateLabels with new labels', () => {
			const view = createView()
			const updateLabelsSpy = vi.spyOn(view._queryInputView!, 'updateLabels')
			const newLabels: Label[] = [createMockLabel(3, 'urgent')]

			view.updateLabels(newLabels, true)

			expect(updateLabelsSpy).toHaveBeenCalledWith(newLabels, true)
		})
	})

	describe('teardown destroys all child views', () => {
		it('destroys editor controls', () => {
			const view = createView()
			const destroySpy = vi.spyOn(view._editorControls!, 'destroy')
			view.destroy()
			expect(destroySpy).toHaveBeenCalled()
		})

		it('destroys description editor view', () => {
			const view = createView()
			const destroySpy = vi.spyOn(view._descriptionEditorView!, 'destroy')
			view.destroy()
			expect(destroySpy).toHaveBeenCalled()
		})

		it('destroys query input view', () => {
			const view = createView()
			const destroySpy = vi.spyOn(view._queryInputView!, 'destroy')
			view.destroy()
			expect(destroySpy).toHaveBeenCalled()
		})

		it('does not throw on double destroy', () => {
			const view = createView()
			expect(() => view.destroy()).not.toThrow()
			expect(() => view.destroy()).not.toThrow()
		})
	})
})