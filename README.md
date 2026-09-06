# Pixel Perfect

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aa77044e-f5c1-47bf-9f01-3df18761ab98).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Supabase y análisis con IA

La app usa Supabase Auth para crear cuentas e iniciar sesión. Las migraciones de tablas, políticas
RLS, perfil corporal y Storage privado están en `supabase/migrations/`.

Configura la clave de OpenAI como secreto de Supabase, nunca en Ajustes ni en el navegador:

```sh
npx supabase secrets set OPENAI_API_KEY=tu_clave_de_openai
npx supabase functions deploy analizar-comida --no-verify-jwt
```

Después de aplicar la migración en el proyecto de Supabase, las comidas se guardan por usuario y
por fecha. La pantalla calcula la evaluación diaria sobre las comidas registradas ese día. La foto
corporal es opcional, se guarda en el bucket privado `body-progress` y el informe solo contiene
observaciones visuales, no diagnósticos médicos.
