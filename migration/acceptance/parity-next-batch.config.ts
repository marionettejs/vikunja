import {resolve} from 'node:path'
import observation from './vue-observation-parity.config'
import adminAvatar from './admin-avatar-paired.config'
process.env.COMMENT_SELECTION_TRACE = '0'
process.env.WEBHOOK_DIAGNOSTIC_CSS = 'false'
export default {
 ...adminAvatar,
 projects: [...observation.projects.filter(p => p.name.includes('comment')).map(p => ({...p, grep: /comment replacement remains exact.*390$/, grepInvert: /keyboard comment replacement/})), ...adminAvatar.projects],
 metadata: {...adminAvatar.metadata, commentFillTrialsPerApp: 5, commentRounds: 12, expectedTotalCases: 30},
 outputDir: resolve(import.meta.dirname, 'parity-next-batch-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'parity-next-batch-report.json')}]],
}
