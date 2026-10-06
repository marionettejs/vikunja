import {test,expect} from './fixtures'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {LinkShareFactory} from '../../frontend/tests/factories/link_sharing'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
const screens=[['home','/'],['directory','/projects'],['list','/projects/1/1'],['table','/projects/1/3'],['kanban','/projects/1/4'],['gantt','/projects/1/2'],['task','/tasks/1'],['settings','/user/settings/general'],['sharing','/projects/1/settings/share']] as const
async function settle(page:import('@playwright/test').Page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))})}
for(const width of [1440,390]){
 test(`login reference screenshot at ${width}`,async({page,currentUser},info)=>{void currentUser;await setupApiUrl(page);await page.setViewportSize({width,height:900});await page.goto('/login');await expect(page.getByRole('button',{name:'Login',exact:true})).toBeVisible();await settle(page);await page.screenshot({path:info.outputPath(`login-${width}.png`),animations:'disabled'})})
 test(`main path visual and behavior capture at ${width}`,async({authenticatedPage:page,currentUser},info)=>{
  test.setTimeout(120000);await page.setViewportSize({width,height:900});await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
  await ProjectFactory.create(1,{title:'Parity project',description:'<p>Project description</p>',owner_id:currentUser.id,created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'});await createDefaultViews(1)
  await TaskFactory.create(3,{title:id=>`Parity task ${id}`,description:'<p>Original description</p>',created_by_id:currentUser.id,start_date:'2026-10-05T00:00:00Z',end_date:'2026-10-07T00:00:00Z',due_date:'2026-10-06T12:00:00Z',created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
  await BucketFactory.create(2,{title:id=>id===1?'Backlog':'Doing',project_view_id:4,position:id=>id*65536});await TaskBucketFactory.create(3,{task_id:id=>id,bucket_id:id=>id<=2?1:2,project_view_id:4})
  await TaskCommentFactory.create(1,{task_id:1,author_id:currentUser.id,comment:'<p>Existing fixture comment</p>',created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'});await LinkShareFactory.create(1,{hash:'visual-share',permission:0})
  for(const [name,path] of screens){await test.step(name,async()=>{await page.goto(path);await expect(page.locator('body')).toContainText(name==='settings'?'General':name==='task'?'Existing fixture comment':'Parity project');if(['list','table','kanban','gantt'].includes(name))await expect(page.locator('body')).toContainText('Parity task 1');await settle(page);await page.screenshot({path:info.outputPath(`${name}-${width}.png`),animations:'disabled'})})}
  await page.goto('/projects/1/4');await page.getByRole('link',{name:'Parity task 1',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();if(width===390){const close=page.getByRole('dialog').getByRole('button',{name:'Close task detail',exact:true}).last();await expect(close).toBeVisible();expect(await close.evaluate(el=>getComputedStyle(el).color)).toBe(await page.locator('.task-view').evaluate(el=>getComputedStyle(el).color))}await expect(page.locator('.task-view')).toContainText('Original description');await settle(page);await page.screenshot({path:info.outputPath(`modal-${width}.png`),animations:'disabled'})
  await page.goto('/tasks/1');const surface=page.locator('.tiptap__task-description');await surface.getByRole('button',{name:'Edit',exact:true}).click();await expect(surface.locator('.ProseMirror')).toHaveAttribute('contenteditable','true');await settle(page);await page.screenshot({path:info.outputPath(`editor-${width}.png`),animations:'disabled'})
 })
}
