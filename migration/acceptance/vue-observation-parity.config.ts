import {resolve} from 'node:path'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import base from './playwright.config'
import {repositoryRoot} from './published-baseline'

const vueRoot = '/workspace/vikunja-vue-reference'
const vueBuild = process.env.OBSERVATION_VUE_BUILD || '/workspace/vikunja-evidence/publication-benchmark/vue-production'
const vueFrontend = execFileSync('git', ['rev-parse', 'HEAD:frontend'], {cwd: vueRoot, encoding: 'utf8'}).trim()
if (vueFrontend !== '7c15706aa02e31bd19448040c6b3f8c9da10ecc9') throw new Error('Frozen Vue frontend differs from official5d22 baseline')
const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, 'migration/benchmark/results-2026-10-06/bundle-vue.json'), 'utf8'))
for (const [name, asset] of Object.entries(manifest.files) as Array<[string, {sha256: string}]>) {
 if (createHash('sha256').update(readFileSync(resolve(vueBuild, name))).digest('hex') !== asset.sha256) throw new Error('Frozen Vue asset differs: ' + name)
}
const apps = [{name: 'vue', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette', baseURL: process.env.BASE_URL!}]
const project = (app: typeof apps[number], name: string, testMatch: string, grep?: RegExp) => ({...base.projects![0], name, testMatch: [testMatch], grep, use: {...base.projects![0].use, baseURL: app.baseURL}})
const projects = Array.from({length: 5}, (_, trial) => {
 const ordered = trial % 2 ? [...apps].reverse() : apps
 return ordered.map(app => project(app, `${app.name}-comment-trial-${trial + 1}`, 'task-comments.spec.ts', /comment replacement remains exact/))
}).flat()
projects.push(...apps.map(app => project(app, `${app.name}-webhook`, 'vue-webhook-observation.spec.ts')))
export default {
 ...base, retries: 0, workers: 1, timeout: 60000, testMatch: ['task-comments.spec.ts', 'vue-webhook-observation.spec.ts'], projects,
 metadata: {vueUpstream: '5d22d730aa35b0666d0849099c12a1e638baabc9', vueFrontend, vueBuild, vueBuildFilesVerified: Object.keys(manifest.files).length,
  marionette: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repositoryRoot, encoding: 'utf8'}).trim(), marionetteFrontend: execFileSync('git', ['rev-parse', 'HEAD:frontend'], {cwd: repositoryRoot, encoding: 'utf8'}).trim(), trials: 5, rounds: 12},
 webServer: {command: `${process.execPath} ${resolve(vueRoot, 'frontend/node_modules/vite/bin/vite.js')} preview --host 127.0.0.1 --port 4470 --strictPort --outDir ${vueBuild} --mode production`, cwd: resolve(vueRoot, 'frontend'), url: 'http://127.0.0.1:4470', reuseExistingServer: false},
 outputDir: resolve(import.meta.dirname, 'vue-observation-parity-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'vue-observation-parity-report.json')}]],
}
