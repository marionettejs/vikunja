import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {ShareSearchView, type Member} from './project-sharing'
import * as users from '@/models/user'
let region: InstanceType<typeof Region> | undefined
beforeEach(()=>{vi.spyOn(users,'fetchAvatarBlobUrl').mockResolvedValue(undefined)})
function setup(search: (query: string) => Promise<Member[]>) {
 const host=document.createElement('div');document.body.append(host);region=new Region({el:host})
 const changed=vi.fn(),view=new ShareSearchView({id:'sharing-search',kind:'user',label:'Search user',placeholder:'Search',items:[],selected:null,search,error:vi.fn(),changed})
 region.show(view)
 const input=host.querySelector('input')!
 return {view,input,host,changed}
}
afterEach(()=>{region?.destroy();region=undefined;vi.restoreAllMocks();document.body.replaceChildren()})
it('sharing choices render the source display name and 24px avatar but select username',async()=>{
 vi.spyOn(users,'fetchAvatarBlobUrl').mockResolvedValue('blob:paired-avatar')
 const state=setup(async()=>[{id:2,username:'paired-user',name:'Paired User',permission:0}])
 state.input.value='paired-user';await state.view.search()
 await vi.waitFor(()=>expect(state.host.querySelector('img.avatar')?.getAttribute('src')).toBe('blob:paired-avatar'))
 expect(state.host.querySelector('[role=option]')?.textContent).toContain('Paired User')
 expect(state.host.querySelector('img.avatar')?.getAttribute('width')).toBe('24')
 state.view.choose(0)
 expect(state.input.value).toBe('paired-user');expect(state.changed).toHaveBeenLastCalledWith(2)
})
it('a superseded sharing read cannot clear the current loading spinner or replace its choices',async()=>{
 const requests:Array<{resolve:(rows:Member[])=>void,reject:(error:Error)=>void}>=[]
 const state=setup(()=>new Promise((resolve,reject)=>requests.push({resolve,reject})))
 state.input.value='first';const first=state.view.search()
 state.input.value='second';const second=state.view.search()
 requests[0].reject(new DOMException('canceled','AbortError'));await first
 expect(state.host.querySelector('.control.is-loading')).not.toBeNull()
 requests[1].resolve([{id:3,username:'second',name:'Second',permission:0}]);await second
 expect(state.host.querySelector('.control.is-loading')).toBeNull()
 expect(state.host.querySelector('[role=option]')?.textContent).toContain('Second')
})
it('destroying sharing search prevents late choice and avatar publication',async()=>{
 let finish!: (rows:Member[])=>void
 const avatars=vi.spyOn(users,'fetchAvatarBlobUrl').mockResolvedValue('blob:obsolete')
 const state=setup(()=>new Promise(resolve=>finish=resolve))
 state.input.value='obsolete';const pending=state.view.search()
 region!.destroy();region=undefined
 finish([{id:2,username:'obsolete',name:'Obsolete',permission:0}]);await pending
 expect(avatars).not.toHaveBeenCalled();expect(state.host.querySelector('[role=option]')).toBeNull()
})
it('destroying a mounted sharing choice prevents its pending avatar from publishing',async()=>{
 let finish!: (value:string)=>void
 vi.spyOn(users,'fetchAvatarBlobUrl').mockImplementation(()=>new Promise(resolve=>finish=resolve))
 const state=setup(async()=>[{id:2,username:'pending-avatar',name:'Pending Avatar',permission:0}])
 state.input.value='pending-avatar';await state.view.search()
 const image=state.host.querySelector('img.avatar')!
 expect(image.isConnected).toBe(true);expect(image.hasAttribute('src')).toBe(false)
 region!.destroy();region=undefined;finish('blob:obsolete-avatar')
 await Promise.resolve();await Promise.resolve()
 expect(image.isConnected).toBe(false);expect(image.hasAttribute('src')).toBe(false)
})
