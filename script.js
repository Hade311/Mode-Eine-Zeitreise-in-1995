const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const filterSelect = document.getElementById('filterSelect');
const captureButton = document.getElementById('captureButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const downloadLink = document.getElementById('downloadLink');

// NEU: Outfit-Bilder aus dem HTML laden
const grungeJacket = document.getElementById('grungeJacket');
const grungePants = document.getElementById('grungePants');

let currentStream;
let facingMode = 'user'; 

// Funktion zum Starten des Kamerastreams (unverändert)
async function startCamera(facingMode) {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: facingMode
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        video.play();
    } catch (err) {
        console.error("Fehler beim Zugriff auf die Kamera: ", err);
        alert("Kamerazugriff verweigert oder nicht möglich.");
    }
}

// Initialer Start der Kamera
startCamera(facingMode);

// Event-Listener für Kamera-Wechsel (unverändert)
switchCameraButton.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    startCamera(facingMode);
});

// Event-Listener für die Filterauswahl (Live-Vorschau)
filterSelect.addEventListener('change', () => {
    const selectedFilterClass = filterSelect.value;
    overlay.className = 'overlay ' + selectedFilterClass;
    
    // Wenn 'grunge-outfit' ausgewählt, füge die Outfit-Bilder zur Live-Vorschau hinzu
    if (selectedFilterClass === 'grunge-outfit') {
        overlay.innerHTML = `
            <img id="overlayJacket" class="outfit-piece" src="${grungeJacket.src}" alt="Grunge Jacket">
            <img id="overlayPants" class="outfit-piece" src="${grungePants.src}" alt="Grunge Pants">
        `;
    } else {
        overlay.innerHTML = ''; // Entferne die Bilder für andere Filter (Visuelle Filter nutzen nur CSS)
    }
});

// Event-Listener für den Aufnahme-Button (unverändert)
captureButton.addEventListener('click', () => {
    takePicture();
});

// Funktion zur Aufnahme des Bildes mit simuliertem Overlay (Canvas-Zeichnung)
function takePicture() {
    if (!video.srcObject) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    // 1. Video-Frame auf das Canvas zeichnen
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Filter-Simulation/Outfit-Zeichnung basierend auf der Auswahl
    const selectedFilterClass = filterSelect.value;
    
    // **GRUNGE OUTFIT auf das Canvas zeichnen**
    if (selectedFilterClass === 'grunge-outfit') {
        
        // **Jacke (Jacket)**: Oben zentriert
        // Angepasste Proportionen für eine realistische Überlappung
        const jacketWidth = canvas.width * 0.9;
        const jacketHeight = canvas.height * 0.55; // Etwas kürzer als 0.6
        const jacketX = (canvas.width - jacketWidth) / 2;
        const jacketY = canvas.height * -0.05; // Startet leicht über dem oberen Rand
        context.drawImage(grungeJacket, jacketX, jacketY, jacketWidth, jacketHeight);

        // **Hosen (Pants)**: Unten zentriert
        const pantsWidth = canvas.width * 0.8;
        const pantsHeight = canvas.height * 0.7;
        const pantsX = (canvas.width - pantsWidth) / 2;
        const pantsY = canvas.height * 0.28; // Startet etwas höher, um Jacke zu treffen
        context.drawImage(grungePants, pantsX, pantsY, pantsWidth, pantsHeight);

    }
    
    // **Grunge-Stil (Visuell)**
    else if (selectedFilterClass === 'grunge-style') {
        context.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.strokeStyle = 'rgba(100, 100, 100, 0.5)';
        context.lineWidth = 20;
        context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    }
    
    // **Hip-Hop (Baggy)-Stil**
    else if (selectedFilterClass === 'hiphop-baggy') {
        context.strokeStyle = 'rgba(255, 255, 0, 0.8)'; 
        context.lineWidth = 30;
        context.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
        
        context.strokeStyle = 'rgba(0, 0, 255, 0.5)'; 
        context.lineWidth = 10;
        context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    }
    
    // **Rave (Neon)-Stil**
    else if (selectedFilterClass === 'rave-neon') {
        context.fillStyle = 'rgba(255, 0, 255, 0.1)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)'); 
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');  
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Bild und Download-Link aktualisieren
    updatePhotoOutput();
}

// Funktion zur Anzeige und zum Download des Canvas-Bildes (unverändert)
function updatePhotoOutput() {
    const dataUrl = canvas.toDataURL('image/png');

    photo.setAttribute('src', dataUrl);
    photo.style.display = 'block';

    downloadLink.setAttribute('href', dataUrl);
    downloadLink.style.display = 'block';
}