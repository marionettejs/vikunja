import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async () => {
 await ProjectFactory.create(1, {title:'Controls review'})
 await createDefaultViews(1)
 await TaskFactory.create(2, {title:id => id===1?'Rich task':'Short task',description:id=>id===1?'<p>'+ 'Scrollable rich task. '.repeat(600)+'</p>':'<p>Short description</p>'})
 await BucketFactory.create(1,{title:'Review',project_view_id:4})
 await TaskBucketFactory.create(2,{task_id:id=>id,bucket_id:1,project_view_id:4})
 await Factory.seed('task_positions',[1,2].map(id=>({task_id:id,project_view_id:4,position:id*65536})))
})
for (const width of [1440,390]) {
 test(`shortcut help close and task draft ${width}`,async ({authenticatedPage:page},info)=>{
  await page.setViewportSize({width,height:900});await page.goto('/tasks/2')
  const description=page.locator('.tiptap__task-description'),editor=description.locator('.ProseMirror')
  await expect(editor).toContainText('Short description')
  if(width===1440){await page.getByRole('button',{name:'Keyboard Shortcuts',exact:true}).click()}
  else {await page.keyboard.press('Shift+/')}
  const help=page.locator('.keyboard-shortcuts');await info.attach('help-geometry',{body:JSON.stringify(await help.evaluate(el=>({open:el.closest('dialog')?.open,box:el.getBoundingClientRect().toJSON(),styles: getComputedStyle(el).display,parent:el.parentElement?.getBoundingClientRect().toJSON(),dialogs:[...document.querySelectorAll('dialog')].map(d=>({open:d.open,box:d.getBoundingClientRect().toJSON()}))}))),contentType:'application/json'});await expect(help).toBeVisible()
  await expect(help).toContainText('General');await page.screenshot({path:info.outputPath('shortcut-help.png'),animations:'disabled'})
  await page.keyboard.press('Escape');await expect(help).toHaveCount(0)
  await description.getByRole('button',{name:'Edit',exact:true}).click();await editor.press('ControlOrMeta+End');await editor.pressSequentially(' retained draft')
  // Help reached through a pointer should preserve the editor-owned draft.
  if(width===1440){await page.getByRole('button',{name:'Keyboard Shortcuts',exact:true}).click();await expect(help).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(help).toHaveCount(0);await page.getByRole('button',{name:'Keyboard Shortcuts',exact:true}).click();await expect(help).toBeVisible();await page.mouse.click(5,5);await expect(help).toHaveCount(0)}
  await expect(editor).toContainText('retained draft');await editor.press('Escape');await expect(editor).toHaveText('Short description')
  await page.goto('/projects/1/1');await expect(page.locator('dialog[open]')).toHaveCount(0)
 })
 for(const presentation of ['list-page','kanban-modal']) test(`rich task bottom navigation ${presentation} ${width}`,async ({authenticatedPage:page},info)=>{
  await page.setViewportSize({width,height:900});await page.goto(presentation==='list-page'?'/projects/1/1':'/projects/1/4');await page.locator(presentation==='list-page'?'.tasks .task-link':'.kanban-card__title-link').filter({hasText:'Rich task'}).click()
  await expect(page.locator('.description .ProseMirror')).toContainText('Scrollable rich task.');await expect(page.locator('dialog[open]')).toHaveCount(presentation==='kanban-modal'?1:0)
  const bottom=page.getByRole('button',{name:'Scroll to bottom',exact:true})
  await page.screenshot({path:info.outputPath('task-scroll-top.png'),animations:'disabled'})
  if(width===1440){
   await expect(bottom).toBeVisible();await bottom.click()
   await expect(page.locator('.content-bottom-marker')).toBeInViewport();await expect(bottom).toBeHidden()
  }else{
   // Pinned TaskDetailView.vue explicitly hides this desktop control at <=769px.
   await expect(bottom).toBeHidden();await page.mouse.move(width/2,450);await page.mouse.wheel(0,20000)
   await expect(page.locator('.content-bottom-marker')).toBeInViewport()
  }
  if(presentation==='kanban-modal'){await page.keyboard.press('Escape');await expect(page).toHaveURL(/projects\/1\/4/)}
  else {await page.goBack();await expect(page).toHaveURL(/projects\/1\/1/)}
  await expect(bottom).toHaveCount(0)
 })
}
