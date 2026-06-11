# Telegram Worker

Buzón persistente para Calorie Tracker basado en Cloudflare Workers y D1.

## Preparación

1. Instala las dependencias:

   ```powershell
   npm install
   ```

2. Crea la base de datos:

   ```powershell
   npx wrangler d1 create calorie-tracker-telegram
   ```

3. Copia `wrangler.toml.example` como `wrangler.toml` y sustituye `database_id`.

4. Aplica el esquema:

   ```powershell
   npx wrangler d1 execute calorie-tracker-telegram --remote --file schema.sql
   ```

5. Configura los secretos:

   ```powershell
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put TELEGRAM_USER_ID
   npx wrangler secret put WEBHOOK_SECRET
   npx wrangler secret put APP_SYNC_TOKEN
   ```

6. Despliega:

   ```powershell
   npm run deploy
   ```

7. Registra el webhook sustituyendo los valores:

   ```text
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<WORKER>/telegram/webhook&secret_token=<WEBHOOK_SECRET>
   ```

En la aplicación, introduce la URL base del Worker y el mismo `APP_SYNC_TOKEN`.

## Comandos

```text
/tomar 150 g | Tortilla de patata | Cena | 21:30
/tomar 1/2 | Tortilla de patata
/tomar 0.5x | Tortilla de patata
/tomar 50% | Tortilla de patata
/recetas
/creatina
```

Las cantidades deben incluir unidad. Los números sin unidad, las fracciones, los
porcentajes y los valores terminados en `x` se interpretan como factores.
