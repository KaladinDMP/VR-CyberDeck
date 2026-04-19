<p align="center">
  <img width="1536" height="1024" alt="banner" src="https://github.com/user-attachments/assets/446f9bc8-fe7a-4817-a063-09a6186addcf" />
</p>

<h1 align="center">ApprenticeVR: Edición VRSrc</h1>

<p align="center">
  <strong>Herramienta multiplataforma para instalar contenido en Quest, con descargas rápidas, interfaz limpia y un sistema moderno.</strong>
</p>

Idioma [Inglés](https://github.com/KaladinDMP/apprenticeVrSrc/releases/tags/v2.2.5) / Español (España)

<p align="center">
  <a href="../../releases/latest">⬇️ Descargar</a> •
  <a href="#configuracion">⚙️ Configuración</a> •
  <a href="#caracteristicas">🚀 Características</a> •
  <a href="#solucion-de-problemas">🛠 Solución de problemas</a>
</p>

---

## 📦 Descargar

👉 **[Descargar la última versión](../../releases/latest)**

### Elige tu versión

| Plataforma | Archivo |
|-----------|--------|
| Windows | `setup-x64.exe` (recomendado) / `portable-x64.exe` |
| macOS (Apple Silicon) | `arm64.dmg` |
| macOS (Intel) | `x64.dmg` |
| Linux | `.AppImage` o `.deb` |

---

<details>
<summary>⚠️ Solución “La app está dañada” en macOS</summary>

```
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

</details>

<details>
<summary>🐧 Uso de AppImage en Linux</summary>

```
chmod +x apprenticevr-*.AppImage
./apprenticevr-*.AppImage
```

</details>

---

## ⚙️ Configuración

### 1. Obtener las credenciales del servidor

Necesitas:
- `baseUri`
- `password`

Puedes encontrarlas aquí:
- https://t.me/the_vrSrc  
- https://t.me/s/the_vrSrc  
- https://qpmegathread.top/pages/public-json.html  

---

### 2. Introducir las credenciales

#### Opción A (Recomendada)

- Abre **Settings**
- Haz clic en **Set Public Server JSON**
- Pega el JSON → Apply → Save

#### Opción B (Archivo manual)

| Sistema | Ruta |
|--------|------|
| Windows | `%APPDATA%\apprenticevr\ServerInfo.json` |
| macOS | `~/Library/Application Support/apprenticevr/ServerInfo.json` |
| Linux | `~/.config/apprenticevr/ServerInfo.json` |

```
{"baseUri":"https://tu-url/","password":"tu-contraseña"}
```

---

### 3. Conectar tu Quest

- Conecta el visor  
- Acepta la **depuración USB**  
- El dispositivo aparecerá automáticamente  

Descargar → instalar → listo.

---

## 🚀 Características

### ⚡ Descargas rápidas
- Hasta **5 descargas simultáneas**
- Sistema automático de gestión de descargas

### 🔌 Sin dependencias adicionales
- Utiliza `rclone copy`
- No requiere macFUSE ni WinFsp

### ⏸ Pausar y reanudar
- Permite continuar descargas incompletas
- Sin desperdiciar ancho de banda

### 🧠 Rendimiento optimizado
- Preparado para bibliotecas de **más de 2000 juegos**
- Búsqueda y navegación más ágiles

### 📊 Seguimiento preciso
- Porcentaje real
- Velocidad y tiempo estimado

### 💻 Multiplataforma
- Compatible con Windows, macOS y Linux

---

## 📤 Subidas (Contribuir)

Puedes subir juegos instalados desde tu Quest.

### Cómo funciona

1. Extrae el APK mediante ADB  
2. Detecta archivos OBB  
3. Prepara los archivos  
4. Los comprime en ZIP  
5. Los sube mediante rclone  
6. Añade el título a la lista de exclusión  

---

### ⚠️ Importante

- Subir contenido **no garantiza su inclusión**
- No solicites estado de revisión
- Ten paciencia

---

## 🧪 Función en desarrollo

Escaneo automático para:
- Detectar versiones más recientes que las del servidor
- Identificar títulos que faltan

---

## 📂 Registros (logs)

| Sistema | Ubicación |
|--------|----------|
| Windows | `%APPDATA%\apprenticevr\logs\main.log` |
| macOS | `~/Library/Logs/apprenticevr/main.log` |
| Linux | `~/.config/apprenticevr/logs/main.log` |

---

## 🛠 Solución de problemas

<details>
<summary>❌ No se puede conectar</summary>

- Comprueba que la URL termina en `/`  
- Verifica la contraseña  
- Asegúrate de poder acceder a https://downloads.rclone.org/  

Prueba:
- https://developers.cloudflare.com/1.1.1.1/setup/windows/  
- https://developers.google.com/speed/public-dns/docs/using  

O utiliza una VPN.

</details>

<details>
<summary>🎧 Quest no detectado</summary>

- Usa un cable de datos  
- Acepta la depuración USB  
- Prueba con otro puerto o cable  

Alternativa:
- Desactiva el modo desarrollador  
- Reinicia el visor  
- Actívalo de nuevo  

</details>

---

## 📸 Capturas

| | |
|--|--|
| ![](screenshots/01_devices_dark.png) | ![](screenshots/02_library_light.png) |
| ![](screenshots/03_detail_light.png) | ![](screenshots/04_download_dark.png) |

---

## 🙌 Créditos

Inspirado en Rookie Sideloader.

Agradecimientos a **mula-bb** por mejoras clave que han impulsado este proyecto.

---

## 📜 Licencia

GNU Affero General Public License v3
