import {test,expect} from './fixtures'
import type {Page,APIRequestContext,TestInfo} from '@playwright/test'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
const message='Undo fixture rejection'
const notices=(page:Page)=>page.locator('.global-notification .vue-notification')
const completion=(page:Page)=>notices(page).filter({hasText:'The task was successfully marked as done.'})
const taskWrite=(page:Page)=>page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST')
async function prepare(page:Page,title:string){
 await ProjectFactory.create(1,{title});await createDefaultViews(1);await TaskFactory.create(1,{title:'Undo rejection task'})
 await page.goto('/projects/1/1');await expect(page.locator('.tasks')).toContainText('Undo rejection task')
 const accepted=taskWrite(page);await page.locator('.tasks .single-task .base-checkbox__label').first().click();expect((await accepted).ok()).toBe(true);await expect(completion(page)).toBeVisible()
}
async function settled(page:Page,response:Awaited<ReturnType<typeof taskWrite>>){expect(response.status()).toBe(503);await response.finished();for(let sample=0;sample<6;sample++){await page.waitForTimeout(100);expect(await page.locator('.global-notification .vue-notification.error').count()).toBe(0)}}
async function backendDone(api:APIRequestContext,token:string){const response=await api.get('tasks/1',{headers:{Authorization:`Bearer ${token}`}});expect(response.ok()).toBe(true);return (await response.json()).done}
async function record(page:Page,api:APIRequestContext,token:string,info:TestInfo){
 await info.attach('failed-undo-state',{body:JSON.stringify({url:page.url(),checkbox:await page.evaluate(()=>document.querySelector<HTMLInputElement>('.tasks .base-checkbox input')?.checked??null),backendDone:await backendDone(api,token),errors:await page.locator('.global-notification .vue-notification.error').allTextContents()}),contentType:'application/json'})
 await info.attach('failed-undo-screen',{body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'})
}
test('live completion Undo rejects without a new error notice and leaves backend completion unchanged',async({authenticatedPage:page,apiContext,userToken},info)=>{
 await prepare(page,'Live Undo project');await page.route('**/api/v1/tasks/1',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{message}}):route.continue())
 const denied=taskWrite(page);await completion(page).getByRole('button',{name:'Undo',exact:true}).click();await settled(page,await denied);await record(page,apiContext,userToken,info)
 await expect(completion(page)).toHaveCount(0);await expect(notices(page).filter({hasText:message})).toHaveCount(0);expect(await backendDone(apiContext,userToken)).toBe(true);await expect(page.locator('.tasks .base-checkbox input').first()).not.toBeChecked()
 await page.reload();await expect(page.locator('.tasks .base-checkbox input').first()).toBeChecked()
})
test('completion Undo retained after SPA task navigation rejects without publishing into the current task',async({authenticatedPage:page,apiContext,userToken},info)=>{
 await prepare(page,'Navigated Undo project');await page.locator('.tasks .task-link').first().click();await expect(page.locator('.task-view h1')).toContainText('Undo rejection task')
 await page.route('**/api/v1/tasks/1',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{message}}):route.continue())
 const denied=taskWrite(page);await completion(page).getByRole('button',{name:'Undo',exact:true}).click();await settled(page,await denied);await record(page,apiContext,userToken,info)
 await expect(completion(page)).toHaveCount(0);await expect(notices(page).filter({hasText:message})).toHaveCount(0);expect(await backendDone(apiContext,userToken)).toBe(true);await expect(page.locator('.task-view h1')).toContainText('Undo rejection task')
})
test('a retained rejected Undo cannot publish feedback after logout and actual login restart',async({authenticatedPage:page,apiContext,userToken,currentUser},info)=>{
 await prepare(page,'Restart Undo project');await page.locator('.username-dropdown-trigger').click();await page.getByText('Logout',{exact:true}).click();await expect(page).toHaveURL(/\/login(?:#.*)?$/)
 let release!:()=>void,seen!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),pending=new Promise<void>(resolve=>seen=resolve)
 await page.route('**/api/v1/tasks/1',async route=>{if(route.request().method()!=='POST')return route.continue();seen();await gate;await route.fulfill({status:503,json:{message}})})
 const denied=taskWrite(page);await completion(page).getByRole('button',{name:'Undo',exact:true}).click();await pending
 try {
  await page.locator('#username').fill(currentUser.username);await page.locator('#password').fill(TEST_PASSWORD);const login=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'Login',exact:true}).click();expect((await login).ok()).toBe(true)
  await expect(page.locator('#loginform')).toHaveCount(0);await expect(page.locator('.username-dropdown-trigger')).toBeVisible();if(page.viewportSize()!.width<769&&await page.locator('.menu-button').getAttribute('aria-expanded')!=='true')await page.locator('.menu-button').click();await page.locator('.menu-container').getByRole('link',{name:'Restart Undo project',exact:true}).click();await expect(page.locator('.tasks')).toContainText('Undo rejection task')
  release();await settled(page,await denied);await record(page,apiContext,userToken,info)
  await expect(completion(page)).toHaveCount(0);await expect(notices(page).filter({hasText:message})).toHaveCount(0);expect(await backendDone(apiContext,userToken)).toBe(true);await expect(page.locator('.tasks .base-checkbox input').first()).toBeChecked()
 } finally {release()}
})
