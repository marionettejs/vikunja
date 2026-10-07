import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
test('final list task kanban search visual and keyboard acceptance', async ({authenticatedPage: page, currentUser}, info) => {
	const width=page.viewportSize()!.width; await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
	await ProjectFactory.create(2, {title: id => id === 1 ? 'Parity project' : 'Destination', description: '<p>Project description</p>', owner_id: currentUser.id, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	await createDefaultViews(1); await createDefaultViews(2, 5)
	await TaskFactory.create(3, {title: id => 'Parity task ' + id, description: '<p>Original description</p>', hex_color: '1973ff', priority: 2, created_by_id: currentUser.id, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	await BucketFactory.create(2, {title: id => id === 1 ? 'Backlog' : 'Doing', project_view_id: 4, position: id => id * 65536})
	await TaskBucketFactory.create(3, {task_id: id => id, bucket_id: id => id <= 2 ? 1 : 2, project_view_id: 4})
	await TaskCommentFactory.create(1, {task_id: 1, author_id: currentUser.id, comment: '<p>Existing fixture comment</p>', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	async function capture(name: string) {
		await page.evaluate(async () => {await document.fonts.ready; await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())))})
		await page.screenshot({path: info.outputPath(name + '-' + width + '.png'), animations: 'disabled'})
		await info.attach(name + '-geometry', {body: JSON.stringify(await page.locator('.task-section-title, .description, .navbar-end, .notifications, .header-search, dialog > button, .switch-view-button, .priority-label').evaluateAll(elements => elements.map(el => {const s = getComputedStyle(el), r = el.getBoundingClientRect(); return {className: el.className, text:el.textContent?.trim().slice(0,100), ariaLabel:el.getAttribute('aria-label'), color:s.color, focused:el===document.activeElement, first: el.matches(':first-child'), x:r.x,y:r.y,width:r.width,height:r.height,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,display:s.display,fontSize:s.fontSize}})), null, 2), contentType:'application/json'})
	}
	for (const [name, path, ready] of [['list', '/projects/1/1', 'Parity task 1'], ['kanban', '/projects/1/4', 'Parity task 1'], ['task', '/tasks/1', 'Existing fixture comment']]) {
		await page.goto(path); await expect(page.locator('body')).toContainText(ready); if (name === 'task') await expect(page.locator('.task-view input[type=color]')).toHaveCount(0); await page.waitForLoadState('networkidle'); if(name==='list' && width>768){const inactive=page.locator('.switch-view-button:not(.is-active)').first(); await expect(inactive).toHaveCSS('color',await inactive.evaluate(el=>{const sample=document.createElement('span');sample.style.color='var(--link)';el.append(sample);const color=getComputedStyle(sample).color;sample.remove();return color}))} await page.mouse.move(0,0); await capture(name)
	}
 await page.goto('/tasks/1')
 const title=page.locator('.task-view h1.title.input')
 await expect(title).toHaveText('Parity task 1')
 await title.fill('Unsent final review draft'); await expect(title).toBeFocused()
 await capture('task-title-draft')
 await title.press('Escape'); await expect(title).toHaveText('Parity task 1')
 const description=page.locator('.tiptap__task-description')
 await description.getByRole('button',{name:'Edit',exact:true}).click()
 const editor=description.locator('.ProseMirror'); await expect(editor).toBeFocused()
 await editor.press('ControlOrMeta+End'); await editor.pressSequentially(' unsent draft')
 await capture('task-editor-draft')
 await editor.press('Escape'); await expect(editor).toHaveText('Original description')
 await page.goto('/projects/1/4'); await expect(page.locator('.kanban')).toContainText('Parity task 1')
 await page.getByText('Parity task 1',{exact:true}).first().click()
 await expect(page.locator('.task-view')).toContainText('Existing fixture comment')
 if(width>768) await expect(page.getByRole('dialog').locator('.close:not(.card-header-icon):visible, .quick-actions-outside-close:visible')).toHaveCSS('color',info.project.use.colorScheme==='dark'?'rgb(249, 250, 251)':'rgb(255, 255, 255)')
 await capture('kanban-task-dialog')
 await page.keyboard.press('Escape'); await expect(page.locator('.task-view')).toHaveCount(0)
 await expect(page.locator('.kanban')).toContainText('Parity task 1')

	await page.goto('/projects/1/1'); await expect(page.getByRole('button', {name: 'Open the search/quick action bar', exact: true})).toBeVisible(); await page.keyboard.press('Control+k')
	const dialog = page.getByRole('dialog'), input = dialog.locator('input').first(); await expect(input).toBeFocused(); await input.fill('Parity task'); await input.press('End')
	await expect(dialog.getByRole('button').filter({hasText: 'Parity task 1'})).toBeVisible(); const result = dialog.getByRole('button').filter({hasText:'Parity task 1'}); await expect(result).toContainText('Medium Parity task 1'); await expect(result.locator('.color-bubble')).toHaveCSS('width','10px'); await expect(result.locator('.color-bubble')).toHaveCSS('height','10px'); if(width>768) await expect(page.getByRole('dialog').locator('.close:not(.card-header-icon):visible, .quick-actions-outside-close:visible')).toHaveCSS('color',info.project.use.colorScheme==='dark'?'rgb(249, 250, 251)':'rgb(255, 255, 255)'); await capture('search'); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await info.attach('search-return-focus',{body:JSON.stringify(await page.evaluate(()=>({tag:document.activeElement?.tagName,role:document.activeElement?.getAttribute('role'),name:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent?.trim().slice(0,100)}))),contentType:'application/json'})
})
