import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base,retries:0,testMatch:['lazy-features.spec.ts','visual-review.spec.ts','focus-parity.spec.ts','bootstrap.spec.ts','project-gantt.spec.ts'],outputDir:resolve(import.meta.dirname,'optimization-lazy-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'optimization-lazy-report.json')}]]}
