import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base,testMatch:['logo-parity.spec.ts','account-admin.spec.ts','visual-review.spec.ts','focus-parity.spec.ts'],grep:/logo|read only project webhook|finite visual review|retains/,outputDir:resolve(import.meta.dirname,'architecture-logo-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'architecture-logo-report.json')}]]}
