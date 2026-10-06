import {test as shared, expect} from './fixtures'
import {TEST_PASSWORD} from '../../frontend/tests/support/constants'

// Browser-context transport owns the real refresh cookie. Original fixtures stay intact.
export const test=shared.extend({
 authenticatedPage:async ({page,currentUser},use)=>{
  const api=process.env.API_URL!,login=await page.context().request.post(api.replace('/api/v1/','/api/v2/')+'login',{data:{username:currentUser.username,password:TEST_PASSWORD}})
  expect(login.ok()).toBe(true)
  const {token}=await login.json()
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:process.env.BASE_URL!})
  await page.addInitScript(({api,token})=>{
   if(!location.protocol.startsWith('http'))return
   localStorage.setItem('API_URL',api);localStorage.setItem('token',token);Object.assign(window,{API_URL:api})
  },{api,token})
  await use(page)
  await page.goto('about:blank').catch(()=>{})
 },
})
export {expect}
