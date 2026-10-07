import { View, CollectionView } from 'marionette'
import { Collection, Model, DataApi } from '@mnjs/data'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import { html } from 'lit-html'
import CSVMigrationService, {
	TASK_ATTRIBUTES,
	SUPPORTED_DELIMITERS,
	SUPPORTED_DATE_FORMATS,
	type ImportConfig,
	type ColumnMapping,
	type DetectionResult,
	type PreviewResult,
} from '@/services/migrator/csvMigration'
import TaskModel from '@/models/task'
import { ListTaskRowView } from '@/shared/task-list/list-task-row'
import type { ListContext } from '@/shared/task-list/list-context'
import { t } from '../../shared/i18n'
import { errorText } from '../../shared/notifications'
import { interceptLink } from '../../app/routes'
import './import.scss'
const attributes: Record<string, string> = {
	title: 'task.attributes.title',
	description: 'task.attributes.description',
	due_date: 'task.attributes.dueDate',
	start_date: 'task.attributes.startDate',
	end_date: 'task.attributes.endDate',
	done: 'task.attributes.done',
	priority: 'task.attributes.priority',
	labels: 'task.attributes.labels',
	reminder: 'task.attributes.reminders',
	project: 'task.attributes.project',
	ignore: 'migrate.csv.ignore',
}
const delimiters: Record<string, string> = {
	',': 'comma',
	';': 'semicolon',
	'\t': 'tab',
	'|': 'pipe',
}
const dates = [
	'YYYY-MM-DD (2024-01-15)',
	'ISO DateTime (2024-01-15T10:30:00)',
	'DD/MM/YYYY (15/01/2024)',
	'MM/DD/YYYY (01/15/2024)',
	'DD-MM-YYYY (15-01-2024)',
	'MM-DD-YYYY (01-15-2024)',
	'DD.MM.YYYY (15.01.2024)',
	'YYYY/MM/DD (2024/01/15)',
	'DateTime (2024-01-15 10:30:00)',
]
interface Options {
	current: () => boolean;
	context: ListContext;
	refresh: (signal: AbortSignal) => Promise<void>;
	navigate: (href: string) => void;
}
const PreviewRows = CollectionView.extend({
	tagName: 'div',
	className: 'tasks',
	childView: ListTaskRowView,
	childViewOptions() {
		return {
			context: this.options.context,
			allTasks: () => this.options.tasks,
			canWrite: false,
		}
	},
	initialize(options: {
		context: ListContext;
		tasks: TaskModel[];
		collection: Collection;
	}) {
		void options
	},
	onAttach() {
		this.el.addEventListener('click', this.block, true)
	},
	onBeforeDestroy() {
		this.el.removeEventListener('click', this.block, true)
	},
	block(event: Event) {
		event.preventDefault()
		event.stopPropagation()
	},
})
	.setDomApi(LitDomApi)
	.setDataApi(DataApi)
const PreviewView = View.extend({
	initialize(options: { result: PreviewResult; context: ListContext }) {
		void options
	},
	regions: { rows: '[data-rows]' },
	templateContext() {
		return this.options.result
	},
	template({ total_rows }: { total_rows: number }) {
		return html`<div class="preview-section card">
			<h3>${t('migrate.csv.preview')}</h3>
			<p>${t('migrate.csv.previewDescription', { count: total_rows })}</p>
			<div data-rows class="preview-tasks"></div>
		</div>`
	},
	onRender() {
		const tasks = this.options.result.tasks.map(
			(pt, i) =>
				new TaskModel({
					id: -(i + 1),
					title: pt.title || t('migrate.csv.untitled'),
					description: pt.description || '',
					done: pt.done,
					dueDate: pt.due_date ? new Date(pt.due_date) : null,
					startDate: pt.start_date ? new Date(pt.start_date) : null,
					endDate: pt.end_date ? new Date(pt.end_date) : null,
					priority: pt.priority as TaskModel['priority'],
					labels: (pt.labels || []).map((title, j) => ({
						id: -(j + 1),
						title,
					})),
				}),
		)
		this.showChildView(
			'rows',
			new PreviewRows({
				tasks,
				context: this.options.context,
				collection: new Collection(
					tasks.map((task) => new Model({ id: task.id, task })),
				),
			}),
		)
	},
}).setDomApi(LitDomApi)
const CSVMappingView = View.extend({
	initialize(
		options: Options & {
			file: File;
			detection: DetectionResult;
			cancel: () => void;
			accepted: (message: string) => void;
		},
	) {
		void options
	},
	regions: { preview: '[data-preview]' },
	ui: {
		fields: '[data-field]',
		mapping: '[data-mapping]',
		import: '[data-import]',
		error: '[data-error]',
		cancel: '[data-cancel]',
	},
	events: {
		'change @ui.fields': 'changed',
		'change @ui.mapping': 'changed',
		'click @ui.import': 'importFile',
		'click @ui.cancel': 'cancel',
	},
	createState() {
		const d = this.options.detection
		return {
			config: {
				delimiter: d.delimiter,
				quote_char: d.quote_char,
				date_format: d.date_format,
				skip_rows: 0,
				mapping: d.suggested_mapping.map((m: ColumnMapping) => ({ ...m })),
			} as ImportConfig,
			preview: undefined as AbortController | undefined,
			write: undefined as AbortController | undefined,
		}
	},
	templateContext() {
		return {
			config: this.getState().config,
			detection: this.options.detection,
			id: this.cid,
		}
	},
	template({
		config,
		detection,
		id,
	}: {
		config: ImportConfig;
		detection: DetectionResult;
		id: string;
	}) {
		return html`<div class="mapping-step">
			<div class="mapping-header">
				<p>${t('migrate.csv.columnMappingDescription')}</p>
			</div>
			<div class="parsing-options card">
				<h3>${t('migrate.csv.parsingOptions')}</h3>
				<div class="options-grid">
					<div class="option-group">
						<label for=${id + 'delimiter'}>${t('migrate.csv.delimiter')}</label>
						<div class="select is-fullwidth">
							<select id=${id + 'delimiter'} data-field="delimiter">
								${SUPPORTED_DELIMITERS.map(
		(d) =>
			html`<option value=${d} ?selected=${d === config.delimiter}>
											${t('migrate.csv.delimiters.' + delimiters[d])}
										</option>`,
	)}
							</select>
						</div>
					</div>
					<div class="option-group">
						<label for=${id + 'date'}>${t('migrate.csv.dateFormat')}</label>
						<div class="select is-fullwidth">
							<select id=${id + 'date'} data-field="date_format">
								${SUPPORTED_DATE_FORMATS.map(
		(d, i) =>
			html`<option
											value=${d}
											?selected=${d === config.date_format}
										>
											${dates[i]}
										</option>`,
	)}
							</select>
						</div>
					</div>
					<div class="option-group">
						<label for=${id + 'skip'}>${t('migrate.csv.skipRows')}</label
						><input
							id=${id + 'skip'}
							data-field="skip_rows"
							type="number"
							min="0"
							class="input"
							value=${config.skip_rows}
						/>
					</div>
				</div>
			</div>
			<div class="column-mappings card">
				<h3>${t('migrate.csv.mapColumns')}</h3>
				<div class="mappings-grid">
					${config.mapping.map(
		(m, i) =>
			html`<div class="mapping-row">
								<div class="column-name">
									<strong>${m.column_name}</strong>${detection.preview_rows?.[0]
	? html`<span class="preview-value"
												>${t('migrate.csv.example')}:
												${detection.preview_rows[0][i] || '-'}</span
											>`
	: ''}
								</div>
								<div class="select is-fullwidth">
									<select data-mapping=${i} aria-label=${m.column_name}>
										${TASK_ATTRIBUTES.map(
		(a) =>
			html`<option value=${a} ?selected=${a === m.attribute}>
													${t(attributes[a])}
												</option>`,
	)}
									</select>
								</div>
							</div>`,
	)}
				</div>
			</div>
			<div data-error role="alert" class="message danger" hidden></div>
			<div data-preview></div>
			<div class="actions">
				<button data-cancel class="button is-text">${t('misc.cancel')}</button
				><button data-import class="button is-primary">
					${t('migrate.csv.import')}
				</button>
			</div>
		</div>`
	},
	onRender() {
		this.updatePreview()
	},
	alive(request: AbortController) {
		return (
			!request.signal.aborted && !this.isDestroyed() && this.options.current()
		)
	},
	changed(event: Event) {
		const input = event.target as HTMLInputElement,
			config = this.getState().config
		if (input.dataset.mapping !== undefined)
			config.mapping[Number(input.dataset.mapping)].attribute =
				input.value as ImportConfig['mapping'][number]['attribute']
		else if (input.dataset.field === 'skip_rows')
			config.skip_rows = Number(input.value)
		else if (input.dataset.field === 'delimiter')
			config.delimiter = input.value
		else config.date_format = input.value
		this.updatePreview()
	},
	busy() {
		const state = this.getState(),
			button = this.getUI('import')![0] as HTMLButtonElement
		button.disabled =
			!!state.preview ||
			!!state.write ||
			!state.config.mapping.some((m) => m.attribute === 'title')
		button.classList.toggle('is-loading', !!state.preview || !!state.write)
	},
	feedback(error?: unknown) {
		const el = this.getUI('error')![0] as HTMLElement
		el.hidden = !error
		el.textContent = error ? errorText(error) : ''
	},
	async updatePreview() {
		const state = this.getState()
		state.preview?.abort()
		const request = (state.preview = new AbortController()),
			config = structuredClone(state.config)
		this.busy()
		try {
			const result = await new CSVMigrationService().preview(
				this.options.file,
				config,
				request.signal,
			)
			if (!this.alive(request)) return
			this.showChildView(
				'preview',
				new PreviewView({ result, context: this.options.context }),
			)
			this.feedback()
		} catch (error) {
			if (this.alive(request)) {
				this.getRegion('preview')!.empty()
				this.feedback(error)
			}
		} finally {
			if (state.preview === request) state.preview = undefined
			if (this.alive(request)) this.busy()
		}
	},
	async importFile() {
		const state = this.getState()
		if (
			state.preview ||
			state.write ||
			!state.config.mapping.some((m) => m.attribute === 'title')
		)
			return
		const request = (state.write = new AbortController())
		this.feedback()
		this.busy()
		try {
			const result = await new CSVMigrationService().migrate(
				this.options.file,
				structuredClone(state.config),
				request.signal,
			)
			if (!this.alive(request)) return
			await this.options.refresh(request.signal)
			if (this.alive(request)) this.options.accepted(result.message)
		} catch (error) {
			if (this.alive(request)) this.feedback(error)
		} finally {
			if (state.write === request) state.write = undefined
			if (this.alive(request)) this.busy()
		}
	},
	cancel() {
		this.options.cancel()
	},
	onBeforeDestroy() {
		this.getState().preview?.abort()
		this.getState().write?.abort()
	},
}).setDomApi(LitDomApi)

const UploadView = View.extend({
	initialize(options: { selected: (file: File) => void }) {
		void options
	},
	ui: { file: 'input', pick: 'button' },
	events: { 'click @ui.pick': 'pick', 'change @ui.file': 'selected' },
	template() {
		return html`<div class="upload-step">
			<p>${t('migrate.csv.uploadDescription')}</p>
			<input type="file" accept=".csv,.txt" class="is-hidden" /><button
				class="button is-primary"
			>
				${t('migrate.csv.selectFile')}
			</button>
		</div>`
	},
	pick() {
		(this.getUI('file')![0] as HTMLInputElement).click()
	},
	selected() {
		const input = this.getUI('file')![0] as HTMLInputElement,
			file = input.files?.[0]
		input.value = ''
		if (file) this.options.selected(file)
	},
	busy(value: boolean) {
		const button = this.getUI('pick')![0] as HTMLButtonElement
		button.disabled = value
		button.classList.toggle('is-loading', value)
	},
}).setDomApi(LitDomApi)
const SuccessView = View.extend({
	initialize(options: { message: string; navigate: (href: string) => void }) {
		void options
	},
	ui: { overview: 'a' },
	events: { 'click @ui.overview': 'navigate' },
	navigate(event: MouseEvent) {
		interceptLink(event, this.options.navigate)
	},
	templateContext() {
		return this.options
	},
	template({ message }: { message: string }) {
		return html`<div class="success-step">
			<div class="message mbe-4">${message}</div>
			<a class="button is-primary" href="/">${t('home.goToOverview')}</a>
		</div>`
	},
}).setDomApi(LitDomApi)
export const CSVImportView = View.extend({
	className: 'content csv-migration native-import native-list-surface native-list-body',
	initialize(options: Options) {
		void options
	},
	regions: { body: '[data-body]' },
	ui: { error: '[data-error]' },
	createState() {
		return { request: undefined as AbortController | undefined }
	},
	template() {
		return html`<h1>${t('migrate.titleService', { name: 'CSV' })}</h1>
			<p>${t('migrate.csv.description')}</p>
			<div data-error class="message danger mbe-4" role="alert" hidden></div>
			<div data-body></div>`
	},
	onRender() {
		this.showUpload()
	},
	showUpload() {
		this.showChildView(
			'body',
			new UploadView({
				selected: (file: File) => {
					void this.selected(file)
				},
			}),
		)
	},
	async selected(file: File) {
		const state = this.getState()
		state.request?.abort()
		const request = (state.request = new AbortController()),
			upload = this.getChildView('body') as InstanceType<typeof UploadView>,
			error = this.getUI('error')![0] as HTMLElement
		upload.busy(true)
		error.hidden = true
		try {
			const detection = await new CSVMigrationService().detect(
				file,
				request.signal,
			)
			if (
				request.signal.aborted ||
				this.isDestroyed() ||
				!this.options.current()
			)
				return
			this.showChildView(
				'body',
				new CSVMappingView({
					current: this.options.current,
					context: this.options.context,
					refresh: this.options.refresh,
					navigate: this.options.navigate,
					file,
					detection,
					cancel: () => this.showUpload(),
					accepted: (message: string) =>
						this.showChildView(
							'body',
							new SuccessView({ message, navigate: this.options.navigate }),
						),
				}),
			)
		} catch (e) {
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				this.options.current()
			) {
				error.textContent = errorText(e)
				error.hidden = false
			}
		} finally {
			if (state.request === request) state.request = undefined
			if (
				!request.signal.aborted &&
				!this.isDestroyed() &&
				!upload.isDestroyed()
			)
				upload.busy(false)
		}
	},
	onBeforeDestroy() {
		this.getState().request?.abort()
	},
}).setDomApi(LitDomApi)
