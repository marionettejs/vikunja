import {html, nothing} from 'lit-html'
import type {ViewInstance} from 'marionette'
import {View} from '../index'

let nextFormId = 0

export interface TeamEditFormOptions {
	initialName: string
	initialIsPublic: boolean
	showPublicOption: boolean
	labels: {
		name: string
		namePlaceholder: string
		nameRequired: string
		isPublic: string
		isPublicDescription: string
		description: string
		save: string
		deleteTeam: string
	}
	onSave: (values: {name: string, isPublic: boolean}) => void
	onDelete: () => void
}

interface TemplateData {
	name: string
	isPublic: boolean
	showPublicOption: boolean
	error: string | null
	errorId: string
	disabled: boolean
	labels: TeamEditFormOptions['labels']
}

export interface TeamEditFormViewInstance extends ViewInstance {
	setDisabled(disabled: boolean): void
	getValues(): {name: string, isPublic: boolean}
}

export const TeamEditFormView = View.extend({
	className: 'team-edit-form card',

	_name: '',
	_isPublic: false,
	_error: null as string | null,
	_errorId: '',
	_disabled: false,
	_initialized: false,

	regions: {
		description: '.description-region',
	},

	events: {
		'input #teamtext': 'onNameInput',
		'change .public-checkbox': 'onPublicChange',
		'click .save-button': 'onSaveClick',
		'click .delete-button': 'onDeleteClick',
	},

	initialize() {
		if (!this._initialized) {
			nextFormId += 1
			this._errorId = `team-edit-error-${nextFormId}`
			const opts = this.options as TeamEditFormOptions
			this._name = opts.initialName
			this._isPublic = opts.initialIsPublic
			this._initialized = true
		}
	},

	template(data: TemplateData) {
		return html`
			<div class='form-group'>
				<label for='teamtext'>${data.labels.name}</label>
				<input
					id='teamtext'
					class='input'
					type='text'
					placeholder=${data.labels.namePlaceholder}
					.value=${data.name}
					?disabled=${data.disabled}
					aria-invalid=${data.error ? 'true' : nothing}
					aria-describedby=${data.error ? data.errorId : nothing}
				>
				${data.error ? html`<div id=${data.errorId} class='error-message'>${data.error}</div>` : nothing}
			</div>

			${data.showPublicOption ? html`
				<div class='form-group checkbox-group'>
					<label>
						<input
							type='checkbox'
							class='public-checkbox'
							.checked=${data.isPublic}
							?disabled=${data.disabled}
						>
						${data.labels.isPublic}
					</label>
					<p class='help-text'>${data.labels.isPublicDescription}</p>
				</div>
			` : nothing}

			<div class='form-group'>
				<label>${data.labels.description}</label>
				<div class='description-region'></div>
			</div>

			<div class='form-actions'>
				<button
					type='button'
					class='button save-button'
					?disabled=${data.disabled}
				>${data.labels.save}</button>
				<button
					type='button'
					class='button delete-button'
					aria-label=${data.labels.deleteTeam}
					?disabled=${data.disabled}
				>${data.labels.deleteTeam}</button>
			</div>
		`
	},

	templateContext(): TemplateData {
		const opts = this.options as TeamEditFormOptions
		return {
			name: this._name,
			isPublic: opts.showPublicOption ? this._isPublic : opts.initialIsPublic,
			showPublicOption: opts.showPublicOption,
			error: this._error,
			errorId: this._errorId,
			disabled: this._disabled,
			labels: opts.labels,
		}
	},

	onNameInput(event: Event) {
		this._name = (event.target as HTMLInputElement).value
	},

	onPublicChange(event: Event) {
		this._isPublic = (event.target as HTMLInputElement).checked
	},

	onSaveClick() {
		if (this._disabled) {
			return
		}
		const opts = this.options as TeamEditFormOptions
		const trimmed = this._name.trim()
		if (trimmed === '') {
			this._error = opts.labels.nameRequired
			this.render()
			return
		}
		this._error = null
		this.render()
		opts.onSave({
			name: trimmed,
			isPublic: opts.showPublicOption ? this._isPublic : opts.initialIsPublic,
		})
	},

	onDeleteClick() {
		if (this._disabled) {
			return
		}
		const opts = this.options as TeamEditFormOptions
		opts.onDelete()
	},

	setDisabled(disabled: boolean) {
		this._disabled = disabled
		this.render()
	},

	getValues(): {name: string, isPublic: boolean} {
		const opts = this.options as TeamEditFormOptions
		return {
			name: this._name,
			isPublic: opts.showPublicOption ? this._isPublic : opts.initialIsPublic,
		}
	},
}) as new (options: TeamEditFormOptions) => TeamEditFormViewInstance
