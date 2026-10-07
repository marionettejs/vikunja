import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import base from './playwright.config'
import {publishedBuild, repositoryRoot} from './published-baseline'

// Reuse the original exact 12-round assertions; alternate app order per trial.
const build = publishedBuild()
const native = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repositoryRoot, encoding: 'utf8'}).trim()
const frontend = execFileSync('git', ['rev-parse', 'HEAD:frontend'], {cwd: repositoryRoot, encoding: 'utf8'}).trim()
const projects = Array.from({length: 5}, (_, trial) => {
 const apps = [{name: 'published', baseURL: 'http://127.0.0.1:4470'}, {name: 'optimized', baseURL: process.env.BASE_URL!}]
 if (trial % 2) apps.reverse()
 return apps.map(app => ({...base.projects![0], name: `${app.name}-trial-${trial + 1}`, use: {...base.projects![0].use, baseURL: app.baseURL}}))
}).flat()
export default {
 ...base, retries: 0, workers: 1,
 testMatch: ['task-comments.spec.ts'], grep: /comment replacement remains exact/,
 projects, metadata: {published: '5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf', native, frontend, trials: 5, roundsPerCase: 12, widths: [1440, 390], replacements: ['browser-fill', 'keyboard']},
 webServer: {command: `${process.execPath} ${resolve(repositoryRoot, 'frontend/node_modules/vite/bin/vite.js')} preview --host 127.0.0.1 --port 4470 --strictPort --outDir ${build} --mode production`, cwd: resolve(repositoryRoot, 'frontend'), url: 'http://127.0.0.1:4470', reuseExistingServer: false},
 outputDir: resolve(import.meta.dirname, 'comment-replacement-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'comment-replacement-paired-report.json')}]],
}
