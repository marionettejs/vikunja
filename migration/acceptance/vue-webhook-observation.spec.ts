import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark'] as const) test(`project webhook root visibility ${width} ${colorScheme}`, async ({authenticatedPage: page, currentUser}, info) => {
 await page.setViewportSize({width, height: 900}); await page.emulateMedia({colorScheme})
 await ProjectFactory.create(1, {title: 'Webhook investigation', owner_id: currentUser.id, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
 await createDefaultViews(1)
 await TaskFactory.create(1, {project_id: 1, created_by_id: currentUser.id, description: '<p>Shared rich description</p>'})
 const requests: unknown[] = []
 page.on('response', response => {if (/\/projects\/1(?:\/webhooks)?(?:$|\?)|\/webhooks\/events/.test(response.url())) requests.push({path: new URL(response.url()).pathname, status: response.status()})})
 await page.goto('/tasks/1'); await expect(page.locator('.description .ProseMirror')).toContainText('Shared rich description')
 await page.goto('/projects/1/settings/webhooks')
 const field = page.getByRole('textbox', {name: 'Target URL', exact: true})
 await expect(page.locator('input[id*="target" i], input[name*="target" i], .native-webhook-editor input').first()).toBeAttached()
 const geometry = async () => page.evaluate(() => ({rootDisplay: getComputedStyle(document.querySelector('#app')!).display, rootBox: document.querySelector('#app')!.getBoundingClientRect().toJSON(), dialogs: [...document.querySelectorAll('dialog')].map(dialog => ({class: dialog.className, insideApp: !!dialog.closest('#app'), modal: dialog.matches(':modal'), open: dialog.open, box: dialog.getBoundingClientRect().toJSON(), display: getComputedStyle(dialog).display})), inputs: [...document.querySelectorAll('dialog input')].map(input => ({id: input.id, box: input.getBoundingClientRect().toJSON()}))}))
 try {
  await page.evaluate(() => document.fonts.ready)
  await info.attach('webhook-before', {body: JSON.stringify(await geometry(), null, 2), contentType: 'application/json'})
  await info.attach('webhook-before-image', {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
  // Both original assertions remain failure gates; continue only to diagnose the same page.
  await expect.soft(field).toBeVisible()
  await expect.soft(page.getByRole('button', {name: 'Create webhook', exact: true})).toHaveCount(1)
  if (process.env.WEBHOOK_DIAGNOSTIC_CSS !== 'false' && await page.locator('#app dialog.native-project-dialog').count()) {
   await page.addStyleTag({content: 'body:has(#app dialog[open].native-project-dialog) #app {display:block!important}'} )
   await expect(field).toBeVisible()
   await expect(page.getByRole('button', {name: 'Create webhook', exact: true})).toHaveCount(1)
   await info.attach('webhook-diagnostic-css', {body: JSON.stringify(await geometry(), null, 2), contentType: 'application/json'})
   await info.attach('webhook-diagnostic-css-image', {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
  }
  await field.focus(); await expect(field).toBeFocused(); await field.pressSequentially('https://fixture.invalid/webhook'); await expect(field).toHaveValue('https://fixture.invalid/webhook')
 } finally {await info.attach('webhook-api', {body: JSON.stringify(requests, null, 2), contentType: 'application/json'})}
})
