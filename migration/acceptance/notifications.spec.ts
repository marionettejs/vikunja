import {test,expect} from './fixtures'
import {UserFactory} from '../../frontend/tests/factories/user'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {ProjectViewFactory} from '../../frontend/tests/factories/project_view'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {Factory} from '../../frontend/tests/support/factory'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import type {APIRequestContext} from '@playwright/test'

async function prepare(api:APIRequestContext,currentUser:{username:string}){
 const [commenter]=await UserFactory.create(1,{id:100,username:'notification-author'},false)
 await ProjectFactory.create(1,{id:100,owner_id:100,title:'Notification project'},false)
 await ProjectViewFactory.create(1,{id:100,project_id:100},false)
 await TaskFactory.create(1,{id:100,project_id:100,created_by_id:100,title:'Notification task'},false)
 await UserProjectFactory.create(1,{id:100,project_id:100,user_id:1},false)
 const response=await api.post('login',{data:{username:commenter.username,password:TEST_PASSWORD}})
 expect(response.ok()).toBeTruthy()
 const {token}=await response.json()
 return async()=>{
  const response=await api.put('tasks/100/comments',{data:{comment:`<p>Hello <mention-user data-id="${currentUser.username}">@${currentUser.username}</mention-user></p>`},headers:{Authorization:`Bearer ${token}`}})
  expect(response.ok()).toBeTruthy()
 }
}
for(const width of [1440,390]){
 test(`actual backend notification delivery navigation read and reload ${width}`,async({authenticatedPage:page,apiContext,currentUser,userToken},info)=>{
  const mention=await prepare(apiContext,currentUser)
  await page.setViewportSize({width,height:900})
  const events:string[]=[]
  page.on('websocket',socket=>socket.on('framereceived',frame=>events.push(String(frame.payload))))
  await page.goto('/')
  await expect.poll(()=>events.some(event=>event.includes('auth.success'))).toBeTruthy()
  await expect(page.locator('.tasktext').first()).toContainText('Notification task')
  await page.evaluate(()=>document.fonts.ready)
  await mention()
  await page.locator('.notifications .trigger-button').click()
  const popup=page.locator('.notifications-list')
  await expect(popup.locator('.single-notification')).toHaveCount(1,{timeout:15000})
  await expect(popup).toContainText('commented on #100')
  expect(events.some(event=>event.includes('notification.created')&&event.includes('task.comment'))).toBeTruthy()
  await expect.poll(()=>popup.evaluate(element=>getComputedStyle(element).opacity)).toBe('1')
  await page.screenshot({path:info.outputPath('delivered.png'),animations:'disabled'})
  await popup.locator('.single-notification').click()
  await expect(page).toHaveURL(/\/tasks\/100/)
  await expect(page.locator('.notifications-list')).not.toBeVisible()
  const headers={Authorization:`Bearer ${userToken}`}
  await expect.poll(async()=>{const response=await apiContext.get('notifications',{headers});return (await response.json())[0]?.read_at}).not.toBeNull()
  await page.reload()
  await page.locator('.notifications .trigger-button').click()
  await expect(popup.locator('.read-indicator.read')).toHaveCount(1)
  await popup.getByRole('button',{name:'Clear notifications',exact:true}).click()
  await expect(popup).toContainText("You don't have any notifications")
  expect(await (await apiContext.get('notifications',{headers})).json()).toEqual([])
  await page.screenshot({path:info.outputPath('cleared.png')})
 })
 test(`actual backend notification mark all and feed navigation ${width}`,async({authenticatedPage:page,apiContext,currentUser,userToken})=>{
  const mention=await prepare(apiContext,currentUser)
  await mention()
  const headers={Authorization:`Bearer ${userToken}`}
  await expect.poll(async()=>{const response=await apiContext.get('notifications',{headers});expect(response.ok()).toBeTruthy();return (await response.json()).length}).toBe(1)
  const [first]=await (await apiContext.get('notifications',{headers})).json()
  await Factory.seed('notifications',[1,2].map(id=>({id,notifiable_id:currentUser.id,name:first.name,notification:JSON.stringify(first.notification),subject_id:100,project_id:100,created:first.created,read_at:null})))
  await page.setViewportSize({width,height:900});await page.goto('/')
  await page.locator('.notifications .trigger-button').click()
  const popup=page.locator('.notifications-list')
  await expect(popup.locator('.single-notification')).toHaveCount(2)
  await popup.getByRole('button',{name:'Mark all notifications as read',exact:true}).click()
  await expect(popup.locator('.read-indicator.read')).toHaveCount(2)
  const response=await apiContext.get('notifications',{headers:{Authorization:`Bearer ${userToken}`}})
  expect((await response.json()).every((notification:{read_at:string|null})=>Boolean(notification.read_at))).toBeTruthy()
  await popup.getByRole('link',{name:'Subscribe to notifications via Atom feed'}).click()
  await expect(page).toHaveURL(/\/user\/settings\/feeds/)
  await expect(popup).not.toBeVisible()
 })
}
test('notification load failure has visible retry and retains focus while loading',async({authenticatedPage:page})=>{
 let calls=0,release!:()=>void
 await page.route('**/api/v1/notifications*',async route=>{
  if(route.request().method()!=='GET')return route.continue()
  calls++
  if(calls===1)return route.fulfill({status:503,json:{message:'notification read unavailable'}})
  await new Promise<void>(ready=>release=ready)
  await route.fulfill({json:[]})
 })
 await page.goto('/');const trigger=page.locator('.notifications .trigger-button');await trigger.click()
 const popup=page.locator('.notifications-list')
 await expect(popup.getByRole('alert')).toContainText('notification read unavailable')
 await popup.getByRole('button',{name:'try again',exact:true}).click()
 await expect(popup.getByRole('status')).toContainText('Loading')
 await trigger.focus();release()
 await expect(popup).toContainText("You don't have any notifications")
 await expect(trigger).toBeFocused()
 await page.keyboard.press('Escape')
 await expect(popup).not.toBeVisible();await expect(trigger).toBeFocused()
})
test('notification failed mutation retries actual request and logout cancels a late list',async({authenticatedPage:page,apiContext,currentUser})=>{
 const mention=await prepare(apiContext,currentUser);await mention()
 let writes=0
 await page.route('**/api/v1/notifications',async route=>{
  if(route.request().method()!=='POST')return route.continue()
  writes++;if(writes===1)return route.fulfill({status:503,json:{message:'notification write unavailable'}})
  return route.continue()
 })
 await page.goto('/');await page.locator('.notifications .trigger-button').click()
 const popup=page.locator('.notifications-list'),all=popup.getByRole('button',{name:'Mark all notifications as read',exact:true})
 await all.click();await expect(popup.getByRole('alert')).toContainText('notification write unavailable')
 await expect(all).toBeEnabled();await all.click()
 await expect(popup.locator('.read-indicator.read')).toHaveCount(1);expect(writes).toBe(2)
 await page.keyboard.press('Escape')
 let release!:()=>void
 await page.route('**/api/v1/notifications*',async route=>{
  if(route.request().method()!=='GET')return route.continue()
  await new Promise<void>(ready=>release=ready)
  await route.fulfill({json:[{id:999,name:'task.created',created:'2026-01-01T00:00:00Z',notification:{task:{id:100,title:'obsolete notification'}}}]}).catch(()=>{})
 })
 await page.reload();await expect.poll(()=>Boolean(release)).toBeTruthy()
 await page.locator('.navbar-end .dropdown-trigger button').click()
 await page.getByRole('button',{name:'Logout',exact:true}).click()
 await expect(page).toHaveURL(/\/login/);release()
 await expect(page.locator('.notifications')).toHaveCount(0)
 await expect(page.getByText('obsolete notification')).toHaveCount(0)
})
