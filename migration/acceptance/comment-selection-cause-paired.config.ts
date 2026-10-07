import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
process.env.COMMENT_SELECTION_TRACE = '1'
const trials = Number(process.env.COMMENT_SELECTION_TRIALS ?? 5)
if (!Number.isInteger(trials) || trials < 1 || trials > 20) throw new Error('Selection trials must be1to20')
const templates = base.projects.filter(p => p.name.includes('comment')).slice(0, 2)
export default {
	...base,
	projects: Array.from({length: trials}, (_, trial) => (trial % 2 ? [...templates].reverse() : templates).map(p => ({...p,
		name: p.name.replace(/trial-\d+$/, `trial-${trial + 1}`),
		grep: /comment replacement remains exact.*390$/,
		grepInvert: /keyboard comment replacement/,
	}))).flat(),
	metadata: {...base.metadata, trials, scope: 'Selection writer traces after fresh uninstrumented390 fill failure; unchanged assertions'},
	outputDir: resolve(import.meta.dirname, 'comment-selection-cause-paired-results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'comment-selection-cause-paired-report.json')}]],
}
