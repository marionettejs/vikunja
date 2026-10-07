import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await ProjectFactory.create(1, {title: 'Table checkpoint'})
	await createDefaultViews(1)
	await TaskFactory.create(70, {title: (id: number) => `Task ${String(id).padStart(3, '0')}`, priority: 1})
})
test('table deep link, pagination and reload retain query/API sorting', async ({authenticatedPage: page}, info) => {
	const requests: string[] = []
	page.on('request', request => { if (/\/views\/3\/tasks\?/.test(request.url())) requests.push(request.url()) })
	await page.goto('/projects/1/3?sort=title:asc&page=2')
	const rows = page.getByRole('table').getByRole('row')
	await expect(rows.nth(1)).toContainText('Task 051')
	await page.getByRole('link', {name: 'Goto page 1', exact: true}).click()
	await expect(rows.nth(1)).toContainText('Task 001')
	await page.reload(); await expect(rows.nth(1)).toContainText('Task 001')
	const query = new URL(requests.at(-1)!).searchParams
	expect(query.getAll('sort_by[]')).toEqual(['title']); expect(query.getAll('order_by[]')).toEqual(['asc']); expect(query.getAll('expand[]')).toEqual(['comment_count', 'is_unread'])
	await info.attach('table-api-requests', {body: JSON.stringify(requests), contentType: 'application/json'})
	await info.attach('table-desktop', {body: await page.screenshot(), contentType: 'image/png'})
})
test('table sort cycle and column choices persist through reload', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/3')
	const table = page.getByRole('table')
	await expect(table.getByRole('row').nth(1)).toContainText('Task 070')
	await page.getByRole('button', {name: 'Sort by Title', exact: true}).click()
	await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('title:desc')
	await expect(table.getByRole('row').nth(1)).toContainText('Task 070')
	await page.getByRole('button', {name: 'Sort by Title', exact: true}).click()
	await expect(table.getByRole('row').nth(1)).toContainText('Task 001')
	await page.getByRole('button', {name: 'Columns', exact: true}).click()
	await page.getByRole('checkbox', {name: /^(Checkbox )?Priority$/}).focus(); await page.keyboard.press('Space')
	await expect(page.getByRole('checkbox', {name: /^(Checkbox )?Priority$/})).toBeChecked()
	await expect(table.getByRole('columnheader', {name: /^Priority/})).toBeVisible()
	await page.getByRole('checkbox', {name: /^(Checkbox )?Labels$/}).focus(); await page.keyboard.press('Space')
	await expect(page.getByRole('checkbox', {name: /^(Checkbox )?Labels$/})).not.toBeChecked()
	await expect(table.getByRole('columnheader', {name: /^Labels/})).toHaveCount(0)
	await page.keyboard.press('Escape'); await expect(page.getByRole('button', {name: 'Columns', exact: true})).toBeFocused()
	await page.reload(); await expect(table.getByRole('columnheader', {name: /^Priority/})).toBeVisible()
	await expect(table.getByRole('columnheader', {name: /^Labels/})).toHaveCount(0)
	await expect(table.getByRole('row').nth(1)).toContainText('Task 001')
})
test('table keyboard sorting and task links expose the original public interactions', async ({authenticatedPage: page}) => {
	await page.setViewportSize({width: 390, height: 844})
	await page.goto('/projects/1/3')
	const sort = page.getByRole('button', {name: 'Sort by Title', exact: true})
	await sort.focus(); await page.keyboard.press('Enter')
	await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Task 070')
	await expect(sort).toBeFocused()
	const task = page.getByRole('link', {name: 'Task 070', exact: true}); await expect(task).toHaveAttribute('href', '/tasks/70')
})


test('table error retry uses a public sort action and retains column choices', async ({authenticatedPage: page}) => {
	let fail = true
	await page.route('**/projects/1/views/3/tasks?**', route => fail ? route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture table failure'})}) : route.continue())
	await page.goto('/projects/1/3')
	await expect(page.getByText('Fixture table failure', {exact: true})).toBeVisible()
	await page.getByRole('button', {name: 'Columns', exact: true}).click()
	await page.getByRole('checkbox', {name: /^(Checkbox )?Priority$/}).focus(); await page.keyboard.press('Space')
	await expect(page.getByRole('checkbox', {name: /^(Checkbox )?Priority$/})).toBeChecked()
	fail = false
	await page.getByRole('button', {name: 'Sort by Title', exact: true}).click()
	await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Task 070')
	await page.getByRole('button', {name: 'Columns', exact: true}).click()
	await expect(page.getByRole('checkbox', {name: /^(Checkbox )?Priority$/})).toBeChecked()
})

test('table superseding sort rejects late results while preserving focused control', async ({authenticatedPage: page}) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
	await page.goto('/projects/1/3'); await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Task 070')
	let release!: () => void
	const delayed = new Promise<void>(resolve => { release = resolve })
	let started!: () => void
	const ready = new Promise<void>(resolve => { started = resolve })
	await page.route('**/projects/1/views/3/tasks?**', async route => {
		if (new URL(route.request().url()).searchParams.getAll('order_by[]')[0] !== 'desc') { await route.continue(); return }
		const response = await route.fetch(); started(); await delayed
		await route.fulfill({response}).catch(() => {})
	})
	const sort = page.getByRole('button', {name: 'Sort by Title', exact: true})
	await sort.click(); await ready; await sort.click()
	await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Task 001')
	release(); await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Task 001'); await expect(sort).toBeFocused(); expect(errors).toEqual([])
})
