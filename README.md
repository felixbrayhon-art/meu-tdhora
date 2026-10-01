<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/622d040b-30ba-42af-83ea-5c98b3b6252a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## FreeLLMAPI como fallback adicional

O app pode usar uma instalação própria do [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) quando o Gemini estiver indisponível. Gemini, Groq e OpenRouter continuam sendo tentados na ordem atual; FreeLLMAPI entra depois deles e escolhe os modelos disponíveis no seu roteador.

1. Instale e configure o FreeLLMAPI seguindo o guia oficial do repositório. Adicione pelo menos uma chave de provedor e copie a chave unificada da página **Keys**.
2. Em desenvolvimento, coloque no `.env.local`:

   ```env
   FREELLMAPI_BASE_URL=http://localhost:3001/v1
   FREELLMAPI_API_KEY=freellmapi-sua-chave-unificada
   FREELLMAPI_ALLOWED_UIDS=seu-uid-do-firebase
   FREELLMAPI_MODEL=auto
   ```

3. Para a versão hospedada na Vercel, configure as mesmas variáveis no ambiente da Vercel, mas use uma URL HTTPS acessível pelo servidor da Vercel. O endpoint `/api/freellmapi` valida a sessão Firebase e libera o uso somente para os UIDs listados em `FREELLMAPI_ALLOWED_UIDS`; encontre seu UID em **Firebase Console → Authentication → Users**. A chave unificada fica no servidor e não é incluída no JavaScript público.

O fallback exige que a pessoa esteja conectada à conta do app. O FreeLLMAPI é auto-hospedado e os limites, a disponibilidade e a qualidade dependem das chaves e dos modelos configurados no roteador.
