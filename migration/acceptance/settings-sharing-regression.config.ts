import {resolve} from 'node:path'
import base from './playwright.config'
export default {
 ...base,
 testMatch: ['settings.spec.ts','settings-controls.spec.ts','project-sharing-management.spec.ts','sharing-access.spec.ts'],
 outputDir: resolve(import.meta.dirname,'settings-sharing-regression-results'),
 reporter: [['line'],['json',{outputFile:resolve(import.meta.dirname,'settings-sharing-regression-report.json')}]],
}
