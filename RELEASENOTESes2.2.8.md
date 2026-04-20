<p align="center">
  <img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/446f9bc8-fe7a-4817-a063-09a6186addcf" />
</p>

---
Idioma [Inglés](https://github.com/KaladinDMP/apprenticeVrSrc/releases/tags/v2.2.8) / Español (España)

# ApprenticeVR: VRSrc Edition — Notas de la versión 2.2.8

## Novedades

- **Soporte para install.txt** — los juegos que incluyen un `install.txt` ahora leen sus comandos ADB directamente del archivo y los ejecutan línea por línea, en lugar del flujo estándar de APK+OBB
- **Instalación directa desde ZIP** — puedes seleccionar un ZIP directamente en el instalador manual; la app lo extrae, ejecuta `install.txt` si existe, instala el APK y el OBB, y limpia automáticamente
- **Corrección de subida local** — el servicio de subida ahora usa el `upload.config` guardado localmente tras conectarte a VRP, en lugar de intentar obtenerlo desde una URL remota
- **Binarios ARM64 en Linux corregidos** — las AppImages ARM64 incluían binarios x86_64 por error; ahora se incluye un binario estático real de 7zip para ARM64, y adb usa el `adb` instalado en el sistema, ya que Google no distribuye platform-tools para ARM64 en Linux
- **DMG ARM64 para macOS restaurado** — ya hay un DMG nativo arm64 junto al build x64; el proceso de compilación fue corregido para evitar una CDN defectuosa que impedía generar el DMG arm64
- **Notificaciones de actualización corregidas** — la app ahora consulta directamente la API de GitHub Releases en lugar de un fichero de texto; los borradores de versión ya no generan avisos falsos y solo se te notificará cuando una versión esté publicada oficialmente
- **Mejoras en las traducciones** — más componentes de la interfaz respetan ahora el idioma seleccionado

## macOS

Se incluyen dos DMGs — elige el que corresponda a tu Mac:

| Archivo | Para |
|---------|------|
| `apprenticevr-x.x.x-arm64.dmg` | Apple Silicon (M1–M5) |
| `apprenticevr-x.x.x-x64.dmg` | Mac Intel |

Si la app queda bloqueada al abrirse:

```
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

Si ningún DMG funciona, puedes compilarlo tú mismo:

```
git clone https://github.com/KaladinDMP/apprenticeVrSrc
cd apprenticeVrSrc
npm install --legacy-peer-deps
npx electron-vite build && npx electron-builder --mac --x64 --arm64
```

Los DMGs generados estarán en la carpeta `dist/`.

---

Para la lista completa de funciones, instrucciones de configuración y resolución de problemas, consulta el [README.md](https://github.com/KaladinDMP/apprenticeVrSrc/blob/main/README.es.md).

---

![Visitors to this Repo](https://badges.pufler.dev/visits/KaladinDMP/apprenticeVrSrc)
![Last Updated](https://badges.pufler.dev/updated/KaladinDMP/apprenticeVrSrc)
![When was this Repo Created?](https://badges.pufler.dev/created/KaladinDMP/apprenticeVrSrc)
![Monthly Commits by KaladinDMP](https://badges.pufler.dev/commits/monthly/KaladinDMP)

Contributors on this Repo
![Contributors on this Repo:](https://badges.pufler.dev/contributors/KaladinDMP/apprenticeVrSrc?size=50&padding=5&perRow=10&bots=true)

![KaladinDMP's stars](https://img.shields.io/github/stars/KaladinDMP)
