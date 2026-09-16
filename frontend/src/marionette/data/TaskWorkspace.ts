import type {TaskRecord} from './TaskRecords'
import type {TaskTransport} from './TaskTransport'
import {TaskRecords} from './TaskRecords'
import {createTaskTransport} from './TaskTransport'
import {ingestTask} from './ingestTask'
import {serializeTask} from '@/helpers/taskPayload'
import {PERMISSIONS} from '@/constants/permissions'

export type TaskContentPatch = {title: string; description?: never} | {description: string; title?: never}

export class TaskWorkspace {
	private _records = new TaskRecords()
	private _transport: TaskTransport
	private _destroyed = false
	// Per-task queue: each entry is the tail of the chain for that task ID.
	private _queues = new Map<number, Promise<unknown>>()

	constructor(transport?: TaskTransport) {
		this._transport = transport ?? createTaskTransport()
	}

	// Appends work onto the per-task queue and releases the slot on settle.
	private _enqueue<T>(id: number, work: () => Promise<T>): Promise<T> {
		const tail = this._queues.get(id) ?? Promise.resolve()
		const next = tail.then(work, work)

		// Release this slot once settled; the reference is captured by value.
		const released = next.then(
			() => { if (this._queues.get(id) === released) this._queues.delete(id) },
			() => { if (this._queues.get(id) === released) this._queues.delete(id) },
		)
		this._queues.set(id, released)
		return next
	}

	load(id: number): Promise<TaskRecord> {
		return this._enqueue(id, async () => {
			if (this._destroyed) {
				throw new Error('TaskWorkspace has been destroyed')
			}

			const raw = await this._transport.load(id)

			if (this._destroyed) {
				throw new Error('TaskWorkspace has been destroyed')
			}

			const responseId = raw['id']
			if (responseId !== id) {
				throw new Error(`Response id ${String(responseId)} does not match requested id ${id}`)
			}

			return ingestTask(this._records, raw)
		})
	}

	update(id: number, patch: TaskContentPatch): Promise<TaskRecord> {
		return this._enqueue(id, async () => {
			if (this._destroyed) {
				throw new Error('TaskWorkspace has been destroyed')
			}

			const record = this._records.get(id)
			if (!record) {
				throw new Error(`No loaded record for task ${id}`)
			}

			const obj = record.toObject()
			if (obj.id !== id) {
				throw new Error(`Record id ${String(obj.id)} does not match requested id ${id}`)
			}

			const perm = obj.maxPermission
			if (perm !== PERMISSIONS.READ_WRITE && perm !== PERMISSIONS.ADMIN) {
				throw new Error(`Insufficient permission to update task ${id}`)
			}

			let updated = obj
			if (typeof patch.title === 'string') {
				const title = patch.title.trim()
				if (title === '') {
					throw new Error('title must not be blank')
				}
				updated = {...updated, title}
			} else {
				updated = {...updated, description: patch.description}
			}

			// Snapshot the full merged record with the supplied content; do not mutate record before success.
			const snapshot = serializeTask(updated)

			const raw = await this._transport.update(id, snapshot)

			if (this._destroyed) {
				throw new Error('TaskWorkspace has been destroyed')
			}

			if (raw.id !== id) {
				throw new Error(`Response id ${String(raw.id)} does not match requested id ${id}`)
			}
			const mergedRaw = {...raw}
			if (raw.max_permission === undefined) {
				mergedRaw.max_permission = record.get('maxPermission')
			}

			return ingestTask(this._records, mergedRaw)
		})
	}

	destroy(): void {
		if (this._destroyed) {
			return
		}
		this._destroyed = true
		this._records.destroy()
		this._queues.clear()
	}
}
