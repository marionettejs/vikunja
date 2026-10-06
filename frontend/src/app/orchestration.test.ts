import {afterEach,expect,it,vi} from 'vitest'
import {Region,View} from 'marionette'
import {WorkspaceApplication} from './workspace'
import {VikunjaApplication} from './application'
import {SessionApplication} from './session'
import {CatalogApplication} from '../features/projects/catalog'
import {ProjectApplication} from '../features/projects/application'
import type {Label} from '@/client/generated'
import {parseRoute} from './routes'
import UserModel from '@/models/user'
import TaskModel from '@/models/task'
import ProjectService from '@/services/project'
import AvatarService from '@/services/avatar'
const transport=vi.hoisted(()=>({createTasks:vi.fn()}))
vi.mock('../shared/quick-add',()=>({createTasks:transport.createTasks}))
vi.mock('../features/labels/label-transport',()=>({loadLabels:vi.fn().mockResolvedValue([]),createLabel:vi.fn(),updateLabel:vi.fn(),deleteLabel:vi.fn()}))
const owners:Array<{destroy:()=>unknown}>=[]
afterEach(()=>{for(const owner of owners.splice(0))owner.destroy();vi.restoreAllMocks();transport.createTasks.mockReset();document.body.replaceChildren()})
function session(){const app=new SessionApplication();app.getState().set({status:'authenticated',user:new UserModel({id:1,username:'fixture-user',type:1})});owners.push(app);return app}
function root(){const host=document.createElement('div');document.body.append(host);const app=new VikunjaApplication({region:{el:host}});owners.push(app);return app}
function workspace(){const app=new WorkspaceApplication({session:session(),navigate:vi.fn()});owners.push(app);return app}
it('Kanban creation captures its initiating project before label preparation even if route changes without abort',async()=>{
 const app=workspace(),catalog=app.getChildApp('catalog') as InstanceType<typeof CatalogApplication>;let release!:()=>void;vi.spyOn(catalog,'ensureLabels').mockImplementation(()=>new Promise<Label[]>(resolve=>release=()=>resolve([])));transport.createTasks.mockResolvedValue({tasks:[new TaskModel({id:1,projectId:1})]});app.getState().route=parseRoute(new URL('https://fixture/projects/1/4'));const pending=(app.getChildApp('project') as InstanceType<typeof ProjectApplication>).options.kanban.createTask('Created task *label',1,new AbortController().signal);app.getState().route=parseRoute(new URL('https://fixture/projects/2/8'));release();await pending;expect(transport.createTasks.mock.calls[0][0]).toEqual([{title:'Created task *label',bucketId:1,projectId:1}])
})
it('profile publication after actual Workspace stop cannot render into its destroyed shell',async()=>{
 vi.spyOn(ProjectService.prototype,'getAll').mockResolvedValue([]);vi.spyOn(AvatarService.prototype,'getBlobUrl').mockResolvedValue('blob:fixture-avatar');const app=workspace();const host=document.createElement('div');document.body.append(host);const region=new Region({el:host});await app.start({region});const chrome=app.shell(),shell=chrome.getView() as InstanceType<typeof View>,render=vi.spyOn(shell,'showChildView');app.stop();expect(shell.isDestroyed()).toBe(true);expect(chrome.getView()).toBeUndefined();expect(chrome.isRunning()).toBe(false);expect(chrome.getChildApp('notifications')!.isRunning()).toBe(false);expect(chrome.getChildApp('timer')!.isRunning()).toBe(false);expect(()=>app.options.session.trigger('profile:changed')).not.toThrow();expect(render).not.toHaveBeenCalled();region.destroy()
})
it('an older navigation flush cannot replace newer committed history and dispatch',async()=>{
 const app=root();vi.spyOn(app,'prepareStart').mockResolvedValue(undefined);vi.spyOn(app,'onStart').mockImplementation(()=>{});await app.start();const work=app.getChildApp('workspace') as InstanceType<typeof WorkspaceApplication>;(app.getChildApp('session') as InstanceType<typeof SessionApplication>).getState().set({status:'authenticated',user:new UserModel({id:1,type:1})});vi.spyOn(work,'isRunning').mockReturnValue(true);const releases:Array<()=>void>=[];vi.spyOn(work,'flushForNavigation').mockImplementation(()=>new Promise<void>(resolve=>releases.push(resolve)));const dispatch=vi.spyOn(app,'dispatch').mockResolvedValue(undefined);const old=app.commitNavigation('/projects/1/1',false),newer=app.commitNavigation('/projects/2/5',false);releases[1]();await newer;releases[0]();await old;expect(location.pathname).toBe('/projects/2/5');expect(dispatch).toHaveBeenCalledTimes(1)
})
it('stopping root during navigation flush prevents history and dispatch publication',async()=>{
 const app=root();vi.spyOn(app,'prepareStart').mockResolvedValue(undefined);vi.spyOn(app,'onStart').mockImplementation(()=>{});await app.start();const work=app.getChildApp('workspace') as InstanceType<typeof WorkspaceApplication>;(app.getChildApp('session') as InstanceType<typeof SessionApplication>).getState().set({status:'authenticated',user:new UserModel({id:1,type:1})});vi.spyOn(work,'isRunning').mockReturnValue(true);let release!:()=>void;vi.spyOn(work,'flushForNavigation').mockImplementation(()=>new Promise<void>(resolve=>release=resolve));const dispatch=vi.spyOn(app,'dispatch').mockResolvedValue(undefined),before=location.pathname;const pending=app.commitNavigation('/projects/9/9',false);app.stop();release();await pending;expect(location.pathname).toBe(before);expect(dispatch).not.toHaveBeenCalled()
})

for(const staleFailure of [false,true])it(`root dispatch ignores an older child readiness ${staleFailure?'failure':'completion'}`,async()=>{
 const app=root();vi.spyOn(app,'prepareStart').mockResolvedValue(undefined);vi.spyOn(app,'onStart').mockImplementation(()=>{});await app.start();(app.getChildApp('session') as InstanceType<typeof SessionApplication>).getState().set({status:'authenticated',user:new UserModel({id:1,type:1})});const host=new View({template:()=>'<div data-workspace></div>',regions:{workspace:'[data-workspace]'}});host.render();app.setView(host);const work=app.getChildApp('workspace') as InstanceType<typeof WorkspaceApplication>,requests:Array<{resolve:(value:boolean)=>void,reject:(error:Error)=>void}>=[];vi.spyOn(work,'start').mockImplementation(()=>new Promise<boolean>((resolve,reject)=>requests.push({resolve,reject})));const show=vi.spyOn(work,'showRoute').mockResolvedValue(undefined);history.replaceState({},'','/teams');const old=app.dispatch();history.replaceState({},'','/labels');const current=app.dispatch();requests[1].resolve(true);await current;if(staleFailure)requests[0].reject(new Error('obsolete readiness'));else requests[0].resolve(true);await old;expect(show).toHaveBeenCalledTimes(1);expect(show.mock.calls[0][0].path).toBe('/labels');expect((app.getState() as {destination:string}).destination).toBe('workspace')
})

it('stopping Workspace during Shell preparation cancels the child and prevents stale mounting',async()=>{
 const app=workspace(),chrome=app.shell(),host=document.createElement('div');document.body.append(host);const region=new Region({el:host})
 let finish!:()=>void,signal!:AbortSignal
 vi.spyOn(chrome,'prepareStart').mockImplementation((_options,context)=>{signal=context.signal;return new Promise<void>(resolve=>finish=resolve)})
 const starting=app.start({region});await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));app.stop();expect(signal.aborted).toBe(true);finish()
 expect(await starting).toBe(false);expect(chrome.isRunning()).toBe(false);expect(region.hasView()).toBe(false);region.destroy()
})
