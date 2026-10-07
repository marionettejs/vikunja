import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {ProjectViewFactory} from '../../frontend/tests/factories/project_view'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {execFileSync} from 'node:child_process'
import {repositoryRoot} from './published-baseline'

// Diagnostic instrumented samples, deliberately separate from the untraced
// n20 benchmark. Attribute network/import/CPU/publication rather than infer a
// regression's cause from wall-clock elapsed alone.
test('published and current task search causal profiles', async ({browser, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Benchmark project'})
 await ProjectViewFactory.create(4, {project_id: 1, title: (id: number) => ['List', 'Gantt', 'Table', 'Kanban'][id - 1], view_kind: (id: number) => id - 1})
 await TaskFactory.create(50, {title: (id: number) => `Bench task ${String(id).padStart(4, '0')}`, description: (id: number) => id === 1 ? '<p>' + 'Rich benchmark content. '.repeat(450) + '</p>' : ''})
 await TaskCommentFactory.create(50, {task_id: 1, author_id: currentUser.id, comment: (id: number) => `Benchmark comment ${id}`})
 const source = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repositoryRoot, encoding: 'utf8'}).trim()
 const samples: unknown[] = [], apps = [{name: 'current', baseURL: process.env.BASE_URL!}, {name: 'published', baseURL: 'http://127.0.0.1:4470'}]
 for (let iteration = -1; iteration < 6; iteration++) for (const app of iteration % 2 ? [...apps].reverse() : apps) {
  const context = await browser.newContext({baseURL: app.baseURL, viewport: {width: 1440, height: 900}, locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block'})
  try {
   const login = await context.request.post(process.env.API_URL!.replace(/\/$/, '') + '/login', {data: {username: currentUser.username, password: TEST_PASSWORD}}); expect(login.ok()).toBe(true)
   const {token} = await login.json()
   await context.addInitScript(({token, api}) => {localStorage.setItem('token', token); localStorage.setItem('API_URL', api); Object.assign(window, {API_URL: api})}, {token, api: process.env.API_URL!})
   const page = await context.newPage(), cdp = await context.newCDPSession(page), apiErrors: {path: string, status: number}[] = []
   page.on('response', response => {if (response.url().includes('/api/') && response.status() >= 400) apiErrors.push({path: new URL(response.url()).pathname, status: response.status()})})
   await cdp.send('Performance.enable'); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 1000})
   await page.goto('/projects/1/1?sort=title:asc'); await expect(page.locator('.tasks .task-link')).toHaveCount(50); await page.evaluate(() => document.fonts.ready)
   async function profile(phase: string, action: () => Promise<void>) {
    await page.evaluate(() => {
     performance.clearResourceTimings()
     const origin = performance.now(), publications: {at: number, tasks: number, comments: number, results: number}[] = [], inputs: {at: number, value: string}[] = []
     const input = (event: Event) => {const target = event.target as HTMLInputElement; if (target.matches('.quick-actions input')) inputs.push({at: performance.now() - origin, value: target.value})}
     document.addEventListener('input', input, true)
     let previous = ''
     const observer = new MutationObserver(() => {
      const value = {at: performance.now() - origin, tasks: document.querySelectorAll('.task-view').length, comments: document.querySelectorAll('.comments .media.comment[id^=comment]').length, results: document.querySelectorAll('.quick-actions .result-item-button').length}
      const signature = `${value.tasks}:${value.comments}:${value.results}`
      if (signature !== previous) {previous = signature; publications.push(value)}
     })
     observer.observe(document.body, {childList: true, subtree: true, characterData: true})
     Object.assign(window, {causePublication: publications, causeInputs: inputs, causeStop: () => {observer.disconnect(); document.removeEventListener('input', input, true)}, causeOrigin: origin})
    })
    const before = await cdp.send('Performance.getMetrics'), start = performance.now()
    await cdp.send('Profiler.start')
    try {
     await action(); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    } finally {await page.evaluate(() => (window as unknown as {causeStop: () => void}).causeStop())}
    const elapsed = performance.now() - start, {profile: cpu} = await cdp.send('Profiler.stop'), after = await cdp.send('Performance.getMetrics')
    const browserEvidence = await page.evaluate(() => ({origin: (window as unknown as {causeOrigin: number}).causeOrigin, inputs: (window as unknown as {causeInputs: unknown[]}).causeInputs, publications: (window as unknown as {causePublication: unknown[]}).causePublication, resources: performance.getEntriesByType('resource').map(e => e.toJSON()), editorChrome: {toolbarButtons: document.querySelectorAll('[data-toolbar] button').length, visibleToolbarHosts: Array.from(document.querySelectorAll('[data-toolbar]')).filter(el => el.getBoundingClientRect().height > 0).length}}))
    const name = `${app.name}-${iteration}-${phase}`
    await info.attach(name + '-cpu', {body: JSON.stringify(cpu), contentType: 'application/json'})
    const sample = {app: app.name, iteration, phase, elapsed, before, after, ...browserEvidence, apiErrors: [...apiErrors]}
    samples.push(sample)
    await info.attach(name + '-metrics', {body: JSON.stringify(sample), contentType: 'application/json'})
    expect(apiErrors).toEqual([])
   }
   await profile('first-task', async () => {
    await page.locator('.tasks .task-link').first().click(); await expect(page.locator('.description .ProseMirror')).toContainText('Rich benchmark content.')
    await expect(page.locator('.comments .media.comment[id^=comment]')).toHaveCount(50)
   })
   await profile('search', async () => {
    await page.getByRole('button', {name: 'Open the search/quick action bar', exact: true}).click()
    const dialog = page.getByRole('dialog'); await dialog.locator('input').first().fill('Bench task 0001'); await dialog.locator('input').first().press('End')
    await expect(dialog.getByRole('button').filter({hasText: 'Bench task 0001'}).first()).toBeVisible()
    await page.keyboard.press('Escape')
   })
  } finally {await context.close()}
 }
 await info.attach('causal-samples', {body: JSON.stringify({source, frontend: execFileSync('git', ['rev-parse', 'HEAD:frontend'], {cwd: repositoryRoot, encoding: 'utf8'}).trim(), browser: browser.version(), warmups: 1, measured: 6, samples}, null, 2), contentType: 'application/json'})
})
