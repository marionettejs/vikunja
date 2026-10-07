import {test, expect} from './fixtures'
for (const width of [1440, 769, 390]) {
 test(`token editor initial focus matches viewport policy ${width}`, async ({authenticatedPage: page}) => {
  await page.setViewportSize({width, height: 900})
  await page.goto('/user/settings/api-tokens')
  if (width === 390) {
   const banner=page.locator('.add-to-home-screen'); await expect(banner).toBeVisible()
   await banner.getByRole('button',{name:'Close banner',exact:true}).click()
  }
  await page.getByRole('button', {name: 'Create a token', exact: true}).click()
  const title = page.getByRole('textbox', {name: 'Title', exact: true})
  await expect(title).toBeVisible()
  if (width > 769) await expect(title).toBeFocused()
  else await expect(title).not.toBeFocused()
  await title.focus(); await page.keyboard.type('Keyboard token draft')
  await expect(title).toHaveValue('Keyboard token draft'); await expect(title).toBeFocused()
 })
 test(`export rejection loading and documented keyboard retry focus ${width}`, async ({authenticatedPage: page}) => {
  await page.setViewportSize({width, height: 900})
  await page.goto('/user/settings/data-export')
  const password = page.getByRole('textbox', {name: 'Current password', exact: true})
  const submit = page.getByRole('button', {name: 'Request a copy of my Vikunja Data', exact: true})
  await password.fill('incorrect')
  let release!: () => void
  const gate = new Promise<void>(resolve => {release = resolve})
  await page.route('**/api/v1/user/export/request', async route => {await gate; await route.continue()})
  await submit.focus(); await page.keyboard.press('Enter')
  await expect(submit).toBeDisabled()
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  const response = page.waitForResponse(r => r.url().endsWith('/user/export/request'))
  release(); expect((await response).status()).toBe(403)
  await expect(submit).toBeEnabled(); await expect(password).toHaveValue('incorrect')
  if (process.env.VIKUNJA_REFERENCE_VUE === '1') expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  else await expect(submit).toBeFocused()
  await password.focus(); await page.keyboard.press('Control+a'); await page.keyboard.type('later draft')
  await expect(password).toBeFocused(); await expect(password).toHaveValue('later draft')
 })
}
