import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

for (const width of [1440, 390]) test(`task links retain original sidebar project context ${width}`, async ({authenticatedPage: page}, info) => {
 await ProjectFactory.create(1, {title: 'Prior project'})
 await ProjectFactory.create(1, {id: 2, title: 'Task project'}, false)
 await createDefaultViews(1); await createDefaultViews(2, 5)
 await TaskFactory.create(1, {title: 'Prior task'})
 await TaskFactory.create(1, {id: 2, title: 'Cross project task', project_id: 2}, false)
 await page.setViewportSize({width, height: 900})
 const active = page.locator('.list-menu-link.router-link-exact-active')
 await page.goto('/tasks/2')
 await expect(page.locator('.task-view h1.title')).toHaveText('Cross project task')
 await expect.soft(active).toHaveCount(0)
 await page.reload()
 await expect(page.locator('.task-view h1.title')).toHaveText('Cross project task')
 await expect.soft(active).toHaveCount(0)
 await page.goto('/projects/1/1')
 await expect(active).toHaveText('Prior project')
 await page.getByRole('button', {name: 'Open the search/quick action bar', exact: true}).click()
 const dialog = page.getByRole('dialog')
 await dialog.locator('input').first().pressSequentially('Cross project task')
 await dialog.getByRole('button').filter({hasText: 'Cross project task'}).first().click()
 await expect(page.locator('.task-view h1.title')).toHaveText('Cross project task')
 await expect.soft(active).toHaveText('Prior project')
 await info.attach('sidebar-context', {body: JSON.stringify({viewport: width, active: await active.allTextContents(), url: page.url()}, null, 2), contentType: 'application/json'})
})
