import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch=['final-acceptance-paired.spec.ts','settings-sharing-appearance-paired.spec.ts']
export default {...base,testMatch,projects:base.projects.map(project=>({...project,testMatch})),metadata:{...base.metadata,scope:'final-six-surfaces-visual-interaction',expectedTotalCases:24},outputDir:resolve(import.meta.dirname,'final-acceptance-paired-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'final-acceptance-paired-report.json')}]]}
