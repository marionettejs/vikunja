import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const testMatch = ['translation-labels.spec.ts']
export default {
	...base, testMatch, retries: 0, workers: 1, timeout: 60000,
	projects: [1440, 390].flatMap(width => [
		{...base.projects[0], name: `marionette-labels-${width}`, testMatch, grep: undefined, use: {...base.projects[0].use, baseURL: process.env.BASE_URL!, viewport: {width, height: 900}}},
		{...base.projects[0], name: `vue-clipboard-${width}`, testMatch, grep: /successful attachment clipboard/, use: {...base.projects[0].use, baseURL: 'http://127.0.0.1:4470', viewport: {width, height: 900}}},
	]),
	metadata: {...base.metadata, scope: 'six-invalid-references; native rendered error/retry/labels; paired original clipboard silence; pro routes are frontend contracts only'},
	outputDir: resolve(import.meta.dirname, 'translation-labels-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'translation-labels-report.json')}]],
}
