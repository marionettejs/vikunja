import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

for (const width of [1440, 390]) test(`webhook creator tooltip and close cleanup ${width}`, async ({authenticatedPage: page, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Tooltip project'}); await createDefaultViews(1)
 await page.setViewportSize({width, height: 900}); await page.goto('/projects/1/settings/webhooks')
 await page.getByRole('textbox', {name: 'Target URL', exact: true}).fill('https://fixture.invalid/tooltip')
 const event = page.getByRole('checkbox', {name: /^(?:Checkbox\s+)?task\.updated$/})
 await event.focus(); await event.press('Space')
 await page.getByRole('button', {name: 'Create webhook', exact: true}).click()
 const row = page.getByRole('row').filter({has: page.getByRole('cell', {name: 'https://fixture.invalid/tooltip', exact: true})})
 const avatar = row.locator('img.avatar')
 await expect(avatar).toBeVisible(); await expect.poll(() => avatar.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
 await avatar.hover()
 // Original floating-vue renders a generic popper without role=tooltip.
 // Use the same visible neutral tooltip surface for both frameworks.
 const tip = page.locator('.v-popper__popper').filter({hasText: currentUser.username})
 await expect.soft(tip).toBeVisible()
 await info.attach('creator-tooltip-geometry', {body: JSON.stringify(await tip.evaluateAll(elements => elements.map(el => {const r = el.getBoundingClientRect(), inner = el.querySelector('.v-popper__inner')!, arrow = el.querySelector('.v-popper__arrow-container')!, style = getComputedStyle(inner); return {text: el.textContent, placement: el.getAttribute('data-popper-placement'), rect: {x:r.x,y:r.y,width:r.width,height:r.height}, padding:style.padding,font:style.fontFamily,size:style.fontSize,color:style.color,background:style.backgroundColor,arrow:{width:getComputedStyle(arrow).width,height:getComputedStyle(arrow).height}}})), null, 2), contentType: 'application/json'})
 await info.attach('creator-trigger-geometry', {body: JSON.stringify(await avatar.boundingBox(), null, 2), contentType: 'application/json'})
 await info.attach('creator-hover', {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
 await page.keyboard.press('Escape')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(tip).not.toBeVisible()
 await page.goto('/projects/1/1')
 await expect(page.locator('.v-popper__popper--shown')).not.toBeVisible()
})
