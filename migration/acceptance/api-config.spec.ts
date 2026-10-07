import {test, expect} from './fixtures'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
const api = process.env.API_URL || 'http://127.0.0.1:3456/api/v1'
const apiBase = api.replace(/\/$/, '')
async function prepare(page: import('@playwright/test').Page) {
 await page.addInitScript(api => {if (!localStorage.getItem('API_URL')) localStorage.setItem('API_URL', api); window.API_URL = localStorage.getItem('API_URL')!}, api)
 await page.goto('/login'); await expect(page.locator('#username')).toBeVisible()
}
async function edit(page: import('@playwright/test').Page) {await page.locator('.api-config').getByRole('button', {name: 'change', exact: true}).click(); if ((page.viewportSize()?.width ?? 0) > 769) await expect(page.locator('#api-url')).toBeFocused(); else await expect(page.locator('#api-url')).not.toBeFocused()}
async function proxy(page: import('@playwright/test').Page) {
 await page.route('**/fixture-install/api/**', async route => {
  const path = new URL(route.request().url()).pathname.replace('/fixture-install', '')
  const target = new URL(api); target.pathname = path; target.search = new URL(route.request().url()).search
  const response = await route.fetch({url: target.toString()}); await route.fulfill({response})
 })
}
for (const width of [1440,390]) {
 test(`API installation failure, retry, actual login and reload ${width}`, async ({page,currentUser}, info) => {
  await page.setViewportSize({width,height:900}); await prepare(page)
  const stored = await page.evaluate(()=>localStorage.getItem('API_URL'))
  await expect(page.locator('.api-url-info')).toContainText('Using Vikunja installation at')
  await page.screenshot({path: info.outputPath(`login-api-${width}.png`), animations:'disabled'})
  await page.locator('#username').fill(currentUser.username); await page.locator('#password').fill(TEST_PASSWORD)
  await edit(page); await page.locator('#api-url').fill(''); await expect(page.locator('.api-config').getByRole('button',{name:'change',exact:true})).toBeDisabled()
  await page.route('**/info', route => new URL(route.request().url()).pathname.includes('installation-missing') ? route.fulfill({status:500,json:{message:'Fixture API unreachable'}}) : route.continue())
  await page.locator('#api-url').fill('/installation-missing'); await page.locator('#api-url').press('Enter')
  await expect(page.locator('.api-config [role=alert]')).toContainText('Could not find or use Vikunja installation')
  await expect(page.locator('#api-url')).toHaveValue('/installation-missing'); await expect(page.locator('#username')).toHaveValue(currentUser.username); await expect(page.locator('#password')).toHaveValue(TEST_PASSWORD)
  expect(await page.evaluate(() => localStorage.getItem('API_URL'))).toBe(stored)
  await expect(page.locator('.api-config').getByRole('button',{name:'change',exact:true})).toBeEnabled(); await expect(page.locator('.api-config').getByRole('button',{name:'change',exact:true})).not.toHaveClass(/is-loading/)
  await page.screenshot({path: info.outputPath(`api-error-${width}.png`), animations:'disabled'})
  await proxy(page); await page.locator('#api-url').fill('/fixture-install/api/v1'); await page.locator('.api-config').getByRole('button',{name:'change',exact:true}).click()
  await expect(page.locator('#api-url')).toHaveCount(0); await expect(page.locator('#username')).toHaveValue(currentUser.username); await expect(page.locator('#password')).toHaveValue(TEST_PASSWORD)
  const selected = await page.evaluate(() => localStorage.getItem('API_URL')); expect(new URL(selected!).pathname).toBe('/fixture-install/api/v1')
  const login = page.waitForResponse(r => new URL(r.url()).pathname === '/fixture-install/api/v1/login' && r.request().method()==='POST')
  await page.getByRole('button', {name:'Login',exact:true}).click(); expect((await login).ok()).toBe(true); await expect(page.locator('.navbar')).toBeVisible()
  await page.reload(); await expect(page.locator('.navbar')).toBeVisible(); expect(await page.evaluate(() => window.API_URL)).toBe(selected)
 })
 test(`API pending request cancels on account route replacement ${width}`, async ({page}, info) => {
  await page.setViewportSize({width,height:900}); await prepare(page); await edit(page)
  const active = await page.evaluate(()=>window.API_URL), stored = await page.evaluate(()=>localStorage.getItem('API_URL'))
  let started!:()=>void, release!:()=>void
  const ready = new Promise<void>(r=>{started=r}), gate = new Promise<void>(r=>{release=r})
  await page.route('**/obsolete-install/api/v1/info', async route => {const result = await route.fetch({url:apiBase+'/info'}); started(); await gate; await route.fulfill({response:result}).catch(()=>{})})
  await page.locator('#api-url').fill('/obsolete-install/api/v1'); await page.locator('#api-url').press('Enter'); await ready
  await expect.soft(page.locator('.api-config').getByRole('button',{name:'change',exact:true})).toHaveClass(/is-loading/); await expect.soft(page.getByRole('button',{name:'Login',exact:true})).toBeDisabled()
  await page.screenshot({path:info.outputPath(`api-loading-${width}.png`),animations:'disabled'})
  const settled = Promise.race([page.waitForEvent('requestfinished',r=>new URL(r.url()).pathname==='/obsolete-install/api/v1/info'),page.waitForEvent('requestfailed',r=>new URL(r.url()).pathname==='/obsolete-install/api/v1/info')])
  await page.getByRole('link',{name:'Create account',exact:true}).click(); await expect(page).toHaveURL(/\/register$/)
  release(); await settled; await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))); await expect(page.locator('#registerform')).toBeVisible(); await expect.poll(()=>page.evaluate(()=>localStorage.getItem('API_URL'))).toBe(stored)
  expect(await page.evaluate(()=>window.API_URL)).toBe(active)
 })
}

for (const width of [1440,390]) test(`API configuration updates auth/legal/MOTD while preserving later drafts ${width}`, async ({page,currentUser},info) => {
 await page.setViewportSize({width,height:900}); await prepare(page)
 await page.locator('#username').fill(currentUser.username); await page.locator('#password').fill(TEST_PASSWORD); await edit(page)
 let started!:()=>void,release!:()=>void,finished!:()=>void
 const ready=new Promise<void>(r=>{started=r}),gate=new Promise<void>(r=>{release=r}),done=new Promise<void>(r=>{finished=r})
 await page.route('**/configured-install/api/v1/info',async route=>{const response=await route.fetch({url:apiBase+'/info'}),config=await response.json(); config.motd='Fixture installation message';config.legal={imprint_url:'https://example.test/imprint',privacy_policy_url:'https://example.test/privacy'};config.auth.local.registration_enabled=false;started();await gate;await route.fulfill({json:config});finished()})
 await page.locator('#api-url').fill('/configured-install/api/v1'); await page.locator('#api-url').press('Enter'); await ready
 await page.locator('#api-url').fill('/later-install/api/v1'); release(); await done
 await expect(page.locator('#api-url')).toHaveValue('/later-install/api/v1'); await expect(page.locator('#api-url')).toBeFocused()
 await expect(page.locator('#username')).toHaveValue(currentUser.username); await expect(page.locator('#password')).toHaveValue(TEST_PASSWORD)
 await expect(page.getByRole('link',{name:'Create account',exact:true})).toHaveCount(0); await expect(page.getByRole('link',{name:'Imprint',exact:true})).toHaveAttribute('href','https://example.test/imprint')
 await expect(page.locator('.message:visible')).toContainText('Fixture installation message')
 expect(new URL((await page.evaluate(()=>localStorage.getItem('API_URL')))!).pathname).toBe('/configured-install/api/v1')
 await page.screenshot({path:info.outputPath(`api-configured-draft-${width}.png`),animations:'disabled'})
})

for (const width of [1440,390]) test(`API response preserves credentials focus and caret during later typing ${width}`, async ({page,currentUser},info) => {
 await page.setViewportSize({width,height:900}); await prepare(page); await page.locator('#username').fill(currentUser.username); await page.locator('#password').fill(TEST_PASSWORD); await edit(page)
 let started!:()=>void, release!:()=>void
 const ready=new Promise<void>(r=>{started=r}),gate=new Promise<void>(r=>{release=r})
 await page.route('**/typing-install/api/v1/info',async route=>{const result=await route.fetch({url:apiBase+'/info'});started();await gate;await route.fulfill({response:result})})
 await page.locator('#api-url').fill('/typing-install/api/v1'); await page.locator('#api-url').press('Enter'); await ready
 await page.locator('#username').focus();await page.locator('#username').evaluate((el:HTMLInputElement)=>el.setSelectionRange(3,3));await page.locator('#username').pressSequentially('X')
 release(); await expect(page.locator('#api-url')).toHaveCount(0); await expect(page.locator('#username')).toBeFocused();expect(await page.locator('#username').evaluate((el:HTMLInputElement)=>el.selectionStart)).toBe(4)
 await page.locator('#username').pressSequentially('Y');await expect(page.locator('#username')).toHaveValue(currentUser.username.slice(0,3)+'XY'+currentUser.username.slice(3));await expect(page.locator('#password')).toHaveValue(TEST_PASSWORD)
 await page.screenshot({path:info.outputPath(`api-credential-focus-${width}.png`),animations:'disabled'})
})
