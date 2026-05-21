// Configuración inicial del estado de la aplicación
let player;
let parsedLyrics = [];
let currentLineIndex = -1;
let trackCheckInterval;

// 1. EL MOTOR PARSEADOR DE LETRAS (.LRC)
// Toma el texto plano del archivo .lrc y lo convierte en un Array de objetos manejables
function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const lyricsArray = [];
    
    // Expresión regular para capturar el formato [minutos:segundos.centésimas]
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            // Convertimos la marca de tiempo completa a segundos totales
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3], 10) / 100;
            const totalSeconds = (minutes * 60) + seconds + milliseconds;
            
            // Extraemos el texto eliminando la etiqueta de tiempo
            const text = line.replace(timeRegex, '').trim();
            
            if (text) {
                lyricsArray.push({ time: totalSeconds, text: text });
            }
        }
    });

    // Ordenamos las líneas por tiempo por seguridad
    return lyricsArray.sort((a, b) => a.time - b.time);
}

// 2. CARGA DEL ARCHIVO DE LETRAS
// Simulamos la carga desde tu carpeta o repositorio de GitHub
async function loadLyricsFromServer(fileName) {
    try {
        const response = await fetch(`./lyrics/${fileName}`);
        const lrcContent = await response.text();
        parsedLyrics = parseLRC(lrcContent);
        resetDisplay();
    } catch (error) {
        console.error("Error cargando el archivo de letras:", error);
        document.getElementById('line-current').innerText = "Error al cargar la letra";
    }
}

// 3. INTEGRACIÓN CON YOUTUBE IFRAME API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('yt-player-raw', {
        height: '100%',
        width: '100%',
        videoId: '4NRXx6U8ABQ', // ID por defecto (Blinding Lights)
        playerVars: { 'autoplay': 0, 'controls': 1 },
        events: {
            'onStateChange': handlePlayerState
        }
    });
}

// Control de la reproducción y del bucle de chequeo
function handlePlayerState(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        trackCheckInterval = setInterval(syncLyricsLoop, 60); // Comprobación rápida para alta precisión
    } else {
        clearInterval(trackCheckInterval);
    }
}

// 4. MOTOR DE TRATAMIENTO Y SINCRONIZACIÓN EN TIEMPO REAL
function syncLyricsLoop() {
    if (!player || parsedLyrics.length === 0) return;
    
    const currentTime = player.getCurrentTime();
    let targetIndex = -1;

    // Buscamos cuál es la línea activa correspondiente al tiempo actual
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
            targetIndex = i;
        } else {
            break;
        }
    }

    // Si la línea cambió, actualizamos el DOM de manera eficiente
    if (targetIndex !== currentLineIndex && targetIndex !== -1) {
        currentLineIndex = targetIndex;
        updateDOMStage();
    }
}

function updateDOMStage() {
    const prevText = parsedLyrics[currentLineIndex - 1] ? parsedLyrics[currentLineIndex - 1].text : "";
    const currentText = parsedLyrics[currentLineIndex].text;
    const nextText = parsedLyrics[currentLineIndex + 1] ? parsedLyrics[currentLineIndex + 1].text : "";

    document.getElementById('line-prev').innerText = prevText;
    document.getElementById('line-current').innerText = currentText;
    document.getElementById('line-next').innerText = nextText;
}

function resetDisplay() {
    currentLineIndex = -1;
    document.getElementById('line-prev').innerText = "";
    document.getElementById('line-current').innerText = "¡Letra cargada! Dale Play al video";
    document.getElementById('line-next').innerText = "";
}

// 5. MANEJO DEL BUSCADOR / INPUT
document.getElementById('song-input').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    if (!val) return;

    // Si el usuario introduce una URL completa de YouTube, extraemos el ID
    let videoId = val;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = val.match(regExp);
    
    if (match && match[2].length === 11) {
        videoId = match[2];
    }

    if (player) {
        player.loadVideoById(videoId);
        // Aquí asumirías que el archivo .lrc se llama igual que el ID o implementarías tu JSON de mapeo
        // Para este ejemplo, recargamos la misma letra de prueba
        loadLyricsFromServer('blinding-lights.lrc');
    }
});

// Carga inicial al abrir la página
window.addEventListener('DOMContentLoaded', () => {
    loadLyricsFromServer('blinding-lights.lrc');
});
      
