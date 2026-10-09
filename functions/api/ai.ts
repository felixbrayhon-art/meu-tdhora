import { handleAIRequest } from '../../api/ai';
import { runNodeHandler } from '../_lib/nodeAdapter';

export const onRequest = (context: Parameters<typeof runNodeHandler>[1]) => runNodeHandler(handleAIRequest, context);
