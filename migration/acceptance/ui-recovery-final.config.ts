import {resolve} from 'node:path'
import milestone from './ui-recovery-milestone.config'
import fades from './notice-fades-paired.config'
const undo = milestone.projects.filter(project => project.name.startsWith('native-recovery-')).map(project => ({...project, name: project.name.replace('recovery', 'single-use'), testMatch: ['notice-single-use.spec.ts']}))
export default {...milestone, testMatch: [...milestone.testMatch, ...fades.testMatch, 'notice-single-use.spec.ts'], projects: [...milestone.projects, ...fades.projects, ...undo], metadata: {...milestone.metadata, scope: 'current committed admin recovery, original notice ARIA/fades/queues/lifetimes and labels; paired marker observations and original failures retained', expectedTotalCases: 84}, outputDir: resolve(import.meta.dirname, 'ui-recovery-final-results'), reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'ui-recovery-final-report.json')}]]}
