import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

const users = page => page.getByRole('heading', {name: 'Shared with these users', exact: true}).locator('..')
async function open(page) {
 await page.goto('/projects/1/1')
 await expect(page.locator('.list-view')).toBeVisible()
 await page.locator('.project-title-wrapper').getByRole('button', {name: 'Open project settings menu', exact: true}).click()
 await page.getByRole('link', {name: 'Share', exact: true}).click()
 await expect(page.getByText('Share this project', {exact: true})).toBeVisible()
}
async function capture(page, info, name) {
 await page.evaluate(() => document.fonts.ready)
 await info.attach(name, {body: await page.screenshot({fullPage: true, animations: 'disabled'}), contentType: 'image/png'})
 await info.attach(name + '-controls', {body: JSON.stringify(await page.locator('dialog[open] input, dialog[open] button, dialog[open] td, dialog[open] .user, dialog[open] .avatar').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().width).map(el => {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el)
  return {tag: el.tagName, text: el.getAttribute('aria-label') || el.textContent?.trim(), classes: el.className, rect: {x:r.x,y:r.y,width:r.width,height:r.height}, font:s.font, color:s.color}
 })), null, 2), contentType: 'application/json'})
}
test.beforeEach(async ({authenticatedPage: page}) => {
 void page
 await ProjectFactory.create(1, {title: 'Paired sharing variants'})
 await createDefaultViews(1)
 await UserFactory.create(2, {id: id => id + 1, username: id => `paired-collaborator-${id + 1}`, name: id => `Paired Collaborator ${id + 1}`}, false)
 await UserProjectFactory.create(0)
})
test('delayed user search spinner avatar keyboard choice and actual share persist', async ({authenticatedPage: page, apiContext}, info) => {
 await open(page)
 const section = users(page), input = section.getByRole('combobox')
 let release!: () => void, ready!: () => void
 const gate = new Promise<void>(done => {release = done}), started = new Promise<void>(done => {ready = done})
 await page.route('**/api/v1/users?**', async route => {
  if (new URL(route.request().url()).searchParams.get('s') !== 'paired-collaborator-2') return route.continue()
  const response = await route.fetch(); ready(); await gate; await route.fulfill({response}).catch(() => {})
 })
 try {
  await input.fill('paired-collaborator-2'); await input.press('ArrowLeft'); await started
  await expect.soft(section.locator('.control.is-loading').first()).toBeVisible()
  await expect(input).toBeFocused()
  await capture(page, info, 'user-search-loading')
 } finally {release?.()}
 const option = section.getByRole('option').filter({hasText:'Paired Collaborator 2'}).first()
 await expect(option).toBeVisible()
 await expect.soft(option.locator('.user .avatar')).toBeVisible()
 if (await option.locator('img.avatar').count()) await expect.poll(() => option.locator('img.avatar').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
 await capture(page, info, 'user-search-results')
 await input.press('ArrowDown'); await page.keyboard.press('Enter')
 await expect.soft(input).toHaveValue('paired-collaborator-2')
 await expect(section.getByRole('option')).toHaveCount(0)
 await section.getByRole('button', {name:'Share',exact:true}).click()
 await expect(section.locator('tbody')).toContainText('Paired Collaborator 2')
 const token = await page.evaluate(() => localStorage.getItem('token'))
 const response = await apiContext.get('projects/1/users', {headers:{Authorization:`Bearer ${token}`}})
 expect(response.ok()).toBe(true); expect((await response.json()).map(row => row.username)).toEqual(['paired-collaborator-2'])
 await page.getByRole('dialog').first().getByRole('button', {name:'Cancel',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.reload(); await open(page)
 await expect(users(page).locator('tbody')).toContainText('Paired Collaborator 2')
})
test('populated permission table nested removal cancel restores focus and live project', async ({authenticatedPage:page, apiContext}, info) => {
 await UserProjectFactory.create(1, {project_id:1,user_id:2,permission:1})
 await open(page)
 const section = users(page), row = section.locator('tbody tr').filter({hasText:'Paired Collaborator 2'})
 await expect(row).toBeVisible()
 await expect(row.getByLabel('Permission for Paired Collaborator 2')).toHaveValue('1')
 await expect(row.locator('svg[data-icon=pen]')).toBeVisible()
 await capture(page, info, 'populated-sharing')
 const remove = row.getByRole('button', {name:'Remove this user',exact:true})
 await remove.click()
 const confirm = page.getByRole('dialog').last()
 await expect(confirm).toContainText('Remove a user from the List')
 await capture(page, info, 'nested-removal')
 await confirm.getByRole('button', {name:'Cancel',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(1)
 await expect.soft(remove).toBeFocused()
 const token = await page.evaluate(() => localStorage.getItem('token'))
 expect((await (await apiContext.get('projects/1/users', {headers:{Authorization:`Bearer ${token}`}})).json())).toHaveLength(1)
 await page.keyboard.press('Escape')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.locator('.list-view')).toBeVisible()
 await expect.soft(page.locator('.project-title-wrapper').getByRole('button', {name:'Open project settings menu',exact:true})).toBeFocused()
})
