import {expect,it} from 'vitest'
import NotificationModel from './notification'
import UserModel from './user'
import TaskModel from './task'
import ProjectModel from './project'
import {NOTIFICATION_NAMES as names,type NotificationData} from '@/modelTypes/INotification'
const user=new UserModel({id:1,username:'reader'}),doer=new UserModel({id:2,username:'author'})
const task=new TaskModel({id:10,index:12,title:'Review',identifier:''}),project=new ProjectModel({id:20,title:'Migration'})
const cases:Array<[string,NotificationData,string]>=[
 [names.TASK_COMMENT,{doer,task},'commented on #12'],
 [names.TASK_ASSIGNED,{doer,task,assignee:user},'assigned you to #12'],
 [names.TASK_DELETED,{doer,task},'deleted #12'],
 [names.TASK_CREATED,{doer,task},'created #12'],
 [names.PROJECT_CREATED,{doer,project},'created Migration'],
 [names.TEAM_MEMBER_ADDED,{doer,member:user,team:{id:30,name:'Reviewers'}},'added you to the Reviewers team'],
 [names.TASK_REMINDER,{task,project},'Reminder for #12 Review (Migration)'],
 [names.TASK_MENTIONED,{doer,task},'author mentioned you on #12'],
]
it.each(cases)('%s retains reference text for heterogeneous backend payloads',(name,payload,text)=>{
 const notification=new NotificationModel({name,notification:payload,created:new Date('2026-01-01')})
 expect(notification.toText(user)).toBe(text)
 expect(notification.created.toISOString()).toBe('2026-01-01T00:00:00.000Z')
})
it('an unknown or incomplete notification does not crash the shell',()=>{
 expect(new NotificationModel({name:'future.notification'}).toText(user)).toBe('')
 expect(new NotificationModel({name:names.TASK_ASSIGNED}).toText(user)).toBe('')
 expect(new NotificationModel({name:names.PROJECT_CREATED,notification:{project}}).notification.doer).toBeUndefined()
})
