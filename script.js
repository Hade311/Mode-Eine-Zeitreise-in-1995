// Funktion zur Aufnahme des Bildes mit simuliertem Overlay (Canvas-Zeichnung)
async function takePicture() {
    if (!video.srcObject) return;

    // ... (Canvas-Setup unverändert) ...

    // 2. Filter-Simulation/Outfit-Zeichnung basierend auf der Auswahl
    const selectedFilterClass = filterSelect.value;
    
    // **GRUNGE OUTFIT auf das Canvas zeichnen**
    if (selectedFilterClass === 'grunge-outfit') {
        
        // Pose-Erkennung durchführen
        const pose = await detectPose(canvas);
        const bodyAnalysis = analyzeBodyParts(pose);
        
        // **KORREKTUR:** Standardwerte auf FALSE setzen. 
        // Wenn die Erkennung fehlschlägt (bodyAnalysis ist null), bleiben diese false, 
        // und es wird KEIN Outfit gezeichnet.
        let hasUpperBody = false; 
        let hasLowerBody = false; 
        
        if (bodyAnalysis) {
            hasUpperBody = bodyAnalysis.hasUpperBody;
            hasLowerBody = bodyAnalysis.hasLowerBody;
        }
        
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
            const pantsWidth = canvas.width * 0.8;
            const pantsHeight = canvas.height * 0.7;
            const pantsX = (canvas.width - pantsWidth) / 2;
            const pantsY = canvas.height * 0.28;
            context.drawImage(grungePants, pantsX, pantsY, pantsWidth, pantsHeight);
        }

    }
    
    // ... (Visuelle Filter unverändert) ...

    // Bild und Download-Link aktualisieren
    updatePhotoOutput();
}

// ... (Rest des Codes) ...