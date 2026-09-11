import { Model } from '@mnjs/data'
import type { ITask } from '@/modelTypes/ITask'
import type { IRelationKind } from '@/types/IRelationKind'
import type { IUser } from '@/modelTypes/IUser'

// ITask declares created/updated as Date, but zero-time is normalized to null.
// The API schema also declares these collection fields nullable while scalars are not.
export type TaskAttributes = Omit<
	{ [K in keyof ITask]: ITask[K] },
	'created' | 'updated' | 'assignees' | 'attachments' | 'buckets' | 'comments' | 'labels' | 'reminders' | 'reactions' | 'relatedTasks'
> & {
	created: Date | null
	updated: Date | null
	assignees: ITask['assignees'] | null
	attachments: ITask['attachments'] | null
	buckets: ITask['buckets'] | null
	comments: ITask['comments'] | null
	labels: ITask['labels'] | null
	reminders: ITask['reminders'] | null
	reactions: { [reaction: string]: IUser[] | null } | null
	relatedTasks: Partial<Record<IRelationKind, ITask[] | null>> | null
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
