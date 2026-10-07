import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch=['undo-rejection-paired.spec.ts']
export default {...base,testMatch,projects:base.projects.map(project=>({...project,testMatch})),metadata:{...base.metadata,scope:'completion-undo-fault-live-navigated-restarted-owner',expectedTotalCases:24,journeys:3},outputDir:resolve(import.meta.dirname,'undo-rejection-paired-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'undo-rejection-paired-report.json')}]]}
