import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const testMatch = ['creation-focus-observation.spec.ts']
const apps = [{name: 'vue', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette', baseURL: process.env.BASE_URL!}]
export default {
 ...base, testMatch,
 metadata: {...base.metadata, trials: undefined, rounds: undefined, scope: 'creation-focus-observation', widths: [1440, 390], expectedTotalCases: 8},
 projects: apps.flatMap(app => [1440, 390].map(width => ({...base.projects[0], name: `${app.name}-${width}`, testMatch, grep: undefined, use: {...base.projects[0].use, baseURL: app.baseURL, viewport: {width, height: 900}, colorScheme: 'light'}}))),
 outputDir: resolve(import.meta.dirname, 'creation-focus-observation-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'creation-focus-observation-report.json')}]],
}
