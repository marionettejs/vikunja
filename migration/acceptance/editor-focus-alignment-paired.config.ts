import {resolve} from 'node:path'
import base from './comment-selection-cause-paired.config'
process.env.COMMENT_SELECTION_TRACE = '0'
const apps = [{name: 'vue', baseURL: 'http://127.0.0.1:4470'}, {name: 'marionette', baseURL: process.env.BASE_URL!}]
export default {
	...base,
	projects: [...base.projects, ...apps.map(app => ({...base.projects[0],
		name: app.name + '-user-input', testMatch: ['editor-input-contract.spec.ts'],
		grep: undefined, grepInvert: undefined, use: {...base.projects[0].use, baseURL: app.baseURL},
	}))],
	metadata: {...base.metadata, selectionTracing: false, scope: 'Unchanged repeated mobile fill plus real keyboard/paste/Chromium composition after public focus alignment'},
	outputDir: resolve(import.meta.dirname, 'editor-focus-alignment-paired-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'editor-focus-alignment-paired-report.json')}]],
}
