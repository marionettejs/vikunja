import {test,expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {LinkShareFactory} from '../../frontend/tests/factories/link_sharing'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
const hash='paired-public-lifetimes'
async function capture(page,info,name){await info.attach(name,{body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'})}
test.beforeEach(async({page,currentUser})=>{
 void currentUser;await setupApiUrl(page)
 await ProjectFactory.create(1,{title:'Paired public project'});await createDefaultViews(1)
 await TaskFactory.create(1,{title:'Paired public task',priority:2});await BucketFactory.create(1,{project_view_id:4,title:'Public paired bucket'});await TaskBucketFactory.create(1,{project_view_id:4,bucket_id:1});await LinkShareFactory.create(1,{hash,permission:1})
})
async function open(page){await page.goto(`/share/${hash}/auth`);await expect(page.locator('.tasks')).toContainText('Paired public task');expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()}
async function taskPage(page){await page.goto(`/projects/1/4#share-auth-token=${hash}`);await expect(page.locator('.kanban .task')).toHaveCount(1);await page.locator('.kanban-card__title-link').filter({hasText:'Paired public task'}).first().click();await expect(page.locator('.task-view h1')).toContainText('Paired public task');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.kanban')).toHaveCount(0)}
test('public task update notice title hit-test click dismiss project return and expiry',async({page},info)=>{
 await open(page);await taskPage(page)
 const priority=page.getByRole('combobox',{name:'Priority',exact:true})
 const accepted=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST')
 await priority.selectOption('4');expect((await accepted).ok()).toBe(true)
 const notice=page.locator('.global-notification .vue-notification').filter({hasText:'The task was saved successfully.'})
 await expect(notice).toBeVisible()
 await expect.soft(notice.locator('.notification-title')).toHaveText('Success')
 expect.soft(await notice.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
 await capture(page,info,'public-task-notice')
 await notice.click({timeout:1500});await expect(notice).toBeHidden()
 const second=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST');await priority.selectOption('3');expect((await second).ok()).toBe(true)
 await expect(notice).toBeVisible()
 await page.locator('.link-share-view .project-title-button').click();await expect(page).toHaveURL(new RegExp(`/projects/1/1#share-auth-token=${hash}$`));await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(notice).toBeVisible();await expect(notice).toBeHidden({timeout:5000})
 expect(new URL(page.url()).hash).toBe(`#share-auth-token=${hash}`)
 await page.reload();await expect(page.locator('.tasks')).toContainText('Paired public task');await page.locator('.task-link').first().click();await expect(priority).toHaveValue('3')
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
})
test('failed public project read hides project title link and retry restores hash and actual tasks',async({page},info)=>{
 await open(page)
 let failed=true
 await page.route('**/api/v1/projects**',route=>failed&&route.request().method()==='GET'&&/^\/api\/v1\/projects(?:\/1)?$/.test(new URL(route.request().url()).pathname)?route.fulfill({status:503,json:{message:'Paired public project unavailable'}}):route.continue())
 await page.reload()
 await expect(page.getByText('Failed to load project information.',{exact:false})).toBeVisible()
 await expect.soft(page.locator('.link-share-view .project-title-button')).not.toBeVisible()
 await capture(page,info,'public-project-error')
 failed=false
 await page.getByRole('button',{name:'Retry',exact:true}).click({timeout:5000})
 await expect(page.locator('.tasks')).toContainText('Paired public task')
 await expect(page.locator('.link-share-view .project-title-button')).toContainText('Paired public project')
 expect(new URL(page.url()).hash).toBe(`#share-auth-token=${hash}`)
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
})
test('live public task document offline teardown reconnect preserves share identity and deep link',async({page},info)=>{
 await open(page);await taskPage(page)
 const before=page.url()
 try{
  await page.context().setOffline(true)
  await expect(page.getByRole('heading',{name:'You are offline.',exact:true})).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.global-notification .vue-notification')).toHaveCount(0)
  await capture(page,info,'public-offline')
 }finally{await page.context().setOffline(false)}
 await expect(page.locator('.task-view h1')).toContainText('Paired public task')
 expect(page.url()).toBe(before)
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
 await expect(page.locator('.navbar')).toHaveCount(0)
 await capture(page,info,'public-reconnected')
})
test('public task Back returns to previous view and deep links respect remembered or default project view',async({page},info)=>{
 await open(page);await taskPage(page)
 await page.locator('.task-view .back-button').click()
 await expect(page).toHaveURL(new RegExp(`/projects/1/4#share-auth-token=${hash}$`));await expect(page.locator('.kanban .task')).toHaveCount(1)
 const deep=await page.context().newPage()
 try{
  await deep.goto(`/tasks/1#share-auth-token=${hash}`);await expect(deep.locator('.task-view h1')).toContainText('Paired public task')
  await deep.locator('.task-view .back-button').click()
  await expect(deep).toHaveURL(new RegExp(`/projects/1/4#share-auth-token=${hash}$`));await expect(deep.locator('.kanban .task')).toHaveCount(1)
  await deep.goBack();await expect(deep).toHaveURL(new RegExp(`/tasks/1#share-auth-token=${hash}$`));await expect(deep.locator('.task-view h1')).toContainText('Paired public task');await expect(deep.getByRole('dialog')).toHaveCount(0)
 }finally{await deep.close()}
 await page.evaluate(()=>localStorage.removeItem('projectView'))
 const clean=await page.context().newPage()
 try{
  await clean.goto(`/tasks/1#share-auth-token=${hash}`);await expect(clean.locator('.task-view h1')).toContainText('Paired public task')
  await clean.locator('.task-view .back-button').click()
  await expect(clean).toHaveURL(new RegExp(`/projects/1/1#share-auth-token=${hash}$`));await expect(clean.locator('.tasks')).toContainText('Paired public task')
  await clean.goBack();await expect(clean).toHaveURL(new RegExp(`/tasks/1#share-auth-token=${hash}$`));await expect(clean.locator('.task-view h1')).toContainText('Paired public task')
 }finally{await clean.close()}
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();await capture(page,info,'public-task-back')
})
