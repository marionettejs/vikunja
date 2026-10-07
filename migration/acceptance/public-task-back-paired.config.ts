import {resolve} from 'node:path'
import base from './public-share-lifetime-paired.config'
const grep=/public task Back/
export default {...base,grep,projects:base.projects.map(project=>({...project,grep})),metadata:{...base.metadata,marionette:process.env.PARITY_NATIVE_REFERENCE_BUILD?'b438310dccec27b4167fcdc9e547409a1fdc71e5':base.metadata.marionette,marionetteFrontend:process.env.PARITY_NATIVE_REFERENCE_BUILD?'062059addc7d63a1dfc0b36793a6a83ef60ad192':base.metadata.marionetteFrontend,scope:'public-task-back-history-remembered-default',expectedTotalCases:8,journeys:1},outputDir:resolve(import.meta.dirname,'public-task-back-paired-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'public-task-back-paired-report.json')}]]}
