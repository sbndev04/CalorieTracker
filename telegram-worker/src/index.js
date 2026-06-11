const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const MEAL_TYPES = new Map([
  ['desayuno', 'Desayuno'],
  ['comida', 'Comida'],
  ['cena', 'Cena'],
  ['snack', 'Snack'],
  ['bebida', 'Bebida'],
  ['otro', 'Otro']
]);

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function numberValue(value) {
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('La cantidad debe ser mayor que cero.');
  return parsed;
}

function nonNegativeValue(value) {
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Los macronutrientes no pueden ser negativos.');
  return parsed;
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function unitInfo(value) {
  const key = normalizeText(value).replace(/\.$/, '');
  const units = {
    g: ['mass', 1, 'g'], gr: ['mass', 1, 'g'], gramo: ['mass', 1, 'g'], gramos: ['mass', 1, 'g'],
    kg: ['mass', 1000, 'kg'], kilo: ['mass', 1000, 'kg'], kilos: ['mass', 1000, 'kg'],
    ml: ['volume', 1, 'ml'], mililitro: ['volume', 1, 'ml'], mililitros: ['volume', 1, 'ml'],
    l: ['volume', 1000, 'l'], litro: ['volume', 1000, 'l'], litros: ['volume', 1000, 'l'],
    ud: ['count', 1, 'ud'], uds: ['count', 1, 'ud'], unidad: ['count', 1, 'ud'], unidades: ['count', 1, 'ud'],
    porcion: ['portion', 1, 'porcion'], porciones: ['portion', 1, 'porcion']
  };
  if (units[key]) {
    const [family, scale, canonical] = units[key];
    return { key, family, scale, canonical };
  }
  const singular = key.endsWith('s') ? key.slice(0, -1) : key;
  return { key: singular, family: `custom:${singular}`, scale: 1, canonical: singular };
}

export function parseAmount(input) {
  const value = String(input || '').trim().toLowerCase();
  let match = value.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (match) {
    const denominator = numberValue(match[2]);
    return { mode: 'factor', value: numberValue(match[1]) / denominator, unit: null };
  }
  match = value.match(/^x?\s*(\d+(?:[.,]\d+)?)\s*x$/);
  if (match) return { mode: 'factor', value: numberValue(match[1]), unit: null };
  match = value.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (match) return { mode: 'factor', value: numberValue(match[1]) / 100, unit: null };
  match = value.match(/^(\d+(?:[.,]\d+)?)\s+([^\s]+)$/);
  if (match) return { mode: 'quantity', value: numberValue(match[1]), unit: match[2] };
  match = value.match(/^(\d+(?:[.,]\d+)?)$/);
  if (match) return { mode: 'factor', value: numberValue(match[1]), unit: null };
  throw new Error('Usa una cantidad con unidad (150 g) o un factor (1/2, 0.5x, 50%).');
}

function quantityInRecipeUnit(amount, recipe) {
  const input = unitInfo(amount.unit);
  const output = unitInfo(recipe.unit);
  if (input.family !== output.family) {
    throw new Error(`La receta está definida en ${recipe.unit}; no puedo convertir desde ${amount.unit}.`);
  }
  return amount.value * input.scale / output.scale;
}

function resolveRecipe(recipes, name) {
  const key = normalizeText(name);
  const exact = recipes.find(recipe => normalizeText(recipe.name) === key);
  if (exact) return exact;
  const matches = recipes.filter(recipe => normalizeText(recipe.name).includes(key));
  if (!matches.length) throw new Error(`No encuentro la receta "${name}". Usa /recetas para ver el catálogo.`);
  if (matches.length > 1) throw new Error(`"${name}" coincide con varias recetas. Escribe un nombre más concreto.`);
  return matches[0];
}

function parseMealType(value) {
  if (!value) return 'Otro';
  const mealType = MEAL_TYPES.get(normalizeText(value));
  if (!mealType) throw new Error('El tipo debe ser Desayuno, Comida, Cena, Snack, Bebida u Otro.');
  return mealType;
}

function parseTime(value, fallback) {
  if (!value) return fallback;
  const match = String(value).trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error('La hora debe tener formato HH:MM.');
  return `${match[1]}:${match[2]}`;
}

function localParts(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    localDate: `${values.year}-${values.month}-${values.day}`,
    localTime: `${values.hour}:${values.minute}`
  };
}

export function buildRecipePayload(recipe, amount, options = {}) {
  const factor = amount.mode === 'factor'
    ? amount.value
    : quantityInRecipeUnit(amount, recipe) / Number(recipe.serving);
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('La cantidad calculada no es válida.');
  const portion = Number(recipe.serving) * factor;
  return {
    name: recipe.name,
    mealType: parseMealType(options.mealType),
    portion: round(portion, 3),
    portionUnit: recipe.unit,
    kcal: Math.round(Number(recipe.kcal) * factor),
    protein: round(Number(recipe.protein || 0) * factor),
    carbs: round(Number(recipe.carbs || 0) * factor),
    fat: round(Number(recipe.fat || 0) * factor),
    localDate: options.localDate,
    localTime: parseTime(options.localTime, options.defaultTime),
    recipeId: recipe.id,
    recipeRevision: Number(recipe.revision || 1),
    amountMode: amount.mode,
    amountValue: round(amount.value, 4),
    amountUnit: amount.unit,
    factor: round(factor, 6)
  };
}

function splitTakeCommand(text) {
  const body = String(text).replace(/^\/tomar(?:@\w+)?\s*/i, '').trim();
  if (!body) throw new Error('Ejemplo: /tomar 150 g | Tortilla | Cena | 21:30');
  if (body.includes('|')) {
    const [amount, recipe, mealType, localTime] = body.split('|').map(value => value.trim());
    if (!amount || !recipe) throw new Error('Indica cantidad o factor y nombre de receta.');
    return { amount, recipe, mealType, localTime };
  }
  const match = body.match(/^((?:\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?)|(?:x?\s*\d+(?:[.,]\d+)?\s*x)|(?:\d+(?:[.,]\d+)?\s*%)|(?:\d+(?:[.,]\d+)?\s+\S+)|(?:\d+(?:[.,]\d+)?))\s+(.+)$/i);
  if (!match) throw new Error('Ejemplo: /tomar 1/2 Tortilla de patata');
  return { amount: match[1], recipe: match[2], mealType: '', localTime: '' };
}

export function parseRecipeCommand(text, recipes, clock) {
  const command = splitTakeCommand(text);
  const recipe = resolveRecipe(recipes, command.recipe);
  const amount = parseAmount(command.amount);
  return buildRecipePayload(recipe, amount, {
    mealType: command.mealType,
    localTime: command.localTime,
    localDate: clock.localDate,
    defaultTime: clock.localTime
  });
}

function parsePortion(value) {
  const text = String(value || '').trim();
  if (!text) return { portion: 1, portionUnit: '' };
  const match = text.match(/^(\d+(?:[.,]\d+)?)(?:\s+(.+))?$/);
  if (!match) throw new Error('La porción no es válida.');
  return { portion: numberValue(match[1]), portionUnit: String(match[2] || '').trim() };
}

export function parseManualMeal(text, clock) {
  const body = String(text).replace(/^\/comida(?:@\w+)?\s*/i, '');
  const fields = {};
  body.split(/\r?\n/).forEach(line => {
    const separator = line.indexOf(':');
    if (separator < 0) return;
    fields[normalizeText(line.slice(0, separator))] = line.slice(separator + 1).trim();
  });
  const name = String(fields.nombre || '').trim();
  const kcal = numberValue(fields.calorias || fields.kcal || 0);
  if (!name) throw new Error('Falta el campo Nombre.');
  const portion = parsePortion(fields.porcion);
  return {
    name,
    mealType: parseMealType(fields.tipo),
    portion: portion.portion,
    portionUnit: portion.portionUnit,
    kcal: Math.round(kcal),
    protein: fields.proteina !== undefined ? nonNegativeValue(fields.proteina) : 0,
    carbs: fields.carbos !== undefined ? nonNegativeValue(fields.carbos) : 0,
    fat: fields.grasa !== undefined ? nonNegativeValue(fields.grasa) : 0,
    localDate: clock.localDate,
    localTime: parseTime(fields.hora, clock.localTime),
    recipeId: null,
    recipeRevision: null,
    amountMode: null,
    amountValue: null,
    amountUnit: null
  };
}

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || `Telegram rechazó ${method}.`);
  return result.result;
}

function formatMeal(payload, state) {
  const macros = `P ${payload.protein || 0} g · C ${payload.carbs || 0} g · G ${payload.fat || 0} g`;
  const amount = payload.amountMode === 'factor'
    ? `Factor ${payload.amountValue}`
    : payload.amountMode === 'quantity'
      ? `Cantidad ${payload.amountValue} ${payload.amountUnit}`
      : `Porción ${payload.portion}${payload.portionUnit ? ` ${payload.portionUnit}` : ''}`;
  return `${state}\n\n${payload.mealType} · ${payload.name}\n${amount}\n${payload.kcal} kcal · ${macros}\n${payload.localDate} ${payload.localTime}`;
}

function formatDraft(payload) {
  if (payload.type === 'habit') {
    return `Confirmar hábito\n\nCreatina · ${payload.data.localDate}`;
  }
  return formatMeal(payload.data, 'Confirma este registro');
}

async function createDraft(env, updateId, chatId, payload) {
  const id = `d_${updateId}`;
  const existing = await env.DB.prepare('SELECT id FROM drafts WHERE id = ?').bind(id).first();
  if (existing) return;
  await env.DB.prepare(
    'INSERT INTO drafts (id, chat_id, payload_json, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, String(chatId), JSON.stringify(payload), 'pending', new Date().toISOString()).run();
  const message = await telegram(env, 'sendMessage', {
    chat_id: chatId,
    text: formatDraft(payload),
    reply_markup: {
      inline_keyboard: [[
        { text: 'Confirmar', callback_data: `confirm:${id}` },
        { text: 'Cancelar', callback_data: `cancel:${id}` }
      ]]
    }
  });
  await env.DB.prepare('UPDATE drafts SET telegram_message_id = ? WHERE id = ?')
    .bind(message.message_id, id).run();
}

async function listRecipes(env, chatId) {
  const result = await env.DB.prepare(
    'SELECT name, kcal, serving, unit FROM recipes WHERE active = 1 ORDER BY name LIMIT 100'
  ).all();
  const rows = result.results || [];
  const text = rows.length
    ? `Recetas disponibles:\n\n${rows.map(r => `• ${r.name}: ${r.kcal} kcal / ${r.serving} ${r.unit}`).join('\n')}`
    : 'Todavía no hay recetas sincronizadas. Abre la aplicación y pulsa “Sincronizar ahora”.';
  await telegram(env, 'sendMessage', { chat_id: chatId, text });
}

async function processMessage(env, update) {
  const message = update.message;
  const text = String(message.text || '').trim();
  const chatId = message.chat.id;
  const clock = localParts(env.TIME_ZONE || 'Europe/Madrid');
  if (/^\/(?:start|ayuda)(?:@\w+)?\b/i.test(text)) {
    await telegram(env, 'sendMessage', {
      chat_id: chatId,
      text: 'Comandos:\n/tomar 150 g | Receta | Cena | 21:30\n/tomar 1/2 | Receta\n/comida seguido de los campos del formulario\n/recetas\n/creatina'
    });
    return;
  }
  if (/^\/recetas(?:@\w+)?\b/i.test(text)) {
    await listRecipes(env, chatId);
    return;
  }
  try {
    if (/^\/tomar(?:@\w+)?\b/i.test(text)) {
      const result = await env.DB.prepare('SELECT * FROM recipes WHERE active = 1 ORDER BY name').all();
      const payload = parseRecipeCommand(text, result.results || [], clock);
      await createDraft(env, update.update_id, chatId, { type: 'meal', data: payload });
      return;
    }
    if (/^\/comida(?:@\w+)?\b/i.test(text)) {
      const payload = parseManualMeal(text, clock);
      await createDraft(env, update.update_id, chatId, { type: 'meal', data: payload });
      return;
    }
    if (/^\/creatina(?:@\w+)?\b/i.test(text)) {
      await createDraft(env, update.update_id, chatId, {
        type: 'habit',
        data: { habit: 'creatine', localDate: clock.localDate, localTime: clock.localTime }
      });
      return;
    }
    await telegram(env, 'sendMessage', { chat_id: chatId, text: 'No reconozco ese formato. Usa /ayuda.' });
  } catch (error) {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: `No pude preparar el registro: ${error.message}` });
  }
}

async function processCallback(env, update) {
  const callback = update.callback_query;
  const [action, draftId] = String(callback.data || '').split(':');
  const draft = await env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(draftId).first();
  if (!draft || draft.status !== 'pending') {
    await telegram(env, 'answerCallbackQuery', {
      callback_query_id: callback.id,
      text: 'Este registro ya fue procesado.'
    });
    return;
  }
  const payload = JSON.parse(draft.payload_json);
  if (action === 'cancel') {
    await env.DB.prepare('UPDATE drafts SET status = ? WHERE id = ?').bind('cancelled', draftId).run();
    await telegram(env, 'editMessageText', {
      chat_id: draft.chat_id,
      message_id: draft.telegram_message_id,
      text: 'Registro cancelado.'
    });
    await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id });
    return;
  }
  if (action !== 'confirm') return;
  const eventId = `e_${draftId}`;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO events (id, type, payload_json, status, telegram_chat_id, telegram_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(eventId, payload.type, JSON.stringify(payload.data), 'pending', draft.chat_id, draft.telegram_message_id, now),
    env.DB.prepare('UPDATE drafts SET status = ? WHERE id = ?').bind('confirmed', draftId)
  ]);
  const text = payload.type === 'meal'
    ? formatMeal(payload.data, 'Guardado, pendiente de sincronización')
    : `Guardado, pendiente de sincronización\n\nCreatina · ${payload.data.localDate}`;
  await telegram(env, 'editMessageText', {
    chat_id: draft.chat_id,
    message_id: draft.telegram_message_id,
    text
  });
  await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Añadido a la cola.' });
}

async function handleWebhook(request, env) {
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
    return json({ error: 'Webhook no autorizado.' }, 401);
  }
  const update = await request.json();
  const updateId = Number(update.update_id);
  if (!Number.isInteger(updateId)) return json({ ok: true });
  const existing = await env.DB.prepare('SELECT update_id FROM processed_updates WHERE update_id = ?')
    .bind(updateId).first();
  if (existing) return json({ ok: true });
  const actor = update.message?.from || update.callback_query?.from;
  const chat = update.message?.chat || update.callback_query?.message?.chat;
  if (String(actor?.id) !== String(env.TELEGRAM_USER_ID) || chat?.type !== 'private') {
    await env.DB.prepare('INSERT OR IGNORE INTO processed_updates (update_id, created_at) VALUES (?, ?)')
      .bind(updateId, new Date().toISOString()).run();
    return json({ ok: true });
  }
  if (update.message) await processMessage(env, update);
  if (update.callback_query) await processCallback(env, update);
  await env.DB.prepare('INSERT OR IGNORE INTO processed_updates (update_id, created_at) VALUES (?, ?)')
    .bind(updateId, new Date().toISOString()).run();
  return json({ ok: true });
}

function authorized(request, env) {
  return request.headers.get('authorization') === `Bearer ${env.APP_SYNC_TOKEN}`;
}

function validateRecipe(recipe) {
  const id = String(recipe?.id || '').trim();
  const name = String(recipe?.name || '').trim();
  const kcal = Number(recipe?.kcal);
  const serving = Number(recipe?.serving);
  if (!id || !name || !Number.isFinite(kcal) || kcal <= 0 || !Number.isFinite(serving) || serving <= 0) {
    throw new Error('El catálogo contiene una receta no válida.');
  }
  return {
    id, name, nameKey: normalizeText(name), kcal, serving,
    unit: String(recipe.unit || 'porción').trim(),
    protein: Number(recipe.protein || 0),
    carbs: Number(recipe.carbs || 0),
    fat: Number(recipe.fat || 0),
    revision: Math.max(1, Number(recipe.revision || 1)),
    updatedAt: recipe.updatedAt || null
  };
}

async function replaceCatalog(request, env) {
  const body = await request.json();
  if (!Array.isArray(body.recipes) || body.recipes.length > 500) {
    return json({ error: 'El catálogo no es válido.' }, 400);
  }
  let recipes;
  try {
    recipes = body.recipes.map(validateRecipe);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const statements = [env.DB.prepare('UPDATE recipes SET active = 0')];
  recipes.forEach(recipe => {
    statements.push(env.DB.prepare(
      `INSERT INTO recipes
       (id, name, name_key, kcal, serving, unit, protein, carbs, fat, revision, updated_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, name_key=excluded.name_key, kcal=excluded.kcal,
       serving=excluded.serving, unit=excluded.unit, protein=excluded.protein,
       carbs=excluded.carbs, fat=excluded.fat, revision=excluded.revision,
       updated_at=excluded.updated_at, active=1`
    ).bind(
      recipe.id, recipe.name, recipe.nameKey, recipe.kcal, recipe.serving, recipe.unit,
      recipe.protein, recipe.carbs, recipe.fat, recipe.revision, recipe.updatedAt
    ));
  });
  await env.DB.batch(statements);
  return json({ ok: true, recipes: recipes.length });
}

async function cleanupExpired(env) {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM events WHERE status = 'acked' AND acked_at < datetime('now', '-30 days')"
    ),
    env.DB.prepare(
      "DELETE FROM drafts WHERE status != 'pending' AND created_at < datetime('now', '-30 days')"
    ),
    env.DB.prepare(
      "DELETE FROM processed_updates WHERE created_at < datetime('now', '-30 days')"
    )
  ]);
}

async function pendingEvents(env) {
  await cleanupExpired(env);
  const result = await env.DB.prepare(
    'SELECT id, type, payload_json, created_at FROM events WHERE status = ? ORDER BY created_at LIMIT 100'
  ).bind('pending').all();
  return json({
    events: (result.results || []).map(row => ({
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload_json),
      createdAt: row.created_at
    }))
  });
}

async function acknowledgeEvents(request, env, ctx) {
  const body = await request.json();
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter(id => typeof id === 'string'))].slice(0, 100)
    : [];
  if (!ids.length) return json({ ok: true, acknowledged: 0 });
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT id, telegram_chat_id, telegram_message_id, type, payload_json
     FROM events WHERE status = 'pending' AND id IN (${placeholders})`
  ).bind(...ids).all();
  const events = result.results || [];
  if (events.length) {
    await env.DB.batch(events.map(event => env.DB.prepare(
      'UPDATE events SET status = ?, acked_at = ? WHERE id = ? AND status = ?'
    ).bind('acked', new Date().toISOString(), event.id, 'pending')));
    ctx.waitUntil(Promise.all(events.map(event => {
      const payload = JSON.parse(event.payload_json);
      const text = event.type === 'meal'
        ? formatMeal(payload, 'Sincronizado con la aplicación')
        : `Sincronizado con la aplicación\n\nCreatina · ${payload.localDate}`;
      return telegram(env, 'editMessageText', {
        chat_id: event.telegram_chat_id,
        message_id: event.telegram_message_id,
        text
      }).catch(() => null);
    })));
  }
  return json({ ok: true, acknowledged: events.length });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });
      if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
        return handleWebhook(request, env);
      }
      if (url.pathname.startsWith('/api/') && !authorized(request, env)) {
        return json({ error: 'No autorizado.' }, 401);
      }
      if (request.method === 'PUT' && url.pathname === '/api/catalog') return replaceCatalog(request, env);
      if (request.method === 'GET' && url.pathname === '/api/events') return pendingEvents(env);
      if (request.method === 'POST' && url.pathname === '/api/events/ack') {
        return acknowledgeEvents(request, env, ctx);
      }
      return json({ error: 'Ruta no encontrada.' }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || 'Error interno.' }, 500);
    }
  }
};
