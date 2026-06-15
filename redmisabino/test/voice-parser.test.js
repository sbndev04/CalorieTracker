import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceMeal } from '../web/voice-parser.js';

const recipes = [{
  id: 'tortilla',
  name: 'Tortilla de patata',
  kcal: 800,
  serving: 300,
  unit: 'g',
  protein: 32,
  carbs: 60,
  fat: 48
}, {
  id: 'arroz',
  name: 'Arroz con pollo',
  kcal: 600,
  serving: 1,
  unit: 'porcion',
  protein: 40,
  carbs: 70,
  fat: 15
}];

test('interpreta cantidades habladas en gramos', () => {
  const result = parseVoiceMeal('Ciento cincuenta gramos de tortilla de patata para cenar', recipes);
  assert.equal(result.recipe.id, 'tortilla');
  assert.equal(result.portion, 150);
  assert.equal(result.factor, 0.5);
  assert.equal(result.mealType, 'Cena');
});

test('interpreta media receta', () => {
  const result = parseVoiceMeal('Media tortilla de patata para comer', recipes);
  assert.equal(result.portion, 150);
  assert.equal(result.mealType, 'Comida');
});

test('interpreta porciones habladas', () => {
  const result = parseVoiceMeal('Dos porciones de arroz con pollo para almorzar', recipes);
  assert.equal(result.portion, 2);
  assert.equal(result.factor, 2);
  assert.equal(result.mealType, 'Comida');
});

test('rechaza unidades incompatibles', () => {
  assert.throws(
    () => parseVoiceMeal('Doscientos mililitros de tortilla de patata', recipes),
    /no es compatible/
  );
});

