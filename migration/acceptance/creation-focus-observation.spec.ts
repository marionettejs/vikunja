import {test, expect} from './fixtures'
for (const [path, link, id] of [['/teams', 'Create a team', 'teamName'], ['/labels', 'New label', 'labelTitle']])
 test(`observe initial creation focus ${path}`, async ({authenticatedPage: page}, info) => {
  await page.goto(path); const entry = page.getByRole('link', {name: link, exact: true}).first(); await expect(entry).toBeVisible()
  const banner = page.locator('.add-to-home-screen'); if (await banner.isVisible()) await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
  await entry.click(); await expect(page.locator(`#${id}`)).toBeVisible(); await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const state = await page.evaluate(() => {
   const active = document.activeElement as HTMLElement, dialog = document.querySelector('dialog')!
   const describe = (el: HTMLElement) => ({tag: el.tagName, id: el.id, name: el.getAttribute('aria-label') || el.textContent?.trim(), classes: el.className, focused: el === active, visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0})
   return {active: describe(active), contained: dialog.contains(active), controls: Array.from(dialog.querySelectorAll<HTMLElement>('button,input'), describe)}
  })
  await info.attach('creation-focus', {body: JSON.stringify({path, viewport: page.viewportSize(), state}, null, 2), contentType: 'application/json'})
  await info.attach('creation-dialog', {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
  expect(state.contained).toBe(true)
  await expect(page.getByRole('button', {name: page.viewportSize()!.width > 768 ? 'Close dialog' : 'Close', exact: true})).toBeFocused()
 })
