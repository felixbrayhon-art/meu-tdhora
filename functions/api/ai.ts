import { handleAIRequest } from '../../api/ai';
import { runNodeHandler } from '../_lib/nodeAdapter';
import { anexarConsenso, withFontes } from '../_lib/fontes';

type Context = Parameters<typeof runNodeHandler>[1] & { env: Record<string, unknown> & { FONTES?: any } };

export const onRequest = async (context: Context) => {
  const { request, consenso } = await withFontes(context.request, context.env.FONTES);
  return anexarConsenso(await runNodeHandler(handleAIRequest, { ...context, request }), consenso);
};
