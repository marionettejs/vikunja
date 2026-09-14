import {describe, expect, it, vi} from 'vitest'

import type {ITask} from '@/modelTypes/ITask'

import {createTaskMutations} from './taskMutations'

describe('taskMutations', () => {
	describe('update', () => {
		it('runs persistence before bucket and publish and returns the persistence result', async () => {
			const events: string[] = []
			const ensureTaskIsInCorrectBucket = vi.fn(() => {
				events.push('bucket')
			})
			const publishLastUpdatedTask = vi.fn(() => {
				events.push('publish')
			})
			const originalTask = {id: 1} as ITask
			const persistedTask = {id: 2} as ITask

			const taskMutations = createTaskMutations({
				updatePersistence: vi.fn(async () => {
					events.push('persistence')
					return persistedTask
				}),
				deletePersistence: vi.fn(),
				ensureTaskIsInCorrectBucket,
				publishLastUpdatedTask,
				removeTaskInBucket: vi.fn(),
			})

			const result = await taskMutations.update(originalTask)

			expect(result).toBe(persistedTask)
			expect(events).toEqual(['persistence', 'bucket', 'publish'])
			expect(ensureTaskIsInCorrectBucket).toHaveBeenCalledWith(persistedTask)
			expect(publishLastUpdatedTask).toHaveBeenCalledWith(persistedTask)
		})

		it('prevents bucket placement and publish when persistence rejects', async () => {
			const events: string[] = []
			const error = new Error('rejected')
			const originalTask = {id: 1} as ITask

			const taskMutations = createTaskMutations({
				updatePersistence: vi.fn(async () => {
					events.push('persistence')
					throw error
				}),
				deletePersistence: vi.fn(),
				ensureTaskIsInCorrectBucket: vi.fn(() => {
					events.push('bucket')
				}),
				publishLastUpdatedTask: vi.fn(() => {
					events.push('publish')
				}),
				removeTaskInBucket: vi.fn(),
			})

			await expect(taskMutations.update(originalTask)).rejects.toBe(error)
			expect(events).toEqual(['persistence'])
		})
	})

	describe('delete', () => {
		it('does not remove the task when persistence rejects', async () => {
			const failure = new Error('delete rejected')
			const removeTaskInBucket = vi.fn()
			const mutations = createTaskMutations({
				updatePersistence: vi.fn(),
				deletePersistence: vi.fn().mockRejectedValue(failure),
				ensureTaskIsInCorrectBucket: vi.fn(),
				publishLastUpdatedTask: vi.fn(),
				removeTaskInBucket,
			})
			await expect(mutations.delete({id: 1} as ITask)).rejects.toBe(failure)
			expect(removeTaskInBucket).not.toHaveBeenCalled()
		})

		it('removes the original task from the bucket and returns the persistence result', async () => {
			const deletePersistence = vi.fn(async (task: ITask) => {
				events.push(`delete ${task.id}`)
				return deleteResult
			})
			const removeTaskInBucket = vi.fn((task: ITask) => {
				events.push(`remove ${task.id}`)
			})
			const events: string[] = []
			const originalTask = {id: 7} as ITask
			const deleteResult = {ok: true}

			const taskMutations = createTaskMutations({
				updatePersistence: vi.fn(),
				deletePersistence,
				ensureTaskIsInCorrectBucket: vi.fn(),
				publishLastUpdatedTask: vi.fn(),
				removeTaskInBucket,
			})

			const result = await taskMutations.delete(originalTask)

			expect(result).toBe(deleteResult)
			expect(events).toEqual(['delete 7', 'remove 7'])
			expect(deletePersistence).toHaveBeenCalledWith(originalTask)
			expect(removeTaskInBucket).toHaveBeenCalledWith(originalTask)
		})
	})
})
