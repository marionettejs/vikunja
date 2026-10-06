import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base, timeout: 90000, testMatch: ['offline-ui.spec.ts', 'bootstrap.spec.ts', 'production-probes.spec.ts'], outputDir: resolve(import.meta.dirname, 'production-probe-results'), reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'production-probe-report.json')}]]}
