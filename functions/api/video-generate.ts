interface Env {
  VIDEO_PROVIDER?: string
  VIDEO_PROVIDER_API_KEY?: string
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { prompt } = await request.json<any>()
  if (!prompt) return Response.json({ error: 'Prompt is required.' }, { status: 400 })

  if (!env.VIDEO_PROVIDER || !env.VIDEO_PROVIDER_API_KEY) {
    return Response.json({
      status: 'needs_provider',
      message: 'Prompt approved. The workflow is working. Add a supported video-provider API next (Seedance/Kling/Veo adapter) and this button will launch the render directly.'
    })
  }

  return Response.json({
    status: 'provider_pending',
    message: `Provider "${env.VIDEO_PROVIDER}" is configured, but its adapter has not been enabled yet.`
  })
}
