import type {ViewInstance} from 'marionette'
import type {Model} from '@mnjs/data'
import {View} from '../index'

export type TaskTitleModelAttributes = {
	title: string
	canWrite: boolean
	label: string
}

export interface TaskTitleViewOptions {
	model: Model<TaskTitleModelAttributes>
	onCommit: (title: string) => void
	onInvalid: () => void
}

export interface TaskTitleViewInstance extends ViewInstance {
	el: HTMLHeadingElement
	model: Model<TaskTitleModelAttributes>
}

interface TaskTitleViewContext extends TaskTitleViewInstance {
	_onCommitCallback: TaskTitleViewOptions['onCommit']
	_onInvalidCallback: TaskTitleViewOptions['onInvalid']
	_isDirty: boolean
	_boundBeforeUnload: (event: BeforeUnloadEvent) => string | undefined
	_onBeforeUnload(event: BeforeUnloadEvent): string | undefined
	_syncAttributes(): void
	_removeBeforeUnload(): void
}

const TaskTitleView = View.extend({
	tagName: 'h1',
	template: false,

	events: {
		input: 'onInput',
		blur: 'onBlur',
		keydown: 'onKeyDown',
	},

	modelEvents: {
		change: 'onModelChange',
	},

	initialize(this: TaskTitleViewContext, options: TaskTitleViewOptions) {
		this._onCommitCallback = options.onCommit
		this._onInvalidCallback = options.onInvalid
		this._isDirty = false
		this._boundBeforeUnload = this._onBeforeUnload.bind(this)

		this.el.textContent = this.model.get('title')!.trim()
		this._syncAttributes()
	},

	onAttach(this: TaskTitleViewContext) {
		window.addEventListener('beforeunload', this._boundBeforeUnload)
	},

	onBeforeDetach(this: TaskTitleViewContext) {
		this._removeBeforeUnload()
	},

	onBeforeDestroy(this: TaskTitleViewContext) {
		this._removeBeforeUnload()
	},

	_removeBeforeUnload(this: TaskTitleViewContext) {
		window.removeEventListener('beforeunload', this._boundBeforeUnload)
	},

	_onBeforeUnload(this: TaskTitleViewContext, e: BeforeUnloadEvent) {
		if (this._isDirty) {
			e.preventDefault()
			e.returnValue = ''
			return ''
		}
	},

	onInput(this: TaskTitleViewContext) {
		this._isDirty = (this.el.textContent ?? '') !== this.model.get('title')!
	},

	onBlur(this: TaskTitleViewContext) {
		if (!this.model.get('canWrite')) {
			return
		}

		const currentText = this.el.textContent ?? ''
		const rawTitle = this.model.get('title')!

		if (currentText.trim() === '') {
			this.el.textContent = rawTitle
			this._isDirty = false
			this._onInvalidCallback()
			return
		}

		if (currentText === rawTitle) {
			this._isDirty = false
			return
		}

		this._onCommitCallback(currentText)
	},

	onKeyDown(this: TaskTitleViewContext, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			event.stopPropagation()
			if (!event.isComposing) {
				this.el.blur()
			}
			return
		}

		if (event.key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			if (!event.isComposing) {
				this.el.textContent = this.model.get('title')!
				this._isDirty = false
				this.el.blur()
			}
		}
	},

	_syncAttributes(this: TaskTitleViewContext) {
		const canWrite = this.model.get('canWrite')
		if (canWrite) {
			this.el.className = 'title input'
			this.el.setAttribute('contenteditable', 'true')
			this.el.setAttribute('tabindex', '0')
			this.el.setAttribute('spellcheck', 'false')
			const label = this.model.get('label')
			if (label) {
				this.el.setAttribute('aria-label', label)
			} else {
				this.el.removeAttribute('aria-label')
			}
		} else {
			this.el.className = 'title input disabled'
			this.el.removeAttribute('contenteditable')
			this.el.removeAttribute('tabindex')
			this.el.removeAttribute('aria-label')
			this.el.setAttribute('spellcheck', 'false')
		}
	},

	onModelChange(this: TaskTitleViewContext) {
		const canWrite = this.model.get('canWrite')
		const rawTitle = this.model.get('title')!

		if (!canWrite) {
			this.el.textContent = rawTitle.trim()
			this._isDirty = false
			this._syncAttributes()
			return
		}

		const currentText = this.el.textContent ?? ''
		if (this._isDirty) {
			if (currentText === rawTitle) {
				this._isDirty = false
			}
		} else if (currentText !== rawTitle.trim()) {
			this.el.textContent = rawTitle.trim()
		}

		this._syncAttributes()
	},
}) as new (options: TaskTitleViewOptions) => TaskTitleViewInstance

export default TaskTitleView
