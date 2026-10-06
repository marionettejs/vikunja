import {test,expect} from './cookie-fixtures'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
test.use({serviceWorkers:'allow'})
for(const width of [1440,390]) test('live offline presentation removes login and restores it on reconnect '+width,async({page},info)=>{
 await page.setViewportSize({width,height:900});await setupApiUrl(page);await page.goto('/login');await expect(page.locator('#username')).toBeVisible();await page.locator('#username').fill('Before disconnect')
 try{
  await page.context().setOffline(true);await expect(page.getByRole('heading',{name:'You are offline.',exact:true})).toBeVisible();await expect(page.getByText('Please check your network connection and try again.',{exact:true})).toBeVisible();await expect(page.locator('#username')).toHaveCount(0);await expect(page.locator('.add-to-home-screen')).toHaveCount(0);await page.screenshot({path:info.outputPath('offline-live-'+width+'.png'),animations:'disabled'})
  await page.context().setOffline(false);await expect(page.locator('#username')).toBeVisible();await expect(page.locator('#username')).toHaveValue('');await expect(page.getByRole('heading',{name:'You are offline.',exact:true})).toHaveCount(0)
 }finally{await page.context().setOffline(false)}
})

import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for(const width of [1440,390]) test('live offline tears down authenticated task and reconnects at its deep link '+width,async({authenticatedPage:page})=>{
 await ProjectFactory.create(1,{title:'Offline project'});await createDefaultViews(1);await TaskFactory.create(1,{title:'Offline task'});await page.setViewportSize({width,height:900});await page.goto('/tasks/1');await expect(page.locator('.task-view h1')).toContainText('Offline task')
 try{await page.context().setOffline(true);await expect(page.getByRole('heading',{name:'You are offline.',exact:true})).toBeVisible();await expect(page.locator('.task-view')).toHaveCount(0);await expect(page.locator('.add-to-home-screen')).toHaveCount(0);await page.context().setOffline(false);await expect(page.locator('.task-view h1')).toContainText('Offline task');await expect(page).toHaveURL(/\/tasks\/1$/);await expect(page.locator('#loginform')).toHaveCount(0)}finally{await page.context().setOffline(false)}
})
