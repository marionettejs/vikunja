import { Model } from '@mnjs/data'
import type {ITask} from '@/modelTypes/ITask'

// ITask declares created and updated as non-nullable Date, but the API sends a
// zero-time year for "never" and normalizeTaskResponse reports that as null
// through parseDateOrNull. A record really can hold null there, so the attribute
// namespace says so rather than letting a cast hide it.
export type TaskAttributes = Omit<{ [K in keyof ITask]: ITask[K] }, 'created' | 'updated'> & {
	created: Date | null
	updated: Date | null
}
export type TaskRecord = Model<TaskAttributes>
export type TaskPatch = Partial<TaskAttributes> & { id: number }

export class TaskRecords {
	private _records = new Map<number, TaskRecord>()
	private _destroyed = false

	get(id: number): TaskRecord | undefined {
		if (this._destroyed) {
			return undefined
		}

		return this._records.get(id)
	}

	upsert(patch: TaskPatch): TaskRecord {
		if (this._destroyed) {
			throw new Error('Cannot upsert into destroyed TaskRecords')
		}

		const existing = this._records.get(patch.id)
		if (existing) {
			existing.set(patch)
			return existing
		}

		const record = new Model<TaskAttributes>(patch)
		this._records.set(patch.id, record)
		return record
	}

	remove(id: number): void {
		if (this._destroyed) {
			return
		}

		const record = this._records.get(id)
		if (record) {
			this._records.delete(id)
			record.destroy()
		}
	}

	destroy(): void {
		if (this._destroyed) {
			return
		}

		this._destroyed = true
		for (const record of this._records.values()) {
			record.destroy()
		}
		this._records.clear()
	}
}
