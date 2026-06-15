import { Capacitor, registerPlugin } from '@capacitor/core';
import { parseVoiceMeal } from './voice-parser.js';

const VoiceRecognition = registerPlugin('VoiceRecognition');
let listening = false;

function setVoiceStatus(text, type = '') {
  const element = document.getElementById('voice-status');
  if (!element) return;
  element.textContent = text;
  element.className = `sync-status${type ? ` ${type}` : ''}`;
}

function setListening(value) {
  listening = value;
  const button = document.getElementById('voice-start-btn');
  if (!button) return;
  button.disabled = value;
  button.classList.toggle('listening', value);
  button.textContent = value ? 'Escuchando...' : 'Hablar';
}

function currentRecipes() {
  const profile = window.getActiveProfile?.();
  return profile?.recipes || [];
}

function prepareEntry(result) {
  window.showTab('registro');
  window.fillEntryFromRecipeById(result.recipe.id);
  document.getElementById('entry-portion').value = result.portion;
  document.getElementById('meal-type').value = result.mealType;
  window.calculateEntryFromRecipe();
  window.setDefaultEntryTime();
  window.showMsg(`Transcripción preparada: ${result.transcript}. Revisa los datos y pulsa Añadir.`, 'ok');
}

function processTranscript(transcript) {
  const transcriptElement = document.getElementById('voice-transcript');
  const resultElement = document.getElementById('voice-result');
  transcriptElement.textContent = transcript;
  try {
    const result = parseVoiceMeal(transcript, currentRecipes());
    resultElement.textContent = `${result.recipe.name}: ${result.portion} ${result.recipe.unit}, ${result.mealType}.`;
    resultElement.className = 'sync-status voice-result show ok';
    prepareEntry(result);
  } catch (error) {
    resultElement.textContent = error.message;
    resultElement.className = 'sync-status voice-result show error';
    setVoiceStatus('La voz se transcribió, pero no pude preparar el registro.', 'error');
  }
}

function browserRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) throw new Error('Este navegador no ofrece reconocimiento de voz.');
  const recognition = new Recognition();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;
  return new Promise((resolve, reject) => {
    recognition.onresult = event => resolve(event.results[0][0].transcript);
    recognition.onerror = event => reject(new Error(event.error || 'No se pudo reconocer la voz.'));
    recognition.onend = () => setListening(false);
    recognition.start();
  });
}

export async function refreshVoiceAvailability() {
  if (!window.getActiveProfile?.()) {
    setVoiceStatus('Crea o selecciona un perfil y guarda al menos una receta.', 'error');
    return;
  }
  if (!currentRecipes().length) {
    setVoiceStatus('Guarda al menos una receta antes de usar la voz.', 'error');
    return;
  }
  try {
    if (!Capacitor.isNativePlatform()) {
      const available = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      setVoiceStatus(
        available ? 'Vista web: reconocimiento del navegador disponible.' : 'La voz se habilita dentro de la APK.',
        available ? 'ok' : ''
      );
      return;
    }
    const availability = await VoiceRecognition.checkAvailability();
    if (!availability.recognitionAvailable) {
      setVoiceStatus('Android no tiene instalado ningún servicio de reconocimiento de voz.', 'error');
      return;
    }
    setVoiceStatus(
      availability.onDeviceAvailable
        ? 'Reconocimiento local disponible en este dispositivo.'
        : 'Reconocimiento disponible, pero Android no confirma que funcione totalmente sin conexión.',
      availability.onDeviceAvailable ? 'ok' : ''
    );
  } catch (error) {
    setVoiceStatus(error.message || 'No se pudo comprobar el reconocimiento de voz.', 'error');
  }
}

export async function startVoiceRecognition() {
  if (listening) return;
  if (!window.getActiveProfile?.()) {
    window.showMsg('Selecciona un perfil primero.');
    return;
  }
  if (!currentRecipes().length) {
    window.showMsg('Guarda al menos una receta antes de hablar.');
    return;
  }

  const offlineOnly = document.getElementById('voice-offline-only').checked;
  setListening(true);
  setVoiceStatus('Escuchando. Di la cantidad, la receta y el tipo de comida...');
  document.getElementById('voice-result').className = 'sync-status voice-result';

  try {
    const transcript = Capacitor.isNativePlatform()
      ? (await VoiceRecognition.start({
          language: 'es-ES',
          preferOnDevice: true,
          offlineOnly
        })).text
      : await browserRecognition();
    processTranscript(transcript);
  } catch (error) {
    setVoiceStatus(error.message || 'No se pudo transcribir el audio.', 'error');
  } finally {
    setListening(false);
  }
}

window.refreshVoiceAvailability = refreshVoiceAvailability;
window.startVoiceRecognition = startVoiceRecognition;

document.addEventListener('DOMContentLoaded', refreshVoiceAvailability);

