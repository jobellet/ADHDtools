<p align="center">
  <a href="README.md"><img src="docs/flags/gb.svg" height="20" alt="English"> English</a> ·
  <a href="README.de.md"><img src="docs/flags/de.svg" height="20" alt="Deutsch"> Deutsch</a> ·
  <a href="README.fr.md"><img src="docs/flags/fr.svg" height="20" alt="Français"> Français</a> ·
  <a href="README.es.md"><img src="docs/flags/es.svg" height="20" alt="Español"> Español</a>
</p>

# ADHD Tools Hub

[**▶ Abrir la aplicación**](https://jobellet.github.io/ADHDtools/)

Un planificador del día para personas con TDAH que muestra **una sola cosa a la vez**. Funciona en el navegador: tus datos se quedan en tu dispositivo, salvo que *tú* actives una sincronización. Funciona en móvil y ordenador, sin conexión y sin cuenta.

## La idea: la menor carga mental posible

En cada momento solo haces una de estas tres cosas:

1. **Hacer** la tarea de la pantalla. La aplicación se abre en la vista **Ahora**: la tarea, el paso de rutina o el evento actual, con una gran cuenta atrás y 2 o 3 botones (*Hecho*, *Enfoque*, *Ahora no*).
2. **Descansar** y ver lo que viene. En un hueco corto, la vista *Ahora* muestra una cuenta atrás hasta lo siguiente.
3. **Planificar** con antelación. Cuando no hay nada previsto, la aplicación abre el **planificador del día**. Ahí colocas tareas y divides las tareas grandes con fecha límite en pasos pequeños.

Las rutinas (mañana, noche o las que crees) **reservan su tiempo** en el día, con un margen (+10 % por defecto). No se puede programar nada más a la misma hora: una tarea añadida en un hueco ocupado pasa al siguiente hueco libre, y la aplicación te dice por qué.

➡️ **¿Eres nuevo? Lee la [guía de uso](docs/using-the-app.md)** (en inglés).

## Ejemplo rápido

Añadir una tarea funciona sin conexión y sin IA:

```text
Entrada:   Call mom tomorrow at 5pm for 20 min !7
Resultado: Call mom — mañana a las 17:00 · 20 min · importancia 7 · hora fija
```

Si las 17:00 ya están ocupadas (por ejemplo, por tu rutina de la noche), la tarea pasa al siguiente hueco libre. Nota: sin IA, el análisis del texto solo entiende frases en inglés. Con un [proveedor de IA](docs/ai-providers.md) también puedes escribir en español.

## 🧰 Funciones

**Lo principal**

*   **Vista «Ahora» (por defecto):** la tarea, el paso de rutina o el evento actual con cuenta atrás, y lo que viene después.
*   **Planificador del día:** todo el día en una línea de tiempo: rutinas, tareas con hora fija, tareas colocadas por la aplicación, eventos del calendario. El panel *Planificar* muestra fechas límite y tareas grandes para dividir, y borra las tareas atrasadas una a una o todas a la vez (con Deshacer).
*   **Rutinas:** pasos con tiempo, uno a uno. Cada rutina reserva su tiempo (pasos + margen); no se pueden guardar rutinas que se solapan.
*   **Captura rápida (Añadir):** escribe o dicta una tarea con tus palabras. Funciona sin conexión; mejor con [IA](docs/ai-providers.md) si la configuras.
*   **Planificador único:** un solo plan para tareas, rutinas y eventos, ordenado por importancia × urgencia, sin reservas dobles.

**Otras herramientas**

*   **Dividir tareas:** partir una tarea grande en pasos pequeños (a mano o con IA).
*   **Modo enfoque** y **temporizador Pomodoro:** temporizadores a pantalla completa para trabajar concentrado.
*   **Calendario:** sincronización privada con [Google Calendar](docs/google-calendar-sync.md), o importación de un archivo / enlace `.ics`.
*   **Hábitos** y **recompensas:** rachas, puntos por tareas terminadas, recompensas que eliges tú.
*   **Varios usuarios** en un dispositivo y **4 idiomas** (English, Deutsch, Français, Español).

**Se adapta a tu configuración**

La aplicación solo muestra las opciones que usas. Por ejemplo, la importación `.ics` se oculta en cuanto Google Calendar está conectado, y los botones de IA se ocultan sin proveedor de IA. *Ajustes → General → Mostrar todas las opciones* vuelve a mostrarlo todo.

## 🤖 Habla con tu asistente de IA sobre tu día (MCP)

Pide a tu asistente de IA (Mistral, Claude o cualquier app compatible con MCP) que *«divida mi declaración de impuestos en pasos pequeños»* o *«busque una hora para hacer deporte mañana»*. Los cambios aparecen en la app. Tu propio Google Drive es el almacenamiento: ningún servidor nuestro, sin ngrok, sin Tailscale.

**Configuración (unos 10 minutos):**

1. En la app, conecta Google y toca **Más → Acerca de → Sync Across Devices → Back up now**. Deja la sincronización automática activada.
2. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), en el **mismo proyecto** que el Client ID de la app: **Create credentials → OAuth client ID → Desktop app**. En la pantalla de consentimiento, haz clic en **Publish app**.
3. En tu ordenador (Node 18+): `git clone https://github.com/jobellet/ADHDtools.git` y, en esa carpeta:
   `npm run mcp:auth -- --client-id "DESKTOP_CLIENT_ID" --client-secret "CLIENT_SECRET"`
4. Añade el servidor en los ajustes MCP de tu app de IA: comando `node`, argumento `/ruta/completa/ADHDtools/mcp/server.js`.
   Para Le Chat en la web, ejecuta `node mcp/server.js http` en un pequeño hosting (ver la guía).
5. Pregunta: *«Dame un resumen de mi día.»* Deja la app abierta: aplica los cambios en unos 2 minutos.

Guía completa (en inglés), configuración de Mistral Vibe y Le Chat, y solución de problemas: [**docs/mcp.md**](docs/mcp.md).

## 📚 Guías

Las guías detalladas están en inglés:

| Guía | Contenido |
| --- | --- |
| [**Guía de uso (User guide)**](docs/using-the-app.md) | Ahora, Plan, Añadir, rutinas, ajustes. Empieza aquí. |
| [**Google Calendar**](docs/google-calendar-sync.md) | Sincronización privada OAuth (recomendada, sin enlace público), importación `.ics` o enlace ICS público. |
| [**Datos en varios dispositivos**](docs/sync-across-devices.md) | Copia en Google Drive, exportar/importar archivo, correo, con fusión segura. |
| [**IA (opcional)**](docs/ai-providers.md) | Tu propio proveedor: OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter o un modelo local. Todo funciona también sin IA. |
| [**Asistente de IA con MCP**](docs/mcp.md) | Mistral, Claude u otra app MCP lee tu día, añade tareas y las divide, a través de tu Google Drive. |
| [**Modelo de datos y planificador**](docs/task-model.md) | El objeto Task, TaskStore, la reserva de rutinas, cómo se construye el día. |
| [**Visión y estado**](docs/vision-roadmap.md) | Hacia dónde va el proyecto y qué funciona ya. |
| [**Casos de prueba**](docs/testing.md) | Escenarios para comprobar la aplicación tras cambios. |
| [**Contribuir**](docs/contributing.md) · [**AGENTS.md**](AGENTS.md) | Ejecutar la aplicación en local, ejecutar las pruebas, enviar cambios. `AGENTS.md` es la guía para agentes de IA de código (y personas): mapa del código, vocabulario común, reglas. |

## 🔒 Privacidad

Todos los datos se guardan en tu navegador. No se envía nada a ningún servidor, salvo que actives una integración: la sincronización con Google va directamente de tu navegador a Google, y las peticiones de IA van directamente al proveedor elegido. No hay servidor intermedio.

## 💬 Comentarios

Sugerencias e informes de errores son bienvenidos: abre un issue.

## Licencia

Licencia MIT. Consulta el archivo [LICENSE](LICENSE).
