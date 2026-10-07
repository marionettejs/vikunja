import {test,expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for(const width of [1440,390]) test('accepted sibling publication preserves editor node focus and keyboard selection '+width,async({authenticatedPage:page,currentUser},info)=>{
 await ProjectFactory.create(1,{title:'Publication contract'});await createDefaultViews(1);await TaskFactory.create(1,{title:'Publication task'});await TaskCommentFactory.create(1,{id:1,task_id:1,author_id:currentUser.id,comment:'<p>Original comment</p>'});await page.setViewportSize({width,height:900});await page.goto('/tasks/1')
 const rows=page.locator('.comments .media.comment[id^=comment]'),row=page.locator('#comment-1'),editor=row.locator('.ProseMirror');let siblingId=0,release!:()=>void,seen!:()=>void
 const gate=new Promise<void>(done=>{release=done}),requested=new Promise<void>(done=>{seen=done})
 await page.route('**/api/v1/tasks/1/comments',async route=>{if(route.request().method()!=='PUT')return route.continue();const response=await route.fetch();siblingId=(await response.json()).id;seen();await gate;await route.fulfill({response})})
 try{
  await page.locator('.comments .media.comment:not([id]) .ProseMirror').fill('Accepted sibling');await page.getByRole('button',{name:'Comment',exact:true}).click();await requested
  await row.getByRole('button',{name:'Edit',exact:true}).click();await editor.press('ControlOrMeta+A');await expect(editor).toBeFocused();await expect.poll(()=>page.evaluate(()=>getSelection()?.toString())).toBe('Original comment')
  await editor.evaluate(element=>Object.assign(window,{selectedEditorNode:element}));release();await expect(rows).toHaveCount(2);await expect(page.locator('#comment-'+siblingId)).toContainText('Accepted sibling');await expect(editor).toBeFocused();expect(await editor.evaluate(element=>element===(window as unknown as {selectedEditorNode:Element}).selectedEditorNode)).toBe(true);expect(await page.evaluate(()=>getSelection()?.toString())).toBe('Original comment')
  await editor.pressSequentially('After publication');await expect(editor).toHaveText('After publication');const saved=page.waitForResponse(r=>r.request().method()==='POST'&&/\/comments\/1$/.test(new URL(r.url()).pathname));await row.getByRole('button',{name:'Save',exact:true}).click();expect((await saved).request().postDataJSON().comment).toBe('<p>After publication</p>');await page.reload();await expect(row.locator('.ProseMirror')).toHaveText('After publication');await info.attach('publication-contract',{body:JSON.stringify({width,nodeRetained:true,focusRetained:true,selectionRetained:true,payload:'<p>After publication</p>'}),contentType:'application/json'})
 }finally{release()}
})
