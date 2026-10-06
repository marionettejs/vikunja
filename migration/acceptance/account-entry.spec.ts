import {test, expect} from './fixtures'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'
import {UserFactory} from '../../frontend/tests/factories/user'
import {TokenFactory} from '../../frontend/tests/factories/token'
import {TotpFactory} from '../../frontend/tests/factories/totp'
import {generate} from '../../frontend/node_modules/otplib/dist/index.js'
const username = 'entry-owner', email = 'entry@example.com', totpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
const response = (page, path: string) => page.waitForResponse(r => new URL(r.url()).pathname.endsWith(path) && r.request().method() === 'POST')
async function credentials(page, password = TEST_PASSWORD) {await page.locator('#username').fill(username); await page.locator('#password').fill(password)}
test.beforeEach(async ({page, currentUser}) => {void currentUser; await UserFactory.create(1, {username, email}); await setupApiUrl(page)})
test('registration persists an actual new identity and reloads authenticated', async ({page, apiContext}, info) => {
 await page.goto('/register'); await expect(page.locator('#username')).toBeFocused()
 await page.locator('#username').fill('new-entry-user'); await page.locator('#email').fill('new-entry@example.com'); await page.locator('#password').fill('RegisterPass123')
 const created=response(page,'/register'); await page.locator('#register-submit').click(); const result=await created; expect(result.ok()).toBe(true); expect(result.request().postDataJSON()).toMatchObject({email:'new-entry@example.com'})
 await expect(page).toHaveURL(/\/$/); await expect(page.locator('.navbar')).toBeVisible()
 const token=await page.evaluate(()=>localStorage.getItem('token'));expect(token).toBeTruthy()
 const user=await apiContext.get('user',{headers:{Authorization:`Bearer ${token}`}});expect(user.ok()).toBe(true);expect(await user.json()).toMatchObject({username:'new-entry-user'})
 await info.attach('register', {body:await page.screenshot(),contentType:'image/png'});await page.reload();await expect(page.locator('.navbar')).toBeVisible()
})
test('registration duplicate error preserves credentials and failed field validation can be corrected', async ({page}) => {
 await page.goto('/register');await page.locator('#username').fill(username);await page.locator('#email').fill('another@example.com');await page.locator('#password').fill('RegisterPass123')
 const rejected=response(page,'/register');await page.locator('#register-submit').click();expect((await rejected).status()).toBe(400)
 await expect(page.locator('.message.danger')).toContainText('A user with this username already exists.');await expect(page.locator('#username')).toHaveValue(username);await expect(page.locator('#password')).toHaveValue('RegisterPass123')
 await page.route('**/api/v1/register',route=>route.fulfill({status:400,json:{code:2002,message:'Validation failed',invalid_fields:['email: Fixture email validation']}}))
 await page.locator('#username').fill('field-entry');await page.locator('#register-submit').click();await expect(page.getByText('Fixture email validation',{exact:true})).toBeVisible()
 await page.locator('#email').fill('corrected@example.co');await page.locator('#email').pressSequentially('m');await expect(page.getByText('Fixture email validation',{exact:true})).toHaveCount(0)
})
test('registration confirmation-needed notice retains form after successful registration',async({page})=>{
 await page.route('**/api/v1/login',route=>route.fulfill({status:412,json:{code:1012,message:'Please confirm your email address.'}}));await page.goto('/register')
 await page.locator('#username').fill('verify-entry');await page.locator('#email').fill('verify-entry@example.com');await page.locator('#password').fill('RegisterPass123');await page.locator('#register-submit').click()
 await expect(page.locator('.message.success')).toContainText('check your inbox');await expect(page).toHaveURL(/\/register$/);await expect(page.locator('#password')).toHaveValue('RegisterPass123')
})
for(const width of [1440,390])test(`actual password reset token, new-password login and token reuse rejection ${width}`,async({page,apiContext},info)=>{
 await page.setViewportSize({width,height:900});const token='account-reset-fixture-token';await TokenFactory.create(1,{token,user_id:1,kind:1})
 await page.goto(`/?userPasswordReset=${token}`);await expect(page).toHaveURL(new RegExp(`/password-reset\\?userPasswordReset=${token}$`));await page.locator('#password').fill('ChangedPassword123')
 const updated=response(page,'/user/password/reset');await page.getByRole('button',{name:'Reset your password',exact:true}).click();expect((await updated).ok()).toBe(true)
 await expect(page.locator('.message.success')).toContainText('The password was updated successfully.');await info.attach('password-reset-success',{body:await page.screenshot(),contentType:'image/png'})
 const oldLogin=await apiContext.post('login',{data:{username,password:TEST_PASSWORD}});expect(oldLogin.status()).toBe(403)
 await page.getByRole('link',{name:'Login',exact:true}).click();await credentials(page,'ChangedPassword123');const login=response(page,'/login');await page.locator('#loginform button').filter({hasText:'Login'}).click();expect((await login).ok()).toBe(true);await expect(page).toHaveURL(/\/$/)
 const reused=await apiContext.post('user/password/reset',{data:{token,new_password:'ReusePassword123'}});expect(reused.status()).toBe(412)
})
test('password reset invalid/missing token and request email error/loading/retry',async({page})=>{
 await page.goto('/password-reset');await expect(page).toHaveURL(/\/login$/);await page.goto('/password-reset?userPasswordReset=invalid-entry-token');await page.locator('#password').fill('ChangedPassword123');await page.getByRole('button',{name:'Reset your password',exact:true}).click();await expect(page.locator('.message:visible')).toContainText('Invalid token')
 await page.goto('/get-password-reset');await expect(page.locator('#email')).toBeFocused();await page.locator('#email').fill(email)
 let fail=true;await page.route('**/user/password/token',route=>fail?route.fulfill({status:500,json:{message:'Fixture reset request unavailable'}}):route.continue())
 await page.getByRole('button',{name:'Send me a password reset link',exact:true}).click();await expect(page.locator('.message.danger')).toContainText('Fixture reset request unavailable');await expect(page.locator('#email')).toHaveValue(email)
 fail=false;const requested=response(page,'/user/password/token');await page.getByRole('button',{name:'Send me a password reset link',exact:true}).click();expect((await requested).ok()).toBe(true);await expect(page.locator('.message.success')).toContainText('Check your inbox!');await expect(page.getByRole('link',{name:'Login',exact:true})).toBeVisible()
})
test('actual email confirmation activates user and consumes stored token on success/error',async({page})=>{
 const token='account-confirm-fixture-token';await UserFactory.create(1,{username,email,status:1});await TokenFactory.create(1,{token,user_id:1,kind:2})
 const confirmed=response(page,'/user/confirm');await page.goto(`/?userEmailConfirm=${token}`);expect((await confirmed).ok()).toBe(true);await expect(page.locator('.message.success')).toContainText('You successfully confirmed your email');expect(await page.evaluate(()=>localStorage.getItem('emailConfirmToken'))).toBeNull()
 await credentials(page,'wrong-password');const rejected=response(page,'/login');await page.locator('#loginform button').filter({hasText:'Login'}).click();expect((await rejected).status()).toBe(403);await expect(page.locator('.message.success')).toContainText('You successfully confirmed your email');await expect(page.locator('.message.danger')).toBeVisible();await credentials(page);const accepted=response(page,'/login');await page.locator('#loginform button').filter({hasText:'Login'}).click();expect((await accepted).ok()).toBe(true);await expect(page).toHaveURL(/\/$/);await expect(page.locator('.navbar')).toBeVisible()
 await page.evaluate(()=>localStorage.removeItem('token'));await page.context().clearCookies();await page.goto('/login?userEmailConfirm=invalid-confirm-token');await expect(page.locator('.message.danger')).toContainText('Invalid');expect(await page.evaluate(()=>localStorage.getItem('emailConfirmToken'))).toBeNull()
})
test('actual TOTP challenge focuses passcode, preserves credentials and accepts a valid code',async({page},info)=>{
 await TotpFactory.create(1,{user_id:1,secret:totpSecret,url:`otpauth://totp/Vikunja:entry?secret=${totpSecret}&issuer=Vikunja`});await page.goto('/login');await credentials(page);const required=response(page,'/login');await page.locator('#loginform button').filter({hasText:'Login'}).click();expect((await required).status()).toBe(412)
 const passcode=page.locator('#totpPasscode');await expect(passcode).toBeFocused();await expect(page.locator('#username')).toHaveValue(username);await expect(page.locator('#password')).toHaveValue(TEST_PASSWORD)
 await passcode.fill('123');const bad=response(page,'/login');await passcode.press('Enter');expect((await bad).ok()).toBe(false);await expect(passcode).toHaveValue('123');await expect(page.locator('.message.danger')).toBeVisible()
 await info.attach('totp-challenge',{body:await page.screenshot(),contentType:'image/png'});await passcode.fill(await generate({secret:totpSecret}));const good=response(page,'/login');await passcode.press('Enter');expect((await good).ok()).toBe(true);await expect(page).toHaveURL(/\/$/)
})
test('shared permissions are enforced by actual backend task/comment writes, independently of controls',async({apiContext})=>{
 const owner=await apiContext.post('login',{data:{username,password:TEST_PASSWORD}});expect(owner.ok()).toBe(true);const userToken=(await owner.json()).token
 const {ProjectFactory}=await import('../../frontend/tests/factories/project'),{TaskFactory}=await import('../../frontend/tests/factories/task'),{TaskCommentFactory}=await import('../../frontend/tests/factories/task_comment'),{LinkShareFactory}=await import('../../frontend/tests/factories/link_sharing')
 await ProjectFactory.create(1);await TaskFactory.create(1,{title:'Permission authority'});await TaskCommentFactory.create(1,{author_id:1,comment:'Owner comment'});await LinkShareFactory.create(1,{hash:'entry-share',permission:0})
 let auth=await apiContext.post('shares/entry-share/auth',{data:{password:''}});expect(auth.ok()).toBe(true);let token=(await auth.json()).token
 const denied=await apiContext.post('tasks/1',{headers:{Authorization:`Bearer ${token}`},data:{title:'Forbidden change',project_id:1}});expect(denied.status()).toBe(403)
 await LinkShareFactory.create(1,{hash:'entry-share',permission:1});auth=await apiContext.post('shares/entry-share/auth',{data:{password:''}});token=(await auth.json()).token
 const comment=await apiContext.post('tasks/1/comments/1',{headers:{Authorization:`Bearer ${token}`},data:{comment:'Forbidden owner edit'}});expect(comment.status()).toBe(403)
 const original=await apiContext.get('tasks/1',{headers:{Authorization:`Bearer ${userToken}`}});expect((await original.json()).title).toBe('Permission authority')
})
test('delayed reset request disables duplicate submit and cannot publish after form replacement',async({page})=>{
 let started!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve}),gate=new Promise<void>(resolve=>{release=resolve});let count=0
 await page.route('**/user/password/token',async route=>{count++;const result=await route.fetch();started();await gate;await route.fulfill({response:result}).catch(()=>{})})
 await page.goto('/get-password-reset');await page.locator('#email').fill(email);const submit=page.getByRole('button',{name:'Send me a password reset link',exact:true});await submit.click();await ready;await expect(submit).toBeDisabled();await expect(submit).toHaveClass(/is-loading/);await expect(page.locator('#email')).toHaveValue(email)
 await page.evaluate(()=>{history.pushState({},'','/register');window.dispatchEvent(new PopStateEvent('popstate'))});await expect(page.locator('#registerform')).toBeVisible();await expect(page.locator('#username')).toBeFocused();release();await page.unroute('**/user/password/token');await page.waitForLoadState('networkidle');expect(count).toBe(1);await expect(page).toHaveURL(/\/register$/);await expect(page.locator('.message.success')).not.toBeVisible()
})
test('delayed user read after login cannot publish across a new account-entry route',async({page})=>{
 let started!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve}),gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/v1/user',async route=>{const result=await route.fetch();started();await gate;await route.fulfill({response:result}).catch(()=>{})})
 await page.goto('/login');await credentials(page);await page.locator('#loginform button').filter({hasText:'Login'}).click();await ready
 await page.evaluate(()=>{history.pushState({},'','/register');window.dispatchEvent(new PopStateEvent('popstate'))});await expect(page.locator('#registerform')).toBeVisible();release();await page.unroute('**/api/v1/user');await page.waitForLoadState('networkidle');await expect(page).toHaveURL(/\/register$/);await expect(page.locator('#username')).toBeFocused();expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull()
})
test('authenticated pending-email confirmation uses actual token and updates identity before settings redirect',async({page,apiContext})=>{
 const confirmToken='pending-email-fixture-token';await UserFactory.create(1,{username,email,pending_email:'pending-entry@example.com'});await TokenFactory.create(1,{token:confirmToken,user_id:1,kind:2})
 const auth=await apiContext.post('login',{data:{username,password:TEST_PASSWORD}});expect(auth.ok()).toBe(true);const token=(await auth.json()).token;await page.addInitScript(token=>localStorage.setItem('token',token),token)
 const confirmed=response(page,'/user/confirm');await page.goto(`/?userEmailConfirm=${confirmToken}`);expect((await confirmed).ok()).toBe(true);await expect(page).toHaveURL(/\/user\/settings\/email-update$/)
 const user=await apiContext.get('user',{headers:{Authorization:`Bearer ${token}`}});expect((await user.json()).pending_email ?? '').toBe('')
 const login=await apiContext.post('login',{data:{username:'pending-entry@example.com',password:TEST_PASSWORD}});expect(login.ok()).toBe(true)
})
test('registration flag and local/LDAP form availability follow backend config without losing MOTD/legal links',async({page},info)=>{
 let phase=0
 await page.route('**/api/v1/info',async route=>{const response=await route.fetch(),config=await response.json();config.auth.local.registration_enabled=false;if(phase>0){config.auth.local.enabled=false;config.auth.ldap.enabled=phase===1};config.motd='Account entry fixture message';config.legal={imprint_url:'https://example.invalid/imprint',privacy_policy_url:'https://example.invalid/privacy'};await route.fulfill({response,json:config})})
 await page.goto('/register');await expect(page.getByText('Registration is disabled.',{exact:true})).toBeVisible();await expect(page.locator('#registerform')).toHaveCount(0);await expect(page.locator('.legal-links')).toContainText('Privacy');await info.attach('disabled-registration',{body:await page.screenshot(),contentType:'image/png'})
 phase=1;await page.goto('/login');await expect(page.locator('#loginform')).toBeVisible();await expect(page.getByRole('link',{name:'Create account',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Forgot your password?',exact:true})).toHaveCount(0);phase=2;await page.reload();await expect(page.locator('#loginform')).toHaveCount(0)
})
