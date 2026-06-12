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
/comida, muslito, 650, 25, 0, 9
/tomar, tortilla de patata, 1/2
/tomar, tortilla de patata, 150 g
/tomar, tortilla de patata, 0.5x, cena, 21:30
/objetivos
/recetas
/creatina
```

En `/comida`, los numeros representan calorias, proteina, carbos y grasa, en ese
orden. El tipo sera `Otro`, la porcion sera `1` y se usara la hora actual.

En `/tomar`, escribe primero el nombre de la receta y despues la cantidad o
factor. Las cantidades deben incluir unidad. Los numeros sin unidad, las
fracciones, los porcentajes y los valores terminados en `x` se interpretan como
factores. El tipo y la hora son opcionales.
