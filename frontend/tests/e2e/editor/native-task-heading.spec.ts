import {test, expect} from '@playwright/test'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const {buildSync} = createRequire(require.resolve('vite'))('esbuild')
import {resolve} from 'node:path'

// Isolated native View acceptance; this does not exercise the task route or API.
let bundle: string | undefined
// Bundling at module scope runs during suite load and slows unrelated specs.
function nativeBundle() {
	bundle ??= buildSync({
		stdin: {contents: `
			import {TaskHeadingView} from './src/marionette/views/TaskHeadingView';
			import {Model} from '@mnjs/data';
			import TaskDetailLayoutView from './src/marionette/views/TaskDetailLayoutView';
			import {View} from './src/marionette';
			import {html} from 'lit-html';
			const model = new Model({id: 1, title: 'Initial task', done: false, hexColor: ''});
			let fail = false;
			const view = new TaskHeadingView({model, canWrite: true, hasClose: true,
				labels: {title: 'Title', titleRequired: 'Title required', saving: 'Saving', saved: 'Saved', saveError: 'Save failed', copy: 'Copy', close: 'Close', done: 'Done'},
				taskUrl: '/tasks/1', taskIdentifier: '#1', onCopy: () => {}, onClose: () => {layout.destroy(); model.destroy()},
				onCommit: async title => {if(fail) throw new Error('offline'); model.set('title',title)}
			});
			const Description = View.extend({template: () => html\`<div contenteditable="true" aria-label="Description draft">Original description</div>\`});
			const description = new Description();
			const layout = new TaskDetailLayoutView({isModal:false, labels:{back:'Back',description:'Description'}, onBack:()=>{}, children:{heading:view,description}});
			layout.render(); document.body.append(layout.el);
			document.querySelector('#rerender').onclick = () => layout.render();
			document.querySelector('#failure').onclick = () => {fail = !fail};
		`, resolveDir: resolve(process.cwd())},
		bundle: true, write: false, format: 'iife', platform: 'browser',
	}).outputFiles[0].text
	return bundle
}

async function mount(page: import('@playwright/test').Page) {
	await page.setContent('<button id="failure">Toggle failure</button><button id="outside">Outside</button><button id="rerender">Rerender layout</button>')
	await page.addScriptTag({content: nativeBundle()})
}

test('native heading accepts full text replacement, Enter and Escape', async ({page}) => {
	const errors: string[] = []
	page.on('pageerror', error => errors.push(error.message))
	await mount(page)
	const title = page.getByRole('heading', {level: 1})
	await title.fill('First replacement')
	await title.press('Enter')
	await expect(page.locator('.heading-status')).toHaveText('Saved')
	await expect(title).not.toBeFocused()
	await title.fill('Second replacement')
	await title.press('Escape')
	await expect(title).toHaveText('First replacement')
	await expect(title).not.toBeFocused()
	await title.fill('   ')
	await page.getByRole('button', {name: 'Outside', exact: true}).click()
	await expect(title).toHaveText('First replacement')
	await expect(title).toHaveAttribute('aria-invalid', 'true')
	await page.getByRole('button', {name: 'Close', exact: true}).click()
	await expect(title).toHaveCount(0)
	expect(errors).toEqual([])
})

test('native heading keeps failed text for retry', async ({page}) => {
	await mount(page)
	const title = page.getByRole('heading', {level: 1})
	await page.getByRole('button', {name: 'Toggle failure'}).click()
	await title.fill('Keep draft')
	await title.press('Enter')
	await expect(page.locator('.heading-status')).toHaveText('Save failed')
	await expect(title).toHaveText('Keep draft')
	await page.getByRole('button', {name: 'Toggle failure'}).click()
	await title.focus()
	await title.press('Enter')
	await expect(page.locator('.heading-status')).toHaveText('Saved')
	await expect(title).toHaveText('Keep draft')
})


test('native layout preserves description DOM and drafts through parent rendering', async ({page}) => {
	const errors: string[] = []
	page.on('pageerror', error => errors.push(error.message))
	await mount(page)
	const description = page.getByLabel('Description draft')
	await description.fill('Unsaved description')
	await description.evaluate(el => el.setAttribute('data-original', 'yes'))
	await page.getByRole('button', {name: 'Rerender layout'}).click()
	await expect(description).toHaveText('Unsaved description')
	await expect(description).toHaveAttribute('data-original', 'yes')
	await expect(page.getByRole('heading', {level: 1})).toHaveText('Initial task')
	await page.getByRole('button', {name: 'Close', exact: true}).click()
	await expect(description).toHaveCount(0)
	expect(errors).toEqual([])
})
