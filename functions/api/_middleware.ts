import { checkOrigin, HttpError, json, rateLimit, requireUser, type AccountEnv } from './account'
export const onRequest: PagesFunction<AccountEnv> = async context => {
  try {
    const path=new URL(context.request.url).pathname.replace(/\/$/,'')
    if(path==='/api/account') return await context.next()
    if(context.request.method!=='GET') checkOrigin(context.request,context.env)
    const user=await requireUser(context.request,context.env)
    await rateLimit(context.env,'ai:'+user.id,30,60)
    context.data.user=user
    const response=await context.next(); const headers=new Headers(response.headers); headers.set('Cache-Control','no-store'); headers.set('X-Content-Type-Options','nosniff')
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
  } catch(error) { return json({error:error instanceof HttpError?error.message:'Service unavailable. Please try again.'},error instanceof HttpError?error.status:503) }
}
