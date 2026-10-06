import {resolve} from 'node:path'
import base from '../../frontend/playwright.config'
export default {
 ...base, retries: 0, timeout: 1800000, testDir: import.meta.dirname,
 testMatch: ['paired-profiling.spec.ts'], outputDir: resolve(import.meta.dirname, 'benchmark-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'benchmark-report.json')}]],
 use: {...base.use, locale: 'en-US', timezoneId: 'UTC', trace: 'off', viewport: {width: 1440, height: 900}},
}
