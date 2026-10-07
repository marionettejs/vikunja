import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test('description keyboard End retains end selection through immediate typing across repeated reloads', async ({authenticatedPage: page}, info) => {
 test.setTimeout(120000)
 await ProjectFactory.create(1,{title:'Selection fixture'}); await createDefaultViews(1)
 await TaskFactory.create(1,{description:'<p>Original description</p>'})
 await page.addInitScript(() => {
  const events: unknown[]=[]; Object.assign(window,{cursorEvents:events})
  for(const type of ['selectionchange','keydown','beforeinput','focusin'])document.addEventListener(type,event=>{
   const s=window.getSelection(); events.push({type,key:(event as KeyboardEvent).key,active:document.activeElement?.className,anchor:s?.anchorOffset,focus:s?.focusOffset,text:s?.anchorNode?.textContent,time:performance.now()})
  },true)
 })
 let text='Original description'
 try{
  for(let round=0;round<30;round++){
   await page.goto('/tasks/1'); const surface=page.locator('.tiptap__task-description'),editor=surface.locator('.ProseMirror')
   await expect(editor).toHaveText(text)
   await surface.getByRole('button',{name:'Edit',exact:true}).click()
   await editor.press('ControlOrMeta+End')
   const suffix=` round${round}`; await editor.pressSequentially(suffix)
   await expect(editor).toHaveText(text+suffix)
   const saved=page.waitForResponse(r=>/\/api\/v1\/tasks\/1$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST')
   await surface.getByRole('button',{name:'Save',exact:true}).click()
   expect((await saved).request().postDataJSON().description).toBe(`<p>${text+suffix}</p>`)
   text+=suffix
  }
 }finally{await info.attach('cursor-event-timeline',{body:JSON.stringify(await page.evaluate(()=> (window as unknown as {cursorEvents:unknown[]}).cursorEvents),null,2),contentType:'application/json'})}
})
