import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {html} from 'lit-html'
import {View} from '../index'
import {TaskDetailController} from '../controllers/TaskDetailController'
import StarterKit from '@tiptap/starter-kit'
import {TaskWorkspace} from '../data/TaskWorkspace'
import {createTaskDetailScreen} from './createTaskDetailScreen'

vi.mock('@/helpers/fetcher', () => ({AuthenticatedHTTPFactory: vi.fn()}))
let workspace: TaskWorkspace
let screen: ReturnType<typeof createTaskDetailScreen> | undefined
const update = vi.fn(async (id: number, payload: Record<string, unknown>) => ({...payload, id}))
beforeEach(() => {
	update.mockClear()
	workspace = new TaskWorkspace({load: async id => ({id,title:'Original',description:'<p>Existing</p>',project_id:7,max_permission:1}),update})
	localStorage.clear()
})
afterEach(() => {
	screen?.view.destroy()
	screen=undefined
	workspace.destroy()
	localStorage.clear()
	document.body.replaceChildren()
})
async function mount(permission = 1) {
	const record = await workspace.load(3)
	record.set('maxPermission', permission === 1 ? 1 : 0)
	screen = createTaskDetailScreen({record,workspace,extensions:[StarterKit],isModal:false,t:(key:string)=>key,taskUrl:'/tasks/3',taskIdentifier:'#3',onCopy:()=>{},onBack:()=>{},onClose:()=>{},labels:{back:'Back',heading:{title:'Title',titleRequired:'Required',saving:'Saving',saved:'Saved',saveError:'Failed',copy:'Copy',close:'Close',done:'Done'},description:{description:'Description',save:'Save',saving:'Saving',saved:'Saved',error:'Failed'}}})
	screen.view.render()
	document.body.appendChild(screen.view.el)
	return {record,screen}
}

describe('native task screen composition',()=>{
	it('saves heading and description through the same workspace record',async()=>{
		const {record,screen}=await mount()
		const title=screen.heading.el.querySelector('h1')!
		title.textContent='Changed title'
		title.dispatchEvent(new Event('input',{bubbles:true}))
		title.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))
		await vi.waitFor(()=>expect(record.get('title')).toBe('Changed title'))
		screen.description.getEditor()!.commands.setContent('<p>New description</p>')
		await screen.saveBeforeLeave()
		expect(record.get('description')).toBe('<p>New description</p>')
		expect(update).toHaveBeenLastCalledWith(3,expect.objectContaining({id:3,title:'Changed title',description:'<p>New description</p>',project_id:7}))
		const destroyed=vi.fn()
		record.on('destroy',destroyed)
		screen.view.destroy()
		expect(destroyed).not.toHaveBeenCalled()
	})

	it('allows clearing description and rejects a save after permission revocation',async()=>{
		const {record,screen}=await mount()
		screen.description.getEditor()!.commands.setContent('<p></p>')
		await screen.saveBeforeLeave()
		expect(record.get('description')).toBe('<p></p>')
		record.set('maxPermission',0)
		screen.description.getEditor()!.commands.setContent('<p>Rejected</p>')
		await expect(screen.saveBeforeLeave()).rejects.toThrow()
		expect(record.get('description')).toBe('<p></p>')
		expect(localStorage.getItem('editorDraft-task-description-3')).toBe('<p>Rejected</p>')
		expect(update).toHaveBeenCalledTimes(1)
	})

	it('mounts readonly controls without a persistence callback being used',async()=>{
		const {screen}=await mount(0)
		expect(screen.description.getEditor()!.isEditable).toBe(false)
		await screen.saveBeforeLeave()
		expect(update).not.toHaveBeenCalled()
	})
	it('retains a real screen on title failure and closes only after both drafts save', async () => {
		const {screen, record} = await mount()
		const Host = View.extend({template: () => html`<main></main>`, regions: {task: 'main'}})
		const host = new Host()
		host.render()
		document.body.append(host.el)
		const controller = new TaskDetailController({region: host.getRegion('task')!, workspace, createScreen: () => screen})
		try {
			await controller.open(3)
			const title = screen.heading.el.querySelector('h1')!
			title.textContent = 'Unsaved title'
			title.dispatchEvent(new Event('input', {bubbles: true}))
			screen.description.getEditor()!.commands.setContent('<p>Unsaved description</p>')
			const failure = new Error('offline')
			let rejectSave!: (error: Error) => void
			update.mockImplementationOnce(() => new Promise((_resolve, reject) => {rejectSave = reject}))
			title.dispatchEvent(new FocusEvent('focusout', {bubbles: true}))
			const closing = controller.close()
			const rejected = expect(closing).rejects.toBe(failure)
			await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
			expect(screen.view.isDestroyed()).toBe(false)
			rejectSave(failure)
			await rejected
			expect(document.body.contains(title)).toBe(true)
			expect(title.textContent).toBe('Unsaved title')
			await controller.close()
			expect(record.get('title')).toBe('Unsaved title')
			expect(record.get('description')).toBe('<p>Unsaved description</p>')
			expect(update).toHaveBeenCalledTimes(3)
			expect(update).toHaveBeenLastCalledWith(3, expect.objectContaining({title: 'Unsaved title', description: '<p>Unsaved description</p>'}))
			expect(screen.view.isDestroyed()).toBe(true)
		} finally {
			controller.destroy()
			host.destroy()
		}
	})

	it('saves title edits made while description persistence is pending', async () => {
		const {record, screen} = await mount()
		let release!: () => void
		const pending = new Promise<void>(resolve => {release = resolve})
		update.mockImplementationOnce(async (id, payload) => {
			await pending
			return {...payload, id}
		})
		screen.description.getEditor()!.commands.setContent('<p>Pending description</p>')
		const saving = screen.saveBeforeLeave()
		await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
		const title = screen.heading.el.querySelector('h1')!
		title.textContent = 'Later title'
		title.dispatchEvent(new Event('input', {bubbles: true}))
		release()
		await saving
		expect(record.get('title')).toBe('Later title')
		expect(record.get('description')).toBe('<p>Pending description</p>')
		expect(update).toHaveBeenCalledTimes(2)
	})

})
