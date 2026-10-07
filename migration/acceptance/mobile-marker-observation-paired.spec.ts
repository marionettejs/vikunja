import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async () => {
	await ProjectFactory.create(1, {title: 'Marker observation'})
	await createDefaultViews(1)
	await TaskFactory.create(2, {title: id => id === 1 ? 'Rich task' : 'Short task', description: id => id === 1 ? '<p>' + 'Scrollable rich task. '.repeat(600) + '</p>' : '<p>Short description</p>'})
	await BucketFactory.create(1, {title: 'Review', project_view_id: 4})
	await TaskBucketFactory.create(2, {task_id: id => id, bucket_id: 1, project_view_id: 4})
	await Factory.seed('task_positions', [1, 2].map(id => ({task_id: id, project_view_id: 4, position: id * 65536})))
})
for (const presentation of ['list-page', 'kanban-modal']) {
	test(`mobile comment marker is reachable above stacked actions ${presentation}`, async ({authenticatedPage: page}, info) => {
		await page.goto(presentation === 'list-page' ? '/projects/1/1' : '/projects/1/4')
		const link = page.locator(presentation === 'list-page' ? '.tasks .task-link' : '.kanban-card__title-link').filter({hasText: 'Rich task'})
		await expect(link).toBeVisible()
		const banner = page.locator('.add-to-home-screen')
		await expect(banner).toBeVisible()
		await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
		await expect(banner).toBeHidden()
		await link.click()
		await expect(page.locator('.description .ProseMirror')).toContainText('Scrollable rich task.')
		await expect(page.locator('dialog[open]')).toHaveCount(presentation === 'kanban-modal' ? 1 : 0)
		await expect(page.getByRole('button', {name: 'Scroll to bottom', exact: true})).toBeHidden()
		await page.mouse.move(195, 450)
		await page.mouse.wheel(0, 20000)
		const marker = page.locator('.content-bottom-marker')
		const geometry = () => marker.evaluate(el => ({marker: el.getBoundingClientRect().toJSON(), actions: document.querySelector('.task-view .action-buttons')?.getBoundingClientRect().toJSON(), height: innerHeight}))
		await expect.poll(async () => (await geometry()).marker.bottom).toBeLessThan(0)
		await info.attach('after-original-wheel', {body: JSON.stringify(await geometry()), contentType: 'application/json'})
		// The marker precedes the mobile action column in both versions. A large
		// wheel reaches those later actions; ordinary upward scrolling finds it.
		for (let step = 0; step < 20; step++) {
			const {marker: box, height} = await geometry()
			if (box.top >= 0 && box.bottom <= height) break
			await page.mouse.wheel(0, -400)
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
		}
		await expect(marker).toBeInViewport()
		await info.attach('marker-reached', {body: JSON.stringify(await geometry()), contentType: 'application/json'})
		await page.screenshot({path: info.outputPath('marker-reached.png'), animations: 'disabled'})
	})
}
