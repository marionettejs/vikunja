import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
process.env.COMMENT_SELECTION_TRACE = '1'
process.env.WEBHOOK_DIAGNOSTIC_CSS = 'false'
const apps = [{name: 'vue', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette', baseURL: process.env.BASE_URL!}]
export default {
 ...base,
 projects: [...base.projects, ...apps.map(app => ({...base.projects[0], name: app.name + '-user-input', testMatch: ['editor-input-contract.spec.ts'], grep: undefined, use: {...base.projects[0].use, baseURL: app.baseURL}})), {...base.projects[0], name: 'marionette-webhook-regression', testMatch: ['webhook-root-regression.spec.ts'], grep: undefined, use: {...base.projects[0].use, baseURL: process.env.BASE_URL!}}],
 outputDir: resolve(import.meta.dirname, 'webhook-selection-fix-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'webhook-selection-fix-report.json')}]],
}
