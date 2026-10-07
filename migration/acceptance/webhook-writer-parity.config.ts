import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const apps = [{name: 'vue-writer', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette-writer', baseURL: process.env.BASE_URL!}]
export default {
 ...base, testMatch: ['webhook-writer-parity.spec.ts'],
 projects: apps.map(app => ({...base.projects[0], name: app.name, testMatch: ['webhook-writer-parity.spec.ts'], grep: undefined, use: {...base.projects[0].use, baseURL: app.baseURL}})),
 outputDir: resolve(import.meta.dirname, 'webhook-writer-parity-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'webhook-writer-parity-report.json')}]],
}
