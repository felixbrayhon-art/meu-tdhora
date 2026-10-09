import handleFreeLLMAPIRequest from '../../api/freellmapi';
import { runNodeHandler } from '../_lib/nodeAdapter';

export const onRequest = (context: Parameters<typeof runNodeHandler>[1]) => runNodeHandler(handleFreeLLMAPIRequest, context);
