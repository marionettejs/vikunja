<template>
	<div class="heading">
		<div class="tw:flex tw:items-center md:tw:items-stretch tw:flex-col tw:gap-1 task-properties">
			<div class="tw:flex tw:items-center tw:gap-2">
				<ColorBubble
					v-if="task.hexColor !== ''"
					:color="getHexColor(task.hexColor)"
				/>
				<BaseButton @click="copyUrl">
					<span class="title task-id">
						{{ textIdentifier }}
					</span>
				</BaseButton>
			</div>
			<Done
				:is-done="task.done"
			/>
			<BaseButton
				v-if="hasClose"
				:aria-label="$t('task.detail.closeTaskDetail')"
				class="close d-print-none"
				@click="$emit('close')"
			>
				<Icon icon="times" />
			</BaseButton>
		</div>
		<MarionetteViewHost
			class="task-title-host"
			:view-factory="viewFactory"
		/>
		<BaseButton
			v-if="hasClose"
			:aria-label="$t('task.detail.closeTaskDetail')"
			class="close d-print-none"
			@click="$emit('close')"
		>
			<Icon icon="times" />
		</BaseButton>
		<CustomTransition name="fade">
			<span
				v-if="loading && saving"
				class="is-inline-flex is-align-items-center"
			>
				<span class="loader is-inline-block mie-2" />
				{{ $t('misc.saving') }}
			</span>
			<span
				v-else-if="!loading && showSavedMessage"
				class="has-text-success is-inline-flex is-align-content-center"
			>
				<Icon
					icon="check"
					class="mie-2"
				/>
				{{ $t('misc.saved') }}
			</span>
		</CustomTransition>
	</div>
</template>

<script setup lang="ts">
import {ref, computed, onBeforeUnmount, onUnmounted, watch} from 'vue'
import {useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'
import {Model} from '@mnjs/data'

import {error} from '@/message'
import BaseButton from '@/components/base/BaseButton.vue'
import CustomTransition from '@/components/misc/CustomTransition.vue'
import ColorBubble from '@/components/misc/ColorBubble.vue'
import Done from '@/components/misc/Done.vue'
import MarionetteViewHost from '@/components/bridge/MarionetteViewHost.vue'
import TaskTitleView from '@/marionette/views/TaskTitleView'
import type {TaskTitleModelAttributes} from '@/marionette/views/TaskTitleView'

import {useCopyToClipboard} from '@/composables/useCopyToClipboard'
import {useTaskStore} from '@/stores/tasks'

import type {ITask} from '@/modelTypes/ITask'
import {getHexColor, getTaskIdentifier} from '@/models/task'

const props = defineProps<{
	task: ITask,
	canWrite: boolean,
	hasClose: boolean,
}>()

const emit = defineEmits<{
	'update:task': [task: ITask],
	'close': [],
}>()

const router = useRouter()
const copy = useCopyToClipboard()
const {t, locale} = useI18n({useScope: 'global'})

async function copyUrl() {
	const route = router.resolve({name: 'task.detail', query: {taskId: props.task.id}})
	const absoluteURL = new URL(route.href, window.location.href).href

	await copy(absoluteURL)
}

const taskStore = useTaskStore()
const loading = computed(() => taskStore.isLoading)

const textIdentifier = computed(() => getTaskIdentifier(props.task))

const saving = ref(false)
const showSavedMessage = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null
let isDisposed = false

function clearSavedTimer() {
	if (savedTimer !== null) {
		clearTimeout(savedTimer)
		savedTimer = null
	}
}

const titleModel = new Model<TaskTitleModelAttributes>({
	title: props.task.title,
	canWrite: props.canWrite,
	label: props.canWrite ? t('task.attributes.title') : '',
})

watch(
	[() => props.task.title, () => props.canWrite, () => locale.value],
	([title, canWrite]) => {
		titleModel.set({
			title,
			canWrite,
			label: canWrite ? t('task.attributes.title') : '',
		})
	},
)

watch(
	() => props.task.id,
	() => {
		clearSavedTimer()
		showSavedMessage.value = false
		saving.value = false
		titleModel.set({
			title: props.task.title,
			canWrite: props.canWrite,
			label: props.canWrite ? t('task.attributes.title') : '',
		})
	},
)

async function saveTitle(title: string, capturedTaskId: number) {
	if (isDisposed || !props.canWrite || props.task.id !== capturedTaskId) {
		return
	}
	const currentTask = props.task
	try {
		saving.value = true
		const newTask = await taskStore.update({
			...currentTask,
			title,
		})
		if (isDisposed || props.task.id !== capturedTaskId) {
			return
		}
		emit('update:task', newTask)
		showSavedMessage.value = true
		clearSavedTimer()
		savedTimer = setTimeout(() => {
			showSavedMessage.value = false
			savedTimer = null
		}, 2000)
	} catch (err: unknown) {
		if (!isDisposed && props.task.id === capturedTaskId) {
			error(err)
		}
	} finally {
		if (!isDisposed && props.task.id === capturedTaskId) {
			saving.value = false
		}
	}
}

const taskId = computed(() => props.task.id)
const viewFactory = computed(() => {
	const capturedTaskId = taskId.value

	return () => {
		return new TaskTitleView({
			model: titleModel,
			onCommit: (title: string) => {
				void saveTitle(title, capturedTaskId)
			},
			onInvalid: () => {
				error({message: t('task.detail.titleRequired')})
			},
		})
	}
})

onBeforeUnmount(() => {
	isDisposed = true
	clearSavedTimer()
})

onUnmounted(() => {
	clearSavedTimer()
	titleModel.destroy()
})
</script>

<style lang="scss" scoped>
.heading {
	display: flex;
	justify-content: flex-start;
	text-transform: none;
	align-items: center;

	@media screen and (max-width: $tablet) {
		flex-direction: column;
		align-items: start;
	}
}

.task-title-host {
	display: contents;

	:deep(.title) {
		margin-block-end: 0;
	}

	:deep(.title.input) {
		min-block-size: calc(1.8rem * 1.125 + .6rem + 2px);
		margin-inline-end: 0;

		@media screen and (max-width: $tablet) {
			margin: 0 -.3rem .5rem;
		}
	}
}

.title {
	margin-block-end: 0;
}

.title.task-id {
	color: var(--grey-400);
	white-space: nowrap;
}

.color-bubble {
	block-size: .75rem;
	inline-size: .75rem;
}

.close {
	font-size: 2rem;
	margin-inline-start: 0.5rem;
	line-height: 1;

	@media screen and (max-width: $tablet) {
		display: none;
	}
	
	@media screen and (min-width: #{$desktop + 1px}) {
		display: none;
	}
}

.task-properties .close {
	display: none;
	position: absolute;
	inset-inline-end: 1.25rem;
	inset-block-start: 1.1rem;

	@media screen and (max-width: $tablet) {
		display: block;
	}
}

.task-properties {
	@media screen and (max-width: $tablet) {
		flex-direction: row;
	}
}
</style>
