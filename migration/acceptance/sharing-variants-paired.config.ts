import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch = ['sharing-variants-paired.spec.ts']
export default {
 ...base, testMatch,
 projects: base.projects.map(project => ({...project, testMatch})),
 metadata: {...base.metadata, scope: 'sharing-search-populated-nested-dialog', expectedTotalCases: 16, journeys: 2},
 outputDir: resolve(import.meta.dirname, 'sharing-variants-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'sharing-variants-paired-report.json')}]],
}
