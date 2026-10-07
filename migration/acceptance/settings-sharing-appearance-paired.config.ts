import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch = ['settings-sharing-appearance-paired.spec.ts']
export default {
 ...base, testMatch,
 projects: base.projects.map(project => ({...project, testMatch})),
 metadata: {...base.metadata, scope: 'settings-sharing-appearance', expectedTotalCases: 16, journeys: 2},
 outputDir: resolve(import.meta.dirname, 'settings-sharing-appearance-paired-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'settings-sharing-appearance-paired-report.json')}]],
}
