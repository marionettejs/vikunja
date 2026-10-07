import {resolve} from 'node:path'
import base from './playwright.config'
import observation from './vue-observation-parity.config'
// observation verifies the immutable original Vue frontend and built assets.
const testMatch = ['task-actions-appearance.spec.ts']
export default {
	...base, retries: 0, workers: 1, timeout: 60000, testMatch,
	projects: [
		{name: 'vue-task-actions', baseURL: 'http://127.0.0.1:4470'},
		{name: 'marionette-task-actions', baseURL: process.env.BASE_URL!},
	].map(app => ({...base.projects![0], name: app.name, testMatch,
		use: {...base.projects![0].use, baseURL: app.baseURL}})),
	webServer: observation.webServer,
	metadata: {...observation.metadata, trials: 1, rounds: undefined, expectedCasesPerApp: 4,
		scope: 'Same real task fixture and original action markup/geometry/print outcomes at both widths and themes; frontend time-tracking advertisement only'},
	outputDir: resolve(import.meta.dirname, 'task-actions-appearance-paired-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'task-actions-appearance-paired-report.json')}]],
}
