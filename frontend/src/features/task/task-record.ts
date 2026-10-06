import {klona} from 'klona'
import type {ITask} from '@/modelTypes/ITask'

export type TaskRecordPatch = Partial<ITask>
type Published = (task: ITask, fields: (keyof ITask)[]) => void

// The task destination owns this session; Views submit only the fields they edit.
export class TaskRecordSession {
	private record: ITask
	private life = new AbortController()
	private tail: Promise<unknown> = Promise.resolve()
	private listeners = new Set<Published>()
	private flushers = new Set<() => Promise<unknown>>()
	constructor(task: ITask, private update: (task: ITask, signal: AbortSignal) => Promise<ITask>) { this.record = klona(task) }
	get task() { return klona(this.record) }
	observe(listener: Published) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
	beforeClose(flush: () => Promise<unknown>) { this.flushers.add(flush); return () => this.flushers.delete(flush) }
	async flush() { await Promise.all(Array.from(this.flushers, flush => flush())) }
	save(patch: TaskRecordPatch, signal?: AbortSignal, deriveEndDate = true): Promise<ITask> {
		const submitted = klona(patch)
		const fields = Object.keys(submitted) as (keyof ITask)[]
		const operation = this.tail.then(async () => {
			this.life.signal.throwIfAborted(); signal?.throwIfAborted()
			const request = new AbortController(), abort = () => request.abort()
			this.life.signal.addEventListener('abort', abort, {once: true}); signal?.addEventListener('abort', abort, {once: true})
			try {
				const draft = {...klona(this.record), ...submitted}
				if (deriveEndDate && draft.endDate === null && draft.startDate !== null && draft.dueDate !== null) { draft.endDate = draft.dueDate; if (!fields.includes('endDate')) fields.push('endDate') }
				const beforeRequest = this.record
				const saved = await this.update(draft, request.signal)
				request.signal.throwIfAborted()
				// Relation endpoints may publish while this task POST is pending.
				const concurrent = Object.fromEntries(Object.keys(this.record).filter(field => JSON.stringify(this.record[field as keyof ITask]) !== JSON.stringify(beforeRequest[field as keyof ITask])).map(field => [field, this.record[field as keyof ITask]]))
				this.record = {...saved, ...concurrent, maxPermission: this.record.maxPermission}
				// Include server effects (for example repeating completion dates), not echoed unchanged fields.
				for (const field of Object.keys(saved) as (keyof ITask)[]) if (JSON.stringify(saved[field]) !== JSON.stringify(draft[field]) && !(field in concurrent) && !fields.includes(field)) fields.push(field)
				for (const listener of this.listeners) listener(klona(this.record), [...fields])
				return klona(this.record)
			} finally { this.life.signal.removeEventListener('abort', abort); signal?.removeEventListener('abort', abort) }
		})
		this.tail = operation.catch(() => {})
		return operation
	}
	acceptFields(patch: TaskRecordPatch) { if (this.life.signal.aborted) return; this.record = {...this.record, ...klona(patch)}; for (const listener of this.listeners) listener(klona(this.record), Object.keys(patch) as (keyof ITask)[]) }
	close() { this.life.abort(); this.listeners.clear(); this.flushers.clear() }
}
