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
let poseDetector = null;
let lastPose = null;

// ===== POSE DETECTION INITIALIZATION =====
async function initPoseDetection() {
    try {
        const detectionConfig = {
            modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        };
        poseDetector = await posedetection.createDetector(
            posedetection.SupportedModels.MoveNet,
            detectionConfig
        );
        console.log('Pose detection model loaded successfully');
    } catch (err) {
        console.error('Error loading pose detection model:', err);
    }
}

// Detect body parts and their positions
async function detectPose(imageElement) {
    if (!poseDetector) return null;
    
    try {
        const poses = await poseDetector.estimatePoses(imageElement);
        if (poses && poses.length > 0) {
            lastPose = poses[0];
            return poses[0];
        }
    } catch (err) {
        console.error('Error detecting pose:', err);
    }
    return null;
}

// Analyze which body parts are visible and calculate their positions
function analyzeBodyParts(pose) {
    if (!pose || !pose.keypoints) return null;
    
    const analysis = {
        hasHead: false,
        hasUpperBody: false,
        hasLowerBody: false,
        keypoints: pose.keypoints,
        bounds: {
            minY: Infinity,
            maxY: -Infinity,
            minX: Infinity,
            maxX: -Infinity
        }
    };
    
    // Map pose keypoints (based on COCO keypoints)
    // ... (Keypoint-Namen sind hier nicht zwingend notwendig, können aber zur Debugging-Hilfe bleiben)
    
    // Filter keypoints with high confidence (score > 0.3)
    const visibleKeypoints = pose.keypoints.filter(kp => kp.score > 0.3);
    
    // Check for head
    const headPoints = visibleKeypoints.filter(kp => kp.name && ['nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar'].includes(kp.name));
    if (headPoints.length >= 2) {
        analysis.hasHead = true;
    }
    
    // Check for upper body (shoulders)
    const shoulderPoints = visibleKeypoints.filter(kp => kp.name && ['leftShoulder', 'rightShoulder'].includes(kp.name));
    if (shoulderPoints.length >= 1) {
        analysis.hasUpperBody = true;
    }
    
    // Check for lower body (hips and knees)
    const lowerBodyPoints = visibleKeypoints.filter(kp => kp.name && ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'].includes(kp.name));
    if (lowerBodyPoints.length >= 2) {
        analysis.hasLowerBody = true;
    }
    
    // Calculate bounding box of body
    visibleKeypoints.forEach(kp => {
        if (kp.x !== undefined && kp.y !== undefined) {
            analysis.bounds.minX = Math.min(analysis.bounds.minX, kp.x);
            analysis.bounds.maxX = Math.max(analysis.bounds.maxX, kp.x);
            analysis.bounds.minY = Math.min(analysis.bounds.minY, kp.y);
            analysis.bounds.maxY = Math.max(analysis.bounds.maxY, kp.y);
        }
    });
    
    // Calculate body center and dimensions
    analysis.centerX = (analysis.bounds.minX + analysis.bounds.maxX) / 2;
    analysis.centerY = (analysis.bounds.minY + analysis.bounds.maxY) / 2;
    analysis.bodyWidth = analysis.bounds.maxX - analysis.bounds.minX;
    analysis.bodyHeight = analysis.bounds.maxY - analysis.bounds.minY;
    
    return analysis;
}

// Initialize pose detection on page load
window.addEventListener('load', () => {
    initPoseDetection();
}); 

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
        // Die src-Attribute greifen auf die im HTML versteckten Bilder zu
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
async function takePicture() {
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
        
        // Pose-Erkennung durchführen
        const pose = await detectPose(canvas);
        const bodyAnalysis = analyzeBodyParts(pose);
        
        // **WICHTIGE KORREKTUR:** Standardwerte auf FALSE setzen. 
        // Es wird nur gezeichnet, wenn die Pose-Erkennung erfolgreich ist.
        let hasUpperBody = false; 
        let hasLowerBody = false; 
        
        if (bodyAnalysis) {
            hasUpperBody = bodyAnalysis.hasUpperBody;
            hasLowerBody = bodyAnalysis.hasLowerBody;
            // Zukünftige Verbesserung: Hier könnten Sie die Positionen basierend auf den erkannten Keypoints anpassen, 
            // anstatt feste statische Werte zu verwenden!
        }
        
        // --- Statische Outfit-Zeichnung (wird nur bei hasUpperBody/hasLowerBody=true ausgeführt) ---
        
        // **Jacke (Jacket)**: Nur zeichnen wenn Oberkörper erkannt
        if (hasUpperBody) {
            const jacketWidth = canvas.width * 0.9;
            const jacketHeight = canvas.height * 0.55;
            const jacketX = (canvas.width - jacketWidth) / 2;
            const jacketY = canvas.height * -0.05;
            context.drawImage(grungeJacket, jacketX, jacketY, jacketWidth, jacketHeight);
        }

        // **Hosen (Pants)**: Nur zeichnen wenn Unterkörper erkannt
        if (hasLowerBody) {
            const pantsWidth = canvas.width * 0.7; // Reduziert für schmalere Hose
            const pantsHeight = canvas.height * 0.7;
            const pantsX = (canvas.width - pantsWidth) / 2; // Zentriert
            const pantsY = canvas.height * 0.28;
            context.drawImage(grungePants, pantsX, pantsY, pantsWidth, pantsHeight);
        }
        // --- Ende der Outfit-Zeichnung ---

    }
    
    // **Visuelle Filter (unverändert)**
    else if (selectedFilterClass === 'grunge-style') {
        context.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
        context.fillRect(0, 0, canvas.width, canvas.height);
        // ... (restlicher Grunge-Stil Code)
    }
    
    else if (selectedFilterClass === 'hiphop-baggy') {
        // ... (Hip-Hop Code)
    }
    
    else if (selectedFilterClass === 'rave-neon') {
        // ... (Rave Code)
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