import { afterEach, expect, it, vi } from 'vitest';
import { TaskColorView, TaskMoveView } from './task-location';
import { TaskRecordSession } from '@/features/task/task-record';
import TaskModel from '@/models/task';
import ProjectService from '@/services/project';
import ProjectModel from '@/models/project';
const owners: {
    destroy: () => unknown;
}[] = [];
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); vi.restoreAllMocks(); document.body.replaceChildren(); });
it('color keeps a later draft while an earlier serialized write returns', async () => { let resolve!: (task: TaskModel) => void; const update = vi.fn().mockImplementationOnce(() => new Promise(ready => resolve = ready)).mockImplementation(task => Promise.resolve(task)); const record = new TaskRecordSession(new TaskModel({ id: 1, maxPermission: 2 }), update); const view = new TaskColorView({ record }); owners.push(view); view.render(); const first = view.save('#1973ff'), second = view.save('#ff4136'); await Promise.resolve(); resolve(new TaskModel({ id: 1, hexColor: '#1973ff', maxPermission: 2 })); await first; await second; expect(update).toHaveBeenCalledTimes(2); expect(record.task.hexColor).toBe('#ff4136'); expect(view.getState().dirty).toBe(false); });
it('destroy aborts a color write and leaves the accepted record intact', async () => { let resolve!: (task: TaskModel) => void, signal: AbortSignal | undefined; const record = new TaskRecordSession(new TaskModel({ id: 1, maxPermission: 2 }), (task, request) => { signal = request; return new Promise(ready => resolve = ready); }); const view = new TaskColorView({ record }); view.render(); const pending = view.save('#ff4136'); await Promise.resolve(); view.destroy(); expect(signal?.aborted).toBe(true); resolve(new TaskModel({ id: 1, hexColor: '#ff4136', maxPermission: 2 })); await pending; expect(record.task.hexColor).toBe(''); });
it('move load excludes readonly archived current and pseudo projects', async () => { vi.spyOn(ProjectService.prototype, 'getAll').mockResolvedValue([new ProjectModel({ id: 1, maxPermission: 2 }), new ProjectModel({ id: 2, maxPermission: 0 }), new ProjectModel({ id: 3, maxPermission: 2, isArchived: true }), new ProjectModel({ id: -2, maxPermission: 2 }), new ProjectModel({ id: 4, maxPermission: 2, title: 'Destination' })]); const record = new TaskRecordSession(new TaskModel({ id: 1, projectId: 1, maxPermission: 2 }), async (task) => task); const view = new TaskMoveView({ record }); owners.push(view); view.render(); await view.load(); expect((view.getChildView('search') as InstanceType<typeof import('../settings/settings-search').SettingsSearchView>).options.items).toEqual([{ value: 4, label: 'Destination' }]); });
it('readonly color controls cannot submit a task mutation', async () => { const update = vi.fn(); const record = new TaskRecordSession(new TaskModel({ id: 1, maxPermission: 0, hexColor: '1973ff' }), update), view = new TaskColorView({ record }); owners.push(view); view.render(); expect(view.el.querySelector<HTMLInputElement>('input')?.disabled).toBe(true); await view.save('#ff4136'); expect(update).not.toHaveBeenCalled(); });

it('move submits identical pending selections once and serializes a later target', async () => {
 vi.spyOn(ProjectService.prototype, 'getAll').mockResolvedValue([]);
 let resolve!: (task: TaskModel) => void;
 const update = vi.fn().mockImplementationOnce(() => new Promise(ready => resolve = ready)).mockImplementation(async task => task);
 const record = new TaskRecordSession(new TaskModel({id: 1, projectId: 1, maxPermission: 2}), update);
 const view = new TaskMoveView({record}); owners.push(view); view.render();
 const first = view.save(2), duplicate = view.save(2), later = view.save(3);
 await Promise.resolve(); expect(update).toHaveBeenCalledTimes(1);
 resolve(new TaskModel({id: 1, projectId: 2, maxPermission: 2}));
 await Promise.all([first, duplicate, later]);
 expect(update.mock.calls.map(call => call[0].projectId)).toEqual([2, 3]); expect(record.task.projectId).toBe(3);
 await view.save(3); expect(update).toHaveBeenCalledTimes(2);
});

it('rejected move retains destination and retries without changing the accepted record', async () => {
 vi.spyOn(ProjectService.prototype, 'getAll').mockResolvedValue([]);
 const update = vi.fn().mockRejectedValueOnce(new Error('permission revoked')).mockImplementation(async task => task);
 const record = new TaskRecordSession(new TaskModel({id: 1, projectId: 1, maxPermission: 2}), update);
 const view = new TaskMoveView({record}); owners.push(view); view.render();
 await view.save(2); expect(record.task.projectId).toBe(1); expect(view.getState().selected).toBe(2); expect(view.getState().error).toBe('permission revoked');
 await view.save(2); expect(record.task.projectId).toBe(2); expect(view.getState().error).toBe('');
});
