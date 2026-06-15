package com.sabino.calorietracker;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "VoiceRecognition",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class VoiceRecognitionPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private PluginCall activeCall;
    private boolean usingOnDevice;

    @PluginMethod
    public void checkAvailability(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("recognitionAvailable", SpeechRecognizer.isRecognitionAvailable(getContext()));
            result.put("onDeviceAvailable", isOnDeviceAvailable());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startRecognition(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecognition(call);
        } else {
            call.reject("Se necesita permiso de micrófono para transcribir.");
        }
    }

    private boolean isOnDeviceAvailable() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
    }

    private void startRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("Android no tiene instalado un servicio de reconocimiento de voz.");
                return;
            }
            if (activeCall != null) {
                call.reject("Ya hay una transcripción en curso.");
                return;
            }

            boolean preferOnDevice = call.getBoolean("preferOnDevice", true);
            boolean offlineOnly = call.getBoolean("offlineOnly", false);
            boolean onDeviceAvailable = isOnDeviceAvailable();
            if (offlineOnly && !onDeviceAvailable) {
                call.reject("No hay reconocimiento local disponible. Descarga español en los ajustes de voz de Android.");
                return;
            }

            usingOnDevice = preferOnDevice && onDeviceAvailable;
            activeCall = call;
            recognizer = usingOnDevice
                ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext())
                : SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches == null || matches.isEmpty()) {
                        rejectActive("Android no devolvió ninguna transcripción.", "NO_RESULT");
                        return;
                    }
                    JSObject response = new JSObject();
                    response.put("text", matches.get(0));
                    response.put("onDevice", usingOnDevice);
                    resolveActive(response);
                }

                @Override
                public void onError(int error) {
                    rejectActive(errorMessage(error), String.valueOf(error));
                }

                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "es-ES"));
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, usingOnDevice || offlineOnly);
            recognizer.startListening(intent);
        });
    }

    private String errorMessage(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Android no pudo acceder al audio.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "No hay permiso para utilizar el micrófono.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "El reconocedor necesita conexión o tardó demasiado.";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No se entendió la frase. Prueba a hablar más despacio.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "El reconocedor de voz está ocupado. Inténtalo de nuevo.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No se detectó voz.";
            default:
                return "No se pudo completar el reconocimiento de voz.";
        }
    }

    private void resolveActive(JSObject result) {
        PluginCall call = activeCall;
        cleanup();
        if (call != null) call.resolve(result);
    }

    private void rejectActive(String message, String code) {
        PluginCall call = activeCall;
        cleanup();
        if (call != null) call.reject(message, code);
    }

    private void cleanup() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        activeCall = null;
        usingOnDevice = false;
    }

    @Override
    protected void handleOnDestroy() {
        if (activeCall != null) activeCall.reject("La aplicación se cerró durante la transcripción.");
        cleanup();
        super.handleOnDestroy();
    }
}
