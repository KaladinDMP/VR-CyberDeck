<p align="center">
  <img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/446f9bc8-fe7a-4817-a063-09a6186addcf" />
</p>

<p align="center">
  🌐 &nbsp;<strong>Language / Idioma:</strong>&nbsp;
  <a href="README.md">🇺🇸 English</a> &nbsp;|&nbsp;
  <a href="README.es.md"><strong>🇪🇸 Español</strong></a>
</p>

---

# ApprenticeVR: Edición VRSrc

**ApprenticeVR: Edición VRSrc** es una aplicación de escritorio multiplataforma moderna, construida con Electron, React y TypeScript, para gestionar y cargar contenido en dispositivos Meta Quest. Se conecta a una biblioteca de juegos de la comunidad, gestiona las descargas e instalaciones automáticamente, y te permite contribuir juegos de vuelta a la biblioteca.

> **Nota del fork:** Este fork incluye correcciones de errores, mejoras de rendimiento y nuevas funcionalidades. Consulta la sección más abajo para más detalles.

---

## Paso 1: Descarga el archivo correcto para tu sistema operativo

| Archivo | Plataforma | Notas |
|---------|------------|-------|
| `apprenticevr-x.x.x-arm64.dmg` | macOS Apple Silicon (M1–M5) | Para Macs con chip M |
| `apprenticevr-x.x.x-x64.dmg` | macOS Intel (macOS 11+) | Build Intel estándar |
| `apprenticevr-macOS10.15-x64.dmg` | macOS Intel (10.15 Catalina) | Fallback si los anteriores fallan |
| `apprenticevr-x.x.x-setup-x64.exe` | Instalador Windows | Recomendado para la mayoría |
| `apprenticevr-x.x.x-portable-x64.exe` | Windows Portable | Sin instalación |
| `apprenticevr-x.x.x-x86_64.AppImage` | Linux x64 | Funciona en la mayoría de distros |
| `apprenticevr-x.x.x-arm64.AppImage` | Linux ARM64 | Para sistemas ARM |
| `apprenticevr-x.x.x-amd64.deb` | Debian/Ubuntu x64 | Instalar con dpkg |
| `apprenticevr-x.x.x-arm64.deb` | Debian/Ubuntu ARM64 | Versión ARM |

> Las descargas están en la página de Releases. Utiliza siempre la versión más reciente.

### macOS: "La aplicación está dañada"

```
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

### Linux AppImage

```
chmod +x apprenticevr-x.x.x-x86_64.AppImage
./apprenticevr-x.x.x-x86_64.AppImage
```

---

## Paso 2: Obtén tus credenciales del servidor

ApprenticeVR requiere:

- `baseUri` (URL que termina en `/`)
- `password` (codificada en base64)

Dónde encontrarlas:

- Telegram: https://t.me/the_vrSrc  
- Vista previa web: https://t.me/s/the_vrSrc  
- JSON público: https://qpmegathread.top/pages/public-json.html  

Mantén las credenciales en privado. No las compartas.

---

## Paso 3: Introduce las credenciales

### Opción A: Desde la aplicación (recomendado)

1. Abre Ajustes
2. Haz clic en **Gestión de espejos**
3. Pega el JSON o introduce los valores manualmente
4. Haz clic en **Guardar**

### Opción B: ServerInfo.json

| Plataforma | Ruta |
|------------|------|
| Windows | `%APPDATA%\apprenticevr\ServerInfo.json` |
| macOS | `~/Library/Application Support/apprenticevr/ServerInfo.json` |
| Linux | `~/.config/apprenticevr/ServerInfo.json` |

```
{"baseUri":"https://tu-url-aqui/","password":"tu-contraseña-aqui"}
```

Se requiere reiniciar al usar este método.

---

## Paso 4: Conecta el Quest y carga juegos

1. Conecta el visor por USB
2. Permite la depuración USB
3. El dispositivo aparece en la app
4. Descarga juegos

Se ejecutan hasta 5 descargas en paralelo.

---

## Novedades de la Edición VRSrc

Consulta las [Notas de la versión](RELEASE_NOTES.es.md) completas para ver el registro de cambios detallado.

### Principales mejoras

- **Subida de archivos locales** — sube carpetas de juegos o archivos ZIP directamente desde tu PC sin necesidad de conectar el Quest
- **Idioma español (Castellano)** — se detecta automáticamente desde el sistema operativo; cámbialo en cualquier momento desde Ajustes
- Corrección de los vídeos de YouTube usando Electron webview
- 5 descargas en paralelo en lugar de 1
- Cambio de `rclone mount` a `rclone copy`
- Soporte de pausa y reanudación
- Prevención de conflictos de instalación ADB con sistema de cola
- Optimizaciones importantes de interfaz y rendimiento
- Corrección del progreso de descarga y visualización de ETA
- Manejo mejorado de bibliotecas de juegos grandes (2600+ títulos)
- Reducción del tamaño de la build de 478 MB a 110 MB
- Detección dinámica de archivos de lista de juegos
- Interfaz de gestión de espejos rediseñada
- Sistema de notificación de actualizaciones simplificado
- Versión visible en Ajustes
- Pipeline de subida corregido y funcionando

---

## Subir juegos

### Desde un Quest conectado (automático)

La app detecta los juegos de tu dispositivo que faltan en la biblioteca o que tienen una versión más nueva, y te solicita que los subas.

1. Crear carpeta de preparación
2. Extraer APK por ADB
3. Comprobar archivos OBB
4. Extraer OBB si existe
5. Generar metadatos
6. Comprimir en ZIP
7. Subir con rclone
8. Añadir a lista negra

### Desde archivos locales (manual)

Usa **Subidas → Subir archivos locales** para enviar carpetas de juegos o archivos ZIP directamente desde tu PC.

- Cada carpeta debe contener **exactamente un archivo APK** — las carpetas OBB, instrucciones y otro contenido se incluyen automáticamente
- Si ya tienes un ZIP, se envía tal cual
- Se pueden poner en cola varias carpetas/ZIP a la vez; se suben de una en una con progreso en tiempo real

Las subidas no garantizan su inclusión en la biblioteca.

---

## Función planeada

Escaneo del visor en busca de:

- Versiones más nuevas que las de la biblioteca
- Juegos que faltan

Usa comparación de versiones por ADB e indexación de la lista de juegos.

---

## Registros

| Plataforma | Ubicación |
|------------|-----------|
| Windows | `%USERPROFILE%\AppData\Roaming\apprenticevr\logs\main.log` |
| macOS | `~/Library/Logs/apprenticevr/main.log` |
| Linux | `~/.config/apprenticevr/logs/main.log` |

---

## Solución de problemas

### Problemas de conexión

- Comprueba el formato de baseUri
- Verifica la contraseña
- Asegúrate de usar los saltos de línea correctos
- Prueba con un DNS diferente
- Usa VPN si es necesario

### Quest no detectado

- Usa un cable de datos
- Permite la depuración USB
- Comprueba si el antivirus interfiere
- Prueba con diferentes puertos USB

### Corrección macOS

```
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

### Corrección Linux

```
chmod +x apprenticevr-*.AppImage && ./apprenticevr-*.AppImage
```

---

## Inspiración

Basado en Rookie Sideloader.

---

## Licencia

GNU Affero GPL v3

---

![Visitantes del repositorio](https://badges.pufler.dev/visits/KaladinDMP/apprenticeVrSrc)
![Última actualización](https://badges.pufler.dev/updated/KaladinDMP/apprenticeVrSrc)
![Creación del repositorio](https://badges.pufler.dev/created/KaladinDMP/apprenticeVrSrc)
![Commits mensuales de KaladinDMP](https://badges.pufler.dev/commits/monthly/KaladinDMP)

Colaboradores en este repositorio  
![Colaboradores:](https://badges.pufler.dev/contributors/KaladinDMP/apprenticeVrSrc?size=50&padding=5&perRow=10&bots=true)

![Estrellas de KaladinDMP](https://img.shields.io/github/stars/KaladinDMP)
