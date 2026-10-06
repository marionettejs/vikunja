import {VikunjaApplication} from './app/application'
import {configureApiClient} from './client/http'
import {setupKeyboardModality} from './helpers/keyboardModality'
import './shared/icons'
import './app/shell.scss'
import './styles/tailwind.css'
import 'flatpickr/dist/flatpickr.css'
import './styles/global.scss'
declare global {
	interface Window {API_URL: string; SENTRY_ENABLED?: boolean; SENTRY_DSN?: string; CUSTOM_LOGO_URL?: string; CUSTOM_LOGO_URL_DARK?: string}
}
window.API_URL = (localStorage.getItem('API_URL') ?? window.API_URL).replace(/\/$/, '')
configureApiClient(); setupKeyboardModality()
const app = new VikunjaApplication({region: {el: '#app'}})
void app.start().catch(console.error)
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy())
