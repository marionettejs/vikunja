import {afterEach, describe, expect, it, vi} from 'vitest'
import type {ViewInstance} from 'marionette'
import {NewTeamFormView, type NewTeamFormOptions} from './NewTeamFormView'

type FormViewInstance = ViewInstance & {
	submit: () => void
	isValid: () => boolean
	setDisabled: (disabled: boolean) => void
	getValues: () => {name: string, isPublic: boolean}
}

describe('NewTeamFormView', () => {
	let views: ViewInstance[] = []

	const defaultLabels = {
		name: 'Team name',
		namePlaceholder: 'Enter team name',
		nameRequired: 'Team name is required',
		isPublic: 'Public team',
		isPublicDescription: 'Allow anyone to see and join this team',
	}

	const createView = (overrides: Partial<NewTeamFormOptions> = {}) => {
		const options: NewTeamFormOptions = {
			labels: defaultLabels,
			showPublicOption: false,
			onValidityChange: vi.fn(),
			onSubmit: vi.fn(),
			...overrides,
		}
		const view = new NewTeamFormView(options) as FormViewInstance
		views.push(view)
		document.body.appendChild(view.el)
		view.render()
		return {view, options}
	}

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views = []
		document.body.innerHTML = ''
		document.body.removeAttribute('style')
	})

	it('focuses the name input when the view is rendered', () => {
		const {view} = createView()
		const input = view.el.querySelector('input.input') as HTMLInputElement

		expect(input).not.toBeNull()
		expect(input.classList.contains('input')).toBe(true)
		expect(input.getAttribute('placeholder')).toBe(defaultLabels.namePlaceholder)
		expect(document.activeElement).toBe(input)
	})

	it('reports validity when rendered and when the name changes, rejecting whitespace', () => {
		const onValidityChange = vi.fn()
		const {view} = createView({onValidityChange})
		const input = view.el.querySelector('input.input') as HTMLInputElement

		expect(onValidityChange).toHaveBeenCalledWith(false)

		input.value = '   '
		input.dispatchEvent(new Event('input', {bubbles: true}))
		expect(onValidityChange).toHaveBeenLastCalledWith(false)

		input.value = 'Designers'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		expect(onValidityChange).toHaveBeenLastCalledWith(true)
	})

	it('displays the required error only after a submit attempt with an empty name and does not call onSubmit', () => {
		const {view, options} = createView()
		expect(view.el.textContent).not.toContain(defaultLabels.nameRequired)

		view.submit()
		expect(options.onSubmit).not.toHaveBeenCalled()
		expect(view.el.textContent).toContain(defaultLabels.nameRequired)
	})

	it('submits trimmed name and current public flag and clears any error upon valid submission', () => {
		const {view, options} = createView()
		const input = view.el.querySelector('input.input') as HTMLInputElement

		view.submit()
		expect(view.el.textContent).toContain(defaultLabels.nameRequired)

		input.value = '  Frontend Core  '
		input.dispatchEvent(new Event('input', {bubbles: true}))
		view.submit()

		expect(options.onSubmit).toHaveBeenCalledTimes(1)
		expect(options.onSubmit).toHaveBeenCalledWith({name: 'Frontend Core', isPublic: false})
		expect(view.el.textContent).not.toContain(defaultLabels.nameRequired)
	})

	it('submits identically when Enter is pressed in the name input', () => {
		const {view, options} = createView()
		const input = view.el.querySelector('input.input') as HTMLInputElement

		input.value = 'DevOps'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))

		expect(options.onSubmit).toHaveBeenCalledTimes(1)
		expect(options.onSubmit).toHaveBeenCalledWith({name: 'DevOps', isPublic: false})
	})

	it('allows the caller to trigger submission via the exposed public submit method', () => {
		const {view, options} = createView()
		const input = view.el.querySelector('input.input') as HTMLInputElement

		input.value = 'QA'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		view.submit()

		expect(options.onSubmit).toHaveBeenCalledTimes(1)
		expect(options.onSubmit).toHaveBeenCalledWith({name: 'QA', isPublic: false})
	})

	it('omits public checkbox when showPublicOption is false and submits with isPublic false', () => {
		const {view, options} = createView({showPublicOption: false})
		const checkbox = view.el.querySelector('input[type="checkbox"]')
		const input = view.el.querySelector('input.input') as HTMLInputElement

		expect(checkbox).toBeNull()

		input.value = 'Product'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		view.submit()

		expect(options.onSubmit).toHaveBeenCalledWith({name: 'Product', isPublic: false})
	})

	it('renders public checkbox when showPublicOption is true and toggling changes the submitted value', () => {
		const {view, options} = createView({showPublicOption: true})
		const checkbox = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement
		const input = view.el.querySelector('input.input') as HTMLInputElement

		expect(checkbox).not.toBeNull()
		expect(view.el.textContent).toContain(defaultLabels.isPublic)
		expect(view.el.textContent).toContain(defaultLabels.isPublicDescription)

		checkbox.checked = true
		checkbox.dispatchEvent(new Event('change', {bubbles: true}))

		input.value = 'Marketing'
		input.dispatchEvent(new Event('input', {bubbles: true}))
		view.submit()

		expect(options.onSubmit).toHaveBeenCalledWith({name: 'Marketing', isPublic: true})
	})

	it('marks input invalid and associates description with error element only while error shows', () => {
		const {view} = createView()
		const input = view.el.querySelector('#team-name') as HTMLInputElement

		expect(input.hasAttribute('aria-invalid')).toBe(false)
		expect(input.hasAttribute('aria-describedby')).toBe(false)

		view.submit()

		expect(input.getAttribute('aria-invalid')).toBe('true')
		const describedBy = input.getAttribute('aria-describedby')
		expect(describedBy).toBeTruthy()

		const errorEl = view.el.querySelector(`#${describedBy}`)
		expect(errorEl).not.toBeNull()
		expect(errorEl?.textContent).toContain(defaultLabels.nameRequired)

		input.value = 'Valid Name'
		input.dispatchEvent(new Event('input', {bubbles: true}))

		expect(input.hasAttribute('aria-invalid')).toBe(false)
		expect(input.hasAttribute('aria-describedby')).toBe(false)
		expect(view.el.querySelector(`#${describedBy}`)).toBeNull()
	})

	it('disables and re-enables name input and public checkbox when toggling disabled state', () => {
		const {view} = createView({showPublicOption: true})
		const nameInput = view.el.querySelector('#team-name') as HTMLInputElement
		const checkbox = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement

		expect(nameInput.disabled).toBe(false)
		expect(checkbox.disabled).toBe(false)

		view.setDisabled(true)
		expect(nameInput.disabled).toBe(true)
		expect(checkbox.disabled).toBe(true)

		view.setDisabled(false)
		expect(nameInput.disabled).toBe(false)
		expect(checkbox.disabled).toBe(false)
	})

	it('initializes with initial values, reports valid immediately, and returns updated values from getValues', () => {
		const onValidityChange = vi.fn()
		const {view} = createView({
			showPublicOption: true,
			initialName: 'Platform Engineering',
			initialIsPublic: true,
			onValidityChange,
		})

		const nameInput = view.el.querySelector('#team-name') as HTMLInputElement
		const checkbox = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement

		expect(nameInput.value).toBe('Platform Engineering')
		expect(checkbox.checked).toBe(true)
		expect(onValidityChange).toHaveBeenCalledWith(true)
		expect(view.isValid()).toBe(true)

		expect(view.getValues()).toEqual({
			name: 'Platform Engineering',
			isPublic: true,
		})

		checkbox.checked = false
		checkbox.dispatchEvent(new Event('change', {bubbles: true}))

		expect(view.getValues()).toEqual({
			name: 'Platform Engineering',
			isPublic: false,
		})
	})
})
