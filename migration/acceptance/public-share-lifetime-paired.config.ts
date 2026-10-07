import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const nativeReference = process.env.PARITY_NATIVE_REFERENCE_BUILD
const testMatch = ['public-share-lifetime-paired.spec.ts']
export default {
 ...base, testMatch, timeout: 60000,
 projects: base.projects.map(project => ({...project, testMatch, use: {...project.use, ...(nativeReference && project.name.startsWith('marionette-') ? {baseURL:'http://127.0.0.1:4471'} : {})}})),
 metadata: {...base.metadata, ...(nativeReference ? {marionette:'1665b1dc24db4f81df6592a51e574bed54db024a',marionetteFrontend:'297071a8099e9ac56484c9e7e76a651ef59f9cfa',nativeReferenceBuild:nativeReference} : {}), scope:'public-share-notice-project-error-offline-back',expectedTotalCases:32,journeys:4},
 webServer: nativeReference ? [base.webServer, {command:`${process.execPath} ${resolve(import.meta.dirname, '../../frontend/node_modules/vite/bin/vite.js')} preview --host 127.0.0.1 --port 4471 --strictPort --outDir ${nativeReference} --mode production`,cwd:resolve(import.meta.dirname,'../../frontend'),url:'http://127.0.0.1:4471',reuseExistingServer:false}] : base.webServer,
 outputDir:resolve(import.meta.dirname,'public-share-lifetime-paired-results'),
 reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'public-share-lifetime-paired-report.json')}]],
}
