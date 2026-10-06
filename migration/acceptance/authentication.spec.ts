import {test, expect} from './fixtures'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test('login focuses username, retains rejected credentials, blocks duplicate submit and reloads a protected route', async ({page, currentUser}) => {
 await ProjectFactory.create(1, {title:'Login fixture'}); await createDefaultViews(1)
 await setupApiUrl(page); await page.goto('/login')
 const username=page.locator('#username'), password=page.locator('#password'), submit=page.locator('#loginform button[type=submit]')
 await expect(username).toBeFocused(); await username.fill(currentUser.username); await password.fill('wrong-password')
 const rejected=page.waitForResponse(response=>response.url().endsWith('/login')&&response.request().method()==='POST'); await submit.click(); expect((await rejected).status()).toBe(403)
 await expect(submit).toBeEnabled(); await expect(username).toHaveValue(currentUser.username); await expect(password).toHaveValue('wrong-password')
 await password.fill(TEST_PASSWORD); await page.locator('#loginform input[type=checkbox]').check()
 let release!:()=>void, seen!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve}), pending=new Promise<void>(resolve=>{seen=resolve})
 await page.route('**/api/v1/login',async route=>{seen();await gate;await route.continue()})
 const accepted=page.waitForResponse(response=>response.url().endsWith('/login')&&response.request().method()==='POST');await submit.click();await pending
 await expect(submit).toBeDisabled();await expect(submit).toHaveClass(/is-loading/);release();const response=await accepted;expect(response.ok()).toBe(true);expect(response.request().postDataJSON()).toMatchObject({username:currentUser.username,password:TEST_PASSWORD,long_token:true})
 await expect(page.locator('#loginform')).toHaveCount(0);await page.goto('/projects/1/1');await expect(page.getByPlaceholder('Add a task…')).toBeVisible();await page.reload();await expect(page.getByPlaceholder('Add a task…')).toBeVisible()
})
