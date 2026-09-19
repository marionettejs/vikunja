<script setup lang="ts">
import {onMounted, onUnmounted, watch, ref, nextTick, computed} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {useAuthStore} from '@/stores/auth'
import {useConfigStore} from '@/stores/config'
import {useRedirectToLastVisited} from '@/composables/useRedirectToLastVisited'
import {RegisterFormView, type RegisterFormViewInstance} from '@/marionette/views/RegisterFormView'
import {parseValidationErrors, type ValidationError} from '@/helpers/parseValidationErrors'

import {useTitle} from '@/composables/useTitle'

const {t} = i18n.global
useTitle(() => t('user.auth.createAccount'))

const router = useRouter()
const authStore = useAuthStore()
const configStore = useConfigStore()
const {redirectIfSaved} = useRedirectToLastVisited()

const registrationEnabled = computed(() => configStore.auth.local.registrationEnabled)
const demoModeEnabled = computed(() => configStore.demoModeEnabled)

const isLoading = computed(() => authStore.isLoading)

const confirmEmailMessage = ref('')
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})

let formView: RegisterFormViewInstance | null = null
let isMounted = false

function destroyFormView(): void {
	if (formView) {
		formView.destroy()
		formView = null
	}
}

function isApiValidationError(error: unknown): error is ValidationError {
	return error !== null &&
		typeof error === 'object' &&
		'invalid_fields' in error
}

async function handleSubmit(credentials: {username: string; email: string; password: string}) {
	errorMessage.value = ''
	fieldErrors.value = {}
	confirmEmailMessage.value = ''
	formView?.setFieldErrors({})
	formView?.setErrorMessage('')
	formView?.setConfirmEmailMessage('')

	try {
		await authStore.register(credentials)
		redirectIfSaved()
	} catch (e: unknown) {
		if (e instanceof Object && 'code' in e && e.code === 1012) {
			confirmEmailMessage.value = t('user.auth.registrationConfirmEmail')
			formView?.setConfirmEmailMessage(confirmEmailMessage.value)
			return
		}

		if (isApiValidationError(e)) {
			const parsed = parseValidationErrors(e)

			if (Object.keys(parsed).length > 0) {
				fieldErrors.value = parsed
				formView?.setFieldErrors(parsed)
			} else {
				errorMessage.value = t('user.auth.registrationFailed')
				formView?.setErrorMessage(errorMessage.value)
			}
		} else if (e instanceof Object && 'message' in e && typeof e.message === 'string') {
			errorMessage.value = e.message
			formView?.setErrorMessage(errorMessage.value)
		} else {
			errorMessage.value = t('user.auth.registrationFailed')
			formView?.setErrorMessage(errorMessage.value)
		}
	}
}

function handleLogin(): void {
	router.push({name: 'user.login'})
}

async function renderFormView(): Promise<void> {
	destroyFormView()

	await nextTick()

	const formEl = document.getElementById('register-form-host')
	if (!formEl) {
		return
	}

	formView = new RegisterFormView({
		t,
		registrationEnabled: registrationEnabled.value,
		demoModeEnabled: demoModeEnabled.value,
		loading: isLoading.value,
		errorMessage: errorMessage.value,
		confirmEmailMessage: confirmEmailMessage.value,
		fieldErrors: fieldErrors.value,
		onSubmit: handleSubmit,
		onLogin: handleLogin,
	}) as RegisterFormViewInstance

	formEl.appendChild(formView.el)
	formView.render()
}

async function initPage(): Promise<void> {
	if (authStore.authenticated) {
		router.push({name: 'home'})
		return
	}
}

onMounted(async () => {
	isMounted = true
	await initPage()
	renderFormView()
})

onUnmounted(() => {
	isMounted = false
	destroyFormView()
})

watch(
	() => [isLoading.value, errorMessage.value, confirmEmailMessage.value] as const,
	() => {
		if (formView) {
			formView.setLoading(isLoading.value)
			formView.setErrorMessage(errorMessage.value)
			formView.setConfirmEmailMessage(confirmEmailMessage.value)
		}
	},
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderFormView()
	}
})

watch(
	() => [registrationEnabled.value, demoModeEnabled.value] as const,
	() => {
		if (isMounted) {
			renderFormView()
		}
	},
)
</script>

<template>
	<div id="register-form-host" />
</template>