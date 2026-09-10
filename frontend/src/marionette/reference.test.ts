import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {html} from 'lit-html'
import {Region} from 'marionette'
import {Collection, Model} from '@mnjs/data'
import {View, CollectionView} from './index'

interface TaskAttrs {
	id: number
	title: string
	done: boolean
}

const ItemView = View.extend({
	tagName: 'li',
	template: (data: TaskAttrs) => html`<span>${data.title}</span>`,
	modelEvents: {
		change: 'render',
	},
})

const ListView = CollectionView.extend({
	tagName: 'ul',
	childView: ItemView,
})

const DetailView = View.extend({
	template: (data: TaskAttrs) => html`
		<form>
			<label>Title <input class="title-input" .value=${data.title} /></label>
			<button type="submit">Save</button>
		</form>
	`,
	modelEvents: {
		change: 'render',
	},
	events: {
		'submit form': 'onSubmit',
	},
	onSubmit(event: Event) {
		event.preventDefault()
		const input = this.el.querySelector('.title-input') as HTMLInputElement
		const model = this.model as Model
		model.set('title', input.value)
	},
})

const ConsumerView = View.extend({
	tagName: 'div',
	className: 'consumer',
	template: (data: TaskAttrs) => html`<strong>${data.title}</strong>`,
	modelEvents: {
		change: 'render',
	},
})

const LayoutView = View.extend({
	template: () => html`
		<div class="list"></div>
		<div class="detail"></div>
		<div class="other"></div>
	`,
	regions: {
		list: '.list',
		detail: '.detail',
		other: '.other',
	},
})

describe('executable reference: lit-html and @mnjs/data list/detail', () => {
	let regionEl: HTMLElement
	let region: InstanceType<typeof Region>
	let taskA: InstanceType<typeof Model>
	let taskB: InstanceType<typeof Model>
	let tasks: InstanceType<typeof Collection>

	beforeEach(() => {
		regionEl = document.createElement('div')
		document.body.appendChild(regionEl)
		region = new Region({el: regionEl})
	})

	afterEach(() => {
		region.destroy()
		tasks?.destroy()
		taskA?.destroy()
		taskB?.destroy()
		regionEl?.remove()
	})

	it('coordinates list reordering, concurrent editing, commit and independent borrowers', () => {
		taskA = new Model({id: 1, title: 'Alpha', done: false})
		taskB = new Model({id: 2, title: 'Beta', done: false})
		tasks = new Collection([taskA, taskB])

		const layout = new LayoutView()
		region.show(layout)

		const listView = new ListView({collection: tasks})
		const detailView = new DetailView({model: taskA})
		const consumerView = new ConsumerView({model: taskA})

		layout.showChildView('list', listView)
		layout.showChildView('detail', detailView)
		layout.showChildView('other', consumerView)

		expect(detailView.el.querySelector('input')?.value).toBe('Alpha')
		expect(consumerView.el.querySelector('strong')?.textContent).toBe('Alpha')
		const listItems = listView.el.querySelectorAll('li')
		expect(listItems[0]?.textContent).toBe('Alpha')
		expect(listItems[1]?.textContent).toBe('Beta')

		const childViewA = listView.children.findByModel(taskA)!
		const childViewB = listView.children.findByModel(taskB)!
		expect(childViewA).toBeDefined()
		expect(childViewB).toBeDefined()

		const input = detailView.el.querySelector('.title-input') as HTMLInputElement
		input.focus()
		input.value = 'Draft title change'
		input.setSelectionRange(2, 5)

		taskA.set('done', true)
		tasks.move(taskA, 1)

		expect(detailView.el.querySelector('.title-input')).toBe(input)
		expect(document.activeElement).toBe(input)
		expect(input.value).toBe('Draft title change')
		expect(input.selectionStart).toBe(2)
		expect(input.selectionEnd).toBe(5)

		expect(listView.children.findByModel(taskA)).toBe(childViewA)
		expect(listView.children.findByModel(taskB)).toBe(childViewB)
		const reorderedItems = listView.el.querySelectorAll('li')
		expect(reorderedItems[0]).toBe(childViewB.el)
		expect(reorderedItems[1]).toBe(childViewA.el)

		const form = detailView.el.querySelector('form') as HTMLFormElement
		form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}))

		expect(taskA.get('title')).toBe('Draft title change')
		expect(reorderedItems[1]?.textContent).toBe('Draft title change')
		expect(consumerView.el.querySelector('strong')?.textContent).toBe('Draft title change')

		taskA.set('title', 'Alpha Committed')
		expect(input.value).toBe('Alpha Committed')
		expect(detailView.el.querySelector('input')?.value).toBe('Alpha Committed')
		expect(consumerView.el.querySelector('strong')?.textContent).toBe('Alpha Committed')
		expect(reorderedItems[1]?.textContent).toBe('Alpha Committed')

		layout.getRegion('other')!.empty()
		expect(consumerView.isDestroyed()).toBe(true)

		taskA.set('title', 'Alpha Final')
		expect(input.value).toBe('Alpha Final')
		expect(reorderedItems[1]?.textContent).toBe('Alpha Final')

		region.destroy()
		expect(layout.isDestroyed()).toBe(true)
		expect(listView.isDestroyed()).toBe(true)
		expect(detailView.isDestroyed()).toBe(true)
		expect(childViewA.isDestroyed()).toBe(true)
	})
})
