import {afterEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import {View} from '../index'
import {TaskRecords, type TaskRecord} from '../data/TaskRecords'
import {TaskDetailController} from './TaskDetailController'

const cleanup: Array<() => void> = []
afterEach(() => {cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren()})
function deferred<T>() {
	let resolve!: (value: T) => void, reject!: (error: Error) => void
	const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no})
	return {promise, resolve, reject}
}
function fixture() {
	const records = new TaskRecords()
	cleanup.push(() => records.destroy())
	const first = records.upsert({id: 1, title: 'First', maxPermission: 1})
	const second = records.upsert({id: 2, title: 'Second', maxPermission: 1})
	const Host = View.extend({template: () => html`<main></main>`, regions: {screen: 'main'}})
	const Screen = View.extend({template: (data: {title: string}) => html`<h1>${data.title}</h1>`})
	const host = new Host()
	host.render()
	document.body.append(host.el)
	cleanup.push(() => host.destroy())
	const workspace = {load: vi.fn(async (id: number) => records.get(id)!)}
	const saveBeforeLeave = vi.fn(async () => {})
	const createScreen = vi.fn((record: TaskRecord) => ({view:new Screen({model:record}),saveBeforeLeave}))
	const controller = new TaskDetailController({region: host.getRegion('screen')!, workspace, createScreen})
	cleanup.push(() => controller.destroy())
	return {controller, records, first, second, workspace, createScreen, saveBeforeLeave}
}
const displayed = () => document.querySelector('h1')?.textContent

describe('TaskDetailController', () => {
	it('retains the current screen until draft save completes before replacement', async () => {
		const {controller,first,createScreen,saveBeforeLeave}=fixture()
		await controller.open(1)
		expect(createScreen.mock.calls[0][0]).toBe(first)
		const pending=deferred<void>()
		saveBeforeLeave.mockReturnValueOnce(pending.promise)
		const opening=controller.open(2)
		await vi.waitFor(()=>expect(saveBeforeLeave).toHaveBeenCalledTimes(1))
		expect(displayed()).toBe('First')
		pending.resolve()
		await opening
		expect(displayed()).toBe('Second')
	})

	it('retains current screen and propagates save or load failure',async()=>{
		const {controller,saveBeforeLeave,workspace}=fixture()
		await controller.open(1)
		const error=new Error('offline')
		saveBeforeLeave.mockRejectedValueOnce(error)
		await expect(controller.open(2)).rejects.toBe(error)
		expect(displayed()).toBe('First')
		workspace.load.mockRejectedValueOnce(error)
		await expect(controller.open(2)).rejects.toBe(error)
		expect(displayed()).toBe('First')
	})

	it('waits before closing and retains ownership of workspace records',async()=>{
		const {controller,saveBeforeLeave,records,first}=fixture()
		await controller.open(1)
		const pending=deferred<void>()
		saveBeforeLeave.mockReturnValueOnce(pending.promise)
		const closing=controller.close()
		expect(displayed()).toBe('First')
		pending.resolve()
		await closing
		expect(displayed()).toBeUndefined()
		expect(records.get(1)).toBe(first)
	})

	it('ignores superseded loads and errors without invoking stale saves',async()=>{
		const {controller,workspace,saveBeforeLeave}=fixture()
		const pending=deferred<TaskRecord>()
		workspace.load.mockReturnValueOnce(pending.promise)
		const old=controller.open(1)
		await controller.open(2)
		pending.reject(new Error('stale'))
		await old
		expect(displayed()).toBe('Second')
		expect(saveBeforeLeave).not.toHaveBeenCalled()
	})

	it('does not close a newer screen when an earlier close finishes later',async()=>{
		const {controller,saveBeforeLeave}=fixture()
		await controller.open(1)
		const pending=deferred<void>()
		saveBeforeLeave.mockReturnValueOnce(pending.promise)
		const closing=controller.close()
		await controller.open(2)
		pending.resolve()
		await closing
		expect(displayed()).toBe('Second')
	})

	it('does not recreate screens after destruction during save',async()=>{
		const {controller,saveBeforeLeave,createScreen}=fixture()
		await controller.open(1)
		const pending=deferred<void>()
		saveBeforeLeave.mockReturnValueOnce(pending.promise)
		const opening=controller.open(2)
		await vi.waitFor(()=>expect(saveBeforeLeave).toHaveBeenCalled())
		controller.destroy()
		pending.resolve()
		await opening
		expect(displayed()).toBeUndefined()
		expect(createScreen).toHaveBeenCalledTimes(1)
	})
})
