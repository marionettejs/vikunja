import {test,expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {ProjectViewFactory} from '../../frontend/tests/factories/project_view'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {Factory} from '../../frontend/tests/support/factory'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {execFileSync} from 'node:child_process'
import {repositoryRoot} from './published-baseline'

// Instrumented attribution only. These samples do not replace untraced n20
// benchmarks. Request ownership starts at the action, ends at its readiness,
// and never includes the next iteration's preparatory list navigation.
test('alternating published current editor and Kanban tail attribution',async({browser,currentUser},info)=>{
 const size=50,description='<p>'+'Rich benchmark content. '.repeat(450)+'</p>'
 await ProjectFactory.create(1,{title:'Benchmark project',created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
 await ProjectViewFactory.create(4,{project_id:1,title:id=>['List','Gantt','Table','Kanban'][id-1],view_kind:id=>id-1,bucket_configuration_mode:id=>id===4?1:0})
 await TaskFactory.create(size,{title:id=>`Bench task ${String(id).padStart(4,'0')}`,description:id=>id===1?description:'',created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
 await TaskCommentFactory.create(50,{task_id:1,author_id:currentUser.id,comment:id=>`Benchmark comment ${id}`,created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
 await Factory.seed('task_positions',[1,4].flatMap(view=>Array.from({length:size},(_,i)=>({task_id:i+1,project_view_id:view,position:(i+1)*65536}))))
 await BucketFactory.create(2,{project_view_id:4,title:id=>id===1?'Backlog':'Doing'})
 await TaskBucketFactory.create(size,{task_id:id=>id,bucket_id:id=>id%2?1:2,project_view_id:4})
 const samples:unknown[]=[],owners=[]
 const frame=page=>page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))))
 try{
  for(const app of [{name:'current',baseURL:process.env.BASE_URL!},{name:'published',baseURL:'http://127.0.0.1:4470'}]){
   const context=await browser.newContext({baseURL:app.baseURL,viewport:{width:1440,height:900},locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'})
   const login=await context.request.post(process.env.API_URL!.replace(/\/$/,'')+'/login',{data:{username:currentUser.username,password:TEST_PASSWORD}});expect(login.ok()).toBe(true)
   const {token}=await login.json()
   await context.addInitScript(({token,api})=>{localStorage.setItem('token',token);localStorage.setItem('API_URL',api);Object.assign(window,{API_URL:api})},{token,api:process.env.API_URL!})
   const page=await context.newPage(),cdp=await context.newCDPSession(page),requests=new Map(),apiErrors=[]
   let active: {origin:number,requests:unknown[]}|undefined
   page.on('request',request=>{if(active)requests.set(request,{owner:active,url:request.url(),method:request.method(),started:performance.now()-active.origin})})
   page.on('response',response=>{if(response.url().includes('/api/')&&response.status()>=400)apiErrors.push({url:response.url(),status:response.status()});const request=requests.get(response.request());if(request){request.owner.requests.push({url:request.url,method:request.method,started:request.started,response:performance.now()-request.owner.origin,status:response.status()});requests.delete(response.request())}})
   page.on('requestfailed',failed=>{const request=requests.get(failed);if(request){request.owner.requests.push({url:request.url,method:request.method,started:request.started,failed:performance.now()-request.owner.origin,error:failed.failure()?.errorText});requests.delete(failed)}})
   await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000})
   async function profile(phase:string,iteration:number,navigation:boolean,action:()=>Promise<void>){
    await page.evaluate(()=>performance.clearResourceTimings())
    const before=await cdp.send('Performance.getMetrics'),origin=performance.now(),owned={origin,requests:[]};active=owned
    await cdp.send('Profiler.start')
    try{await action();await frame(page)}finally{active=undefined}
    const elapsed=performance.now()-origin,{profile:cpu}=await cdp.send('Profiler.stop'),after=await cdp.send('Performance.getMetrics')
    const evidence=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>e.toJSON()),toolbarButtons:document.querySelectorAll('[data-toolbar] button').length}))
    const sample={app:app.name,phase,iteration,elapsed,before,after,cumulativeCpuDeltaValid:!navigation,...evidence,requests:owned.requests,apiErrors:[...apiErrors]};samples.push(sample)
    await info.attach(`${app.name}-${iteration}-${phase}-cpu`,{body:JSON.stringify(cpu),contentType:'application/json'})
    expect(apiErrors).toEqual([])
   }
   owners.push({app,context,page,profile})
  }
  for(let iteration=-2;iteration<10;iteration++)for(const owner of iteration%2?[...owners].reverse():owners){
   const {page}=owner
   await page.goto('/projects/1/1?sort=title:asc');await expect(page.locator('.tasks .task-link')).toHaveCount(50);await page.evaluate(()=>document.fonts.ready)
   await page.locator('.tasks .task-link').first().click();await expect(page.locator('.description .ProseMirror')).toContainText('Rich benchmark content.');await expect(page.locator('.comments .media.comment[id^=comment]')).toHaveCount(50)
   await owner.profile('editor-enter-discard',iteration,false,async()=>{const editor=page.locator('.description .ProseMirror');await page.locator('.description').getByRole('button',{name:'Edit',exact:true}).click();await editor.press('ControlOrMeta+End');await editor.pressSequentially(' temporary');await editor.press('Escape');await expect(editor).toHaveText(description.slice(3,-4))})
   await owner.profile('kanban-ready',iteration,true,async()=>{await page.goto('/projects/1/4');await expect(page.locator('.kanban .bucket[data-bucket-id]')).toHaveCount(2);await expect(page.locator('.kanban .task')).toHaveCount(50)})
  }
 }finally{for(const owner of owners)await owner.context.close()}
 await info.attach('tail-attribution-samples',{body:JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8'}).trim(),frontend:execFileSync('git',['rev-parse','HEAD:frontend'],{cwd:repositoryRoot,encoding:'utf8'}).trim(),published:'5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf',browser:browser.version(),size,measured:10,warmups:2,order:'Alternating app order each iteration; both persistent contexts. CPU profiler1ms; instrumented diagnostics only.',samples},null,2),contentType:'application/json'})
})
