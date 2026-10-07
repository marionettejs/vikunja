import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const testMatch = ['webhook-tooltip.spec.ts']
const apps = [{name: 'vue-webhook-tooltip', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette-webhook-tooltip', baseURL: process.env.BASE_URL!}]
export default {
 ...base, testMatch,
 projects: apps.map(app => ({...base.projects[0], name: app.name, testMatch, grep: undefined, use: {...base.projects[0].use, baseURL: app.baseURL}})),
 outputDir: resolve(import.meta.dirname, 'webhook-tooltip-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'webhook-tooltip-paired-report.json')}]],
}
