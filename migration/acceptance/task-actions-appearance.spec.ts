import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {proContract} from './pro-contract-fixture'

// Public TaskDetailView/XButton contract, identical for both frameworks. No
// data-action or Vue test-id dependency: all controls use their accessible name.
const actions = [
	['Mark task done!', 'fas', 'check-double'], ['Subscribe', 'fas', 'bell'],
	['Add to Favorites', 'far', 'star'], ['Add Labels', 'fas', 'tags'],
	['Set Priority', 'fas', 'circle-exclamation'], ['Set Progress', 'fas', 'percent'],
	['Set Color', 'fas', 'fill-drip'], ['Assign to User', 'fas', 'users'],
	['Add Attachments', 'fas', 'paperclip'], ['Add Relation', 'fas', 'sitemap'],
	['Move', 'fas', 'list'], ['Duplicate', 'fas', 'copy'],
	['Track time', 'far', 'clock'], ['Set Due Date', 'fas', 'calendar'],
	['Set Start Date', 'fas', 'play'], ['Set End Date', 'fas', 'stop'],
	['Set Reminders', 'far', 'clock'], ['Set Repeating Interval', 'fas', 'clock-rotate-left'],
	['Delete', 'fas', 'trash-can'],
] as const

for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark'] as const)
	test(`task action appearance and print ${width} ${colorScheme}`, async ({authenticatedPage: page, currentUser, apiContext, userToken}, info) => {
		await page.setViewportSize({width, height: 900})
		await page.emulateMedia({colorScheme})
		await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
		// Advertise the existing frontend feature only; real backend license gates
		// remain untouched. Task CRUD/subscriptions below use the real backend.
		await proContract(page, {admin: false, features: ['time_tracking']})
		await ProjectFactory.create(1, {title: 'Action appearance project', owner_id: currentUser.id})
		await createDefaultViews(1)
		await TaskFactory.create(1, {title: 'Action appearance task', project_id: 1, created_by_id: currentUser.id,
			description: '<p>Deterministic task description</p>', hex_color: '1973ff',
			created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
		await page.goto('/tasks/1')
		await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme))
		const sidebar = page.locator('.task-view .action-buttons')
		await expect(sidebar.getByRole('button', {name: 'Track time', exact: true})).toBeVisible()
		await page.evaluate(async () => {await document.fonts.ready})
		const banner = page.locator('.add-to-home-screen')
		if (await banner.isVisible()) await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
		await page.mouse.move(0, 0)
		async function capture(name: string) {
			await page.screenshot({path: info.outputPath(name + '.png'), animations: 'disabled', fullPage: true})
			const geometry = await sidebar.evaluate(root => {
				const origin = root.getBoundingClientRect()
				const rect = (el: Element, base: DOMRect) => {const r = el.getBoundingClientRect(); return {x: r.x - base.x, y: r.y - base.y, width: r.width, height: r.height}}
				return {parentClasses: root.className, headings: Array.from(root.querySelectorAll('.action-heading'), el => el.textContent),
					buttons: Array.from(root.querySelectorAll('button'), button => {
						const r = button.getBoundingClientRect(), icon = button.querySelector('.icon'), label = button.querySelector(':scope > span:not(.icon)'), svg = icon?.querySelector('svg'), style = getComputedStyle(button)
						return {name: button.textContent?.trim(), classes: button.className, rect: rect(button, origin), icon: icon ? {classes: icon.className, rect: rect(icon, r), prefix: svg?.getAttribute('data-prefix'), name: svg?.getAttribute('data-icon')} : null,
							label: label ? rect(label, r) : null, font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, line: style.lineHeight, whiteSpace: style.whiteSpace, gap: style.gap, padding: style.padding, shadow: style.boxShadow}
					})}
			})
			await info.attach(name + '-geometry', {body: JSON.stringify(geometry, null, 2), contentType: 'application/json'})
			return geometry
		}
		const geometry = await capture('task-actions-unsubscribed')
		expect.soft(geometry.buttons.map(button => button.name)).toEqual(actions.map(action => action[0]))
		for (const [name, prefix, iconName] of actions) {
			const button = sidebar.getByRole('button', {name, exact: true})
			expect.soft(await button.getAttribute('class'), name).toContain('base-button--type-button')
			const measured = geometry.buttons.find(button => button.name === name)!
			expect.soft(measured.icon?.prefix, name).toBe(prefix)
			expect.soft(measured.icon?.name, name).toBe(iconName)
			// Original XButton reserves Bulma's small 16px icon, 8px padding,
			// 4px gap, theme form.scss's .05rem (0.8px) icon end margin,
			// and a separate wrapping label. Measure relative to button.
			expect.soft(measured.icon?.classes, name).toContain('is-small')
			expect.soft(measured.icon?.rect.width, name).toBeCloseTo(16, 1)
			expect.soft(measured.icon?.rect.x, name).toBeCloseTo(8, 1)
			expect.soft(measured.label?.x, name).toBeCloseTo(28.8, 1)
			expect.soft(measured.whiteSpace, name).toBe('break-spaces')
			expect.soft(measured.size, name).toBe('13.6px')
			expect.soft(measured.weight, name).toBe('700')
		}
		const sequence = await sidebar.locator('.action-heading, button').allTextContents()
		expect.soft(sequence.map(text => text.trim())).toEqual([
			...actions.slice(0, 3).map(action => action[0]), 'Organization',
			...actions.slice(3, 7).map(action => action[0]), 'Management',
			...actions.slice(7, 12).map(action => action[0]), 'Date and time',
			...actions.slice(12).map(action => action[0]),
		])
		await sidebar.getByRole('button', {name: 'Subscribe', exact: true}).click()
		await expect(sidebar.getByRole('button', {name: 'Unsubscribe', exact: true})).toBeVisible()
		const response = await apiContext.get('tasks/1', {headers: {Authorization: `Bearer ${userToken}`}})
		expect(response.ok()).toBe(true)
		expect((await response.json()).subscription).toMatchObject({entity: 'task', entity_id: 1})
		const subscribed = await capture('task-actions-subscribed')
		expect.soft(subscribed.buttons.find(button => button.name === 'Unsubscribe')?.icon).toMatchObject({prefix: 'far', name: 'bell-slash'})
		// TaskDetailView's original action parent is d-print-none at both widths.
		// Soft preserves the same strict failure while recording the print artifact.
		await page.emulateMedia({media: 'print'})
		await capture('task-actions-print')
		await expect.soft(sidebar).not.toBeVisible()
		await expect(page.locator('.task-view h1')).toContainText('Action appearance task')
		await page.emulateMedia({media: 'screen'})
		await expect(sidebar).toBeVisible()
	})
