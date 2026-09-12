import type {TaskRecord, TaskRecords} from './TaskRecords'
import {normalizeTaskNested} from './normalizeTaskNested'
import {normalizeTaskParticipation} from './normalizeTaskParticipation'
import {normalizeTaskResponse} from './normalizeTaskResponse'
import {normalizeTaskUsers} from './normalizeUser'
import {stabilizePatch} from './stabilizePatch'

export function ingestTask(records: TaskRecords, raw: Record<string, unknown>): TaskRecord {
	const normalized = normalizeTaskParticipation(
		normalizeTaskNested(
			normalizeTaskUsers(
				normalizeTaskResponse(raw),
			),
		),
	)
	const previous = records.get(normalized.id)
	const stabilized = stabilizePatch(previous?.toObject() as Record<string, unknown> | undefined, normalized)
	return records.upsert(stabilized)
}
