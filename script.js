// ... (Variablen wie video, canvas etc. bleiben gleich) ...
const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const filterSelect = document.getElementById('filterSelect');
const captureButton = document.getElementById('captureButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const downloadLink = document.getElementById('downloadLink');

// Outfit Bilder
const grungeJacketImg = document.getElementById('grungeJacket');
const grungePantsImg = document.getElementById('grungePants');

let currentStream;
let facingMode = 'user';
let poseDetector = null;
const MIN_CONFIDENCE = 0.3;

// ===== 1. KI-Modell Initialisierung (VERBESSERT) =====
async function initPoseDetection() {
    captureButton.innerText = "⏳ Lade KI...";
    captureButton.disabled = true;

    try {
        // Warten, bis TensorFlow bereit ist
        await tf.ready();
        console.log("TensorFlow ist bereit. Backend:", tf.getBackend());

        // Konfiguration für das Modell
        const detectorConfig = { 
            modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING 
        };
        
        // Modell erstellen
        poseDetector = await posedetection.createDetector(
            posedetection.SupportedModels.MoveNet, 
            detectorConfig
        );

        console.log('KI-Modell erfolgreich geladen!');
        captureButton.innerText = "📸 Foto aufnehmen";
        captureButton.disabled = false;

    } catch (err) {
        console.error('Kritischer Fehler beim Laden der KI:', err);
        // Fallback: Wir erlauben trotzdem das Foto machen, nur ohne Körpererkennung
        captureButton.innerText = "📸 Foto (ohne KI)";
        captureButton.disabled = false;
        alert("Hinweis: Die KI konnte nicht geladen werden (" + err.message + "). Du kannst trotzdem Fotos machen, aber das Outfit wird evtl. nicht perfekt sitzen.");
    }
}
// ... (Rest des Codes bleibt gleich) ...

// ===== 1. KI-Modell Initialisierung =====
async function initPoseDetection() {
    captureButton.innerText = "⏳ Lade KI-Modell...";
    captureButton.disabled = true;
    try {
        // Wir verwenden MoveNet (schnell und relativ genau für Einzelpersonen)
        const detectorConfig = { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        poseDetector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, detectorConfig);
        
        console.log('Pose Detection Modell erfolgreich geladen!');
        captureButton.innerText = "📸 Foto aufnehmen";
        captureButton.disabled = false;
    } catch (err) {
        console.error('Fehler beim Laden des KI-Modells:', err);
        captureButton.innerText = "❌ Fehler beim Laden";
        alert("Fehler: Das KI-Modell konnte nicht geladen werden. Bitte Seite neu laden.");
    }
}

// ===== 2. Kamera Funktionen =====
async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    const constraints = {
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
    };
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        // Warten bis Video-Metadaten geladen sind, damit width/height verfügbar sind
        await new Promise(resolve => video.onloadedmetadata = resolve);
        video.play();
    } catch (err) {
        console.error("Kamerafehler:", err);
        alert("Zugriff auf Kamera verweigert oder nicht möglich.");
    }
}

switchCameraButton.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    startCamera();
});

// ===== 3. Filter UI Logik =====
filterSelect.addEventListener('change', () => {
    // Setzt CSS-Klasse für visuelle Live-Filter (nicht für das Outfit)
    overlay.className = 'overlay ' + filterSelect.value;
});


// ===== 4. Hauptfunktion: Foto aufnehmen & Verarbeiten =====
async function takePicture() {
    if (!video.srcObject || !poseDetector) return;

    // UI Feedback während der Verarbeitung
    captureButton.disabled = true;
    captureButton.innerText = "🤖 Verarbeite...";

    // Canvas auf Video-Größe einstellen
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // WICHTIG: Da wir das Video im CSS spiegeln (transform: scaleX(-1)),
    // müssen wir das auch beim Zeichnen auf den Canvas tun, sonst passt die Pose nicht.
    ctx.save(); // Aktuellen Zustand speichern
    ctx.scale(-1, 1); // Horizontal spiegeln
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height); // Bild versetzt zeichnen
    ctx.restore(); // Zustand wiederherstellen (damit die Outfits nicht auch gespiegelt werden)


    const selectedFilter = filterSelect.value;

    // --- HAUPTLOGIK: Outfit Anprobe ---
    if (selectedFilter === 'grunge-outfit') {
        try {
            // Pose auf dem statischen Canvas-Bild erkennen
            const poses = await poseDetector.estimatePoses(canvas);
            
            if (poses && poses.length > 0) {
                const keypoints = poses[0].keypoints;
                
                // Hilfsfunktion um Keypoints sicher zu finden
                const getKp = (name) => keypoints.find(kp => kp.name === name && kp.score > MIN_CONFIDENCE);

                // Relevante Punkte suchen
                const leftShoulder = getKp('leftShoulder');
                const rightShoulder = getKp('rightShoulder');
                const leftHip = getKp('leftHip');
                const rightHip = getKp('rightHip');
                const leftAnkle = getKp('leftAnkle');
                const rightAnkle = getKp('rightAnkle');

                // === A) OBERKÖRPER (Jacke) ===
                // Wir brauchen beide Schultern und mindestens eine Hüfte, um den Torso zu definieren.
                if (leftShoulder && rightShoulder && (leftHip || rightHip)) {
                    // 1. Breite berechnen: Abstand zwischen Schultern
                    const shoulderDistX = Math.abs(rightShoulder.x - leftShoulder.x);
                    // Jacken sind breiter als Schultern -> Multiplikator für "Baggy"-Look (z.B. 1.6-fach)
                    const jacketWidth = shoulderDistX * 1.6;

                    // 2. Höhe berechnen: Durchschnittl. Schulterhöhe bis durchschnittl. Hüfthöhe
                    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
                    // Nehme die vorhandene Hüfte oder den Durchschnitt, falls beide da sind
                    const avgHipY = (leftHip && rightHip) ? (leftHip.y + rightHip.y) / 2 : (leftHip ? leftHip.y : rightHip.y);
                    const torsoHeight = Math.abs(avgHipY - avgShoulderY);
                    // Jacke geht etwas über Schultern und unter Hüfte -> Multiplikator (z.B. 1.4-fach)
                    const jacketHeight = torsoHeight * 1.4;
                    
                    // 3. Position berechnen: Mitte zwischen Schultern
                    const centerX = (leftShoulder.x + rightShoulder.x) / 2;
                    // X-Position ist Mitte minus halbe Jackenbreite
                    const drawX = centerX - (jacketWidth / 2);
                    // Y-Position: Schulterhöhe minus ein Stück nach oben (z.B. 20% der Jackenhöhe)
                    const drawY = avgShoulderY - (jacketHeight * 0.2);

                    // Zeichnen!
                    ctx.drawImage(grungeJacketImg, drawX, drawY, jacketWidth, jacketHeight);
                }

                // === B) UNTERKÖRPER (Hose) ===
                // Wir brauchen beide Hüften und mindestens einen Knöchel für die Beinlänge.
                if (leftHip && rightHip && (leftAnkle || rightAnkle)) {
                     // 1. Breite berechnen: Abstand zwischen Hüften
                    const hipDistX = Math.abs(rightHip.x - leftHip.x);
                    // Baggy Jeans sind viel breiter als die Hüfte -> Multiplikator (z.B. 2.2-fach)
                    const pantsWidth = hipDistX * 2.2;

                     // 2. Höhe berechnen: Durchschnittl. Hüfthöhe bis durchschnittl. Knöchelhöhe
                    const avgHipY = (leftHip.y + rightHip.y) / 2;
                    const avgAnkleY = (leftAnkle && rightAnkle) ? (leftAnkle.y + rightAnkle.y) / 2 : (leftAnkle ? leftAnkle.y : rightAnkle.y);
                    const legLength = Math.abs(avgAnkleY - avgHipY);
                    // Hose geht etwas über Hüfte und bis zum Boden -> Multiplikator (z.B. 1.2-fach)
                    const pantsHeight = legLength * 1.2;

                    // 3. Position berechnen: Mitte zwischen Hüften
                    const centerX = (leftHip.x + rightHip.x) / 2;
                    const drawX = centerX - (pantsWidth / 2);
                    // Y-Position: Etwas über der Hüfte anfangen (z.B. 10% der Hosenhöhe nach oben)
                    const drawY = avgHipY - (pantsHeight * 0.1);

                     // Zeichnen!
                    ctx.drawImage(grungePantsImg, drawX, drawY, pantsWidth, pantsHeight);
                }
            } else {
                console.log("Keine Person erkannt oder Konfidenz zu niedrig.");
                // Optional: Eine Meldung auf dem Canvas anzeigen
                ctx.font = "20px Arial";
                ctx.fillStyle = "red";
                ctx.textAlign = "center";
                ctx.fillText("Keine Person erkannt. Bitte ganz ins Bild stellen.", canvas.width/2, canvas.height - 50);
            }

        } catch (error) {
            console.error("Fehler bei der Pose-Erkennung während der Aufnahme:", error);
        }
    } 
    
    // --- Einfache Visuelle Filter anwenden (Falls ausgewählt) ---
    applySimpleFilters(ctx, selectedFilter);

    // Ergebnis anzeigen
    finalizeCapture();
}

// Hilfsfunktion für die einfachen Farbfilter
function applySimpleFilters(ctx, filter) {
    if (filter === 'grunge-style') {
        ctx.fillStyle = 'rgba(50, 30, 0, 0.3)'; // Sepia-artiger Schleier
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over'; // Zurücksetzen
    } else if (filter === 'hiphop-baggy') {
        ctx.strokeStyle = 'gold';
        ctx.lineWidth = canvas.width * 0.05; // Rahmenbreite relativ zur Bildgröße
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
    } else if (filter === 'rave-neon') {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'; // Cyan Schleier
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    }
}

// Abschluss der Aufnahme: Bild anzeigen und Button resetten
function finalizeCapture() {
    const dataUrl = canvas.toDataURL('image/png');
    photo.src = dataUrl;
    photo.style.display = 'block';
    downloadLink.href = dataUrl;
    downloadLink.style.display = 'block';
    
    captureButton.disabled = false;
    captureButton.innerText = "📸 Neues Foto aufnehmen";
    
    // Automatisch zum Ergebnis scrollen (für Mobile)
    photo.scrollIntoView({behavior: "smooth"});
}


// Start everything
initPoseDetection();
startCamera();
captureButton.addEventListener('click', takePicture);