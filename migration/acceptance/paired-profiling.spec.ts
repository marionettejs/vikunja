import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {performance} from 'node:perf_hooks'
import {mkdir, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {spawn, execFileSync} from 'node:child_process'
import {test, expect} from './fixtures'
import {ProjectViewFactory} from '../../frontend/tests/factories/project_view'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {Factory} from '../../frontend/tests/support/factory'
import type {Page, CDPSession} from '@playwright/test'

async function frame(page: Page) {await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))}
async function snapshot(cdp: CDPSession) {
 const metrics = await cdp.send('Performance.getMetrics')
 return {metrics: Object.fromEntries(metrics.metrics.map(m => [m.name, m.value])), dom: await cdp.send('Memory.getDOMCounters')}
}
for (const size of [50, 500]) test(`production profile dataset ${size}`, async ({browser, currentUser}, info) => {
 await ProjectFactory.create(1, {title: 'Benchmark project', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
 await ProjectViewFactory.create(4, {project_id: 1, title: id => ['List', 'Gantt', 'Table', 'Kanban'][id - 1], view_kind: id => id - 1, bucket_configuration_mode: id => id === 4 ? 1 : 0})
 const description = '<p>' + 'Rich benchmark content. '.repeat(450) + '</p>'
 await TaskFactory.create(size, {title: id => `Bench task ${String(id).padStart(4, '0')}`, description: id => id === 1 ? description : '', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
 await TaskCommentFactory.create(50, {task_id: 1, author_id: currentUser.id, comment: id => `Benchmark comment ${id}`, created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
 await Factory.seed('task_positions', [1, 4].flatMap(view => Array.from({length: size}, (_, i) => ({task_id: i + 1, project_view_id: view, position: (i + 1) * 65536}))))
 await BucketFactory.create(2, {project_view_id: 4, title: id => id === 1 ? 'Backlog' : 'Doing'})
 await TaskBucketFactory.create(size, {task_id: id => id, bucket_id: id => id % 2 ? 1 : 2, project_view_id: 4})
 const repositoryRoot = resolve(import.meta.dirname, '../..')
 const vueRoot = resolve(process.env.BENCHMARK_VUE_ROOT ?? resolve(repositoryRoot, '../vikunja-vue-reference'))
 const vueBuild = resolve(process.env.BENCHMARK_VUE_BUILD ?? resolve(vueRoot, 'frontend/dist'))
 const nativeSha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repositoryRoot, encoding: 'utf8'}).trim()
 const vueSha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: vueRoot, encoding: 'utf8'}).trim()
 if (vueSha !== '5d22d730aa35b0666d0849099c12a1e638baabc9') throw new Error('Vue reference must use the pinned upstream baseline')
 const retentionCycles = Number(process.env.BENCHMARK_RETENTION_CYCLES ?? 30)
 if (!Number.isInteger(retentionCycles) || retentionCycles < 30 || retentionCycles > 120) throw new Error('Retention cycles must be an integer from30to120')
 const apps = [{name: `native-${nativeSha.slice(0, 9)}`, base: process.env.BASE_URL!}, {name: 'vue-upstream', base: 'http://127.0.0.1:4470'}]
 let app = apps[0]
 const preview = spawn(process.execPath, [resolve(vueRoot, 'frontend/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4470', '--strictPort', '--outDir', vueBuild, '--mode', 'production'], {cwd: resolve(vueRoot, 'frontend'), stdio: ['ignore', 'pipe', 'pipe']})
 preview.stdout.on('data', data => process.stdout.write('VUE_PREVIEW: ' + data)); preview.stderr.on('data', data => process.stderr.write('VUE_PREVIEW: ' + data))
 const samples: unknown[] = [], requests: unknown[] = [], interactions: unknown[] = [], retention: unknown[] = [], heapSnapshots: unknown[] = []
 let phase = '', context: Awaited<ReturnType<typeof browser.newContext>> | undefined
 const result = {environment: {browser:browser.version(),node:process.version,platform:process.platform,viewport:{width:1440,height:900},deviceScaleFactor:1,headless:true,cpuThrottling:'none',networkThrottling:'none',vueBuild:vueBuild}, apps, source: {native: nativeSha, vue: '5d22d730aa35b0666d0849099c12a1e638baabc9'}, size, retentionCycles, gcSamplesPerCheckpoint: 3, warmups: 3, measured: 20, cache: 'Fresh context cold; document reload warm. Shared Chromium process, workers blocked.', correctness: '50 list rows and 50 Kanban cards, canonical task title, rich description and 50 comments asserted. Full feature/visual parity remains uncertified.', samples, requests, interactions, retention, heapSnapshots}
 async function open() {
  context = await browser.newContext({baseURL: app.base, viewport: {width: 1440, height: 900}, locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block'})
  const login = await context.request.post(process.env.API_URL!.replace('/api/v1/', '/api/v2/') + 'login', {data: {username: currentUser.username, password: TEST_PASSWORD}})
  if (!login.ok()) throw new Error('Real browser-context login failed: ' + login.status())
  const {token} = await login.json()
  await context.addInitScript(({token, api}) => {
   localStorage.setItem('token', token); localStorage.setItem('API_URL', api); Object.assign(window, {API_URL: api, benchmarkPaints: []})
   new PerformanceObserver(list => (window as unknown as {benchmarkPaints: unknown[]}).benchmarkPaints.push(...list.getEntries().map(e => ({name: e.name, type: e.entryType, start: e.startTime, duration: e.duration})))).observe({type: 'largest-contentful-paint', buffered: true})
  }, {token, api: process.env.API_URL!})
  const page = await context.newPage(), cdp = await context.newCDPSession(page)
  page.setDefaultTimeout(10000)
  await cdp.send('Performance.enable')
  page.on('response', response => {
   if (!response.url().includes('/api/')) return
   const current = phase, currentApp = app.name
   void response.body().then(body => {
    let cardinality: number | undefined
    try {const json = JSON.parse(body.toString()); if (Array.isArray(json)) cardinality = json.length} catch { /* Non-JSON bodies remain byte-counted. */ }
    requests.push({app: currentApp, phase: current, path: new URL(response.url()).pathname + new URL(response.url()).search, method: response.request().method(), status: response.status(), decodedBodyBytes: body.length, cardinality})
   }).catch(() => requests.push({app: currentApp, phase: current, path: new URL(response.url()).pathname, status: response.status(), bodyUnavailable: true}))
  })
  return {page, cdp}
 }
 async function listReady(page: Page) {await expect(page.locator('.tasks .task-link')).toHaveCount(50); await page.evaluate(() => document.fonts.ready); await frame(page)}
 try {
  for (let attempt = 0; attempt < 100; attempt++) {try {if ((await fetch(apps[1].base)).ok) break} catch {} if (attempt === 99) throw new Error('Vue production preview did not become ready'); await new Promise(resolve => setTimeout(resolve, 100))}
  for (let iteration = -3; iteration < 20; iteration++) for (const candidate of iteration % 2 ? [...apps].reverse() : apps) {
   app = candidate
   if (iteration % 5 === 0) console.log('PROFILE startup', size, app.name, iteration)
   const {page, cdp} = await open()
   phase = `cold:${iteration}`; await page.goto('/projects/1/1?sort=title:asc'); await listReady(page)
   samples.push({app: app.name, iteration, cache: 'cold', timing: await page.evaluate(() => ({ready: performance.now(), paints: performance.getEntriesByType('paint').map(e => ({name: e.name, start: e.startTime})), lcp: (window as unknown as {benchmarkPaints: unknown[]}).benchmarkPaints, navigation: performance.getEntriesByType('navigation').map(e => e.toJSON())})), counters: await snapshot(cdp)})
   phase = `warm:${iteration}`; await page.reload(); await listReady(page)
   samples.push({app: app.name, iteration, cache: 'warm', timing: await page.evaluate(() => ({ready: performance.now(), paints: performance.getEntriesByType('paint').map(e => ({name: e.name, start: e.startTime})), lcp: (window as unknown as {benchmarkPaints: unknown[]}).benchmarkPaints, navigation: performance.getEntriesByType('navigation').map(e => e.toJSON())})), counters: await snapshot(cdp)})
   await context!.close(); context = undefined
  }
  for (const candidate of apps) {
  app = candidate
  const {page, cdp} = await open()
  async function measure(name: string, action: () => Promise<void>, iteration: number) {
   phase = `${name}:${iteration}`; const start = performance.now(); await action(); await frame(page)
   interactions.push({app: app.name, name, iteration, elapsed: performance.now() - start, counters: await snapshot(cdp)})
  }
  for (let iteration = -3; iteration < 20; iteration++) {
   if (iteration % 5 === 0) console.log('PROFILE interactions', size, app.name, iteration)
   await page.goto('/projects/1/1?sort=title:asc'); await listReady(page)
   await measure('task-open', async () => {await page.locator('.tasks .task-link').first().click(); await expect(page.locator('.task-view')).toContainText('Bench task 0001'); await expect(page.locator('.description .ProseMirror')).toContainText('Rich benchmark content.'); await expect(page.locator('.comments .media.comment[id^=comment]')).toHaveCount(50)}, iteration)
   await measure('editor-enter-discard', async () => {const editor = page.locator('.description .ProseMirror'); await page.locator('.description').getByRole('button', {name: 'Edit', exact: true}).click(); await editor.press('ControlOrMeta+End'); await editor.pressSequentially(' temporary'); await editor.press('Escape'); await expect(editor).toHaveText(description.slice(3, -4))}, iteration)
   await measure('search-results', async () => {await page.getByRole('button', {name: 'Open the search/quick action bar', exact: true}).click(); const dialog = page.getByRole('dialog'); await dialog.locator('input').first().fill('Bench task 0001'); await dialog.locator('input').first().press('End'); await expect(dialog.getByRole('button').filter({hasText: 'Bench task 0001'}).first()).toBeVisible(); await page.keyboard.press('Escape')}, iteration)
   await measure('kanban-ready', async () => {await page.goto('/projects/1/4'); await expect(page.locator('.kanban .bucket[data-bucket-id]')).toHaveCount(2); await expect(page.locator('.kanban .task')).toHaveCount(50)}, iteration)
  }
  phase = 'retention'; await page.goto('/projects/1/1?sort=title:asc'); await listReady(page)
  async function cycle() {
   await page.locator('.switch-view a[href="/projects/1/4"]').click(); await expect(page.locator('.kanban .task')).toHaveCount(50)
   await page.locator('.kanban-card__title-link').filter({hasText: 'Bench task 0001'}).first().click()
   await expect(page.locator('.description .ProseMirror')).toContainText('Rich benchmark content.')
   await expect(page.locator('.comments .media.comment[id^=comment]')).toHaveCount(50)
   await page.keyboard.press('Escape'); await expect(page).toHaveURL(/projects\/1\/4/)
   await page.locator('.switch-view a[href="/projects/1/1"], .switch-view a[href^="/projects/1/1?"]').click(); await listReady(page)
  }
  for (let warmup = 0; warmup < 3; warmup++) await cycle()
  async function collect(cycle: number) {
   for (let gcSample = 1; gcSample <= 3; gcSample++) {await cdp.send('HeapProfiler.collectGarbage'); await frame(page); retention.push({app: app.name, cycle, gcSample, counters: await snapshot(cdp)})}
   if (process.env.BENCHMARK_HEAP_DIRECTORY && [0, 60, retentionCycles].includes(cycle)) {
    const chunks: string[] = [], receive = ({chunk}: {chunk: string}) => {chunks.push(chunk)}
    cdp.on('HeapProfiler.addHeapSnapshotChunk', receive)
    try {
     await cdp.send('HeapProfiler.takeHeapSnapshot', {reportProgress: false, captureNumericValue: true, exposeInternals: false})
     await mkdir(process.env.BENCHMARK_HEAP_DIRECTORY, {recursive: true})
     const path = join(process.env.BENCHMARK_HEAP_DIRECTORY, `${app.name}-${size}-${cycle}.heapsnapshot`)
     await writeFile(path, chunks.join(''), {mode: 0o600})
     heapSnapshots.push({app: app.name, cycle, path, protocol: 'Snapshot follows tripleGC/frame samples; sampling can alter later heap.'})
    } finally {cdp.off('HeapProfiler.addHeapSnapshotChunk', receive)}
   }
  }
  await collect(0)
  for (let count = 1; count <= retentionCycles; count++) {
   await cycle()
   if (count % 10 === 0) console.log('PROFILE retention', size, app.name, count)
   if (count % 10 === 0) await collect(count)
  }
  await context!.close(); context = undefined
  }
 } finally {
  preview.kill('SIGTERM')
  if (context) await context.close()
  await info.attach('profile-raw', {body: JSON.stringify(result, null, 2), contentType: 'application/json'})
 }
})
