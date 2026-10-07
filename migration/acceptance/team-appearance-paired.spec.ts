import {test, expect} from './fixtures'
import {TeamFactory} from '../../frontend/tests/factories/team'
import {TeamMemberFactory} from '../../frontend/tests/factories/team_member'

test('team edit initial focus member avatar and action appearance', async ({authenticatedPage: page, currentUser}, info) => {
 await TeamFactory.create(1, {id: 1, name: 'Appearance team'})
 await TeamMemberFactory.create(1, {id: 1, team_id: 1, user_id: currentUser.id, admin: true})
 await page.goto('/teams/1/edit')
 const name = page.getByLabel('Team Name', {exact: true}); await expect(name).toHaveValue('Appearance team')
 await page.evaluate(async () => {await document.fonts.ready})
 const banner = page.locator('.add-to-home-screen'); if (await banner.isVisible()) await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
 await expect.soft(page.getByRole('link', {name: 'Project description', exact: true, includeHidden: true})).toBeHidden()
 const add = page.getByRole('button', {name: /^Add to team$/i}).locator('span').last()
 const line = await add.evaluate(el => ({height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight)}))
 expect.soft(line.height).toBeLessThanOrEqual(line.lineHeight + 0.1)
 if (page.viewportSize()!.width > 769) await expect.soft(name).toBeFocused()
 else await expect.soft(name).not.toBeFocused()
 const user = page.locator('table tbody tr').first().locator('td').first().locator('.user')
 await expect.soft(user).toBeVisible()
 const avatar = user.locator('.avatar').first(); await expect.soft(avatar).toBeVisible()
 if (await avatar.count()) {
  await expect.soft(user.locator('img.avatar')).toBeVisible()
  await expect.soft(user.locator('img.avatar')).toHaveJSProperty('complete', true)
  await expect.soft.poll(() => user.locator('img.avatar').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  const rect = await avatar.boundingBox(); expect.soft(rect?.width).toBe(24); expect.soft(rect?.height).toBe(24)
 }
 await info.attach('team-edit', {body: await page.screenshot({fullPage: true, animations: 'disabled'}), contentType: 'image/png'})
 await info.attach('team-controls', {body: JSON.stringify(await page.locator('button, .field.has-addons .control, .field.has-addons .multiselect').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().width).map(el => {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el)
  return {tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent?.trim(), classes: el.className, rect: {x:r.x,y:r.y,width:r.width,height:r.height}, font:s.font, whiteSpace:s.whiteSpace, padding:s.padding, flexShrink:s.flexShrink}
 })), null, 2), contentType: 'application/json'})
})
