import {test, expect} from './fixtures'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {readFile, writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'

test.describe('actual production Workbox', () => {
 test.use({serviceWorkers: 'allow'})
 test('first claim retains login draft and actual generated worker update reloads once after acceptance', async ({page}, info) => {
  const path = resolve(import.meta.dirname, '../../frontend/dist-dev/sw.js'), original = await readFile(path, 'utf8')
  let navigations = 0
  let registrationEvidence: unknown
  const responses: {path: string, status: number}[] = []
  page.context().on('response', response => {const url = new URL(response.url()); if (/workbox|sw\.js/.test(url.pathname)) responses.push({path: url.pathname, status: response.status()})})
  try {
   await setupApiUrl(page); await page.goto('/login'); const username = page.locator('#username'); await username.fill('Retained production draft')
   page.on('request', request => {if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++})
   await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {timeout: 20000}).toBe(true)
   await expect(username).toHaveValue('Retained production draft'); expect(navigations).toBe(0)
   registrationEvidence = await page.evaluate(async () => {const registration = await navigator.serviceWorker.getRegistration();return {scriptURL:registration?.active?.scriptURL,state:registration?.active?.state,controller:navigator.serviceWorker.controller?.scriptURL}})
   await writeFile(path, original + '\n/* Isolated production update probe; same actual Workbox code. */\n')
   await page.evaluate(async () => {const registration = await navigator.serviceWorker.getRegistration(); await registration!.update()})
   await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state), {timeout: 20000}).toBe('installed')
   const update = page.getByRole('button', {name: 'Update Now', exact: true}); await expect(update).toBeVisible()
   await expect(username).toHaveValue('Retained production draft'); expect(navigations).toBe(0)
   await update.click(); await expect(username).toHaveValue(''); await expect.poll(() => navigations).toBe(1)
   await expect(update).toHaveCount(0)
  } finally {
   await writeFile(path, original)
   await info.attach('actual-worker-network', {body: JSON.stringify({responses, navigations, registrationEvidence}), contentType: 'application/json'})
   await page.evaluate(async () => {for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()}).catch(() => {})
  }
 })
 test('controlled offline reload preserves the pinned offline presentation', async ({page}, info) => {
  try {
   await setupApiUrl(page); await page.goto('/login'); await expect(page.locator('#username')).toBeVisible()
   await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {timeout: 20000}).toBe(true)
   await page.context().setOffline(true); await page.reload({waitUntil: 'domcontentloaded'})
   await page.screenshot({path: info.outputPath('production-offline.png'), animations: 'disabled'})
   await expect(page.getByRole('heading', {name: 'You are offline.', exact: true})).toBeVisible()
   await expect(page.getByText('Please check your network connection and try again.', {exact: true})).toBeVisible()
  } finally {await page.context().setOffline(false); await page.evaluate(async () => {for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()}).catch(() => {})}
 })
 test('controlled cached root load preserves the pinned offline presentation', async ({page}, info) => {
  try {
   await setupApiUrl(page); await page.goto('/login'); await expect(page.locator('#username')).toBeVisible()
   await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {timeout: 20000}).toBe(true)
   await page.context().setOffline(true); await page.goto('/', {waitUntil: 'domcontentloaded'})
   await page.screenshot({path: info.outputPath('production-offline-root.png'), animations: 'disabled'})
   await expect(page.getByRole('heading', {name: 'You are offline.', exact: true})).toBeVisible()
   await expect(page.getByText('Please check your network connection and try again.', {exact: true})).toBeVisible()
  } finally {await page.context().setOffline(false); await page.evaluate(async () => {for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()}).catch(() => {})}
 })

})

test('real same-origin tabs coordinate cookie refresh and propagate public logout', async ({browser, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Cross-tab project'}); await createDefaultViews(1); await TaskFactory.create(1, {title: 'Cross-tab task'})
 const context = await browser.newContext({baseURL: process.env.BASE_URL!, viewport: {width: 1440, height: 900}, serviceWorkers: 'block'})
 const api = process.env.API_URL!, refreshes: number[] = []
 await context.addInitScript(api => {localStorage.setItem('API_URL', api); Object.assign(window, {API_URL: api})}, api)
 context.on('response', response => {if (response.url().includes('/user/token/refresh')) refreshes.push(response.status())})
 const first = await context.newPage(), second = await context.newPage()
 try {
  await first.goto('/login'); await first.locator('#username').fill(currentUser.username); await first.locator('#password').fill(TEST_PASSWORD); await first.getByRole('button', {name: 'Login', exact: true}).click(); await expect(first.locator('#loginform')).toHaveCount(0)
  await first.goto('/projects/1/1'); await expect(first.locator('.tasks')).toContainText('Cross-tab task')
  await second.goto('/projects/1/1'); await expect(second.locator('.tasks')).toContainText('Cross-tab task')
  const before = refreshes.length, faulted = new Set<unknown>()
  let release!: () => void, both!: () => void
  const gate = new Promise<void>(done => {release = done}), seen = new Promise<void>(done => {both = done})
  await context.route('**/api/v1/user', async route => {
   const owner = route.request().frame().page()
   if (route.request().method() !== 'GET' || faulted.has(owner)) return route.continue()
   faulted.add(owner); if (faulted.size === 2) both(); await gate
   await route.fulfill({status: 401, contentType: 'application/json', body: JSON.stringify({code: 11, message: 'Isolated expired-token fault'})})
  })
  const reloading = Promise.all([first.reload({waitUntil: 'domcontentloaded'}), second.reload({waitUntil: 'domcontentloaded'})])
  try {await seen} finally {release()}
  await reloading
  await expect(first.locator('.tasks')).toContainText('Cross-tab task'); await expect(second.locator('.tasks')).toContainText('Cross-tab task')
  expect(refreshes.slice(before)).toEqual([200])
  const tokensMatch = await first.evaluate(() => localStorage.getItem('token')) === await second.evaluate(() => localStorage.getItem('token'))
  expect(tokensMatch).toBe(true)
  await first.getByRole('button', {name: currentUser.username, exact: true}).click(); await first.getByText('Logout', {exact: true}).click()
  await expect(first.locator('#loginform')).toBeVisible(); await expect(second.locator('#loginform')).toBeVisible()
  await expect(second.locator('.tasks')).toHaveCount(0)
 } finally {await info.attach('cross-tab-summary', {body: JSON.stringify({refreshes}), contentType: 'application/json'}); await context.close()}
})

test('accepted filter fault covers whichever project refresh transport each app uses without duplicate create', async ({authenticatedPage: page}, info) => {
 let acceptedId = 0, failed = false
 const writes: {method: string, path: string, status: number}[] = [], refresh: {path: string, rejected: boolean}[] = []
 try {
  await page.goto('/filters/new'); await page.getByRole('textbox', {name: 'Title', exact: true}).fill('Transport refresh filter'); await page.getByRole('textbox', {name: 'Filter query', exact: true}).fill('priority >= 3')
  await page.route('**/api/v1/filters**', async route => {
   const request = route.request(), method = request.method()
   if (!['PUT','POST'].includes(method)) return route.continue()
   const response = await route.fetch(), data = await response.json(); writes.push({method, path: new URL(request.url()).pathname, status: response.status()})
   if (method === 'PUT' && response.ok()) acceptedId = data.id
   await route.fulfill({response})
  })
  await page.route('**/api/v1/projects**', async route => {
   const request = route.request(), path = new URL(request.url()).pathname
   if (request.method() !== 'GET' || !acceptedId || !/^\/api\/v1\/projects(?:\/-\d+)?$/.test(path)) return route.continue()
   const rejected = !failed; refresh.push({path, rejected})
   if (rejected) {failed = true; await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({message: 'Fixture common refresh unavailable'})})} else await route.continue()
  })
  const create = page.getByRole('button', {name: 'Create saved filter', exact: true})
  await create.click(); await expect(page.getByRole('alert')).toContainText('Fixture common refresh unavailable')
  await expect(page.getByRole('textbox', {name: 'Title', exact: true})).toHaveValue('Transport refresh filter')
  await create.click(); await expect(page).toHaveURL(new RegExp(`/projects/${-acceptedId-1}(?:/\\d+)?$`))
  expect(writes.filter(x => x.method === 'PUT')).toHaveLength(1)
 } finally {await info.attach('refresh-transports', {body: JSON.stringify({acceptedId, failed, writes, refresh}), contentType: 'application/json'})}
})

test('public cookie logout clears both protected tabs independently of refresh count', async ({browser,currentUser}) => {
 await ProjectFactory.create(1,{title:'Logout contract'});await createDefaultViews(1);await TaskFactory.create(1,{title:'Logout task'})
 const context=await browser.newContext({baseURL:process.env.BASE_URL!,viewport:{width:1440,height:900},serviceWorkers:'block'})
 await context.addInitScript(api=>{localStorage.setItem('API_URL',api);Object.assign(window,{API_URL:api})},process.env.API_URL!)
 const first=await context.newPage(),second=await context.newPage()
 try{
  await first.goto('/login');await first.locator('#username').fill(currentUser.username);await first.locator('#password').fill(TEST_PASSWORD);await first.getByRole('button',{name:'Login',exact:true}).click();await expect(first.locator('#loginform')).toHaveCount(0)
  await first.goto('/tasks/1');await expect(first.locator('.task-view h1')).toContainText('Logout task');await second.goto('/tasks/1');await expect(second.locator('.task-view h1')).toContainText('Logout task')
  await first.getByRole('button',{name:currentUser.username,exact:true}).click();await first.getByText('Logout',{exact:true}).click();await expect(first.locator('#loginform')).toBeVisible();await expect(second.locator('#loginform')).toBeVisible();await expect(first.locator('.task-view')).toHaveCount(0);await expect(second.locator('.task-view')).toHaveCount(0)
 }finally{await context.close()}
})


test('late expired responses across repeated tab navigation reuse the completed refresh', async ({browser, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Refresh ownership project'}); await createDefaultViews(1); await TaskFactory.create(1, {title: 'Refresh ownership task'})
 const context = await browser.newContext({baseURL: process.env.BASE_URL!, serviceWorkers: 'block'})
 await context.addInitScript(api => {localStorage.setItem('API_URL', api); Object.assign(window, {API_URL: api})}, process.env.API_URL!)
 const first = await context.newPage(), second = await context.newPage(), refreshes: number[] = []
 context.on('response', response => {if (response.url().includes('/user/token/refresh')) refreshes.push(response.status())})
 try {
  await first.goto('/login'); await first.locator('#username').fill(currentUser.username); await first.locator('#password').fill(TEST_PASSWORD); await first.getByRole('button', {name: 'Login', exact: true}).click(); await expect(first.locator('#loginform')).toHaveCount(0)
  await first.goto('/projects/1/1'); await second.goto('/projects/1/1')
  for (let round = 0; round < 2; round++) {
   await expect(first.locator('.tasks')).toContainText('Refresh ownership task'); await expect(second.locator('.tasks')).toContainText('Refresh ownership task')
   const before = refreshes.length, faulted = new Set<unknown>()
   let release!: () => void, observed!: () => void
   const gate = new Promise<void>(done => {release = done}), seen = new Promise<void>(done => {observed = done})
   await context.route('**/api/v1/user', async route => {
    const owner = route.request().frame().page()
    if (route.request().method() !== 'GET' || faulted.has(owner)) return route.continue()
    faulted.add(owner)
    if (owner === second) {observed(); await gate}
    await route.fulfill({status: 401, json: {code: 11, message: 'Isolated late expired-token fault'}})
   })
   const firstReady = first.reload({waitUntil: 'domcontentloaded'}), secondReady = second.reload({waitUntil: 'domcontentloaded'})
   try {
    await seen; await firstReady; await expect(first.locator('.tasks')).toContainText('Refresh ownership task')
    expect(refreshes.slice(before)).toEqual([200])
   } finally {release()}
   await secondReady; await expect(second.locator('.tasks')).toContainText('Refresh ownership task')
   expect(refreshes.slice(before)).toEqual([200])
   expect(await first.evaluate(() => localStorage.getItem('token'))).toBe(await second.evaluate(() => localStorage.getItem('token')))
   await context.unroute('**/api/v1/user')
  }
 } finally {await info.attach('late-refresh-summary', {body: JSON.stringify({refreshes}), contentType: 'application/json'}); await context.close()}
})
