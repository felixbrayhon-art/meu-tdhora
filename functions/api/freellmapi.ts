import handleFreeLLMAPIRequest from '../../api/freellmapi';
import { runNodeHandler } from '../_lib/nodeAdapter';
import { withFontes } from '../_lib/fontes';

type Context = Parameters<typeof runNodeHandler>[1] & {
  env: Record<string, unknown> & { FREELLMAPI_TUNNEL?: { get: (key: string) => Promise<string | null> }; FONTES?: any };
};

// FreeLLMAPI runs on Brayhon's Mac behind a Cloudflare quick tunnel whose address changes
// on every start; ~/freellmapi-tunnel/start.sh writes the current one to this KV key.
export const onRequest = async (context: Context) => {
  const tunnelUrl = await context.env.FREELLMAPI_TUNNEL?.get('base_url').catch(() => null);
  const env = tunnelUrl ? { ...context.env, FREELLMAPI_BASE_URL: tunnelUrl } : context.env;
  return runNodeHandler(handleFreeLLMAPIRequest, { ...context, env, request: await withFontes(context.request, context.env.FONTES) });
};
