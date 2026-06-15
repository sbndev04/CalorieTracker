# Calorie Tracker Sabino para Android

Aplicacion Android local basada en el proyecto de escritorio. Conserva perfiles,
objetivos, recetas, comidas, creatina y calendario, y anade registro por voz.

No incluye Telegram, Cloudflare ni un modelo generativo. Usa el reconocedor de
voz de Android porque es mas ligero y adecuado para frases cortas.

## Como funciona la voz

1. Crea o selecciona un perfil.
2. Guarda las recetas que quieras reconocer.
3. Abre la pestana `Voz` y pulsa `Hablar`.
4. Di, por ejemplo:

   ```text
   Ciento cincuenta gramos de tortilla de patata para cenar
   Media tortilla de patata para comer
   Dos porciones de arroz con pollo para almorzar
   ```

5. La aplicacion abre el formulario de registro con los valores calculados.
6. Revisa los datos y pulsa `Anadir`.

La opcion `Exigir reconocimiento sin conexion` impide usar el fallback normal
de Android cuando no existe un motor local. Para usarla, descarga el idioma
espanol en los ajustes de reconocimiento de voz del telefono. La ruta exacta
puede variar entre versiones de HyperOS.

## Requisitos para compilar

- Node.js 22 o posterior.
- Android Studio 2025.2.1 o posterior.
- Android SDK API 36.
- El JDK incluido con Android Studio.

## Preparar el proyecto

Desde esta carpeta:

```powershell
npm install
npm run android:sync
npm run android:open
```

Android Studio abrira la carpeta `android`. Espera a que termine la
sincronizacion de Gradle y conecta el Redmi Note 13 por USB para ejecutar la
aplicacion.

## Generar e instalar el APK

En Android Studio usa:

```text
Build > Build APK(s)
```

O, cuando Android Studio y el SDK ya esten instalados:

```powershell
npm run android:apk
```

El APK de prueba se genera en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Pasa ese archivo al Redmi, permite temporalmente instalar aplicaciones desde
la fuente que uses para abrirlo e instalalo. Al iniciar, concede el permiso de
microfono.

## Privacidad y almacenamiento

- La APK no declara permiso de Internet.
- El audio se entrega al servicio de reconocimiento de Android.
- Cuando Android confirma soporte local, se usa el reconocedor del dispositivo.
- Los perfiles y registros se guardan en el almacenamiento local de la WebView.
- Desinstalar la aplicacion borra sus datos. Esta primera version no incorpora
  exportacion ni copia de seguridad.

## Comandos utiles

```powershell
npm test
npm run build:web
npm run android:sync
npm run android:open
npm run android:apk
```

