import {test,expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {SavedFilterFactory} from '../../frontend/tests/factories/saved_filter'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
const bucket=(page:import('@playwright/test').Page,id:number)=>page.locator(`.kanban .bucket[data-bucket-id="${id}"]`)
const cards=(page:import('@playwright/test').Page,id:number)=>bucket(page,id).locator('.kanban-card__title-link')
const api=(response:import('@playwright/test').Response,path:RegExp,method:string)=>path.test(new URL(response.url()).pathname)&&response.request().method()===method
async function options(page:import('@playwright/test').Page,id:number){await bucket(page,id).getByRole('button',{name:'Bucket options',exact:true}).click()}
test.beforeEach(async()=>{await ProjectFactory.create(1,{title:'Board parity'});await createDefaultViews(1);await BucketFactory.create(2,{title:id=>id===1?'Backlog':'Doing',project_view_id:4,position:id=>id*65536});await TaskFactory.create(6,{title:id=>`Card ${id}`,description:'<p>Card description</p>'});await TaskBucketFactory.create(6,{task_id:id=>id,bucket_id:id=>id<=3?1:2,project_view_id:4});await Factory.seed('task_positions',Array.from({length:6},(_,i)=>({task_id:i+1,project_view_id:4,position:(i+1)*65536})))})
for(const width of [1440,390])test(`board card modal edit and close retain board at ${width}`,async({authenticatedPage:page},info)=>{await page.setViewportSize({width,height:900});await page.goto('/projects/1/4?s=Card');await expect(cards(page,1)).toHaveCount(3);const original=await page.locator('.kanban').elementHandle();await page.screenshot({path:info.outputPath('kanban.png'),animations:'disabled'});await cards(page,1).first().click();await expect(page.getByRole('dialog')).toBeVisible();const title=page.locator('.task-view h1');await title.click();await title.fill('Renamed card');const saved=page.waitForResponse(response=>api(response,/\/api\/v1\/tasks\/1$/,'POST'));await title.press('Enter');expect((await saved).request().postDataJSON().title).toBe('Renamed card');await page.getByRole('button',{name:width===390?'Close task detail':'Close dialog',exact:true}).last().click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page).toHaveURL(/\/projects\/1\/4\?s=Card$/);expect(await page.locator('.kanban').evaluate((node,previous)=>node===previous,original)).toBe(true);await expect(cards(page,1).first()).toHaveText('Renamed card');await page.goto('/projects/1/4');await expect(cards(page,1).first()).toHaveText('Renamed card')})
test('create bucket and task, rename bucket, and reload persist real payloads',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await page.getByRole('button',{name:'Create a bucket',exact:true}).click();const input=page.getByPlaceholder('Enter the new bucket title…');await input.fill('Review');const created=page.waitForResponse(response=>api(response,/\/views\/4\/buckets$/,'PUT'));await input.press('Enter');expect((await created).request().postDataJSON().title).toBe('Review');const review=page.locator('.kanban .bucket').filter({has:page.locator('h2',{hasText:'Review'})});await review.getByRole('button',{name:'Add a task',exact:true}).click();const entry=review.getByPlaceholder('Enter the new task title…');await entry.fill('New board task !3');const written=page.waitForResponse(response=>response.request().method()==='PUT'&&/\/api\/v1\/projects\/1\/tasks$/.test(new URL(response.url()).pathname)||response.request().method()==='POST'&&/\/api\/v2\/projects\/1\/tasks\/bulk$/.test(new URL(response.url()).pathname));await entry.press('Enter');expect((await written).ok()).toBe(true);await expect(review.getByRole('link',{name:'New board task'})).toBeVisible();const heading=review.locator('h2');await heading.click();await heading.fill('Reviewed');const renamed=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/\d+$/,'POST'));await heading.press('Enter');expect((await renamed).request().postDataJSON().title).toBe('Reviewed');await page.reload();await expect(page.locator('.kanban .bucket').filter({hasText:'Reviewed'}).getByRole('link',{name:'New board task'})).toBeVisible()})
test('bucket limit and collapse persist, block create and target drop, permit source reorder',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await options(page,1);await bucket(page,1).getByRole('button',{name:'Limit: Not set',exact:true}).click();const limit=bucket(page,1).locator('.options input');await limit.fill('3');const saved=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/1$/,'POST'));await bucket(page,1).getByRole('button',{name:'Save',exact:true}).click();expect((await saved).request().postDataJSON().limit).toBe(3);await expect(bucket(page,1).locator('.limit')).toHaveText('3/3');await expect(bucket(page,1).getByRole('button',{name:'Add another task',exact:true})).toBeDisabled();await bucket(page,2).locator('.task').first().dragTo(bucket(page,1).locator('.tasks'));await expect(cards(page,1)).toHaveCount(3);await expect(cards(page,2)).toHaveCount(3);await options(page,1);await bucket(page,1).getByRole('button',{name:'Collapse this bucket',exact:true}).click();await expect(bucket(page,1)).toHaveClass(/is-collapsed/);await page.reload();await expect(bucket(page,1)).toHaveClass(/is-collapsed/);await bucket(page,1).locator('h2').click();await expect(bucket(page,1)).not.toHaveClass(/is-collapsed/)})
test('card move and reorder plus bucket reorder survive reload',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);const moved=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/2\/tasks$/,'POST'));await bucket(page,1).locator('.task').first().dragTo(bucket(page,2).locator('.tasks'));expect((await moved).request().postDataJSON().task_id).toBe(1);await expect(cards(page,2)).toHaveCount(4);await expect(cards(page,1)).toHaveCount(2);const position=page.waitForResponse(response=>api(response,/\/tasks\/\d+\/position$/,'POST'));await bucket(page,1).locator('.task').last().dragTo(bucket(page,1).locator('.task').first(),{targetPosition:{x:20,y:2}});expect((await position).ok()).toBe(true);await expect(cards(page,1).first()).toHaveText('Card 3');const reordered=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/2$/,'POST'));await bucket(page,2).locator('h2').dragTo(bucket(page,1).locator('h2'),{targetPosition:{x:2,y:10}});expect((await reordered).ok()).toBe(true);await expect(page.locator('.kanban .bucket[data-bucket-id]').first()).toHaveAttribute('data-bucket-id','2');await page.reload();await expect(cards(page,2)).toHaveCount(4);await expect(cards(page,1).first()).toHaveText('Card 3');await expect(page.locator('.kanban .bucket[data-bucket-id]').first()).toHaveAttribute('data-bucket-id','2')})
test('done/default bucket options and task completion use backend behavior',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await options(page,2);const done=page.waitForResponse(response=>api(response,/\/projects\/1\/views\/4$/,'POST'));await bucket(page,2).getByRole('button',{name:'Done bucket',exact:true}).click();expect((await done).request().postDataJSON().done_bucket_id).toBe(2);await options(page,1);const def=page.waitForResponse(response=>api(response,/\/projects\/1\/views\/4$/,'POST'));await bucket(page,1).getByRole('button',{name:'Default bucket',exact:true}).click();expect((await def).request().postDataJSON().default_bucket_id).toBe(1);const updated=page.waitForResponse(response=>api(response,/\/api\/v1\/tasks\/1$/,'POST'));await bucket(page,1).locator('.task').first().click({modifiers:['Control']});expect((await updated).request().postDataJSON().done).toBe(true);await expect(bucket(page,2).getByRole('link',{name:'Card 1',exact:true})).toBeVisible();await page.reload();await expect(bucket(page,2).getByRole('link',{name:'Card 1',exact:true})).toBeVisible()})
test('delete confirmation moves cards and protects the last bucket',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await options(page,2);await bucket(page,2).getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(cards(page,2)).toHaveCount(3);await options(page,2);await bucket(page,2).getByRole('button',{name:'Delete',exact:true}).click();const deleted=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/2$/,'DELETE'));await page.getByRole('dialog').getByRole('button',{name:'Do it!',exact:true}).click();expect((await deleted).ok()).toBe(true);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(bucket(page,2)).toHaveCount(0);await expect(cards(page,1)).toHaveCount(6);await page.reload();await expect(cards(page,1)).toHaveCount(6);await options(page,1);await expect(bucket(page,1).locator('.dropdown-item').filter({hasText:'Delete'})).toHaveClass(/is-disabled/)})
test('failed bucket title save reports error and retries without changing persisted state',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await page.route('**/api/v1/projects/1/views/4/buckets/1',route=>route.request().method()==='POST'?route.fulfill({status:500,contentType:'application/json',body:'{"message":"Fixture bucket rejection"}'}):route.continue());const title=bucket(page,1).locator('h2');await title.click();await title.fill('Rejected title');await title.press('Enter');await expect(page.locator('.vue-notification.error')).toContainText('Fixture bucket rejection');await page.reload();await expect(title).toHaveText('Backlog');await page.unroute('**/api/v1/projects/1/views/4/buckets/1');await title.click();await title.fill('Retried title');const retry=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/1$/,'POST'));await title.press('Enter');expect((await retry).ok()).toBe(true);await page.reload();await expect(title).toHaveText('Retried title')})
test('search/filter loading replaces stale results and retains filter control',async({authenticatedPage:page})=>{let seen!:()=>void;const pending=new Promise<void>(resolve=>{seen=resolve});let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});await page.route('**/api/v1/projects/1/views/4/tasks?**',async route=>{if(new URL(route.request().url()).searchParams.get('s')==='Card 1'){seen();await gate};await route.continue().catch(()=>{})});await page.goto('/projects/1/4?s=Card%201');await pending;await page.evaluate(()=>{history.pushState({},'','/projects/1/4?s=Card%202');window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}))});await expect(cards(page,1)).toHaveCount(1);await expect(cards(page,1)).toHaveText('Card 2');release();await expect(cards(page,1)).toHaveText('Card 2');await page.reload();await expect(cards(page,1)).toHaveText('Card 2')})
test('pending drag write cancelled by navigation cannot publish into the next view',async({authenticatedPage:page})=>{let seen!:()=>void;const pending=new Promise<void>(resolve=>{seen=resolve});let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});await page.route('**/api/v1/tasks/*/position',async route=>{seen();await gate;await route.continue().catch(()=>{})});await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await bucket(page,1).locator('.task').first().dragTo(bucket(page,2).locator('.tasks'));await pending;await page.locator('.switch-view a[href="/projects/1/1"]').click();await expect(page.getByPlaceholder('Add a task…')).toBeVisible();release();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.kanban')).toHaveCount(0);await expect(page.locator('.vue-notification.success')).toHaveCount(0)})
test('per-bucket paging loads beyond first 25 without duplicates',async({authenticatedPage:page})=>{await TaskFactory.create(40,{title:id=>`Paged card ${id}`});await TaskBucketFactory.create(40,{task_id:id=>id,bucket_id:1,project_view_id:4});await Factory.seed('task_positions',Array.from({length:40},(_,i)=>({task_id:i+1,project_view_id:4,position:(i+1)*65536})));await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(25);await bucket(page,1).locator('.tasks').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'))});await expect(cards(page,1)).toHaveCount(40);expect(await cards(page,1).allTextContents()).toEqual(Array.from({length:40},(_,i)=>`Paged card ${i+1}`))})
test('read-only board exposes cards but no mutation controls or writes',async({authenticatedPage:page})=>{await page.route('**/api/v1/projects/1',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'x-max-permission':'0'}})});const writes:string[]=[];page.on('request',request=>{if(request.method()!=='GET'&&/\/api\/v1\/(projects\/1|tasks\/\d+)/.test(new URL(request.url()).pathname))writes.push(request.url())});await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await expect(page.getByRole('button',{name:'Bucket options',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Create a bucket',exact:true})).toHaveCount(0);await bucket(page,1).locator('h2').click();await expect(bucket(page,1).locator('h2')).not.toHaveAttribute('contenteditable','true');expect(writes).toEqual([])})

 test('bucket menu Escape closes and returns keyboard focus',async({authenticatedPage:page})=>{await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await options(page,1);const trigger=bucket(page,1).getByRole('button',{name:'Bucket options',exact:true});await expect(trigger).toHaveAttribute('aria-expanded','true');await trigger.press('Escape');await expect(trigger).toHaveAttribute('aria-expanded','false');await expect(trigger).toBeFocused()})
 test('card priority follows user threshold and hides on completed cards',async({authenticatedPage:page})=>{await TaskFactory.create(6,{title:id=>`Card ${id}`,priority:id=>id===1?1:3,done:id=>id===3});await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);const rows=bucket(page,1).locator('.task');await expect(rows.nth(0).locator('.priority-label')).toHaveCount(0);await expect(rows.nth(1).locator('.priority-label')).toContainText('High');await expect(rows.nth(2).locator('.priority-label')).toHaveCount(0)})

 test('failed drag position preserves persisted board and allows retry',async({authenticatedPage:page})=>{let fail=true;await page.route('**/api/v1/tasks/*/position',route=>fail?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Fixture drag failed'})}):route.continue());await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await bucket(page,1).locator('.task').first().dragTo(bucket(page,2).locator('.tasks'));await expect(page.locator('.vue-notification.error')).toContainText('Fixture drag failed');await expect(cards(page,1)).toHaveCount(3);await expect(cards(page,2)).toHaveCount(3);fail=false;const moved=page.waitForResponse(response=>api(response,/\/views\/4\/buckets\/2\/tasks$/,'POST'));await bucket(page,1).locator('.task').first().dragTo(bucket(page,2).locator('.tasks'));expect((await moved).ok()).toBe(true);await expect(cards(page,1)).toHaveCount(2);await expect(cards(page,2)).toHaveCount(4);await page.reload();await expect(cards(page,2)).toHaveCount(4)})
 test('saved-filter board displays cards without task creation or filter controls',async({authenticatedPage:page})=>{await SavedFilterFactory.create(1,{title:'Saved board'});await createDefaultViews(-2,5);await BucketFactory.create(2,{title:id=>id===1?'Backlog':'Doing',project_view_id:8});await TaskBucketFactory.create(6,{task_id:id=>id,bucket_id:id=>id<=3?1:2,project_view_id:8});await page.goto('/projects/-2/8');await expect(cards(page,1)).toHaveCount(3);await expect(page.getByRole('button',{name:'Add another task',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Filters',exact:true})).toHaveCount(0)})


test('sidebar drag moves a card to a real project and persists after reload', async ({authenticatedPage: page}) => {
	await ProjectFactory.create(1, {id: 2, title: 'Destination project'}, false)
	await createDefaultViews(2, 5)
	await page.goto('/projects/1/4')
	await expect(cards(page, 1)).toHaveCount(3)
	const destination = page.locator('.menu-container [data-project-id="2"] a[href="/projects/2"]')
	await expect(destination).toBeVisible()
	const saved = page.waitForResponse(response => api(response, /\/api\/v1\/tasks\/1$/, 'POST'))
	const sourceBox = await bucket(page, 1).locator('.task').first().boundingBox()
	const destinationBox = await destination.boundingBox()
	expect(sourceBox).not.toBeNull()
	expect(destinationBox).not.toBeNull()
	await page.mouse.move(sourceBox!.x + 20, sourceBox!.y + 20)
	await page.mouse.down()
	await page.mouse.move(sourceBox!.x + 30, sourceBox!.y + 30, {steps: 5})
	await page.mouse.move(destinationBox!.x + destinationBox!.width / 2, destinationBox!.y + destinationBox!.height / 2, {steps: 15})
	const target = destination.locator('xpath=ancestor::li[@data-project-id="2"]')
	await expect(target).toHaveClass(/is-drop-target/)
	await page.screenshot({path: test.info().outputPath('sidebar-task-drag.png')})
	await page.mouse.move(600, 80, {steps: 10})
	await page.mouse.move(601, 80)
	await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
	await page.mouse.move(destinationBox!.x + destinationBox!.width / 2, destinationBox!.y + destinationBox!.height / 2, {steps: 10})
	await page.mouse.move(destinationBox!.x + destinationBox!.width / 2 + 1, destinationBox!.y + destinationBox!.height / 2)
	await expect(target).toHaveClass(/is-drop-target/)
	await page.mouse.up()
	await expect(page.locator('.menu-container .is-drop-target')).toHaveCount(0)
	const response = await saved
	expect(response.ok()).toBe(true)
	expect(response.request().postDataJSON().project_id).toBe(2)
	await expect(cards(page, 1)).toHaveCount(2)
	await page.reload()
	await expect(cards(page, 1)).toHaveCount(2)
	await destination.click()
	await expect(page.locator('ul.tasks .task-link')).toContainText(['Card 1'])
})

test('recurring task dropped in the done bucket keeps its source and advances dates', async ({authenticatedPage: page}) => {
	await TaskFactory.create(6, {title: id => id === 1 ? 'Recurring card' : `Card ${id}`, repeat_after: id => id === 1 ? 86400 : 0, repeat_mode: 0, due_date: id => id === 1 ? '2026-01-01T12:00:00Z' : null})
	await page.goto('/projects/1/4')
	await expect(cards(page, 1)).toHaveCount(3)
	await options(page, 2)
	const configured = page.waitForResponse(response => api(response, /\/projects\/1\/views\/4$/, 'POST'))
	await bucket(page, 2).getByRole('button', {name: 'Done bucket', exact: true}).click()
	expect((await configured).ok()).toBe(true)
	const moved = page.waitForResponse(response => api(response, /\/views\/4\/buckets\/2\/tasks$/, 'POST'))
	await bucket(page, 1).locator('.task').filter({hasText: 'Recurring card'}).dragTo(bucket(page, 2).locator('.tasks'))
	const result = await (await moved).json()
	expect(result.bucket_id).toBe(1)
	expect(result.task.done).toBe(false)
	expect(Date.parse(result.task.due_date)).toBeGreaterThan(Date.parse('2026-01-01T12:00:00Z'))
	await expect(cards(page, 1)).toHaveCount(3)
	await expect(cards(page, 2)).toHaveCount(3)
	await page.reload()
	await expect(bucket(page, 1).getByRole('link', {name: 'Recurring card', exact: true})).toBeVisible()
})

test('bucket transport failure restores persisted cards and permits drag retry', async ({authenticatedPage: page}) => {
	let fail = true
	await page.route('**/api/v1/projects/1/views/4/buckets/2/tasks', route => route.request().method() === 'POST' && fail
		? route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture bucket write failed'})})
		: route.continue())
	await page.goto('/projects/1/4')
	await expect(cards(page, 1)).toHaveCount(3)
	await bucket(page, 1).locator('.task').first().dragTo(bucket(page, 2).locator('.tasks'))
	await expect(page.locator('.vue-notification.error')).toContainText('Fixture bucket write failed')
	await expect(cards(page, 1)).toHaveCount(3)
	await expect(cards(page, 2)).toHaveCount(3)
	fail = false
	const saved = page.waitForResponse(response => api(response, /\/views\/4\/buckets\/2\/tasks$/, 'POST'))
	await bucket(page, 1).locator('.task').first().dragTo(bucket(page, 2).locator('.tasks'))
	expect((await saved).ok()).toBe(true)
	await expect(cards(page, 1)).toHaveCount(2)
	await expect(cards(page, 2)).toHaveCount(4)
	await page.reload()
	await expect(cards(page, 2)).toHaveCount(4)
})

test('navigation during new label creation cancels originating board task without targeting next project',async({authenticatedPage:page,apiContext})=>{
 await ProjectFactory.create(1,{id:2,title:'Next project'},false);await createDefaultViews(2,5)
 let release!:()=>void,ready!:()=>void,finished!:()=>void
 const gate=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>ready=resolve),done=new Promise<void>(resolve=>finished=resolve)
 await page.route('**/api/v2/labels',async route=>{if(route.request().method()!=='POST'){await route.continue();return}const response=await route.fetch();ready();await gate;await route.fulfill({response}).catch(()=>{});finished()})
 const creates:string[]=[];page.on('request',request=>{if(['POST','PUT'].includes(request.method())&&/\/api\/(?:v2\/projects\/\d+\/tasks\/bulk|v1\/projects\/\d+\/tasks)$/.test(new URL(request.url()).pathname))creates.push(request.url())})
 await page.goto('/projects/1/4');await expect(cards(page,1)).toHaveCount(3);await bucket(page,1).getByRole('button',{name:'Add another task',exact:true}).click();const entry=bucket(page,1).getByPlaceholder('Enter the new task title…');await entry.fill('Canceled label task *newcancel');await entry.press('Enter');await started
 await page.locator('.menu-container a[href="/projects/2"]').click();await expect(page.getByPlaceholder('Add a task…')).toBeVisible();await expect(page).toHaveURL(/\/projects\/2\/5$/);release();await done;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect(creates).toEqual([])
 const response=await apiContext.get('tasks',{headers:{Authorization:`Bearer ${await page.evaluate(()=>localStorage.getItem('token'))}`},params:{s:'Canceled label task'}});expect(response.ok()).toBe(true);expect(await response.json()).toEqual([]);await expect(page.locator('.vue-notification.success')).toHaveCount(0)
})
