import {test,expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
test('accepted task notice retains original deadline across actual logout while task requests and dialogs stop',async({authenticatedPage:page},info)=>{
 await ProjectFactory.create(1,{title:'Notice session lifetime'});await createDefaultViews(1);await TaskFactory.create(1,{title:'Notice session task',priority:2})
 await page.goto('/projects/1/1');await page.locator('.tasks .task-link').first().click();await expect(page.locator('.task-view h1')).toContainText('Notice session task')
 const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST')
 await page.getByRole('combobox',{name:'Priority',exact:true}).selectOption('4');expect((await response).ok()).toBe(true)
 const notice=page.locator('.global-notification .vue-notification').filter({hasText:'The task was saved successfully.'});await expect(notice).toBeVisible()
 await page.locator('.username-dropdown-trigger').click();await assertAccountMenu(page);await page.getByText('Logout',{exact:true}).click()
 await expect(page).toHaveURL(/\/login(?:#.*)?$/);await expect(page.getByRole('heading',{name:'Login',exact:true})).toBeVisible()
 await expect(notice).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.task-view')).toHaveCount(0)
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
 await info.attach('notice-after-logout',{body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'})
 await expect(notice).toBeHidden({timeout:5000})
})
test('retained Undo after actual logout reaches the isolated backend and cannot change its task without authentication',async({authenticatedPage:page,apiContext,userToken},info)=>{
 await ProjectFactory.create(1,{title:'Notice Undo session'});await createDefaultViews(1);await TaskFactory.create(1,{title:'Notice Undo task'})
 await page.goto('/projects/1/1');await expect(page.locator('.tasks')).toContainText('Notice Undo task')
 const accepted=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST')
 await page.locator('.tasks .single-task .base-checkbox__label').first().click();expect((await accepted).ok()).toBe(true)
 const notice=page.locator('.global-notification .vue-notification').filter({hasText:'The task was successfully marked as done.'});await expect(notice).toBeVisible()
 await page.locator('.username-dropdown-trigger').click();await assertAccountMenu(page);await page.getByText('Logout',{exact:true}).click();await expect(page).toHaveURL(/\/login(?:#.*)?$/)
 expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();await expect(notice.getByRole('button',{name:'Undo',exact:true})).toBeVisible()
 const denied=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST')
 await notice.getByRole('button',{name:'Undo',exact:true}).click();const rejected=await denied;expect(rejected.status()).toBe(401);await rejected.finished();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 await expect(notice).toBeHidden();await expect(page.locator('.global-notification .vue-notification.error')).toHaveCount(0)
 const response=await apiContext.get('tasks/1',{headers:{Authorization:`Bearer ${userToken}`}});expect(response.ok()).toBe(true);expect((await response.json()).done).toBe(true)
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.task-view')).toHaveCount(0);await expect(page).toHaveURL(/\/login(?:#.*)?$/)
 await info.attach('denied-Undo-after-logout',{body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'})
})

async function assertAccountMenu(page: import('@playwright/test').Page) {
 const menu=page.locator('.navbar .dropdown-menu').filter({has:page.getByText('Logout',{exact:true})});await expect(menu).toBeVisible()
 for(const label of ['Settings','Keyboard Shortcuts','About','Logout']) {
  const item=menu.getByText(label,{exact:true});await expect(item).toBeVisible()
  await expect.poll(()=>item.evaluate(element=>{const r=element.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})).toBe(true)
 }
}
