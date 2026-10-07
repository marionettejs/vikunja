import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base,retries:0,testMatch:['account-admin.spec.ts','openid.spec.ts','project-duplicate.spec.ts','task-comments.spec.ts','lazy-features.spec.ts'],outputDir:resolve(import.meta.dirname,'optimization-regression-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'optimization-regression-report.json')}]]}
