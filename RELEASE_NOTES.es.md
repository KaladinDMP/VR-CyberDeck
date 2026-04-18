<p align="center">
  🌐 &nbsp;<strong>Language / Idioma:</strong>&nbsp;
  <a href="RELEASE_NOTES.md">🇺🇸 English</a> &nbsp;|&nbsp;
  <a href="RELEASE_NOTES.es.md"><strong>🇪🇸 Español</strong></a>
</p>

---

# Notas de la versión — ApprenticeVR: Edición VRSrc

---

## v2.1.0

### Nuevas funciones

#### Subida de archivos locales
- Añadido el botón **"Subir archivos locales"** en el panel de Subidas
- Permite seleccionar varias **carpetas de juegos** o **archivos ZIP** directamente desde tu PC — sin necesidad de conectar el Quest
- **Reglas para carpetas:** cada carpeta debe contener exactamente un archivo APK; las carpetas OBB, instrucciones y cualquier otro contenido en la misma carpeta se incluyen automáticamente en el ZIP
- Los **archivos ZIP** se envían tal cual, sin recomprimir
- Se ejecuta una **validación completa** antes de añadir nada a la cola — si alguna carpeta tiene varios APKs, se rechaza todo el lote con un mensaje de error claro que explica la regla
- Los elementos se añaden a la **cola de subida** existente y se procesan uno a uno con progreso en tiempo real

#### Idioma español (Castellano)
- Añadida traducción completa de la interfaz al **español castellano**
- El idioma se **detecta automáticamente** desde el sistema operativo al primer arranque — si tu sistema está en español, la app arranca directamente en español
- Hay un **selector de idioma** (English / Español Castellano) en Ajustes que se guarda entre reinicios

---

## v2.0.0

### Principales mejoras respecto al original

- Corrección de los vídeos de YouTube usando Electron webview
- 5 descargas en paralelo en lugar de 1
- Cambio de `rclone mount` a `rclone copy` para transferencias más fiables
- Soporte de pausa y reanudación de descargas
- Prevención de conflictos de instalación ADB mediante un sistema de cola
- Optimizaciones importantes de interfaz y rendimiento
- Corrección del progreso de descarga y visualización de ETA
- Manejo mejorado de bibliotecas de juegos grandes (más de 2.600 títulos)
- Corrección de la lógica del pipeline de reanudación
- Corrección del bug de duplicación de ruta de descarga
- Mejora del seguimiento del progreso de reanudación
- Reducción del tamaño de la build de 478 MB a 110 MB
- Detección dinámica de archivos de lista de juegos
- Interfaz de gestión de espejos rediseñada
- Sistema de notificación de actualizaciones simplificado
- Eliminación de problemas con archivos de marcador de 0 KB
- Número de versión visible en Ajustes
- Pipeline de subida corregido y funcionando
