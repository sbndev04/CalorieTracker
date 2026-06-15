const MEAL_TYPES = [
  { value: 'Desayuno', words: ['desayuno', 'desayunar'] },
  { value: 'Comida', words: ['comida', 'comer', 'almuerzo', 'almorzar'] },
  { value: 'Cena', words: ['cena', 'cenar'] },
  { value: 'Snack', words: ['snack', 'aperitivo', 'merienda', 'merendar'] },
  { value: 'Bebida', words: ['bebida', 'beber'] }
];

const SMALL_NUMBERS = new Map([
  ['cero', 0], ['un', 1], ['uno', 1], ['una', 1], ['dos', 2], ['tres', 3],
  ['cuatro', 4], ['cinco', 5], ['seis', 6], ['siete', 7], ['ocho', 8],
  ['nueve', 9], ['diez', 10], ['once', 11], ['doce', 12], ['trece', 13],
  ['catorce', 14], ['quince', 15], ['dieciseis', 16], ['diecisiete', 17],
  ['dieciocho', 18], ['diecinueve', 19], ['veinte', 20], ['veintiuno', 21],
  ['veintiuna', 21], ['veintidos', 22], ['veintitres', 23], ['veinticuatro', 24],
  ['veinticinco', 25], ['veintiseis', 26], ['veintisiete', 27],
  ['veintiocho', 28], ['veintinueve', 29]
]);

const TENS = new Map([
  ['treinta', 30], ['cuarenta', 40], ['cincuenta', 50], ['sesenta', 60],
  ['setenta', 70], ['ochenta', 80], ['noventa', 90]
]);

const HUNDREDS = new Map([
  ['cien', 100], ['ciento', 100], ['doscientos', 200], ['doscientas', 200],
  ['trescientos', 300], ['trescientas', 300], ['cuatrocientos', 400],
  ['cuatrocientas', 400], ['quinientos', 500], ['quinientas', 500],
  ['seiscientos', 600], ['seiscientas', 600], ['setecientos', 700],
  ['setecientas', 700], ['ochocientos', 800], ['ochocientas', 800],
  ['novecientos', 900], ['novecientas', 900]
]);

const UNITS = new Map([
  ['g', { family: 'mass', scale: 1, canonical: 'g' }],
  ['gramo', { family: 'mass', scale: 1, canonical: 'g' }],
  ['gramos', { family: 'mass', scale: 1, canonical: 'g' }],
  ['kg', { family: 'mass', scale: 1000, canonical: 'kg' }],
  ['kilo', { family: 'mass', scale: 1000, canonical: 'kg' }],
  ['kilos', { family: 'mass', scale: 1000, canonical: 'kg' }],
  ['ml', { family: 'volume', scale: 1, canonical: 'ml' }],
  ['mililitro', { family: 'volume', scale: 1, canonical: 'ml' }],
  ['mililitros', { family: 'volume', scale: 1, canonical: 'ml' }],
  ['l', { family: 'volume', scale: 1000, canonical: 'l' }],
  ['litro', { family: 'volume', scale: 1000, canonical: 'l' }],
  ['litros', { family: 'volume', scale: 1000, canonical: 'l' }],
  ['unidad', { family: 'count', scale: 1, canonical: 'ud' }],
  ['unidades', { family: 'count', scale: 1, canonical: 'ud' }],
  ['porcion', { family: 'portion', scale: 1, canonical: 'porcion' }],
  ['porciones', { family: 'portion', scale: 1, canonical: 'porcion' }]
]);

export function normalizeSpeech(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseNumberPhrase(words) {
  const clean = words.filter(word => word !== 'y');
  if (!clean.length) return null;
  if (clean.length === 1 && /^\d+(?:\.\d+)?$/.test(clean[0])) return Number(clean[0]);

  let value = 0;
  let matched = false;
  for (const word of clean) {
    if (HUNDREDS.has(word)) {
      value += HUNDREDS.get(word);
      matched = true;
    } else if (TENS.has(word)) {
      value += TENS.get(word);
      matched = true;
    } else if (SMALL_NUMBERS.has(word)) {
      value += SMALL_NUMBERS.get(word);
      matched = true;
    } else {
      return null;
    }
  }
  return matched ? value : null;
}

function recipeUnitInfo(value) {
  const key = normalizeSpeech(value).replace(/\s/g, '');
  if (UNITS.has(key)) return UNITS.get(key);
  const singular = key.endsWith('s') ? key.slice(0, -1) : key;
  return { family: `custom:${singular}`, scale: 1, canonical: singular };
}

function detectMealType(text) {
  for (const type of MEAL_TYPES) {
    if (type.words.some(word => new RegExp(`\\b${word}\\b`).test(text))) return type.value;
  }
  return 'Otro';
}

function findRecipe(text, recipes) {
  const candidates = (Array.isArray(recipes) ? recipes : [])
    .map(recipe => ({ recipe, key: normalizeSpeech(recipe.name) }))
    .filter(candidate => candidate.key);

  const exact = candidates
    .filter(candidate => new RegExp(`\\b${candidate.key.replace(/\s+/g, '\\s+')}\\b`).test(text))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (exact) return exact.recipe;

  const textWords = new Set(text.split(' '));
  const scored = candidates.map(candidate => {
    const words = candidate.key.split(' ');
    const matched = words.filter(word => textWords.has(word)).length;
    return { recipe: candidate.recipe, score: matched / words.length, matched, words: words.length };
  }).sort((a, b) => b.score - a.score || b.matched - a.matched);

  const best = scored[0];
  if (!best || best.score < 0.67 || (best.words > 1 && best.matched < 2)) {
    throw new Error('No encuentro una receta guardada en la frase.');
  }
  if (scored[1] && scored[1].score === best.score && scored[1].matched === best.matched) {
    throw new Error('La frase coincide con varias recetas. Di el nombre más completo.');
  }
  return best.recipe;
}

function detectAmount(text) {
  if (/\b(tres cuartos|tres cuartas)\b/.test(text)) return { mode: 'factor', value: 0.75 };
  if (/\b(media|medio|mitad)\b/.test(text)) return { mode: 'factor', value: 0.5 };
  if (/\b(un cuarto|una cuarta)\b/.test(text)) return { mode: 'factor', value: 0.25 };
  if (/\b(doble|dos veces)\b/.test(text)) return { mode: 'factor', value: 2 };

  const percent = text.match(/\b(\d+(?:\.\d+)?)\s*(?:por ciento|porcentaje)\b/);
  if (percent) return { mode: 'factor', value: Number(percent[1]) / 100 };

  const words = text.split(' ');
  for (let unitIndex = 0; unitIndex < words.length; unitIndex++) {
    const unit = UNITS.get(words[unitIndex]);
    if (!unit) continue;
    for (let length = Math.min(6, unitIndex); length >= 1; length--) {
      const value = parseNumberPhrase(words.slice(unitIndex - length, unitIndex));
      if (value !== null && value > 0) {
        return { mode: 'quantity', value, unit };
      }
    }
  }
  return { mode: 'factor', value: 1 };
}

export function parseVoiceMeal(transcript, recipes) {
  const text = normalizeSpeech(transcript);
  if (!text) throw new Error('No se recibió ninguna transcripción.');

  const recipe = findRecipe(text, recipes);
  const amount = detectAmount(text);
  let portion;
  let factor;

  if (amount.mode === 'factor') {
    factor = amount.value;
    portion = Number(recipe.serving || 1) * factor;
  } else {
    const target = recipeUnitInfo(recipe.unit || 'porcion');
    if (target.family !== amount.unit.family) {
      throw new Error(`La receta usa ${recipe.unit}; la cantidad dictada no es compatible.`);
    }
    portion = amount.value * amount.unit.scale / target.scale;
    factor = portion / Number(recipe.serving || 1);
  }

  if (!Number.isFinite(factor) || factor <= 0) throw new Error('No pude calcular una cantidad válida.');
  return {
    recipe,
    mealType: detectMealType(text),
    portion: Math.round((portion + Number.EPSILON) * 1000) / 1000,
    factor,
    transcript: String(transcript).trim()
  };
}

