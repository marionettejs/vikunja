import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
process.env.COMMENT_SELECTION_TRACE = '0'
process.env.WEBHOOK_DIAGNOSTIC_CSS = 'false'
const apps = [{name: 'vue', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette', baseURL: process.env.BASE_URL!}]
const project = (app: typeof apps[number], name: string, testMatch: string[], grep?: RegExp) => ({...base.projects[0], name, testMatch, grep, use: {...base.projects[0].use, baseURL: app.baseURL}})
export default {
 ...base,
 projects: [...base.projects.filter(p => p.name.includes('comment')).map(p => ({...p, grep: /comment replacement remains exact.*390$/, grepInvert: /keyboard comment replacement/})), ...apps.map(app => project(app, app.name + '-webhooks', ['vue-webhook-observation.spec.ts', 'webhook-writer-parity.spec.ts'])), project(apps[1], 'marionette-webhook-regression', ['webhook-root-regression.spec.ts'])],
 outputDir: resolve(import.meta.dirname, 'webhook-fix-followup-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'webhook-fix-followup-report.json')}]],
}
