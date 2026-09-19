<script setup lang="ts">
import {onMounted, onUnmounted, watch, ref, nextTick, computed, shallowReactive} from 'vue'
import {useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import PasswordResetService from '@/services/passwordReset'
import {RequestPasswordResetFormView, type RequestPasswordResetFormViewInstance} from '@/marionette/views/RequestPasswordResetFormView'
import {getErrorText} from '@/message'

import {useTitle} from '@/composables/useTitle'

const {t} = i18n.global
useTitle(() => t('user.auth.resetPassword'))

const router = useRouter()

const passwordResetService = shallowReactive(new PasswordResetService())

const isLoading = computed(() => passwordResetService.loading)

const errorMessage = ref('')
const isSuccess = ref(false)

let formView: RequestPasswordResetFormViewInstance | null = null
let isMounted = false
let renderGeneration = 0
let submitInFlight = false

function destroyFormView(): void {
	if (formView) {
		formView.destroy()
		formView = null
	}
}

function handleEmailChange(): void {
	errorMessage.value = ''
	formView?.setErrorMessage('')
}

async function handleSubmit(email: string) {
	if (submitInFlight) {
		return
	}
	submitInFlight = true
	formView?.setLoading(true)
	errorMessage.value = ''

	try {
		await passwordResetService.requestResetPassword({email})
		isSuccess.value = true
		formView?.setSuccess(true)
	} catch (e: unknown) {
		errorMessage.value = getErrorText(e)
		formView?.setErrorMessage(errorMessage.value)
	} finally {
		submitInFlight = false
		formView?.setLoading(isLoading.value)
	}
}

function handleLogin(): void {
	router.push({name: 'user.login'})
}

async function renderFormView(): Promise<void> {
	const generation = ++renderGeneration
	const draft = formView ? {
		email: (formView.el.querySelector('#email') as HTMLInputElement)?.value ?? '',
	} : null

	destroyFormView()

	await nextTick()

	if (!isMounted || generation !== renderGeneration) {
		return
	}

	const formEl = document.getElementById('request-password-reset-form-host')
	if (!formEl) {
		return
	}

	formView = new RequestPasswordResetFormView({
		t,
		loading: isLoading.value,
		errorMessage: errorMessage.value,
		isSuccess: isSuccess.value,
		onSubmit: handleSubmit,
		onLogin: handleLogin,
		onEmailChange: handleEmailChange,
	}) as RequestPasswordResetFormViewInstance

	formEl.appendChild(formView.el)
	formView.render()

	if (draft && draft.email) {
		const emailInput = formView.el.querySelector('#email') as HTMLInputElement | null
		if (emailInput) {
			emailInput.value = draft.email
		}
	}
}

onMounted(async () => {
	isMounted = true
	await renderFormView()
})

onUnmounted(() => {
	isMounted = false
	destroyFormView()
})

watch(
	() => [isLoading.value, errorMessage.value, isSuccess.value] as const,
	() => {
		if (formView) {
			formView.setLoading(isLoading.value)
			formView.setErrorMessage(errorMessage.value)
			formView.setSuccess(isSuccess.value)
		}
	},
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderFormView()
	}
})
</script>

<template>
	<div id="request-password-reset-form-host" />
</template>