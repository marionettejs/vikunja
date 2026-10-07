import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

for(const width of [1440,390]) for(const input of ['keyboard','clipboard','chromium-ime']) test(`real ${input} replacement contract ${width}`, async ({authenticatedPage:page,currentUser},info)=>{
 test.setTimeout(90000)
 await ProjectFactory.create(1,{title:'Input contract'});await createDefaultViews(1)
 await TaskFactory.create(1,{title:'Input task'});await TaskCommentFactory.create(1,{task_id:1,author_id:currentUser.id,comment:'<p>Original comment</p>'})
 await page.setViewportSize({width,height:900});await page.goto('/tasks/1')
 await page.context().grantPermissions(['clipboard-read','clipboard-write'])
 const row=page.locator('.comments .media.comment[id^=comment]').first(),editor=row.locator('.ProseMirror')
 const cdp=await page.context().newCDPSession(page)
 const evidence:unknown[]=[]
 const content=(text:string)=>input==='chromium-ime'?text+' 日本語':text
 const replace=async(text:string)=>{
  await editor.press('ControlOrMeta+A')
  if(input==='keyboard') await editor.pressSequentially(text)
  else if(input==='chromium-ime'){await cdp.send('Input.imeSetComposition',{text,selectionStart:0,selectionEnd:text.length});await cdp.send('Input.insertText',{text})}
  else {await page.evaluate(text=>navigator.clipboard.writeText(text),text);await editor.press('ControlOrMeta+V')}
  await expect(editor).toHaveText(text)
 }
 try {
  for(let round=0;round<20;round++){
   await row.getByRole('button',{name:'Edit',exact:true}).click();await replace(content('Discarded '+round));await editor.press('Escape')
   await row.getByRole('button',{name:'Edit',exact:true}).click();const text=content('Accepted '+round);await replace(text)
   const saved=page.waitForResponse(r=>/\/tasks\/1\/comments\/1$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST')
   await row.getByRole('button',{name:'Save',exact:true}).click();const response=await saved
   expect(response.ok()).toBe(true);expect(response.request().postDataJSON().comment).toBe('<p>'+text+'</p>');evidence.push({round,input,text,payload:response.request().postDataJSON().comment})
  }
  await page.reload();await expect(row.locator('.ProseMirror')).toHaveText(content('Accepted 19'))
 }finally {await info.attach('real-input-payloads',{body:JSON.stringify(evidence,null,2),contentType:'application/json'})}
})
