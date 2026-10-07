import {resolve} from 'node:path'
import base from './admin-avatar-paired.config'

export default {
	...base,
	testMatch: ['admin-time.spec.ts'],
	projects: base.projects.map(p => ({...p, testMatch: ['admin-time.spec.ts'],
		grep: /frontend contract/,
		grepInvert: /(?:admin advertised feature denies ordinary user|advertised enabled UI does not unlock real backend|time author controls and settled totals exclude running entry)$/,
	})),
	metadata: {...base.metadata, selectedTitles: undefined, expectedCasesPerApp: 12,
		scope: 'Remaining unchanged admin/time frontend contracts; licensed backend stays gated'},
	outputDir: resolve(import.meta.dirname, 'admin-time-remaining-paired-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'admin-time-remaining-paired-report.json')}]],
}
