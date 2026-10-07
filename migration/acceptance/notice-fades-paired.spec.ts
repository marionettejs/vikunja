import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async () => {
	await ProjectFactory.create(1, {title: 'Fade project'})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: 'Fade task', priority: 3})
})
async function prepare(page) {
	await page.addInitScript(() => {
		const records: any[] = []
		;(window as any).__noticeFades = records
		const seen = new WeakSet<Element>()
		new MutationObserver(() => {
			for (const row of document.querySelectorAll('.global-notification .vue-notification')) {
				if (seen.has(row)) continue
				seen.add(row)
				const animated = row.closest('.vue-notification-wrapper') ?? row
				const record = {created: performance.now(), removed: 0, samples: [] as any[]}
				records.push(record)
				const sample = () => {
					if (!row.isConnected) {record.removed = performance.now(); return}
					record.samples.push({time: performance.now(), opacity: Number(getComputedStyle(animated).opacity), animations: animated.getAnimations().map(animation => ({duration: animation.effect?.getTiming().duration, opacity: animation.effect?.getKeyframes().some(frame => frame.opacity !== undefined)}))})
					requestAnimationFrame(sample)
				}
				requestAnimationFrame(sample)
			}
		}).observe(document, {childList: true, subtree: true})
	})
	await page.goto('/tasks/1')
	const banner = page.locator('.add-to-home-screen')
	if (await banner.isVisible()) await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
}
const recording = page => page.evaluate(() => (window as any).__noticeFades[0])
async function publish(page) {
	const accepted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/tasks/1' && response.request().method() === 'POST')
	await page.getByRole('combobox', {name: 'Priority', exact: true}).selectOption('4')
	expect((await accepted).ok()).toBe(true)
	const notice = page.locator('.global-notification .vue-notification.success')
	await expect(notice).toContainText('The task was saved successfully.')
	await expect.poll(async () => (await recording(page))?.samples.some(sample => sample.opacity > 0 && sample.opacity < 1 && sample.animations.some(animation => animation.opacity && animation.duration === 300))).toBe(true)
	await expect.poll(() => notice.evaluate(row => Number(getComputedStyle(row.closest('.vue-notification-wrapper') ?? row).opacity))).toBe(1)
	return notice
}
test('accepted notice enters and click dismissal leaves over the source fade duration', async ({authenticatedPage: page}, info) => {
	await prepare(page)
	const notice = await publish(page)
	const clicked = await page.evaluate(() => performance.now())
	await notice.click()
	await expect(notice).toHaveCount(0)
	await expect.poll(async () => (await recording(page)).removed).toBeGreaterThan(0)
	const result = await recording(page)
	expect(result.samples.some(sample => sample.time > clicked && sample.opacity > 0 && sample.opacity < 1 && sample.animations.some(animation => animation.opacity && animation.duration === 300))).toBe(true)
	await info.attach('click-fade-samples', {body: JSON.stringify(result), contentType: 'application/json'})
})
test('automatic expiry preserves the deadline and finishes its leave fade', async ({authenticatedPage: page}, info) => {
	await prepare(page)
	const notice = await publish(page)
	await expect(notice).toHaveCount(0, {timeout: 6000})
	await expect.poll(async () => (await recording(page)).removed).toBeGreaterThan(0)
	const result = await recording(page)
	expect(result.samples.some(sample => sample.time - result.created > 3400 && sample.opacity > 0 && sample.opacity < 1 && sample.animations.some(animation => animation.opacity && animation.duration === 300))).toBe(true)
	await info.attach('expiry-fade-samples', {body: JSON.stringify(result), contentType: 'application/json'})
})
