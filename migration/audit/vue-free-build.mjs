import {build} from '../../frontend/node_modules/vite/dist/node/index.js'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
const project=resolve(import.meta.dirname,'../..'),frontend=resolve(project,'frontend'),evidence=resolve(process.argv[2]??'/tmp/vikunja-vue-free-audit')
mkdirSync(evidence,{recursive:true})
const vuePackage=/(?:node_modules\/)(?:\.pnpm\/[^/]+\/node_modules\/)?(?:vue|@vue|@vueuse|pinia|vue-router|vue-i18n|@tiptap\/vue-3|@tanstack\/vue-query|@sentry\/vue)(?:\/|$)/
for(const mode of ['development','production']){
 const graphs=[]
 await build({root:frontend,configFile:resolve(frontend,'vite.config.ts'),mode,build:{emptyOutDir:true,outDir:resolve(evidence,mode)},plugins:[{name:'migration-vue-runtime-audit',generateBundle(_options,bundle){const ids=[...this.getModuleIds()];graphs.push({modules:ids.length,vue_matches:ids.filter(id=>vuePackage.test(id)),module_ids:ids,assets:Object.entries(bundle).map(([name,value])=>({name,type:value.type,...(value.type==='chunk'?{imports:value.imports,dynamicImports:value.dynamicImports,modules:Object.keys(value.modules)}:{})}))})}}]})
 writeFileSync(resolve(evidence,`${mode}-graph.json`),JSON.stringify({mode,graphs},null,2))
 if(graphs.some(graph=>graph.vue_matches.length))throw new Error(`Vue modules in ${mode} bundle`)
}
const manifest=JSON.parse(readFileSync(resolve(frontend,'package.json'),'utf8'))
const versions={}
for(const name of ['marionette','@mnjs/adapters','@mnjs/data','@mnjs/radio','@mnjs/utils']){versions[name]=JSON.parse(readFileSync(resolve(frontend,'node_modules',name,'package.json'),'utf8')).version;if(versions[name]!=='5.0.0-rc.2'||manifest.dependencies[name]!=='5.0.0-rc.2')throw new Error(`Unpinned RC2 dependency ${name}`)}
writeFileSync(resolve(evidence,'rc2-versions.json'),JSON.stringify(versions,null,2))
