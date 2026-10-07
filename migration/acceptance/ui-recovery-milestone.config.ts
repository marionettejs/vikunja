import {resolve} from 'node:path'
import recovery from './ui-recovery.config'
import translations from './translation-labels.config'
import notices from './notice-regression-paired.config'
export default {...recovery, testMatch: [...recovery.testMatch, ...translations.testMatch, ...notices.testMatch], projects: [...recovery.projects, ...translations.projects, ...notices.projects], metadata: {...recovery.metadata, scope: 'current committed admin recovery, notice ARIA/queue/lifetimes, previous six labels; original mobile scroll assertions retained', expectedTotalCases: 74}, outputDir: resolve(import.meta.dirname, 'ui-recovery-milestone-results'), reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'ui-recovery-milestone-report.json')}]]}
