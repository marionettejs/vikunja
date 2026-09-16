import type {ViewInstance} from 'marionette'
import type {TaskRecord} from '../data/TaskRecords'
import type {TaskDetailScreen} from '../views/createTaskDetailScreen'

type TaskDetailScreenView = Pick<TaskDetailScreen, 'view' | 'saveBeforeLeave'>

interface TaskDetailWorkspace {
	load(id: number): Promise<TaskRecord>
}

interface TaskDetailControllerOptions {
	region: {show(view: ViewInstance): unknown; empty(): unknown}
	workspace: TaskDetailWorkspace
	createScreen(record: TaskRecord): TaskDetailScreenView
}

export class TaskDetailController {
	private generation = 0
	private destroyed = false
	private currentScreen: TaskDetailScreenView | null = null

	constructor(private options: TaskDetailControllerOptions) {}

	async open(id: number): Promise<void> {
		if (this.destroyed) {
			throw new Error('Task detail controller is destroyed')
		}

		const generation = ++this.generation

		let record: TaskRecord
		try {
			record = await this.options.workspace.load(id)
		} catch (error) {
			if (this.destroyed || generation !== this.generation) {
				return
			}
			throw error
		}

		if (this.destroyed || generation !== this.generation) {
			return
		}

		if (this.currentScreen !== null) {
			try {
				await this.currentScreen.saveBeforeLeave()
			} catch (error) {
				if (this.destroyed || generation !== this.generation) {
					return
				}
				throw error
			}
		}

		if (this.destroyed || generation !== this.generation) {
			return
		}

		const screen = this.options.createScreen(record)
		this.currentScreen = screen
		this.options.region.show(screen.view)
	}

	async close(): Promise<void> {
		if (this.destroyed) {
			return
		}

		const generation = ++this.generation
		if (this.currentScreen !== null) {
			try {
				await this.currentScreen.saveBeforeLeave()
			} catch (error) {
				if (this.destroyed || generation !== this.generation) {
					return
				}
				throw error
			}
		}

		if (this.destroyed || generation !== this.generation) {
			return
		}

		this.currentScreen = null
		this.options.region.empty()
	}

	destroy(): void {
		if (this.destroyed) {
			return
		}

		this.destroyed = true
		++this.generation
		this.currentScreen = null
		this.options.region.empty()
	}
}
