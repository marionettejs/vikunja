import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for (const context of ['fresh', 'prior-project'] as const) for (const command of ['New task', 'New project'] as const)
 test(`quick creation ${command} retains ${context} task context`, async ({authenticatedPage: page, apiContext, userToken}, info) => {
 const headers = {Authorization: 'Bearer ' + userToken}
 await ProjectFactory.create(1, {title: 'Default and prior project'}); await createDefaultViews(1)
 await ProjectFactory.create(1, {id: 2, title: 'Loaded task project'}, false); await createDefaultViews(2, 5)
 await TaskFactory.create(1, {title: 'Prior project task'})
 await TaskFactory.create(1, {id: 2, title: 'Cross project target task', project_id: 2}, false)
 const user = await apiContext.get('user', {headers}); expect(user.ok()).toBe(true)
 const settings = (await user.json()).settings
 expect((await apiContext.post('user/settings/general', {headers, data: {...settings, default_project_id: 1}})).ok()).toBe(true)
 await page.goto(context === 'fresh' ? '/tasks/2' : '/projects/1/1')
 const open = async () => {
  await page.getByRole('button', {name: 'Open the search/quick action bar', exact: true}).click()
  const dialog = page.getByRole('dialog'); return {dialog, input: dialog.locator('input').first()}
 }
 if (context === 'prior-project') {
  const {dialog, input} = await open(); await input.pressSequentially('Cross project target task')
  await dialog.getByRole('button').filter({hasText: 'Cross project target task'}).first().click()
  await expect(dialog).toHaveCount(0)
 }
 await expect(page.locator('.task-view h1.title')).toHaveText('Cross project target task')
 const legacySingleTask = info.project.name.startsWith('vue-')
 const before = page.url(), {dialog, input} = await open()
 await input.press('ControlOrMeta+A')
 const searchSettled = page.waitForResponse(response => response.request().method() === 'GET' && /\/tasks$/.test(new URL(response.url()).pathname) && new URL(response.url()).searchParams.get('s') === command)
 await input.pressSequentially(command); await searchSettled
 await expect(input).not.toHaveClass(/is-loading/)
 await dialog.getByRole('button', {name: new RegExp('^' + command)}).click()
 const title = command + ' from ' + context
 await expect(input).toHaveValue('')
 await input.pressSequentially(title)
 await expect(input).toHaveValue(title)
 const saved = page.waitForResponse(response => response.request().method() === (command === 'New task' && !legacySingleTask ? 'POST' : 'PUT') && (command === 'New task' ? legacySingleTask ? /\/api\/v1\/projects\/\d+\/tasks$/ : /\/api\/v2\/projects\/\d+\/tasks\/bulk$/ : /\/api\/v1\/projects$/).test(new URL(response.url()).pathname))
 await input.press('Enter'); const response = await saved; expect(response.ok()).toBe(true)
 const data = await response.json()
 await expect(dialog).toHaveCount(0)
 if (command === 'New task') {
  expect.soft(new URL(response.url()).pathname).toBe(legacySingleTask ? '/api/v1/projects/1/tasks' : '/api/v2/projects/1/tasks/bulk')
  const id = legacySingleTask ? data.id : data.tasks[0].id
  await expect(page).toHaveURL(new RegExp('/tasks/' + id + '$'))
  const stored = await apiContext.get('tasks/' + id, {headers}); expect(stored.ok()).toBe(true)
  expect.soft(await stored.json()).toMatchObject({title, project_id: 1})
 } else {
  expect.soft(data).toMatchObject({title, parent_project_id: context === 'fresh' ? 0 : 1})
  await expect(page).toHaveURL(new RegExp('/projects/' + data.id + '(?:/|$)'))
  const stored = await apiContext.get('projects/' + data.id, {headers}); expect(stored.ok()).toBe(true)
  expect.soft(await stored.json()).toMatchObject({title, parent_project_id: context === 'fresh' ? 0 : 1})
 }
 await info.attach('quick-creation-api', {body: JSON.stringify({context, command, before, after: page.url(), path: new URL(response.url()).pathname, payload: response.request().postDataJSON(), response: data}, null, 2), contentType: 'application/json'})
})
