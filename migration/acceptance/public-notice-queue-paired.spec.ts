import {test,expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {LinkShareFactory} from '../../frontend/tests/factories/link_sharing'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
test('public real writes deduplicate notices, evict oldest at max two, and Undo preserves the other entry',async({page,currentUser,userToken,apiContext},info)=>{
 void currentUser;await setupApiUrl(page)
 await ProjectFactory.create(1,{title:'Paired notice queue'});await createDefaultViews(1);await TaskFactory.create(1,{title:'Notice queue task',priority:2});await LinkShareFactory.create(1,{hash:'paired-notice-queue',permission:1})
 await page.goto('/share/paired-notice-queue/auth');await expect(page.locator('.tasks')).toContainText('Notice queue task');await page.locator('.task-link').first().click();await expect(page.locator('.task-view h1')).toContainText('Notice queue task')
 const notices=page.locator('.global-notification .vue-notification'),saved=notices.filter({hasText:'The task was saved successfully.'}),priority=page.getByRole('combobox',{name:'Priority',exact:true})
 for(const value of ['4','3']){const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks/1')&&r.request().method()==='POST');await priority.selectOption(value);expect((await response).ok()).toBe(true);await expect(saved).toBeVisible()}
 await expect(notices).toHaveCount(1);await expect(saved).toContainText('×2')
 await page.locator('.link-share-view .project-title-button').click();await expect(page.locator('.tasks')).toContainText('Notice queue task')
 const checkbox=page.getByRole('checkbox',{name:"Mark 'Notice queue task' as done"}),done=notices.filter({hasText:'The task was successfully marked as done.'}),undone=notices.filter({hasText:'The task was successfully un-marked as done.'})
 await page.locator('.tasks .single-task .base-checkbox__label').first().click();await expect(done).toBeVisible();await expect(notices).toHaveCount(2)
 await page.locator('.tasks .single-task .base-checkbox__label').first().click();await expect(undone).toBeVisible();await expect(notices).toHaveCount(2);await expect(saved).toHaveCount(0)
 await page.locator('.tasks .single-task .base-checkbox__label').first().click();await expect(done).toContainText('×2');await expect(notices).toHaveCount(2)
 const undo=done.getByRole('button',{name:'Undo',exact:true})
 await expect(undo).toHaveClass(/is-outlined/);await expect(undo).toHaveClass(/has-no-shadow/)
 expect(await undo.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
 await info.attach('public-notice-max-two',{body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'})
 await undo.click();await expect(checkbox).not.toBeChecked();await expect(done).toHaveCount(0);await expect(undone).toBeVisible()
 const response=await apiContext.get('tasks/1',{headers:{Authorization:`Bearer ${userToken}`}});expect(response.ok()).toBe(true);expect((await response.json()).done).toBe(false)
 await expect(undone).toBeHidden({timeout:5000});expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
})
