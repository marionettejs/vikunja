import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const testMatch = ['supported-device-paired.spec.ts']
const apps = [{name: 'vue', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette', baseURL: process.env.BASE_URL!}]
export default {
 ...base, testMatch, timeout: 45000,
 metadata: {...base.metadata, trials: undefined, rounds: undefined, scope: 'settings-project-sharing-organization-supported-device-pair', expectedTotalCases: 48, widths: [1440, 390], colorSchemes: ['light', 'dark'], journeys: 6},
 projects: apps.flatMap(app => [1440, 390].flatMap(width => (['light', 'dark'] as const).map(colorScheme => ({
  ...base.projects[0], name: `${app.name}-${width}-${colorScheme}`, testMatch, grep: undefined,
  use: {...base.projects[0].use, baseURL: app.baseURL, viewport: {width, height: 900}, colorScheme},
 })))),
 outputDir: resolve(import.meta.dirname, 'supported-device-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'supported-device-paired-report.json')}]],
}
