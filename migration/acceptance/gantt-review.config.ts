import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base, retries: 0, testMatch: ['project-gantt.spec.ts'], outputDir: resolve(import.meta.dirname, 'gantt-review-results'), reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'gantt-review-report.json')}]]}
