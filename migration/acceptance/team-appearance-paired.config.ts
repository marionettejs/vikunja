import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch = ['team-appearance-paired.spec.ts']
export default {
 ...base, testMatch,
 projects: base.projects.map(project => ({...project, testMatch})),
 metadata: {...base.metadata, scope: 'team-appearance', expectedTotalCases: 8, journeys: 1},
 outputDir: resolve(import.meta.dirname, 'team-appearance-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'team-appearance-paired-report.json')}]],
}
