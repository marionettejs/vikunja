import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
async function openModal(page: import('@playwright/test').Page, id: number) { await page.evaluate(id => { const backdrop = location.pathname + location.search; history.pushState({...history.state, backdropView: backdrop, modal: true}, '', `/tasks/${id}`); window.dispatchEvent(new PopStateEvent('popstate', {state: history.state})) }, id) }
test.beforeEach(async () => { await ProjectFactory.create(1, {title: 'Route ownership'}); await createDefaultViews(1); await TaskFactory.create(70, {title: id => `Task ${String(id).padStart(3, '0')}`, description: '<p>Original description</p>'}); await Factory.seed('task_positions', Array.from({length: 70}, (_, i) => ({task_id: i + 1, project_view_id: 1, position: (i + 1) * 65536}))) })
test('seeded project modal close and browser back retain query, entry draft, DOM and scroll', async ({authenticatedPage: page}, info) => {
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.goto('/projects/1/1?sort=title:asc&page=2'); const link = page.getByRole('link', {name: 'Task 061', exact: true}); await expect(link).toBeVisible(); const entry = page.getByPlaceholder('Add a task…'); await entry.fill('Retain draft'); const original = await entry.elementHandle(); await page.evaluate(() => window.scrollTo(0, 250)); const scroll = await page.evaluate(() => window.scrollY); await info.attach('scroll-before-open', {body:JSON.stringify(await page.evaluate(() => ({x:scrollX,y:scrollY,rect:document.querySelector('.task-link')?.getBoundingClientRect().toJSON()}))),contentType:'application/json'}); await openModal(page, 61); await info.attach('scroll-after-open', {body:String(await page.evaluate(() => scrollY)),contentType:'text/plain'}); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.locator('.task-view h1')).toHaveText('Task 061'); await page.screenshot({path:info.outputPath('list-task-modal.png'), animations:'disabled'}); await page.getByRole('button', {name:'Close dialog', exact:true}).last().click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page).toHaveURL(/\/projects\/1\/1\?sort=title:asc&page=2$/); await expect(entry).toHaveValue('Retain draft'); expect(await entry.evaluate((node, previous) => node === previous, original)).toBe(true); await info.attach('scroll-after-close', {body:String(await page.evaluate(() => scrollY)),contentType:'text/plain'}); expect(await page.evaluate(() => window.scrollY)).toBe(scroll); await openModal(page, 61); await expect(page.getByRole('dialog')).toBeVisible(); await page.goBack(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(entry).toHaveValue('Retain draft'); expect(errors).toEqual([])
})
test('direct task description saves exact HTML and survives reload', async ({authenticatedPage: page}, info) => {
 await page.goto('/tasks/1'); await expect(page.getByRole('dialog')).toHaveCount(0); const surface = page.locator('.tiptap__task-description'), editor = surface.locator('.ProseMirror'); await expect(editor).toHaveText('Original description'); await surface.getByRole('button', {name:'Edit', exact:true}).click(); await editor.press('ControlOrMeta+End'); await editor.pressSequentially(' native draft'); const saved = page.waitForResponse(response => /\/api\/v1\/tasks\/1$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST'); await surface.getByRole('button', {name:'Save', exact:true}).click(); const response = await saved; expect(response.ok()).toBe(true); expect(response.request().postDataJSON().description).toBe('<p>Original description native draft</p>'); await expect(surface.getByRole('button', {name:'Edit', exact:true})).toBeVisible(); await page.screenshot({path:info.outputPath('direct-task.png'), animations:'disabled'}); await page.reload(); await expect(editor).toHaveText('Original description native draft')
})
test('superseded task readiness cannot publish into the next task destination', async ({authenticatedPage: page}) => {
 let release!: () => void; const gate = new Promise<void>(resolve => {release=resolve}); await page.route('**/api/v1/tasks/1?**', async route => { await gate; await route.continue().catch(() => {}) }); await page.goto('/projects/1/1'); await openModal(page, 1); await page.goBack(); await openModal(page, 2); await expect(page.locator('.task-view h1')).toHaveText('Task 002'); release(); await expect(page.locator('.task-view h1')).toHaveText('Task 002'); await page.getByRole('button', {name:'Close dialog',exact:true}).last().click(); await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('logout in another tab tears down a protected task destination and pending request', async ({authenticatedPage: page}) => {
 let release!: () => void; const gate = new Promise<void>(resolve => {release=resolve}); await page.route('**/api/v1/tasks/1?**', async route => { await gate; await route.continue().catch(() => {}) }); await page.goto('/projects/1/1'); await openModal(page, 1); const second = await page.context().newPage(); await second.goto('/projects/1/1'); await expect(second.getByRole('link',{name:'Task 002',exact:true})).toBeVisible(); await second.evaluate(() => localStorage.removeItem('token')); await expect(page).toHaveURL(/\/login$/); release(); await expect(page.locator('.task-view')).toHaveCount(0); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button',{name:'Login',exact:true})).toBeVisible(); await second.close()
})

test('changing project while a modal task prepares cancels the project-owned task lifetime', async ({authenticatedPage: page}) => {
 await ProjectFactory.create(1, {id:2,title:'Next project'}, false); await createDefaultViews(2,5)
 let seen!:()=>void;const pending=new Promise<void>(resolve=>{seen=resolve});
 let release!: () => void; const gate = new Promise<void>(resolve => {release=resolve}); await page.route('**/api/v1/tasks/1?**', async route => { seen();await gate; await route.continue().catch(() => {}) })
 await page.goto('/projects/1/1'); await expect(page.getByRole('link',{name:'Task 002',exact:true})).toBeVisible(); await openModal(page,1);await pending
 await page.evaluate(() => {history.pushState({},'', '/projects/2/5');window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}))})
 await expect(page.getByPlaceholder('Add a task…')).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0); release(); await expect(page).toHaveURL(/\/projects\/2\/5$/); await expect(page.locator('.task-view')).toHaveCount(0)
})


test('failed project modal can retry the same URL without losing the project', async ({authenticatedPage: page}) => {
	let fail = true
	await page.route('**/api/v1/tasks/1?**', route => fail
		? route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture modal failure'})})
		: route.continue())
	await page.goto('/projects/1/1')
	await expect(page.getByRole('link', {name: 'Task 002', exact: true})).toBeVisible()
	await openModal(page, 1)
	await expect(page.locator('.vue-notification.error')).toContainText('Fixture modal failure')
	fail = false
	await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate', {state: history.state})))
	await expect(page.locator('.task-view h1')).toHaveText('Task 001')
	await page.getByRole('button', {name: 'Close dialog', exact: true}).last().click()
	await expect(page.getByPlaceholder('Add a task…')).toBeVisible()
})

test('superseded modal failure cannot clear the newer task key', async ({authenticatedPage: page}) => {
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	let seen!: () => void
	const requested = new Promise<void>(resolve => { seen = resolve })
	await page.route('**/api/v1/tasks/1?**', async route => {
		seen()
		await gate
		await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Obsolete modal failure'})}).catch(() => {})
	})
	await page.goto('/projects/1/1')
	await expect(page.getByRole('link', {name: 'Task 002', exact: true})).toBeVisible()
	await openModal(page, 1)
	await requested
	await openModal(page, 2)
	await expect(page.locator('.task-view h1')).toHaveText('Task 002')
	release()
	await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate', {state: history.state})))
	await expect(page.locator('.task-view h1')).toHaveText('Task 002')
	await expect(page.locator('.vue-notification.error')).toHaveCount(0)
})

test('a late project catalog updates the task breadcrumb without replacing its title draft', async ({authenticatedPage: page}) => {
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	await page.route('**/api/v1/projects?**', async route => { await gate; await route.continue() })
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText('Task 001')
	await title.click()
	await title.fill('Retained title draft')
	const original = await title.elementHandle()
	release()
	await expect(page.getByRole('navigation', {name: 'Breadcrumb'}).getByRole('link', {name: 'Route ownership', exact: true})).toBeVisible()
	await expect(title).toHaveText('Retained title draft')
	await expect(title).toBeFocused()
	expect(await title.evaluate((node, prior) => node === prior, original)).toBe(true)
})
