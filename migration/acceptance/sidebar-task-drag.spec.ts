import {test, expect} from './cookie-fixtures'
import type {Locator, Page} from '@playwright/test'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async () => {
 await ProjectFactory.create(1, {title: 'Source project'})
 await ProjectFactory.create(1, {id: 2, title: 'Destination project'}, false)
 await createDefaultViews(1)
 await createDefaultViews(2, 5)
 await TaskFactory.create(6, {title: id => `Drag task ${id}`})
 await BucketFactory.create(2, {project_view_id: 4, title: id => `Bucket ${id}`, position: id => id * 65536})
 await TaskBucketFactory.create(6, {task_id: id => id, bucket_id: id => id <= 3 ? 1 : 2, project_view_id: 4})
 await Factory.seed('task_positions', [1, 4].flatMap(view => Array.from({length: 6}, (_, i) => ({task_id: i + 1, project_view_id: view, position: (i + 1) * 65536}))))
})
async function hover(page: Page, source: Locator, destination: Locator) {
 if (await page.locator('.kanban').count()) await expect(page.getByRole('button', {name: 'Create a bucket', exact: true})).toBeVisible()
 await source.hover({position: {x: 20, y: 20}})
 const from = await source.boundingBox(), to = await destination.boundingBox()
 expect(from).not.toBeNull(); expect(to).not.toBeNull()
 await page.mouse.move(from!.x + 20, from!.y + 20)
 await page.mouse.down()
 await page.mouse.move(from!.x + 30, from!.y + 30, {steps: 5})
 await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, {steps: 15})
 await page.mouse.move(to!.x + to!.width / 2 + 1, to!.y + to!.height / 2)
}
for (const view of [1, 4]) {
 const source = (page: Page) => page.locator(view === 1 ? '.tasks [data-task-id="1"]' : '.kanban .task-item[data-task-id="1"]').first()
 test(`sidebar task move hover pending write and reload from view ${view}`, async ({authenticatedPage: page}, info) => {
  await page.setViewportSize({width: 1440, height: 900})
  let release!: () => void, seen!: () => void
  const gate = new Promise<void>(resolve => release = resolve), started = new Promise<void>(resolve => seen = resolve)
  await page.route('**/api/v1/tasks/1', async route => {if (route.request().method() !== 'POST') {await route.continue(); return} seen(); await gate; await route.continue()})
  await page.goto(`/projects/1/${view}`)
  const title = page.getByRole('link', {name: 'Drag task 1', exact: true})
  await expect(title).toBeVisible()
  const destination = page.locator('.menu-container a[href="/projects/2"]')
  await hover(page, source(page), destination)
  await expect(page.locator('.menu-container li[data-project-id="2"]')).toHaveClass(/is-drop-target/)
  await page.screenshot({path: info.outputPath('sidebar-drag.png')})
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/tasks/1'))
  await page.mouse.up(); await started
  await expect(page.locator('.menu-container li[data-project-id="2"]')).toHaveClass(/is-drop-target/)
  await page.screenshot({path: info.outputPath('sidebar-pending.png')})
  release(); const response = await saved
  expect(response.ok()).toBe(true); expect(response.request().postDataJSON().project_id).toBe(2)
  await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
  await expect(title).toHaveCount(0)
  await page.reload(); await expect(title).toHaveCount(0)
  await destination.click(); await expect(page.getByRole('link', {name: 'Drag task 1', exact: true})).toBeVisible()
 })
 test(`sidebar rejected move retains task and permits retry from view ${view}`, async ({authenticatedPage: page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.route('**/api/v1/tasks/1', route => route.request().method() === 'POST' ? route.fulfill({status: 403, contentType: 'application/json', body: JSON.stringify({message: 'Fixture sidebar denial'})}) : route.continue())
  await page.goto(`/projects/1/${view}`)
  const destination = page.locator('.menu-container a[href="/projects/2"]')
  await expect(page.getByRole('link', {name: 'Drag task 1', exact: true})).toBeVisible()
  await hover(page, source(page), destination); await page.mouse.up()
  await expect(page.locator('.vue-notification.error')).toContainText('Fixture sidebar denial')
  await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
  await page.reload(); await expect(page.getByRole('link', {name: 'Drag task 1', exact: true})).toBeVisible()
  await page.unroute('**/api/v1/tasks/1')
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/tasks/1'))
  await hover(page, source(page), destination); await page.mouse.up(); expect((await saved).ok()).toBe(true)
  await page.reload(); await expect(page.getByRole('link', {name: 'Drag task 1', exact: true})).toHaveCount(0)
 })
 test(`reader sidebar target stays unhighlighted and server denies move from view ${view}`, async ({authenticatedPage: page}) => {
  await UserFactory.create(1, {id: 2, username: 'project-owner'}, false)
  await ProjectFactory.create(2, {owner_id: id => id === 2 ? 2 : 1, title: id => id === 2 ? 'Reader project' : 'Source project'})
  await UserProjectFactory.create(1, {project_id: 2, user_id: 1, permission: 0})
  await page.setViewportSize({width: 1440, height: 900}); await page.goto(`/projects/1/${view}`)
  await expect(page.getByRole('link', {name: 'Drag task 1', exact: true})).toBeVisible()
  const destination = page.locator('.menu-container a[href="/projects/2"]')
  await hover(page, source(page), destination)
  await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
  const rejected = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/tasks/1'))
  await page.mouse.up(); const response = await rejected; expect(response.status()).toBe(403); expect(response.request().postDataJSON().project_id).toBe(2)
  await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
  await page.reload(); await expect(page.getByRole('link', {name: 'Drag task 1', exact: true})).toBeVisible()
 })
}

test.describe('touch list ordering', () => {
 test.use({hasTouch: true, isMobile: true})
 test('real touch handle reorders and persists without leaving sidebar feedback', async ({authenticatedPage: page}) => {
  await page.setViewportSize({width: 1024, height: 900})
  await page.goto('/projects/1/1')
  const rows = page.locator('.tasks .task-link')
  await expect(rows).toHaveCount(6)
  const handle = page.locator('.tasks [data-task-id="2"] .handle').first()
  const from = await handle.boundingBox(), to = await page.locator('.tasks [data-task-id="1"]').first().boundingBox()
  expect(from).not.toBeNull(); expect(to).not.toBeNull()
  const cdp = await page.context().newCDPSession(page)
  const start = {x: from!.x + from!.width / 2, y: from!.y + from!.height / 2}
  const target = {x: start.x, y: to!.y + 2}
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/tasks/2/position'))
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...start, id: 1}]})
  for (let step = 1; step <= 20; step++) {
   await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: start.x + (target.x - start.x) * step / 20, y: start.y + (target.y - start.y) * step / 20, id: 1}]})
   await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []})
  const response = await saved
  expect(response.ok()).toBe(true); expect(response.request().postDataJSON()).toMatchObject({task_id: 2, project_view_id: 1, position: 32768})
  await expect(rows.first()).toHaveText('Drag task 2')
  await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
  await page.reload(); await expect(rows.first()).toHaveText('Drag task 2')
  await cdp.detach()
 })
})
