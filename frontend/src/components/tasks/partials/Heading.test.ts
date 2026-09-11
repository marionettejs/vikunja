import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {mount} from '@vue/test-utils'
import {nextTick, ref} from 'vue'
import {createI18n} from 'vue-i18n'
import Heading from './Heading.vue'
import TaskModel from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'

const mocks = vi.hoisted(() => ({
	error: vi.fn(),
	copy: vi.fn(),
	resolve: vi.fn(() => ({href: '/tasks/1'})),
	taskStoreUpdate: vi.fn(),
}))

const isLoadingRef = ref(false)

vi.mock('@/message', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/message')>()
	return {
		...actual,
		error: mocks.error,
	}
})

vi.mock('@/composables/useCopyToClipboard', () => ({
	useCopyToClipboard: () => mocks.copy,
}))

vi.mock('vue-router', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue-router')>()
	return {
		...actual,
		useRouter: () => ({
			resolve: mocks.resolve,
		}),
	}
})

vi.mock('@/stores/tasks', () => ({
	useTaskStore: () => ({
		update: mocks.taskStoreUpdate,
		get isLoading() {
			return isLoadingRef.value
		},
	}),
}))

function createTestI18n() {
	return createI18n({
		legacy: false,
		locale: 'en',
		messages: {
			en: {
				'task.attributes.title': 'Task Title',
				'task.detail.titleRequired': 'A task title is required',
				'task.detail.closeTaskDetail': 'Close',
				'misc.saving': 'Saving...',
				'misc.saved': 'Saved',
			},
			de: {
				'task.attributes.title': 'Aufgabentitel',
				'task.detail.titleRequired': 'Ein Aufgabentitel ist erforderlich',
				'task.detail.closeTaskDetail': 'Schließen',
				'misc.saving': 'Speichern...',
				'misc.saved': 'Gespeichert',
			},
		},
	})
}

describe('Heading.vue integration', () => {
	let i18n: ReturnType<typeof createTestI18n>
	const activeWrappers = new Set<ReturnType<typeof mount>>()

	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		isLoadingRef.value = false
		i18n = createTestI18n()
	})

	afterEach(() => {
		for (const wrapper of activeWrappers) {
			wrapper.unmount()
		}
		activeWrappers.clear()
		vi.clearAllTimers()
		vi.useRealTimers()
		document.body.innerHTML = ''
	})

	function createWrapper(props: {task: ITask; canWrite?: boolean; hasClose?: boolean}) {
		const wrapper = mount(Heading, {
			attachTo: document.body,
			props: {
				task: props.task,
				canWrite: props.canWrite ?? true,
				hasClose: props.hasClose ?? true,
			},
			global: {
				plugins: [i18n],
				stubs: {
					BaseButton: {
						template: '<button><slot /></button>',
					},
					Icon: true,
					ColorBubble: true,
					Done: true,
					CustomTransition: {
						template: '<div><slot /></div>',
					},
				},
			},
		})
		activeWrappers.add(wrapper)
		return wrapper
	}

	it('saves entered title on blur and emits update:task with updated model', async () => {
		const task = new TaskModel({id: 1, title: 'Initial Title'})
		const updatedTask = new TaskModel({id: 1, title: 'Updated Title'})
		mocks.taskStoreUpdate.mockResolvedValueOnce(updatedTask)

		const wrapper = createWrapper({task})
		await nextTick()

		const h1 = wrapper.find('h1').element as HTMLHeadingElement
		expect(h1.textContent).toBe('Initial Title')
		expect(h1.getAttribute('contenteditable')).toBe('true')

		h1.textContent = 'Updated Title'
		h1.dispatchEvent(new Event('input'))
		h1.dispatchEvent(new Event('blur'))

		await Promise.resolve()
		await nextTick()

		expect(mocks.taskStoreUpdate).toHaveBeenCalledWith({
			...task,
			title: 'Updated Title',
		})
		expect(wrapper.emitted('update:task')?.[0]).toEqual([updatedTask])
		expect(wrapper.text()).toContain('Saved')

		vi.advanceTimersByTime(2000)
		await nextTick()
		expect(wrapper.text()).not.toContain('Saved')
	})

	it('reports error when save is rejected and keeps draft text', async () => {
		const task = new TaskModel({id: 1, title: 'Initial Title'})
		const saveError = new Error('Network error')
		mocks.taskStoreUpdate.mockRejectedValueOnce(saveError)

		const wrapper = createWrapper({task})
		await nextTick()

		const h1 = wrapper.find('h1').element as HTMLHeadingElement
		h1.textContent = 'Draft Title'
		h1.dispatchEvent(new Event('input'))
		h1.dispatchEvent(new Event('blur'))

		await Promise.resolve()
		await nextTick()

		expect(mocks.taskStoreUpdate).toHaveBeenCalled()
		expect(mocks.error).toHaveBeenCalledWith(saveError)
		expect(h1.textContent).toBe('Draft Title')
		expect(wrapper.emitted('update:task')).toBeUndefined()
	})

	it('preserves h1 identity, dirty text, focus, and selection across canonical update; updates aria-label on locale change and disables on permission revocation', async () => {
		const task = new TaskModel({id: 1, title: 'Initial Title'})
		const wrapper = createWrapper({task, canWrite: true})
		await nextTick()

		const initialH1 = wrapper.find('h1').element as HTMLHeadingElement
		expect(initialH1.getAttribute('aria-label')).toBe('Task Title')

		initialH1.focus()
		initialH1.textContent = 'Unsaved In-Progress Edit'
		initialH1.dispatchEvent(new Event('input'))

		const textNode = initialH1.firstChild!
		const range = document.createRange()
		range.setStart(textNode, 8)
		range.setEnd(textNode, 19)
		const selection = window.getSelection()!
		selection.removeAllRanges()
		selection.addRange(range)

		await wrapper.setProps({
			task: new TaskModel({id: 1, title: 'Background Canonical Update'}),
		})
		await nextTick()

		const currentH1 = wrapper.find('h1').element as HTMLHeadingElement
		expect(currentH1).toBe(initialH1)
		expect(currentH1.textContent).toBe('Unsaved In-Progress Edit')
		expect(document.activeElement).toBe(currentH1)

		const curSel = window.getSelection()!
		expect(curSel.rangeCount).toBeGreaterThan(0)
		const currentRange = curSel.getRangeAt(0)
		expect(currentRange.startContainer).toBe(textNode)
		expect(currentRange.startOffset).toBe(8)
		expect(currentRange.endContainer).toBe(textNode)
		expect(currentRange.endOffset).toBe(19)

		i18n.global.locale.value = 'de'
		await nextTick()
		expect(currentH1.getAttribute('aria-label')).toBe('Aufgabentitel')

		await wrapper.setProps({canWrite: false})
		await nextTick()
		expect(currentH1.hasAttribute('contenteditable')).toBe(false)
		expect(currentH1.classList.contains('disabled')).toBe(true)
		expect(currentH1.hasAttribute('aria-label')).toBe(false)

		currentH1.dispatchEvent(new Event('blur'))
		expect(mocks.taskStoreUpdate).not.toHaveBeenCalled()
	})

	it('switches editor and title when task id changes and suppresses deferred old save', async () => {
		const taskA = new TaskModel({id: 1, title: 'Task A'})
		const taskB = new TaskModel({id: 2, title: 'Task B'})

		let resolveTaskASave!: (value: ITask) => void
		const taskASavePromise = new Promise<ITask>((resolve) => {
			resolveTaskASave = resolve
		})
		mocks.taskStoreUpdate.mockReturnValueOnce(taskASavePromise)

		const wrapper = createWrapper({task: taskA})
		await nextTick()

		const h1A = wrapper.find('h1').element as HTMLHeadingElement
		expect(h1A.textContent).toBe('Task A')

		h1A.textContent = 'Task A Modified'
		h1A.dispatchEvent(new Event('input'))
		h1A.dispatchEvent(new Event('blur'))

		await nextTick()
		expect(mocks.taskStoreUpdate).toHaveBeenCalledWith({
			...taskA,
			title: 'Task A Modified',
		})

		await wrapper.setProps({task: taskB})
		await nextTick()

		const h1B = wrapper.find('h1').element as HTMLHeadingElement
		expect(h1B).not.toBe(h1A)
		expect(h1B.textContent).toBe('Task B')

		resolveTaskASave(new TaskModel({id: 1, title: 'Task A Modified'}))
		await Promise.resolve()
		await nextTick()

		expect(wrapper.emitted('update:task')).toBeUndefined()
		expect(wrapper.text()).not.toContain('Saved')
	})

	it('suppresses emitted update and new timer on deferred save resolve after unmount', async () => {
		const task = new TaskModel({id: 1, title: 'Initial Title'})
		let resolveSave!: (value: ITask) => void
		const savePromise = new Promise<ITask>((resolve) => {
			resolveSave = resolve
		})
		mocks.taskStoreUpdate.mockReturnValueOnce(savePromise)

		const wrapper = createWrapper({task})
		await nextTick()

		const h1 = wrapper.find('h1').element as HTMLHeadingElement
		h1.textContent = 'Modified Title'
		h1.dispatchEvent(new Event('input'))
		h1.dispatchEvent(new Event('blur'))
		await nextTick()

		expect(mocks.taskStoreUpdate).toHaveBeenCalled()
		wrapper.unmount()
		activeWrappers.delete(wrapper)

		resolveSave(new TaskModel({id: 1, title: 'Modified Title'}))
		await Promise.resolve()
		await nextTick()

		expect(wrapper.emitted('update:task')).toBeUndefined()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('suppresses error callback on deferred save rejection after unmount', async () => {
		const task = new TaskModel({id: 1, title: 'Initial Title'})
		let rejectSave!: (reason?: unknown) => void
		const savePromise = new Promise<ITask>((_, reject) => {
			rejectSave = reject
		})
		mocks.taskStoreUpdate.mockReturnValueOnce(savePromise)

		const wrapper = createWrapper({task})
		await nextTick()

		const h1 = wrapper.find('h1').element as HTMLHeadingElement
		h1.textContent = 'Modified Title'
		h1.dispatchEvent(new Event('input'))
		h1.dispatchEvent(new Event('blur'))
		await nextTick()

		expect(mocks.taskStoreUpdate).toHaveBeenCalled()
		wrapper.unmount()
		activeWrappers.delete(wrapper)

		rejectSave(new Error('Delayed failure'))
		await Promise.resolve()
		await nextTick()

		expect(mocks.error).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('cleans up beforeunload listener on unmount', async () => {
		const task = new TaskModel({id: 1, title: 'Title'})
		const wrapper = createWrapper({task})
		await nextTick()

		const h1 = wrapper.find('h1').element as HTMLHeadingElement
		h1.textContent = 'Dirty Title'
		h1.dispatchEvent(new Event('input'))

		const eventBeforeUnmount = new Event('beforeunload', {cancelable: true}) as BeforeUnloadEvent
		window.dispatchEvent(eventBeforeUnmount)
		expect(eventBeforeUnmount.defaultPrevented).toBe(true)

		wrapper.unmount()
		activeWrappers.delete(wrapper)

		const eventAfterUnmount = new Event('beforeunload', {cancelable: true}) as BeforeUnloadEvent
		window.dispatchEvent(eventAfterUnmount)
		expect(eventAfterUnmount.defaultPrevented).toBe(false)
	})
})
