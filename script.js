const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const filterSelect = document.getElementById('filterSelect');
const captureButton = document.getElementById('captureButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const downloadLink = document.getElementById('downloadLink');

// Bilder laden
const grungeJacketImg = document.getElementById('grungeJacket');
const grungePantsImg = document.getElementById('grungePants');

let currentStream;
let facingMode = 'user';
let poseDetector = null;
const MIN_CONFIDENCE = 0.3;

// ===== 1. Initialisierung mit Sicherheitsnetz =====
async function initPoseDetection() {
    captureButton.innerText = "⏳ Lade KI...";
    captureButton.disabled = true;

    // Sicherheitsnetz: Button nach 4 Sekunden auf jeden Fall aktivieren
    setTimeout(() => {
        if (captureButton.disabled) {
            console.warn("Zeitüberschreitung beim Laden. Aktiviere Button trotzdem.");
            captureButton.disabled = false;
            captureButton.innerText = "📸 Foto (Ohne KI)";
        }
    }, 4000);

    try {
        await tf.ready();
        const detectorConfig = { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        poseDetector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, detectorConfig);
        
        console.log('KI bereit.');
        captureButton.innerText = "📸 Foto aufnehmen";
        captureButton.disabled = false;
    } catch (err) {
        console.error('KI Fehler:', err);
        // Wir machen weiter, auch ohne KI!
        captureButton.innerText = "📸 Foto (Ohne KI)";
        captureButton.disabled = false;
        poseDetector = null; // Sicherstellen, dass es null ist
    }
}

// ===== 2. Kamera =====
// In der Funktion startCamera
async function startCamera(facingMode) {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    // Vereinfachte Constraints, um Konflikte zu vermeiden
    const constraints = {
        video: {
            // Wir lassen facingMode weg, wenn nur eine Kamera verfügbar ist, 
            // oder verwenden es, wenn es funktioniert.
            // Zuerst versuchen wir es mit facingMode:
            facingMode: facingMode
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        
        // WICHTIG: Prüfen Sie die geladene Auflösung (kann bei Fehlern helfen)
        video.onloadedmetadata = function() {
            console.log("Kamera gestartet mit Auflösung:", video.videoWidth, "x", video.videoHeight);
        };

        video.play();
    } catch (err) {
        console.error("Fehler beim Zugriff auf die Kamera: ", err);
        alert("Kamera-Fehler: Konnte Videoquelle nicht starten. Ursache: " + err.name);
        // Falls der Fehler 'NotAllowedError' ist, liegt es an den Berechtigungen (Punkt 1)
    }
}

switchCameraButton.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    startCamera();
});

// ===== 3. Filter Auswahl =====
filterSelect.addEventListener('change', () => {
    overlay.className = 'overlay ' + filterSelect.value;
});

// ===== 4. Foto Aufnehmen (Robuste Version) =====
async function takePicture() {
    // Wenn kein Video da ist, breche ab
    if (!video.srcObject) {
        alert("Kamera läuft nicht!");
        return;
    }

    captureButton.disabled = true;
    captureButton.innerText = "Verarbeite...";

    // Canvas vorbereiten
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Video zeichnen (Spiegeln beachten)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const selectedFilter = filterSelect.value;

    // --- KI-Logik: Nur ausführen, wenn Modell da ist UND Outfit gewählt ---
    if (selectedFilter === 'grunge-outfit' && poseDetector) {
        try {
            const poses = await poseDetector.estimatePoses(canvas);
            
            if (poses && poses.length > 0) {
                // Keypoints finden
                const k = poses[0].keypoints;
                const findPt = (name) => k.find(p => p.name === name && p.score > MIN_CONFIDENCE);

                const lS = findPt('leftShoulder');
                const rS = findPt('rightShoulder');
                const lH = findPt('leftHip');
                const rH = findPt('rightHip');

                // Jacke zeichnen (einfache Logik)
                if (lS && rS) {
                    const width = Math.abs(rS.x - lS.x) * 1.8; // Breiter als Schultern
                    const height = width * 1.2; // Verhältnis
                    const x = ((lS.x + rS.x) / 2) - (width / 2);
                    const y = ((lS.y + rS.y) / 2) - (height * 0.2);
                    ctx.drawImage(grungeJacketImg, x, y, width, height);
                }
                
                // Hose zeichnen (einfache Logik)
                if (lH && rH) {
                    const width = Math.abs(rH.x - lH.x) * 2.5; // Baggy Style
                    const height = width * 1.5; 
                    const x = ((lH.x + rH.x) / 2) - (width / 2);
                    const y = ((lH.y + rH.y) / 2);
                    ctx.drawImage(grungePantsImg, x, y, width, height);
                }
            }
        } catch (e) {
            console.log("KI-Erkennung fehlgeschlagen, mache normales Foto.");
        }
    } 
    // Fallback: Wenn 'grunge-outfit' gewählt ist, aber KEINE KI da ist -> Statische Bilder
    else if (selectedFilter === 'grunge-outfit' && !poseDetector) {
        // Einfach statisch in die Mitte malen
        ctx.drawImage(grungeJacketImg, canvas.width*0.1, canvas.height*0.1, canvas.width*0.8, canvas.height*0.4);
        ctx.drawImage(grungePantsImg, canvas.width*0.2, canvas.height*0.5, canvas.width*0.6, canvas.height*0.5);
    }

    // Andere Filter
    if (selectedFilter === 'grunge-style') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0,0,canvas.width, canvas.height);
    }

    // --- SPEICHERN (Hier passiert oft der Fehler) ---
    try {
        const dataUrl = canvas.toDataURL('image/png');
        photo.src = dataUrl;
        photo.style.display = 'block';
        downloadLink.href = dataUrl;
        downloadLink.style.display = 'block';
        
        // Zu Bild scrollen
        photo.scrollIntoView({behavior: "smooth"});
    } catch (securityError) {
        console.error(securityError);
        alert("Sicherheitsfehler: Das Bild konnte nicht gespeichert werden.\n\nGrund: Du öffnest die Datei wahrscheinlich lokal (file://). Bitte lade den Ordner auf Netlify hoch oder nutze einen lokalen Server.");
    }

    captureButton.disabled = false;
    captureButton.innerText = "📸 Foto aufnehmen";
}

// Start
initPoseDetection();
startCamera(facingMode);
captureButton.addEventListener('click', takePicture);