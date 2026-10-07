import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const specs = ['shell.spec.ts', 'task-heading.spec.ts', 'project-list.spec.ts', 'project-table.spec.ts', 'task-actions.spec.ts']
const apps = [{name: 'vue-representative', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette-representative', baseURL: process.env.BASE_URL!}]
export default {
 ...base, testMatch: specs,
 projects: apps.map(app => ({...base.projects[0], name: app.name, testMatch: specs, grep: undefined, use: {...base.projects[0].use, baseURL: app.baseURL}})),
 outputDir: resolve(import.meta.dirname, 'representative-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'representative-paired-report.json')}]],
}
