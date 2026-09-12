import {html} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

export interface NewTeamFormLabels {
	name: string
	namePlaceholder: string
	nameRequired: string
	isPublic: string
	isPublicDescription: string
}

export interface NewTeamFormOptions {
	labels: NewTeamFormLabels
	showPublicOption: boolean
	onValidityChange: (isValid: boolean) => void
	onSubmit: (values: {name: string, isPublic: boolean}) => void
}

interface TemplateData {
	labels: NewTeamFormLabels
	name: string
	showPublicOption: boolean
	isPublic: boolean
	error: string | null
}

export const NewTeamFormView = View.extend({
	_name: '',
	_isPublic: false,
	_showError: false,

	events: {
		'submit form': (e: Event) => e.preventDefault(),
		'input #team-name': 'onNameInput',
		'keydown #team-name': 'onNameKeydown',
		'change input[type="checkbox"]': 'onPublicChange',
	},

	template(data: TemplateData) {
		return html`
			<form>
				<div class='form-field'>
					<label class='label' for='team-name'>${data.labels.name}</label>
					<input
						id='team-name'
						class='input'
						type='text'
						.value=${data.name}
						placeholder=${data.labels.namePlaceholder}
					/>
					${data.error ? html`<p class='help is-danger error'>${data.error}</p>` : ''}
				</div>
				${data.showPublicOption ? html`
					<div class='form-field'>
						<label class='label'>${data.labels.isPublic}</label>
						<label class='checkbox'>
							<input
								type='checkbox'
								.checked=${data.isPublic}
							/>
							${data.labels.isPublicDescription}
						</label>
					</div>
				` : ''}
			</form>
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as NewTeamFormOptions
		const trimmed = this._name.trim()
		const error = this._showError && trimmed === '' ? opts.labels.nameRequired : null
		return {
			labels: opts.labels,
			name: this._name,
			showPublicOption: Boolean(opts.showPublicOption),
			isPublic: this._isPublic,
			error,
		}
	},

	onRender() {
		const input = this.el.querySelector('input.input') as HTMLInputElement | null
		if (input && typeof input.focus === 'function') {
			input.focus()
		}
		const opts = this.options as NewTeamFormOptions
		opts.onValidityChange(this.isValid())
	},

	isValid(): boolean {
		return this._name.trim() !== ''
	},

	onNameInput(event: Event) {
		const target = event.target as HTMLInputElement
		this._name = target.value
		const opts = this.options as NewTeamFormOptions
		opts.onValidityChange(this.isValid())
		if (this._showError && this.isValid()) {
			this._showError = false
			this.render()
		}
	},

	onNameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			this.submit()
		}
	},

	onPublicChange(event: Event) {
		const target = event.target as HTMLInputElement
		this._isPublic = target.checked
	},

	submit() {
		const opts = this.options as NewTeamFormOptions
		const trimmed = this._name.trim()
		if (trimmed === '') {
			this._showError = true
			this.render()
			return
		}
		this._showError = false
		this.render()
		opts.onSubmit({
			name: trimmed,
			isPublic: Boolean(opts.showPublicOption) && this._isPublic,
		})
	},
}) as new (options: NewTeamFormOptions) => ViewInstance & {
	submit: () => void
	isValid: () => boolean
}
