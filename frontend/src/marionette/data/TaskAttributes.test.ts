import {describe, it, expectTypeOf} from 'vitest'
import type {TaskAttributes} from './TaskRecords'
import type {Label} from '@/client/generated'
import type {IUser} from '@/modelTypes/IUser'
import type {IAttachment} from '@/modelTypes/IAttachment'
import type {IBucket} from '@/modelTypes/IBucket'
import type {ITaskComment} from '@/modelTypes/ITaskComment'
import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import type {IRelationKind} from '@/types/IRelationKind'
import type {ITask} from '@/modelTypes/ITask'

describe('TaskAttributes', () => {
	it('TaskAttributes[\'labels\'] is Label[] | null', () => {
		expectTypeOf<TaskAttributes['labels']>().toEqualTypeOf<Label[] | null>()
	})

	it('TaskAttributes[\'assignees\'] is IUser[] | null', () => {
		expectTypeOf<TaskAttributes['assignees']>().toEqualTypeOf<IUser[] | null>()
	})

	it('TaskAttributes collection fields are nullable arrays', () => {
		expectTypeOf<TaskAttributes['attachments']>().toEqualTypeOf<IAttachment[] | null>()
		expectTypeOf<TaskAttributes['buckets']>().toEqualTypeOf<IBucket[] | null>()
		expectTypeOf<TaskAttributes['comments']>().toEqualTypeOf<ITaskComment[] | null>()
		expectTypeOf<TaskAttributes['reminders']>().toEqualTypeOf<ITaskReminder[] | null>()
	})

	it('TaskAttributes map fields are non-nullable maps with nullable values', () => {
		expectTypeOf<TaskAttributes['reactions']>().toEqualTypeOf<{[reaction: string]: IUser[] | null}>()
		expectTypeOf<TaskAttributes['relatedTasks']>().toEqualTypeOf<Partial<Record<IRelationKind, ITask[] | null>>>()
	})

	it('TaskAttributes[\'created\'] and updated are Date | null', () => {
		expectTypeOf<TaskAttributes['created']>().toEqualTypeOf<Date | null>()
		expectTypeOf<TaskAttributes['updated']>().toEqualTypeOf<Date | null>()
	})

	it('TaskAttributes scalar fields stay non-nullable', () => {
		expectTypeOf<TaskAttributes['title']>().toEqualTypeOf<string>()
		expectTypeOf<TaskAttributes['description']>().toEqualTypeOf<string>()
		expectTypeOf<TaskAttributes['done']>().toEqualTypeOf<boolean>()
		expectTypeOf<TaskAttributes['id']>().toEqualTypeOf<number>()
	})

	it('TaskAttributes nullable date fields stay Date | null', () => {
		expectTypeOf<TaskAttributes['dueDate']>().toEqualTypeOf<Date | null>()
		expectTypeOf<TaskAttributes['startDate']>().toEqualTypeOf<Date | null>()
		expectTypeOf<TaskAttributes['endDate']>().toEqualTypeOf<Date | null>()
	})
})
