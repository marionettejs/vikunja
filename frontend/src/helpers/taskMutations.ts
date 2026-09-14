import type {ITask} from '@/modelTypes/ITask'

interface TaskMutationDependencies<TDeleteResult = unknown> {
	updatePersistence(task: ITask): Promise<ITask>
	deletePersistence(task: ITask): Promise<TDeleteResult>
	ensureTaskIsInCorrectBucket(task: ITask): void
	publishLastUpdatedTask(task: ITask): void
	removeTaskInBucket(task: ITask): void
}

export interface TaskMutations<TDeleteResult = unknown> {
	update(task: ITask): Promise<ITask>
	delete(task: ITask): Promise<TDeleteResult>
}

export function createTaskMutations<TDeleteResult = unknown>(
	dependencies: TaskMutationDependencies<TDeleteResult>,
): TaskMutations<TDeleteResult> {
	return {
		async update(task: ITask) {
			const updatedTask = await dependencies.updatePersistence(task)
			dependencies.ensureTaskIsInCorrectBucket(updatedTask)
			dependencies.publishLastUpdatedTask(updatedTask)
			return updatedTask
		},

		async delete(task: ITask) {
			const response = await dependencies.deletePersistence(task)
			dependencies.removeTaskInBucket(task)
			return response
		},
	}
}
