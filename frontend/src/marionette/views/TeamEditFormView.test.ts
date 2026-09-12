import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {html} from 'lit-html'
import {View} from '../index'
import {TeamEditFormView, type TeamEditFormOptions, type TeamEditFormViewInstance} from './TeamEditFormView'

const defaultLabels: TeamEditFormOptions['labels'] = {
	name: 'Team name',
	namePlaceholder: 'Enter team name',
	nameRequired: 'Team name is required',
	isPublic: 'Public team',
	isPublicDescription: 'Allow anyone to view this team',
	description: 'Team description',
	save: 'Save changes',
	deleteTeam: 'Delete this team',
}

describe('TeamEditFormView', () => {
	const views: TeamEditFormViewInstance[] = []

	const createView = (overrides: Partial<TeamEditFormOptions> = {}): TeamEditFormViewInstance => {
		const options: TeamEditFormOptions = {
			initialName: 'Core Team',
			initialIsPublic: true,
			showPublicOption: true,
			labels: defaultLabels,
			onSave: vi.fn(),
			onDelete: vi.fn(),
			...overrides,
		}
		const view = new TeamEditFormView(options)
		views.push(view)
		return view
	}

	afterEach(() => {
		for (const view of views) {
			view.destroy()
		}
		views.length = 0
		document.body.innerHTML = ''
	})

	it('renders name input with id teamtext and class input matching .card input.input', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const inputById = view.el.querySelector('input#teamtext')
		expect(inputById).not.toBeNull()
		expect(inputById?.classList.contains('input')).toBe(true)

		const inputByCard = document.body.querySelector('.card input.input')
		expect(inputByCard).toBe(inputById)
	})

	it('renders initial values for name and public checkbox', () => {
		const view = createView({
			initialName: 'Designers',
			initialIsPublic: true,
		})
		view.render()
		document.body.appendChild(view.el)

		const nameInput = view.el.querySelector<HTMLInputElement>('#teamtext')
		const publicCheckbox = view.el.querySelector<HTMLInputElement>('.public-checkbox')

		expect(nameInput?.value).toBe('Designers')
		expect(publicCheckbox?.checked).toBe(true)
	})

	it('does not display an error message before any save attempt', () => {
		const view = createView({initialName: ''})
		view.render()
		document.body.appendChild(view.el)

		expect(view.el.textContent).not.toContain(defaultLabels.nameRequired)
	})

	it('shows error and does not call onSave when saving with empty name', () => {
		const onSave = vi.fn()
		const view = createView({
			initialName: '',
			onSave,
		})
		view.render()
		document.body.appendChild(view.el)

		const saveBtn = view.el.querySelector<HTMLButtonElement>('.save-button')
		saveBtn?.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onSave).not.toHaveBeenCalled()
		expect(view.el.textContent).toContain(defaultLabels.nameRequired)
	})

	it('shows error and does not call onSave when saving with whitespace-only name', () => {
		const onSave = vi.fn()
		const view = createView({
			initialName: '   ',
			onSave,
		})
		view.render()
		document.body.appendChild(view.el)

		const saveBtn = view.el.querySelector<HTMLButtonElement>('.save-button')
		saveBtn?.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onSave).not.toHaveBeenCalled()
		expect(view.el.textContent).toContain(defaultLabels.nameRequired)
	})

	it('calls onSave with trimmed name and current public flag, clearing any previous error', () => {
		const onSave = vi.fn()
		const view = createView({
			initialName: '',
			initialIsPublic: false,
			onSave,
		})
		view.render()
		document.body.appendChild(view.el)

		const saveBtn = view.el.querySelector<HTMLButtonElement>('.save-button')
		saveBtn?.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(view.el.textContent).toContain(defaultLabels.nameRequired)

		const nameInput = view.el.querySelector<HTMLInputElement>('#teamtext')!
		nameInput.value = '  Frontend Team  '
		nameInput.dispatchEvent(new Event('input', {bubbles: true}))

		const publicCheckbox = view.el.querySelector<HTMLInputElement>('.public-checkbox')!
		publicCheckbox.checked = true
		publicCheckbox.dispatchEvent(new Event('change', {bubbles: true}))

		saveBtn?.dispatchEvent(new MouseEvent('click', {bubbles: true}))

		expect(onSave).toHaveBeenCalledTimes(1)
		expect(onSave).toHaveBeenCalledWith({name: 'Frontend Team', isPublic: true})
		expect(view.el.textContent).not.toContain(defaultLabels.nameRequired)
	})

	it('calls onDelete when delete control is activated', () => {
		const onDelete = vi.fn()
		const view = createView({onDelete})
		view.render()
		document.body.appendChild(view.el)

		const deleteBtn = view.el.querySelector<HTMLButtonElement>('.delete-button')
		expect(deleteBtn?.classList.contains('button')).toBe(true)
		expect(deleteBtn?.getAttribute('aria-label')).toBe(defaultLabels.deleteTeam)

		deleteBtn?.dispatchEvent(new MouseEvent('click', {bubbles: true}))
		expect(onDelete).toHaveBeenCalledTimes(1)
	})

	it('renders save control with button class and labels.save text', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		const saveBtn = view.el.querySelector<HTMLButtonElement>('.save-button')
		expect(saveBtn?.classList.contains('button')).toBe(true)
		expect(saveBtn?.textContent?.trim()).toBe(defaultLabels.save)
	})

	it('renders no public checkbox and getValues reports false when showPublicOption is false', () => {
		const view = createView({
			initialName: 'Secret Team',
			initialIsPublic: true,
			showPublicOption: false,
		})
		view.render()
		document.body.appendChild(view.el)

		expect(view.el.querySelector('.public-checkbox')).toBeNull()
		expect(view.getValues()).toEqual({name: 'Secret Team', isPublic: false})
	})

	it('setDisabled(true) disables inputs and controls, and setDisabled(false) restores them', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		view.setDisabled(true)

		let nameInput = view.el.querySelector<HTMLInputElement>('#teamtext')
		let publicCheckbox = view.el.querySelector<HTMLInputElement>('.public-checkbox')
		let saveBtn = view.el.querySelector<HTMLButtonElement>('.save-button')
		let deleteBtn = view.el.querySelector<HTMLButtonElement>('.delete-button')

		expect(nameInput?.disabled).toBe(true)
		expect(publicCheckbox?.disabled).toBe(true)
		expect(saveBtn?.disabled).toBe(true)
		expect(deleteBtn?.disabled).toBe(true)

		view.setDisabled(false)

		nameInput = view.el.querySelector<HTMLInputElement>('#teamtext')
		publicCheckbox = view.el.querySelector<HTMLInputElement>('.public-checkbox')
		saveBtn = view.el.querySelector<HTMLButtonElement>('.save-button')
		deleteBtn = view.el.querySelector<HTMLButtonElement>('.delete-button')

		expect(nameInput?.disabled).toBe(false)
		expect(publicCheckbox?.disabled).toBe(false)
		expect(saveBtn?.disabled).toBe(false)
		expect(deleteBtn?.disabled).toBe(false)
	})

	it('shows caller-supplied child view inside description region labelled with labels.description', () => {
		const view = createView()
		view.render()
		document.body.appendChild(view.el)

		expect(view.el.textContent).toContain(defaultLabels.description)

		const ChildView = View.extend({
			template() {
				return html`<div class="mock-editor">Editor content</div>`
			},
		})
		const child = new ChildView()
		view.showChildView('description', child)

		expect(view.el.querySelector('.mock-editor')).not.toBeNull()
	})

	it('getValues returns current name and public flag', () => {
		const view = createView({
			initialName: 'Initial Name',
			initialIsPublic: false,
			showPublicOption: true,
		})
		view.render()
		document.body.appendChild(view.el)

		expect(view.getValues()).toEqual({name: 'Initial Name', isPublic: false})

		const nameInput = view.el.querySelector<HTMLInputElement>('#teamtext')!
		nameInput.value = 'Updated Name'
		nameInput.dispatchEvent(new Event('input', {bubbles: true}))

		const publicCheckbox = view.el.querySelector<HTMLInputElement>('.public-checkbox')!
		publicCheckbox.checked = true
		publicCheckbox.dispatchEvent(new Event('change', {bubbles: true}))

		expect(view.getValues()).toEqual({name: 'Updated Name', isPublic: true})
	})
})
