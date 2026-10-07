import {test, expect} from './fixtures'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {publishedBuild, repositoryRoot} from './published-baseline'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import type {Page} from '@playwright/test'

async function styles(page: Page, selectors: string[]) {
 await page.evaluate(() => document.fonts.ready)
 await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
 await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))))
 return page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
  const element = document.querySelector(selector)
  if (!element) throw new Error('Missing style target: ' + selector)
  const style = getComputedStyle(element), box = element.getBoundingClientRect()
  return [selector, {color: style.color, background: style.backgroundColor, font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, padding: style.padding, margin: style.margin, border: style.border, display: style.display, width: Math.round(box.width * 100) / 100, height: Math.round(box.height * 100) / 100}]
 })), selectors)
}
async function selectView(page: Page, id: number) {
 const trigger = page.locator('.switch-view-dropdown-trigger')
 if (await trigger.isVisible()) {
  await trigger.click(); await page.locator(`.switch-view-dropdown .dropdown-menu a[href="/projects/1/${id}"]`).click()
 } else await page.locator(`.switch-view a[href="/projects/1/${id}"]`).click()
}
for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark'] as const) test(`published versus lazy first-use styles ${width} ${colorScheme}`, async ({browser, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Style project', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
 await createDefaultViews(1)
 await TaskFactory.create(2, {title: id => `Style task ${id}`, project_id: 1, description: '<p>Original rich description</p>', start_date: '2026-10-08T00:00:00Z', end_date: '2026-10-10T23:59:59Z', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
 await BucketFactory.create(1, {project_view_id: 4, title: 'Backlog'})
 await TaskBucketFactory.create(2, {task_id: id => id, bucket_id: 1, project_view_id: 4})
 const preview = spawn(process.execPath, [resolve(repositoryRoot, 'frontend/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4470', '--strictPort', '--outDir', publishedBuild(), '--mode', 'production'], {cwd: resolve(repositoryRoot, 'frontend'), stdio: ['ignore', 'pipe', 'pipe']})
 preview.stderr.on('data', data => process.stderr.write('BASELINE_PREVIEW: ' + data))
 const apps = [{name: 'published', base: 'http://127.0.0.1:4470'}, {name: 'lazy', base: process.env.BASE_URL!}]
 const evidence: Record<string, Record<string, unknown>> = {}
 const failures: Error[] = []
 try {
  for (let attempt = 0; attempt < 100; attempt++) {try {if ((await fetch(apps[0].base)).ok) break} catch {} if (attempt === 99) throw new Error('Published production preview did not become ready'); await new Promise(done => setTimeout(done, 100))}
  for (const app of apps) {
   const context = await browser.newContext({baseURL: app.base, viewport: {width, height: 900}, colorScheme, locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block'})
   try {
    const login = await context.request.post(process.env.API_URL!.replace('/api/v1/', '/api/v2/') + 'login', {data: {username: currentUser.username, password: TEST_PASSWORD}})
    expect(login.ok()).toBe(true)
    const {token} = await login.json()
    await context.addInitScript(({token, api}) => {localStorage.setItem('token', token); localStorage.setItem('API_URL', api); Object.assign(window, {API_URL: api})}, {token, api: process.env.API_URL!})
    let page = await context.newPage()
    const measured: Record<string, unknown> = evidence[app.name] = {}
    async function capture(name: string, selectors: string[]) {
     measured[name] = await styles(page, selectors)
     await info.attach(`${app.name}-${name}-${width}-${colorScheme}`, {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
    }
    await page.goto('/projects/1/1'); await expect(page.locator('.tasks .task-link')).toHaveCount(2)
    await capture('list', ['.task-link', '.switch-view-container', '.project-title-print', '.filter-container'])
    await selectView(page, 3); await expect(page.locator('.native-table-body table')).toBeVisible()
    await capture('table', ['.native-table-body', '.native-table-body table', '.native-table-body th'])
    await selectView(page, 2); await expect(page.getByRole('slider', {name: 'Task: Style task 1', exact: true})).toBeVisible()
    await capture('gantt', ['.gantt-container', '.gantt-bar'])
    await selectView(page, 4); await expect(page.locator('.kanban .task')).toHaveCount(2)
    await capture('kanban', ['.kanban', '.bucket', '.kanban .task'])
    await page.locator('.kanban-card__title-link').first().click(); await expect(page.locator('.description .ProseMirror')).toContainText('Original rich description')
    await expect(page.locator('dialog.native-task-dialog')).toBeVisible()
    await capture('task-modal', ['dialog.native-task-dialog', '.modal-content', '.task-view h1', '.description .ProseMirror', '.editor-toolbar'])
    await page.emulateMedia({media: 'print'})
    await capture('print', ['.task-view h1', '.description .ProseMirror'])
    await page.emulateMedia({media: 'screen'})
    await page.goto('/user/settings/general'); await expect(page.locator('.native-settings .general-settings').first()).toBeVisible()
    await page.locator('.native-settings input[data-setting="name"]').fill('Visible style draft')
    await capture('settings', ['.native-settings', '.native-settings input[data-setting="name"]', '.native-settings button[type="submit"]'])
    await page.goto('/projects/1/settings/webhooks')
    await expect(page.locator('.native-webhook-editor input').first()).toBeAttached()
    await info.attach(app.name + '-webhook-geometry', {body: JSON.stringify(await page.evaluate(() => ({scroll: [scrollX, scrollY], elements: [...new Set([...document.querySelectorAll('dialog, .modal-container, .modal-content, .native-webhook-editor input')].flatMap(element => {const ancestors: Element[] = []; for (let parent: Element | null = element; parent; parent=parent.parentElement) ancestors.push(parent); return ancestors}))].map(element => {const box=element.getBoundingClientRect(), style=getComputedStyle(element); return {tag: element.tagName, id: element.id, cls: element.className, box: box.toJSON(), display: style.display, visibility: style.visibility, opacity: style.opacity, overflow: style.overflow, transform: style.transform, contentVisibility: style.contentVisibility}})})), null, 2), contentType: 'application/json'})
    // Soft assertions still fail the case; collect both builds and later surfaces after the baseline defect.
    await expect.soft(page.getByRole('textbox', {name: 'Target URL', exact: true})).toBeVisible()
    await expect.soft(page.getByRole('button', {name: 'Create webhook', exact: true})).toHaveCount(1)
    await capture('project-webhook', ['.native-project-dialog', '.native-webhook-editor', '.native-webhook-editor input', '.native-webhook-editor button[data-save]'])
    await page.goto('/projects/1/settings/duplicate')
    await expect(page.getByRole('button', {name: 'Duplicate', exact: true}).last()).toBeVisible()
    await expect(page.locator('.native-settings-search .search-results')).toHaveCSS('position', 'absolute')
    await capture('duplicate', ['.native-project-duplicate', '.native-settings-search .search-results', '.native-project-duplicate button[data-submit]'])
    const anonymous = await browser.newContext({baseURL: app.base, viewport: {width, height: 900}, colorScheme, locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block'})
    try {
     await anonymous.addInitScript(api => {localStorage.setItem('API_URL', api); Object.assign(window, {API_URL: api})}, process.env.API_URL!)
     page = await anonymous.newPage()
     await page.goto('/login')
     await expect(page.locator('#loginform')).toBeVisible()
     await capture('login', ['.native-account-entry', '#loginform input', '.native-account-entry button[data-provider]'])
    } finally {await anonymous.close()}
   } catch (error) {failures.push(error as Error)} finally {await context.close()}
  }
  if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('\n'))
  expect(evidence.lazy).toEqual(evidence.published)
 } finally {
  await info.attach('style-values', {body: JSON.stringify(evidence, null, 2), contentType: 'application/json'})
  const stopped = new Promise<void>(done => preview.once('close', () => done())); preview.kill('SIGTERM'); await stopped
 }
})
