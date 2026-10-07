import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import type {Page} from '@playwright/test'
async function seed() {
 await ProjectFactory.create(1, {title: 'Lazy project'})
 await createDefaultViews(1)
 await BucketFactory.create(1, {project_view_id: 4, title: 'Backlog'})
 await TaskBucketFactory.create(2, {task_id: id => id, bucket_id: 1, project_view_id: 4})
 await TaskFactory.create(2, {title: id => `Lazy task ${id}`, project_id: 1, description: '<p>Original rich task description</p>'})
}
async function hold(page: Page, pattern: string) {
 let release!: () => void, started!: () => void
 const gate = new Promise<void>(resolve => {release = resolve}), seen = new Promise<void>(resolve => {started = resolve})
 await page.route(pattern, async route => {started(); await gate; await route.continue().catch(() => {})}, {times: 1})
 return {release, seen}
}
for (const width of [1440, 390]) {
 test(`pending Workspace code respects a newer task deep link ${width}`, async ({authenticatedPage: page}) => {
  await seed(); await page.setViewportSize({width, height: 900})
  const held = await hold(page, '**/assets/workspace-*.js')
  const taskRequests: string[] = []; page.on('request', request => {if (/\/api\/v1\/tasks\/\d+$/.test(request.url())) taskRequests.push(request.url())})
  try {
   await page.goto('/tasks/1', {waitUntil: 'domcontentloaded'}); await held.seen
   await expect(page.getByText('Vikunja is loading…', {exact: true})).toBeVisible()
   await page.evaluate(() => {history.pushState({}, '', '/tasks/2'); window.dispatchEvent(new PopStateEvent('popstate'))})
  } finally {held.release()}
  await expect(page.locator('.task-view h1')).toContainText('Lazy task 2')
  await expect(page.locator('.description .ProseMirror')).toContainText('Original rich task description')
  expect(taskRequests.some(url => url.endsWith('/tasks/1'))).toBe(false)
  await expect(page).toHaveURL(/\/tasks\/2$/)
 })
 test(`leaving pending editor code cannot mount a late modal and first use retains dark styling ${width}`, async ({authenticatedPage: page}, info) => {
  await seed(); await page.setViewportSize({width, height: 900}); await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/projects/1/4'); await expect(page.locator('.kanban-card__title-link')).toHaveCount(2)
  const held = await hold(page, '**/assets/editor-*.js')
  try {
   await page.locator('.kanban-card__title-link').first().click(); await held.seen
   await page.goBack(); await expect(page).toHaveURL(/\/projects\/1\/4/)
  } finally {held.release()}
  await expect(page.locator('.kanban-card__title-link')).toHaveCount(2)
  await expect(page.locator('.task-view')).toHaveCount(0)
  await page.locator('.kanban-card__title-link').first().click()
  await expect(page.locator('.description .ProseMirror')).toContainText('Original rich task description')
  await page.locator('.description').getByRole('button', {name: 'Edit', exact: true}).click()
  await page.locator('.description .ProseMirror').press('ControlOrMeta+End')
  await page.locator('.description .ProseMirror').pressSequentially(' draft')
  await page.locator('.description .ProseMirror').press('Escape')
  await expect(page.locator('.description .ProseMirror')).toHaveText('Original rich task description')
  await expect(page.locator('.modal-container')).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.locator('.modal-container').evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgb(255, 255, 255)')
  await info.attach(`first-editor-${width}`, {body: await page.screenshot(), contentType: 'image/png'})
  await page.emulateMedia({media: 'print'})
  await info.attach(`editor-print-${width}`, {body: await page.screenshot(), contentType: 'image/png'})
 })
 test(`interrupted first Kanban module cannot publish over restored list ${width}`, async ({authenticatedPage: page}) => {
  await seed(); await page.setViewportSize({width, height: 900})
  await page.goto('/projects/1/1'); await expect(page.locator('.tasks .task-link')).toHaveCount(2)
  const held = await hold(page, '**/assets/project-kanban-*.js')
  try {
   if (width === 390) {
    await page.locator('.switch-view-dropdown-trigger').click()
    await page.locator('.switch-view-dropdown .dropdown-menu a[href="/projects/1/4"]').click()
   } else await page.locator('.switch-view a[href="/projects/1/4"]').click()
   await held.seen
   await page.goBack(); await expect(page).toHaveURL(/\/projects\/1\/1/)
  } finally {held.release()}
  await expect(page.locator('.tasks .task-link')).toHaveCount(2)
  await expect(page.locator('.kanban')).toHaveCount(0)
 })
}
