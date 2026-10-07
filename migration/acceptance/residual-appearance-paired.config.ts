import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const testMatch = ['task-sidebar-context.spec.ts', 'webhook-tooltip.spec.ts', 'task-heading-appearance.spec.ts']
const apps = [{name: 'vue-residual-appearance', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette-residual-appearance', baseURL: process.env.BASE_URL!}]
export default {
 ...base, testMatch,
 projects: apps.map(app => ({...base.projects[0], name: app.name, testMatch, grep: undefined, use: {...base.projects[0].use, baseURL: app.baseURL}})),
 outputDir: resolve(import.meta.dirname, 'residual-appearance-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'residual-appearance-paired-report.json')}]],
}
