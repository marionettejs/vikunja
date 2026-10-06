import type {IAbstract} from './IAbstract'
import type {IProject} from './IProject'
import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import type {PrefixMode} from '@/modules/quickAddMagic/prefixes'
type BasicColorSchema = 'light' | 'dark' | 'auto'
import type {SupportedLocale} from '@/shared/locales'
import type {DefaultProjectViewKind} from '@/modelTypes/IProjectView'
import type {Priority} from '@/constants/priorities'
import type {DateDisplay} from '@/constants/dateDisplay'
import type {TimeFormat} from '@/constants/timeFormat'
import type {IRelationKind} from '@/types/IRelationKind'

export interface IFrontendSettings {
	playSoundWhenDone: boolean
	quickAddMagicMode: PrefixMode
	colorSchema: BasicColorSchema
	allowIconChanges: boolean
	filterIdUsedOnOverview: IProject['id'] | null
	defaultView?: DefaultProjectViewKind
	minimumPriority?: Priority
	dateDisplay: DateDisplay
	timeFormat: TimeFormat
	defaultTaskRelationType: IRelationKind
	backgroundBrightness: number | null
	alwaysShowBucketTaskCount: boolean
	showLastViewed: boolean
	sidebarWidth: number | null
	commentSortOrder: 'asc' | 'desc'
	desktopQuickEntryShortcut: string
	quickAddDefaultReminders: ITaskReminder[]
	timeTrackingDefaultStart?: string
	defaultDueTime?: string
}

export interface IExtraSettingsLink {
	text: string
	url: string
}

export interface IExtraSettingsLinks {
	[key: string]: IExtraSettingsLink
}

export interface IUserSettings extends IAbstract {
	name: string
	emailRemindersEnabled: boolean
	discoverableByName: boolean
	discoverableByEmail: boolean
	overdueTasksRemindersEnabled: boolean
	overdueTasksRemindersTime: undefined | string | Date
	defaultProjectId: undefined | IProject['id']
	weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6
	timezone: string
	language: SupportedLocale | null
	frontendSettings: IFrontendSettings
	extraSettingsLinks: IExtraSettingsLinks
}
