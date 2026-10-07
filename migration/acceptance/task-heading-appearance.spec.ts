import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark'] as const)
 test(`detail heading colors and empty comments print ${width} ${colorScheme}`, async ({authenticatedPage: page, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Heading project'}); await createDefaultViews(1)
 await TaskFactory.create(1, {title: 'Heading task', description: '<p>Heading description</p>'})
 await page.setViewportSize({width, height: 900}); await page.emulateMedia({colorScheme}); await page.goto('/tasks/1')
 await expect(page.locator('.task-view h1.title')).toHaveText('Heading task')
 const headings = page.locator('.task-view .description h2, .task-view .comments-heading')
 await expect(headings).toHaveCount(2)
 const colors = await headings.evaluateAll(elements => elements.map(el => ({heading: getComputedStyle(el).color, icon: getComputedStyle(el.querySelector('.icon')!).color})))
 for (const color of colors) expect.soft(color.icon).toBe(color.heading)
 await info.attach('heading-colors', {body: JSON.stringify({width, colorScheme, colors}, null, 2), contentType: 'application/json'})
 await page.emulateMedia({media: 'print'})
 await expect.soft(page.locator('.comments-heading')).not.toBeVisible()
 await page.emulateMedia({media: 'screen'})
 await TaskCommentFactory.create(1, {task_id: 1, author_id: currentUser.id, comment: '<p>Printable existing comment</p>'})
 await page.reload(); await expect(page.locator('.comments .media.comment[id^=comment]')).toHaveCount(1)
 await page.emulateMedia({media: 'print'})
 await expect(page.locator('.comments-heading')).toBeVisible()
 await expect(page.locator('.comments .media.comment[id^=comment]')).toContainText('Printable existing comment')
 await info.attach('heading-print', {body: await page.screenshot({animations: 'disabled', fullPage: true}), contentType: 'image/png'})
})
