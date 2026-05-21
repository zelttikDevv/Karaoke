// --- CONFIGURACIÓN Y CATÁLOGO ---
let player;
let parsedLyrics = [];
let currentLineIndex = -1;
let trackCheckInterval;
let currentLineStartTime = 0;
let currentLineDuration = 0;

// Mapeo: ID de video de YouTube -> Nombre del archivo .lrc en carpeta /lyrics
const songCatalog = {
    "4NRXx6U8ABQ": "blinding-lights.lrc",
    "h4GhiCoYqkQ": "mia.lrc"
};

// --- 1. MOTOR PARSEADOR DE LETRAS (.LRC) ---
function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const lyricsArray = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3], 10) / 100;
            const totalSeconds = (minutes * 60) + seconds + milliseconds;
            const text = line.replace(timeRegex, '').trim();
            if (text) lyricsArray.push({ time: totalSeconds, text: text });
        }
    });
    return lyricsArray.sort((a, b) => a.time - b.time);
}

// --- 2. CARGA DE ARCHIVOS DESDE GITHUB ---
async function loadLyricsFromServer(fileName) {
    try {
        const response = await fetch(`./lyrics/${fileName}`);
        if (!response.ok) throw new Error("Archivo no encontrado");
        const lrcContent = await response.text();
        parsedLyrics = parseLRC(lrcContent);
        resetDisplay();
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('line-current').innerText = "Letra no encontrada en /lyrics";
    }
}

// --- 3. INTEGRACIÓN YOUTUBE ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('yt-player-raw', {
        height: '100%',
        width: '100%',
        videoId: 'h4GhiCoYqkQ', // Video inicial por defecto
        playerVars: { 'autoplay': 0, 'controls': 1 },
        events: { 'onStateChange': handlePlayerState }
    });
}

function handlePlayerState(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        trackCheckInterval = setInterval(syncLyricsLoop, 60);
    } else {
        clearInterval(trackCheckInterval);
    }
}

// --- 4. SINCRONIZACIÓN Y ANIMACIÓN ---
function syncLyricsLoop() {
    if (!player || parsedLyrics.length === 0) return;
    const currentTime = player.getCurrentTime();
    let targetIndex = -1;

    for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) targetIndex = i;
        else break;
    }

    if (targetIndex !== currentLineIndex && targetIndex !== -1) {
        currentLineIndex = targetIndex;
        currentLineStartTime = parsedLyrics[currentLineIndex].time;
        const nextLineTime = parsedLyrics[currentLineIndex + 1] ? parsedLyrics[currentLineIndex + 1].time : player.getDuration();
        currentLineDuration = nextLineTime - currentLineStartTime;
        updateDOMStage();
    }

    if (currentLineIndex !== -1) animateWordSweeping(currentTime);
}

function updateDOMStage() {
    const prevText = parsedLyrics[currentLineIndex - 1] ? parsedLyrics[currentLineIndex - 1].text : "";
    const nextText = parsedLyrics[currentLineIndex + 1] ? parsedLyrics[currentLineIndex + 1].text : "";
    document.getElementById('line-prev').innerText = prevText;
    document.getElementById('line-next').innerText = nextText;

    const currentContainer = document.getElementById('line-current');
    currentContainer.innerHTML = '';
    const words = parsedLyrics[currentLineIndex].text.split(' ');
    
    words.forEach(word => {
        const span = document.createElement('span');
        span.classList.add('karaoke-word');
        span.setAttribute('data-word', word);
        span.innerText = word;
        span.style.setProperty('--progress', '100%');
        currentContainer.appendChild(span);
    });
}

function animateWordSweeping(currentTime) {
    const wordElements = document.querySelectorAll('.karaoke-word');
    if (wordElements.length === 0 || currentLineDuration <= 0) return;
    const timeElapsedInLine = currentTime - currentLineStartTime;
    const durationPerWord = currentLineDuration / wordElements.length;

    wordElements.forEach((el, index) => {
        const wordStartTime = index * durationPerWord;
        const wordEndTime = (index + 1) * durationPerWord;
        if (timeElapsedInLine >= wordEndTime) el.style.setProperty('--progress', '0%');
        else if (timeElapsedInLine >= wordStartTime) {
            const wordProgress = (timeElapsedInLine - wordStartTime) / durationPerWord;
            el.style.setProperty('--progress', `${(100 - (wordProgress * 100)).toFixed(1)}%`);
        } else el.style.setProperty('--progress', '100%');
    });
}

function resetDisplay() {
    currentLineIndex = -1;
    document.getElementById('line-prev').innerText = "";
    document.getElementById('line-current').innerText = "¡Letra lista!";
    document.getElementById('line-next').innerText = "";
}

// --- 5. BUSCADOR ---
document.getElementById('song-input').addEventListener('change', (e) => {
    let val = e.target.value.trim();
    const match = val.match(/(youtu\.be\/|v\/|watch\?v=)([^#\&\?]*)/);
    const videoId = (match && match[2].length === 11) ? match[2] : val;

    if (player) {
        player.loadVideoById(videoId);
        if (songCatalog[videoId]) loadLyricsFromServer(songCatalog[videoId]);
        else document.getElementById('line-current').innerText = "Letra no disponible";
    }
});
