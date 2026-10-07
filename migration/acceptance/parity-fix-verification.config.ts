import {resolve} from 'node:path'
import base from './webhook-fix-followup.config'
import admin from './admin-avatar-paired.config'

export default {
	...base,
	projects: [
		...base.projects.filter(p => !p.name.includes('comment')),
		...admin.projects.map(p => ({...p, grep: /frontend contract time author controls and settled totals exclude running entry$/})),
	],
	outputDir: resolve(import.meta.dirname, 'parity-fix-verification-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'parity-fix-verification-report.json')}]],
}
