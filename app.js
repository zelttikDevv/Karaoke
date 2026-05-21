// Configuración inicial del estado de la aplicación
let player;
let parsedLyrics = [];
let currentLineIndex = -1;
let trackCheckInterval;
let currentLineStartTime = 0;
let currentLineDuration = 0;

// 1. MOTOR PARSEADOR DE LETRAS (.LRC)
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

    // Ordenamos las líneas cronológicamente por seguridad
    return lyricsArray.sort((a, b) => a.time - b.time);
}

// 2. CARGA DEL ARCHIVO DE LETRAS
async function loadLyricsFromServer(fileName) {
    try {
        const response = await fetch(`./lyrics/${fileName}`);
        if (!response.ok) throw new Error("No se pudo encontrar el archivo de letra");
        
        const lrcContent = await response.text();
        parsedLyrics = parseLRC(lrcContent);
        resetDisplay();
    } catch (error) {
        console.error("Error cargando el archivo de letras:", error);
        document.getElementById('line-current').innerText = "Error al cargar la letra (.lrc)";
    }
}

// 3. INTEGRACIÓN CON YOUTUBE IFRAME API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('yt-player-raw', {
        height: '100%',
        width: '100%',
        videoId: '4NRXx6U8ABQ', // ID por defecto (Blinding Lights de The Weeknd)
        playerVars: { 'autoplay': 0, 'controls': 1 },
        events: {
            'onStateChange': handlePlayerState
        }
    });
}

// Control de la reproducción y del bucle de chequeo continuo
function handlePlayerState(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        trackCheckInterval = setInterval(syncLyricsLoop, 60); // Alta frecuencia para precisión de barrido
    } else {
        clearInterval(trackCheckInterval);
    }
}

// 4. MOTOR DE TRATAMIENTO Y SINCRONIZACIÓN EN TIEMPO REAL
function syncLyricsLoop() {
    if (!player || parsedLyrics.length === 0) return;
    
    const currentTime = player.getCurrentTime();
    let targetIndex = -1;

    // Localizar la línea correspondiente al segundo actual del video
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
            targetIndex = i;
        } else {
            break;
        }
    }

    // Si la línea de la letra cambia, reconstruimos el escenario base
    if (targetIndex !== currentLineIndex && targetIndex !== -1) {
        currentLineIndex = targetIndex;
        
        // Calculamos la duración exacta de esta línea usando el inicio de la siguiente
        currentLineStartTime = parsedLyrics[currentLineIndex].time;
        const nextLineTime = parsedLyrics[currentLineIndex + 1] ? parsedLyrics[currentLineIndex + 1].time : player.getDuration();
        currentLineDuration = nextLineTime - currentLineStartTime;

        updateDOMStage();
    }

    // Mientras estemos cantando una línea, calculamos el barrido continuo por palabra
    if (currentLineIndex !== -1) {
        animateWordSweeping(currentTime);
    }
}

function updateDOMStage() {
    const prevText = parsedLyrics[currentLineIndex - 1] ? parsedLyrics[currentLineIndex - 1].text : "";
    const currentText = parsedLyrics[currentLineIndex].text;
    const nextText = parsedLyrics[currentLineIndex + 1] ? parsedLyrics[currentLineIndex + 1].text : "";

    document.getElementById('line-prev').innerText = prevText;
    document.getElementById('line-next').innerText = nextText;

    // Fragmentamos el texto de la línea activa en elementos HTML independientes por palabra
    const currentContainer = document.getElementById('line-current');
    currentContainer.innerHTML = ''; 

    const words = currentText.split(' ');
    words.forEach(word => {
        const span = document.createElement('span');
        span.classList.add('karaoke-word');
        span.setAttribute('data-word', word);
        span.innerText = word;
        span.style.setProperty('--progress', '100%'); // Inicialmente oculto (100% recortado)
        currentContainer.appendChild(span);
    });
}

// 5. MOTOR DE BARRIDO DE COLOR (CLIP-PATH VARIABLE)
function animateWordSweeping(currentTime) {
    const wordElements = document.querySelectorAll('.karaoke-word');
    if (wordElements.length === 0 || currentLineDuration <= 0) return;

    const timeElapsedInLine = currentTime - currentLineStartTime;
    const durationPerWord = currentLineDuration / wordElements.length;

    wordElements.forEach((el, index) => {
        const wordStartTime = index * durationPerWord;
        const wordEndTime = (index + 1) * durationPerWord;

        if (timeElapsedInLine >= wordEndTime) {
            // Palabra cantada: se remueve por completo el corte (0% oculto, brillo total)
            el.style.setProperty('--progress', '0%');
        } else if (timeElapsedInLine >= wordStartTime && timeElapsedInLine < wordEndTime) {
            // Palabra en ejecución: calculamos el progreso interno del fragmento
            const wordProgress = (timeElapsedInLine - wordStartTime) / durationPerWord;
            const percentageToCut = (100 - (wordProgress * 100)).toFixed(1);
            el.style.setProperty('--progress', `${percentageToCut}%`);
        } else {
            // Palabra futura: se queda totalmente oculta (100% recortada)
            el.style.setProperty('--progress', '100%');
        }
    });
}

function resetDisplay() {
    currentLineIndex = -1;
    document.getElementById('line-prev').innerText = "";
    document.getElementById('line-current').innerText = "¡Letra cargada! Dale Play al video";
    document.getElementById('line-next').innerText = "";
}

// 6. DETECTOR DEL ENLACE O ID DE USER
document.getElementById('song-input').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    if (!val) return;

    let videoId = val;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = val.match(regExp);
    
    if (match && match[2].length === 11) {
        videoId = match[2];
    }

    if (player) {
        player.loadVideoById(videoId);
        // Aquí puedes enlazar tu lógica dinámica para buscar archivos .lrc distintos
        loadLyricsFromServer('blinding-lights.lrc');
    }
});

// Carga del archivo por defecto al iniciar
window.addEventListener('DOMContentLoaded', () => {
    loadLyricsFromServer('blinding-lights.lrc');
});
