import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base,testMatch:['visual-review.spec.ts','background-upcoming.spec.ts'],grep:/finite visual review|project menu keyboard|kanban/,outputDir:resolve(import.meta.dirname,'appearance-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'appearance-report.json')}]]}
