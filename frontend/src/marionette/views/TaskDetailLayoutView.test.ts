import {afterEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import {Model} from '@mnjs/data'
import {View} from '../index'
import TaskDetailLayoutView from './TaskDetailLayoutView'
import {TaskHeadingView} from './TaskHeadingView'

const cleanup: Array<() => void> = []
afterEach(() => {cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren()})
function fixture(isModal = false) {
	const model = new Model({id: 1, title: 'Read only', done: false, hexColor: ''})
	cleanup.push(() => model.destroy())
	const heading = new TaskHeadingView({model, canWrite: false, hasClose: false,
		labels: {title: 'Title', titleRequired: 'Required', saving: 'Saving', saved: 'Saved', saveError: 'Failed', copy: 'Copy', close: 'Close', done: 'Done'},
		taskUrl: '/tasks/1', taskIdentifier: '#1', onCopy: () => {}, onCommit: () => {},
	})
	const Description = View.extend({template: () => html`<div contenteditable="true" .textContent=${'Description'}></div>`})
	const description = new Description()
	const onBack = vi.fn()
	const layout = new TaskDetailLayoutView({isModal, labels: {back: 'Back', description: 'Description'}, onBack, children: {heading, description}})
	cleanup.push(() => layout.destroy())
	layout.render()
	document.body.append(layout.el)
	return {layout, heading, description, onBack}
}
describe('TaskDetailLayoutView', () => {
	it('preserves child identity and edited DOM across parent rendering and destroys each once', () => {
		const {layout, heading, description, onBack} = fixture()
		const editor = description.el.querySelector('[contenteditable]')!
		editor.textContent = 'Unsaved draft'
		const rendered = vi.fn(), destroyed = vi.fn()
		description.on('render', rendered)
		description.on('destroy', destroyed)
		const headingDestroyed = vi.fn()
		heading.on('destroy', headingDestroyed)
		layout.render()
		expect(layout.el.querySelector('[contenteditable]')).toBe(editor)
		expect(editor.textContent).toBe('Unsaved draft')
		expect(layout.getChildView('heading')).toBe(heading)
		expect(rendered).not.toHaveBeenCalled()
		layout.el.querySelector<HTMLButtonElement>('[data-action="back"]')!.click()
		expect(onBack).toHaveBeenCalledOnce()
		layout.destroy()
		layout.destroy()
		expect(destroyed).toHaveBeenCalledOnce()
		expect(headingDestroyed).toHaveBeenCalledOnce()
	})
	it('omits back navigation for a modal', () => {
		const {layout} = fixture(true)
		expect(layout.el.querySelector('[data-action="back"]')).toBeNull()
		expect(layout.el.querySelector('.task-view.is-modal')).not.toBeNull()
	})
})
