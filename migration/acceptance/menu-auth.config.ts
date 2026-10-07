import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base,testMatch:['background-upcoming.spec.ts','production-probes.spec.ts','visual-review.spec.ts'],outputDir:resolve(import.meta.dirname,'menu-auth-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'menu-auth-report.json')}]]}
