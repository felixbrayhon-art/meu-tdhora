import { handleAIRequest } from '../../api/ai';
import { runNodeHandler } from '../_lib/nodeAdapter';
import { withFontes } from '../_lib/fontes';

type Context = Parameters<typeof runNodeHandler>[1] & { env: Record<string, unknown> & { FONTES?: any } };

export const onRequest = async (context: Context) =>
  runNodeHandler(handleAIRequest, { ...context, request: await withFontes(context.request, context.env.FONTES) });
