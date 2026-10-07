import {resolve} from 'node:path'
import base from './playwright.config'
import observation from './vue-observation-parity.config'

// Importing observation verifies the frozen Vue source and every captured build asset.
const selectedTitles = [
	'real unlicensed UI and backend gate /time-tracking',
	'real unlicensed UI and backend gate /admin',
	'real unlicensed UI and backend gate /admin/users',
	'real unlicensed UI and backend gate /admin/projects',
	'frontend contract admin advertised feature denies ordinary user',
	'frontend contract advertised enabled UI does not unlock real backend',
	'frontend contract time author controls and settled totals exclude running entry',
	'avatar real local providers persistence and image endpoint 1440',
	'avatar real local providers persistence and image endpoint 390',
	'avatar cropped upload produces square image persisted across reload',
]
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const grep = new RegExp(`(?:${selectedTitles.map(escapeRegex).join('|')})$`)
const testMatch = ['admin-time.spec.ts', 'avatar-system.spec.ts']
const apps = [
	{name: 'vue-admin-avatar', baseURL: 'http://127.0.0.1:4470'},
	{name: 'marionette-admin-avatar', baseURL: process.env.BASE_URL!},
]
export default {
	...base,
	retries: 0,
	workers: 1,
	timeout: 60000,
	testMatch,
	projects: apps.map(app => ({
		...base.projects![0],
		name: app.name,
		testMatch,
		grep,
		use: {...base.projects![0].use, baseURL: app.baseURL},
	})),
	webServer: observation.webServer,
	metadata: {...observation.metadata, trials: 1, rounds: undefined, selectedTitles, expectedCasesPerApp: 10,
		scope: 'Unchanged frontend contracts and real unlicensed gates; no licensed backend certification'},
	outputDir: resolve(import.meta.dirname, 'admin-avatar-paired-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'admin-avatar-paired-report.json')}]],
}
