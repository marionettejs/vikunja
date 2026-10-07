import {afterEach,expect,it,vi} from 'vitest'
import {TaskActionsApplication} from './task-actions-application'
import {TaskActionsView} from './task-actions-view'
import type {TaskPorts} from './application'
import {TaskRecordSession} from '@/features/task/task-record'
import TaskModel from '@/models/task'
import UserModel from '@/models/user'
import SubscriptionService from '@/services/subscription'
import TaskDuplicateService from '@/services/taskDuplicateService'
const owners: {destroy:()=>unknown}[]=[]
afterEach(()=>{owners.splice(0).forEach(owner=>owner.destroy());vi.restoreAllMocks();document.body.replaceChildren()})
async function setup() {
 const record=new TaskRecordSession(new TaskModel({id:1,maxPermission:2}),vi.fn()),ports={user:()=>new UserModel({id:1,type:1}),open:vi.fn(),close:vi.fn(),removed:vi.fn()} as unknown as TaskPorts
 const app=new TaskActionsApplication({record:()=>record,ports});owners.push(app);await app.start()
 const view=new TaskActionsView({record,workflow:app,ports,active:vi.fn()});owners.push(view);view.render();document.body.append(view.el)
 return {app,view,record,ports}
}
it('workflow pending publication disables view controls and blocks repeated subscription commands',async()=>{
 let finish!:()=>void
 const create=vi.spyOn(SubscriptionService.prototype,'create').mockImplementation(()=>new Promise(resolve=>finish=()=>resolve({} as never)))
 const {view,record}=await setup(),pending=view.run('subscribe')
 await vi.waitFor(()=>expect(create).toHaveBeenCalledOnce());expect(view.el.querySelector<HTMLButtonElement>('[data-action=subscribe]')!.disabled).toBe(true)
 await view.run('subscribe');expect(create).toHaveBeenCalledOnce();finish();await pending
 expect(record.task.subscription).not.toBeNull();expect(view.el.querySelector<HTMLButtonElement>('[data-action=subscribe]')!.disabled).toBe(false)
})
it('stopping the workflow aborts a held duplicate and rejects its late navigation even if transport resolves',async()=>{
 let finish!:()=>void,signal!:AbortSignal
 vi.spyOn(TaskDuplicateService.prototype,'create').mockImplementation((_model,caller)=>{signal=caller!;return new Promise(resolve=>finish=()=>resolve({duplicatedTask:new TaskModel({id:2})} as never))})
 const {app,view,ports}=await setup(),pending=view.run('duplicate')
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));app.stop();expect(signal.aborted).toBe(true);finish();await pending
 expect(ports.open).not.toHaveBeenCalled();expect(ports.close).not.toHaveBeenCalled()
})

it('old completion after restart cannot clear the busy state of a new workflow',async()=>{
 let finishOld!:()=>void,finishNew!:()=>void
 vi.spyOn(TaskDuplicateService.prototype,'create').mockImplementation(()=>new Promise(resolve=>finishOld=()=>resolve({duplicatedTask:new TaskModel({id:2})} as never)))
 vi.spyOn(SubscriptionService.prototype,'create').mockImplementation(()=>new Promise(resolve=>finishNew=()=>resolve({} as never)))
 const {app}=await setup(),old=app.run('duplicate',new AbortController().signal)
 await vi.waitFor(()=>expect(finishOld).toBeTypeOf('function'));app.stop();await app.start()
 const current=app.run('subscribe',new AbortController().signal)
 await vi.waitFor(()=>expect(finishNew).toBeTypeOf('function'));finishOld();await old
 expect(app.getState().busy).toBe(true)
 finishNew();await current;expect(app.getState().busy).toBe(false)
})
