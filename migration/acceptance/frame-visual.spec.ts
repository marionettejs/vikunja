import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for (const width of [1440, 390]) test('stable high use paired frames ' + width, async ({authenticatedPage: page, currentUser}, info) => {
	await page.setViewportSize({width, height: 900}); await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
	await ProjectFactory.create(2, {title: id => id === 1 ? 'Parity project' : 'Destination', description: '<p>Project description</p>', owner_id: currentUser.id, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	await createDefaultViews(1); await createDefaultViews(2, 5)
	await TaskFactory.create(3, {title: id => 'Parity task ' + id, description: '<p>Original description</p>', hex_color: '1973ff', priority: 2, created_by_id: currentUser.id, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	await BucketFactory.create(2, {title: id => id === 1 ? 'Backlog' : 'Doing', project_view_id: 4, position: id => id * 65536})
	await TaskBucketFactory.create(3, {task_id: id => id, bucket_id: id => id <= 2 ? 1 : 2, project_view_id: 4})
	await TaskCommentFactory.create(1, {task_id: 1, author_id: currentUser.id, comment: '<p>Existing fixture comment</p>', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	async function capture(name: string) {
		await page.evaluate(async () => {await document.fonts.ready; await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())))})
		await page.screenshot({path: info.outputPath(name + '-' + width + '.png'), animations: 'disabled'})
		await info.attach(name + '-geometry', {body: JSON.stringify(await page.locator('.task-section-title, .description, .navbar-end, .notifications, .header-search').evaluateAll(elements => elements.map(el => {const s = getComputedStyle(el), r = el.getBoundingClientRect(); return {className: el.className, first: el.matches(':first-child'), x:r.x,y:r.y,width:r.width,height:r.height,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,display:s.display,fontSize:s.fontSize}})), null, 2), contentType:'application/json'})
	}
	for (const [name, path, ready] of [['home', '/', 'Parity project'], ['directory', '/projects', 'Parity project'], ['list', '/projects/1/1', 'Parity task 1'], ['kanban', '/projects/1/4', 'Parity task 1'], ['task', '/tasks/1', 'Existing fixture comment'], ['settings', '/user/settings/general', 'General']]) {
		await page.goto(path); await expect(page.locator('body')).toContainText(ready); if (name === 'task') await expect(page.locator('.task-view input[type=color]')).toHaveCount(0); await capture(name)
	}
	await page.goto('/projects/1/1'); await expect(page.getByRole('button', {name: 'Open the search/quick action bar', exact: true})).toBeVisible(); await page.keyboard.press('Control+k')
	const dialog = page.getByRole('dialog'), input = dialog.locator('input').first(); await expect(input).toBeFocused(); await input.fill('Parity task'); await input.press('End')
	await expect(dialog.getByRole('button').filter({hasText: 'Parity task 1'})).toBeVisible(); const result = dialog.getByRole('button').filter({hasText:'Parity task 1'}); await expect(result).toContainText('Medium Parity task 1'); await expect(result.locator('.color-bubble')).toHaveCSS('width','10px'); await expect(result.locator('.color-bubble')).toHaveCSS('height','10px'); await capture('search')
})
