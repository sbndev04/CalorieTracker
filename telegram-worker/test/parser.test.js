import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecipePayload,
  parseAmount,
  parseManualMeal,
  parseRecipeCommand
} from '../src/index.js';

const recipe = {
  id: 'r_tortilla',
  name: 'Tortilla de patata',
  kcal: 800,
  serving: 300,
  unit: 'g',
  protein: 32,
  carbs: 60,
  fat: 48,
  revision: 3
};

const clock = { localDate: '2026-06-11', localTime: '17:19' };

test('parses recipe factors', () => {
  assert.deepEqual(parseAmount('1/2'), { mode: 'factor', value: 0.5, unit: null });
  assert.deepEqual(parseAmount('0.5x'), { mode: 'factor', value: 0.5, unit: null });
  assert.deepEqual(parseAmount('50%'), { mode: 'factor', value: 0.5, unit: null });
});

test('parses quantities and converts compatible units', () => {
  const payload = buildRecipePayload(recipe, parseAmount('0.15 kg'), {
    mealType: 'Cena',
    localDate: clock.localDate,
    localTime: '21:30',
    defaultTime: clock.localTime
  });
  assert.equal(payload.factor, 0.5);
  assert.equal(payload.portion, 150);
  assert.equal(payload.kcal, 400);
  assert.equal(payload.amountMode, 'quantity');
});

test('parses a recipe command using pipes', () => {
  const payload = parseRecipeCommand('/tomar 1/2 | Tortilla de patata | Cena | 21:30', [recipe], clock);
  assert.equal(payload.kcal, 400);
  assert.equal(payload.mealType, 'Cena');
  assert.equal(payload.localTime, '21:30');
  assert.equal(payload.recipeRevision, 3);
});

test('parses a recipe command without pipes', () => {
  const payload = parseRecipeCommand('/tomar 150 g Tortilla de patata', [recipe], clock);
  assert.equal(payload.kcal, 400);
  assert.equal(payload.amountMode, 'quantity');
});

test('parses the manual meal form', () => {
  const payload = parseManualMeal(`/comida
Nombre: Arroz con pollo
Tipo: Comida
Porción: 1 plato
Hora: 14:30
Calorías: 650
Proteína: 45
Carbos: 70
Grasa: 18`, clock);
  assert.equal(payload.name, 'Arroz con pollo');
  assert.equal(payload.portion, 1);
  assert.equal(payload.portionUnit, 'plato');
  assert.equal(payload.kcal, 650);
});

test('accepts explicit zero macros', () => {
  const payload = parseManualMeal(`/comida
Nombre: Café
Tipo: Bebida
Calorías: 2
Proteína: 0
Carbos: 0
Grasa: 0`, clock);
  assert.equal(payload.protein, 0);
  assert.equal(payload.carbs, 0);
  assert.equal(payload.fat, 0);
});
