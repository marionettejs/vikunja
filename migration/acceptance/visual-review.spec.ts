import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {LabelFactory} from '../../frontend/tests/factories/labels'
import {LabelTaskFactory} from '../../frontend/tests/factories/label_task'
import {TaskAssigneeFactory} from '../../frontend/tests/factories/task_assignee'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
const rich = '<h2>Review heading</h2><p>Rich <strong>bold</strong> and <em>italic</em> text with <a href="https://example.org">a link</a>.</p><ul><li>First item</li><li>Second item</li></ul><blockquote><p>Quoted text</p></blockquote><pre><code>const task = 1</code></pre>'
for (const width of [1440, 390]) test(`finite visual review groups ${width}`, async ({authenticatedPage: page, currentUser, apiContext}, info) => {
 test.setTimeout(120000)
 await page.setViewportSize({width, height:900}); await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
 async function capture(name:string) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {await document.fonts.ready; await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))})
  await page.mouse.move(0,0)
  await page.screenshot({path:info.outputPath(name+'.png'), animations:'disabled', fullPage:true})
  await info.attach(name+'-geometry',{body:JSON.stringify(await page.locator('h1, .details, .description, .subtitle, .project-header, .task-view .columns, .detail-title, .native-task-membership, .multiselect, .list-view__add-task, .content, .app-content').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {cls:el.className,tag:el.tagName,first:el.matches(':first-child'),x:r.x,y:r.y,w:r.width,h:r.height,mt:s.marginTop,mb:s.marginBottom,pt:s.paddingTop,pb:s.paddingBottom}})),null,2),contentType:'application/json'})
  const selectors = '.navbar,.project-title-wrapper,.navbar .project-title,.navbar .project-title-button,.tasks .single-task,.single-task .favorite,.single-task .handle,.single-task > .progress-bar,.tasktext,.tasktext > span,.task-project,.priority-label,.task-glance-trigger,.dueDate,.assignees-list,.assignees-list .user,.assignees-list .username,.avatar-wrapper,.kanban-bucket-container,.bucket,.bucket-header,.bucket .tasks,.kanban .task,.kanban .task .p-2,.kanban .task .p-2 > div,.kanban .task-id,.kanban h3,.task-progress,.kanban .footer,.label-wrapper,.label-wrapper .tag,.task-view h1,.task-view .heading,.task-view .details,.tiptap__editor-actions'
  await info.attach(name+'-styles',{body:JSON.stringify(await page.locator(selectors).evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {cls:el.className,tag:el.tagName,text:el.textContent?.slice(0,70),x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,font:s.fontSize,line:s.lineHeight,weight:s.fontWeight,mt:s.marginTop,mb:s.marginBottom,ml:s.marginLeft,mr:s.marginRight,pt:s.paddingTop,pb:s.paddingBottom,pl:s.paddingLeft,pr:s.paddingRight,gap:s.gap,align:s.alignItems,vertical:s.verticalAlign,overflow:s.overflow}})),null,2),contentType:'application/json'})

 }
 await page.goto('/'); await expect(page.locator('.content')).toBeVisible(); await expect(page.getByRole('heading',{name:'Current Tasks',exact:true})).not.toBeVisible(); await capture('home-empty')
 await page.goto('/projects'); await capture('directory-empty')
 await ProjectFactory.create(2,{title:id=>id===1?'Parity project':'Destination',description:'<p>Project description</p>',owner_id:currentUser.id,created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
 await createDefaultViews(1); await createDefaultViews(2,5)
 await TaskFactory.create(3,{title:id=>'Parity task '+id,description:rich,priority:2,percent_done:0.5,hex_color:'1973ff',due_date:'2026-10-06T12:00:00Z',created_by_id:currentUser.id,created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
 await LabelFactory.create(1,{title:'Review label',hex_color:'e64980',created_by_id:currentUser.id})
 await LabelTaskFactory.create(1,{task_id:1,label_id:1}); await TaskAssigneeFactory.create(1,{task_id:1,user_id:currentUser.id})
 await TaskCommentFactory.create(1,{task_id:1,author_id:currentUser.id,comment:rich,created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'})
 await BucketFactory.create(2,{title:id=>id===1?'Backlog':'Doing',project_view_id:4,limit:id=>id===1?2:0,position:id=>id*65536})
 await TaskBucketFactory.create(3,{task_id:id=>id,bucket_id:id=>id<=2?1:2,project_view_id:4})
 for(const [name,path] of [['home-populated','/'],['directory-populated','/projects'],['kanban-rich-limited','/projects/1/4'],['task-reader','/tasks/1']]) {
  await page.goto(path); await expect(page.locator('body')).toContainText('Parity project'); await capture(name)
  if (name === 'home-populated') {
   await expect(page.locator('.single-task .handle')).toHaveCount(0)
   await expect(page.locator('.tasks > li')).toHaveCount(3)
   if (width === 390) expect((await page.locator('.tasktext').first().boundingBox())!.width).toBe(286.21875)
  }
  if (name === 'kanban-rich-limited') {
   const card = page.locator('.bucket[data-bucket-id="1"] .task').first()
   await expect(card.locator('.label-wrapper')).toHaveCSS('display', 'flex')
   await expect(card.locator('.label-wrapper')).toHaveCSS('gap', '4px')
   await expect(card.locator('.assignees-list .user')).toHaveCSS('display', 'flex')
   expect((await card.locator('.assignees-list').boundingBox())!.height).toBe(24)
   await expect(page.locator('.bucket[data-bucket-id="1"] .tasks > .bucket-footer')).toHaveCount(1)
  }
 }
 await expect(page.locator('.task-view .created')).toContainText('by migration-reviewer')
 await page.locator('.tiptap__task-description').getByRole('button',{name:'Edit',exact:true}).click(); await expect(page.locator('.tiptap__task-description .ProseMirror')).toHaveAttribute('contenteditable','true'); await capture('task-editor')
 await page.goto('/tasks/1'); await page.locator('#comment-1').getByRole('button',{name:'Edit',exact:true}).click(); await expect(page.locator('#comment-1 .ProseMirror')).toHaveAttribute('contenteditable','true'); await capture('comment-editor')
 await page.goto('/projects/1/4'); await page.getByRole('link',{name:'Parity task 1',exact:true}).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('modal-reader')
 await page.locator('.tiptap__task-description').getByRole('button',{name:'Edit',exact:true}).click(); await capture('modal-editor')
 await page.goto('/projects/1/4'); const bucket=page.locator('.bucket[data-bucket-id="1"]'); await bucket.getByRole('button',{name:'Bucket options',exact:true}).click(); await bucket.getByRole('button',{name:'Collapse this bucket',exact:true}).click(); await expect(bucket).toHaveClass(/is-collapsed/); await capture('kanban-collapsed')
 await page.goto('/projects/1/1'); await expect(page.locator('body')).toContainText('Parity task 1'); await capture('frame-light')
 await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveClass(/dark/); await capture('frame-dark')
 const headers = {Authorization: `Bearer ${await page.evaluate(()=>localStorage.getItem('token'))}`}
 const user = await (await apiContext.get('user',{headers})).json()
 expect((await apiContext.post('user/settings/general',{headers,data:{...user.settings,language:'ar-SA'}})).ok()).toBe(true)
 await page.reload(); await expect(page.locator('html')).toHaveAttribute('dir','rtl'); await capture('frame-dark-rtl')
 await page.emulateMedia({colorScheme:'light'}); await capture('frame-light-rtl')
})
