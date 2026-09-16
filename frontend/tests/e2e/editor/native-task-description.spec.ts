import {test, expect} from '@playwright/test'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const {buildSync} = createRequire(require.resolve('vite'))('esbuild')
import {resolve} from 'node:path'

// Isolated native editor evidence; no task route or real API writes.
let bundle: string | undefined
// Bundling at module scope runs during suite load and slows unrelated specs.
function nativeBundle() {
	bundle ??= buildSync({
		stdin: {contents: `
			import {TaskDescriptionView} from './src/marionette/views/TaskDescriptionView';
			import {TaskRecords} from './src/marionette/data/TaskRecords';
			import StarterKit from '@tiptap/starter-kit';
			const records = new TaskRecords();
			const model = records.upsert({id:3,description:'<p>Original</p>'});
			let view;
			function mount() {
				view = new TaskDescriptionView({model,extensions:[StarterKit],canWrite:true,
					labels:{description:'Description',save:'Save',saving:'Saving',saved:'Saved',error:'Failed'},
					t:key=>key,
					onCommit:async description=>{await new Promise(resolve=>setTimeout(resolve,200));model.set('description',description)}
				});
				view.render();document.body.append(view.el);
			}
			mount();
			document.querySelector('#remount').onclick=()=>{view.destroy();mount()};
			document.querySelector('#destroy').onclick=()=>view.destroy();
		`,resolveDir:resolve(process.cwd())},
		alias:{'@':resolve(process.cwd(),'src')},
		bundle:true,write:false,format:'iife',platform:'browser',
	}).outputFiles[0].text
	return bundle
}

async function mount(page: import('@playwright/test').Page) {
	await page.route('**/native-description-fixture', route => route.fulfill({contentType:'text/html',body:'<button id="remount">Remount</button><button id="destroy">Destroy</button>'}))
	await page.goto('/native-description-fixture')
	await page.addScriptTag({content: nativeBundle()})
}

test('autosave status preserves editor focus and selection for continued typing', async ({page}) => {
	const errors:string[]=[]
	page.on('pageerror', error=>errors.push(error.message))
	await mount(page)
	const editor=page.locator('.tiptap[contenteditable="true"]')
	await editor.fill('Draft')
	await editor.press('End')
	await expect(page.getByRole('status')).toHaveText('Saved',{timeout:10000})
	await expect(editor).toBeFocused()
	await page.keyboard.type(' continued')
	await expect(editor).toHaveText('Draft continued')
	await page.getByRole('button',{name:'Destroy',exact:true}).click()
	await expect(editor).toHaveCount(0)
	expect(errors).toEqual([])
})

test('unsaved empty description survives teardown and remount',async({page})=>{
	await mount(page)
	const editor=page.locator('.tiptap[contenteditable="true"]')
	await editor.fill('')
	await page.getByRole('button',{name:'Remount',exact:true}).click()
	await expect(editor).toHaveText('')
	await expect.poll(()=>page.evaluate(()=>localStorage.getItem('editorDraft-task-description-3'))).toBe('<p></p>')
})
