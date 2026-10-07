import {test, expect} from './fixtures'
import {readFileSync} from 'node:fs'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
const paths = (name:string) => (readFileSync(new URL(`../../frontend/src/assets/${name}.svg`,import.meta.url),'utf8').match(/<path/g)??[]).length
for (const width of [1440,390]) test(`logo normal seasonal theme settings and teardown ${width}`,async({authenticatedPage:page,apiContext,browser},info)=>{
 await page.setViewportSize({width,height:900}); await page.clock.install({time:new Date('2026-05-31T23:30:00Z')})
 await page.route('**/api/v1/info',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),allow_icon_changes:true}})})
 await page.goto('/'); const logo=page.locator('.logo-link svg')
 await expect(logo.locator('path')).toHaveCount(paths('logo-full'))
 await page.clock.fastForward(3600000)
 await expect(logo.locator('path')).toHaveCount(paths('logo-full-pride'))
 await expect(page.locator('.menu-container a.logo svg path')).toHaveCount(paths('logo-full-pride'))
 const headers={Authorization:`Bearer ${await page.evaluate(()=>localStorage.getItem('token'))}`}
 const user=await (await apiContext.get('user',{headers})).json()
 const settings={...user.settings,frontend_settings:{...user.settings.frontend_settings,allowIconChanges:false}}
 expect((await apiContext.post('user/settings/general',{headers,data:settings})).ok()).toBe(true)
 await page.reload(); await expect(logo.locator('path')).toHaveCount(paths('logo-full'))
 await expect(page.locator('.menu-container a.logo svg path')).toHaveCount(paths('logo-full'))
 await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveClass(/dark/)
 await expect(logo).toHaveCSS('color','rgb(229, 231, 235)')
 await expect(page.locator('.menu-container a.logo svg')).toHaveCSS('color','rgb(229, 231, 235)')
 await page.screenshot({path:info.outputPath('logo-dark.png'),animations:'disabled'})
 const context=await browser.newContext()
 try {const publicPage=await context.newPage();await setupApiUrl(publicPage);await publicPage.goto('/login');await expect(publicPage.getByRole('img',{name:'Vikunja',exact:true})).toBeVisible()} finally {await context.close()}
})
for (const variant of ['both','light-only','dark-only']) test(`configured logo theme fallback ${variant}`,async({authenticatedPage:page},info)=>{
 const light='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="40"%3E%3Crect width="120" height="40" fill="red"/%3E%3C/svg%3E'
 const dark=light.replace('red','blue')
 await page.addInitScript(({variant,light,dark})=>{if(variant!=='dark-only')(window as any).CUSTOM_LOGO_URL=light;if(variant!=='light-only')(window as any).CUSTOM_LOGO_URL_DARK=dark},{variant,light,dark})
 await page.goto('/'); const logo=page.locator('.logo-link img:visible')
 await expect(logo).toHaveAttribute('src',variant==='dark-only'?dark:light)
 await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveClass(/dark/)
 await expect(logo).toHaveAttribute('src',variant==='light-only'?light:dark)
 await page.screenshot({path:info.outputPath('custom-logo.png'),animations:'disabled'})
})
test('backend logo opt-out uses normal SVG in June',async({authenticatedPage:page})=>{
 await page.clock.setFixedTime(new Date('2026-06-05T12:00:00Z'))
 await page.route('**/api/v1/info',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),allow_icon_changes:false}})})
 await page.goto('/'); await expect(page.locator('.logo-link svg path')).toHaveCount(paths('logo-full'))
})
