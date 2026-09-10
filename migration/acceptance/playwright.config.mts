import base from '../../frontend/playwright.config.ts'
import {resolve} from 'node:path'

export default {
	...base,
	use: {...base.use, locale: 'en-US'},
	testDir: import.meta.dirname,
	testMatch: 'about.spec.ts',
	outputDir: resolve(import.meta.dirname, 'results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'report.json')}]],
}
