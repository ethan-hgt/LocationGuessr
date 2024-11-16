mapboxgl.accessToken = 'pk.eyJ1IjoiNGtlZXppeCIsImEiOiJjbTF5c2ZucmEwMThzMnFzanNreXJzOW5uIn0.OR0rEGAdPmQIGBBd2hGv_g';

let currentRound = 0;
let totalScore = 0;
let correctPoint;
let correctMarker, userMarker;
let map;
let choiceValidated = false;
let timerInterval, timeRemaining;
let previousPositions = [];
let initialPosition;
let panorama;
let isProcessingRound = false;
const streetViewService = new google.maps.StreetViewService();

let modeDeJeu = localStorage.getItem('gameMode') || 'mondial';
const totalRounds = 5;

async function saveScore(finalScore) {
    const token = localStorage.getItem('userToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const response = await fetch('http://localhost:3000/api/user/stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                score: Math.floor(finalScore),
                mode: modeDeJeu,  
                gameDetails: {
                    roundsPlayed: totalRounds,
                    timePlayed: (120 - timeRemaining) * totalRounds,
                    date: new Date()
                }
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("Score sauvegardé avec succès!");
            return true;
        } else {
            console.error("Erreur lors de la sauvegarde:", data.message);
            return false;
        }
    } catch (error) {
        console.error("Erreur lors de la sauvegarde:", error);
        return false;
    }
}

function initialize() {
    const token = localStorage.getItem('userToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    createMap();
    loadRound();
    updateRoundCounter();
    startTimer();
    document.getElementById('validateChoiceBtn').disabled = true;
    document.getElementById('validateChoiceBtn').classList.add('disabled-button');

    document.getElementById('zoomIn').onclick = () => adjustZoom(1);
    document.getElementById('zoomOut').onclick = () => adjustZoom(-1);
    document.getElementById('undoMove').onclick = undoMove;
    document.getElementById('settings').onclick = toggleSettings;
    document.getElementById('resetPosition').onclick = resetToInitialPosition;
}

function getRandomPositionInFrance() {
    const zones = [
        { minLat: 48.7, maxLat: 50.9, minLng: -4.5, maxLng: 2.5 },
        { minLat: 46.5, maxLat: 48.7, minLng: -4.5, maxLng: 3.2 },
        { minLat: 45.0, maxLat: 46.5, minLng: -1.0, maxLng: 4.0 },
        { minLat: 44.0, maxLat: 45.0, minLng: -1.0, maxLng: 3.0 },
        { minLat: 43.6, maxLat: 44.0, minLng: 3.0, maxLng: 7.0 },
        { minLat: 44.5, maxLat: 46.0, minLng: -1.2, maxLng: 2.5 },
    ];
    const zone = zones[Math.floor(Math.random() * zones.length)];
    let lat = Math.random() * (zone.maxLat - zone.minLat) + zone.minLat;
    let lng = Math.random() * (zone.maxLng - zone.minLng) + zone.minLng;

    if ((lng < -4.5 || lng > 7.5) || (lat < 43.5 || lat > 51)) {
        return getRandomPositionInFrance();
    }
    return { lat, lng };
}
let usedPositions = [];

const disneylandParisBounds = {
    minLat: 48.8685,
    maxLat: 48.8715,
    minLng: 2.7765,
    maxLng: 2.7815,
    centerLat: 48.8700,
    centerLng: 2.7790,
    zoomLevel: 16,
    validateZoomLevel: 18
};

const neversBounds = {
    minLat: 46.981,
    maxLat: 47.001,
    minLng: 3.121,
    maxLng: 3.141,
    centerLat: 46.991,
    centerLng: 3.131,
    zoomLevel: 11,
    validateZoomLevel: 18
};

let usedNeversPositions = [];

const versaillesBounds = {
    minLat: 48.8047,
    maxLat: 48.8075,
    minLng: 2.1148,
    maxLng: 2.1216,
    centerLat: 48.8061,
    centerLng: 2.1182,
    zoomLevel: 12,
    validateZoomLevel: 17
};

let usedVersaillesPositions = [];

function getRandomPositionInVersailles() {
    let lat, lng, position;
    do {
        lat = Math.random() * (versaillesBounds.maxLat - versaillesBounds.minLat) + versaillesBounds.minLat;
        lng = Math.random() * (versaillesBounds.maxLng - versaillesBounds.minLng) + versaillesBounds.minLng;
        position = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    } while (usedVersaillesPositions.includes(position));

    usedVersaillesPositions.push(position);
    return { lat, lng };
}

function getRandomPositionInNevers() {
    let lat, lng, position;
    do {
        lat = Math.random() * (neversBounds.maxLat - neversBounds.minLat) + neversBounds.minLat;
        lng = Math.random() * (neversBounds.maxLng - neversBounds.minLng) + neversBounds.minLng;
        position = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    } while (usedNeversPositions.includes(position));

    usedNeversPositions.push(position);
    return { lat, lng };
}

function checkPhotoSphereAvailable(position, callback) {
    streetViewService.getPanorama({ location: position, radius: 50 }, (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data && data.links.length === 0) {
            callback(true, data.location.latLng);
        } else {
            callback(false);
        }
    });
}
function setupLampModeOverlay() {
    const overlay1 = document.createElement('div');
    const overlay2 = document.createElement('div');

    overlay1.id = 'lampOverlay1';
    overlay2.id = 'lampOverlay2';

    [overlay1, overlay2].forEach(overlay => {
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        overlay.style.zIndex = '10';
        document.getElementById('pano').appendChild(overlay);
    });

    document.getElementById('pano').addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        overlay1.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent 150px, rgba(0, 0, 0, 1) 250px)`;
        overlay2.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent 140px, rgba(0, 0, 0, 1) 260px)`;
    });
}

if (modeDeJeu === 'dark') {
    setupLampModeOverlay();
}

function getRandomPositionInPark(bounds, usedPositionsArray) {
    let lat, lng, position;

    do {
        lat = Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
        lng = Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng;
        position = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    } while (usedPositionsArray.includes(position));

    usedPositionsArray.push(position);
    return { lat, lng };
}

function getRandomPosition() {
    if (modeDeJeu === 'versailles') return getRandomPositionInVersailles();
    if (modeDeJeu === 'nevers') return getRandomPositionInNevers();
    if (modeDeJeu === 'france') return getRandomPositionInFrance();
    if (modeDeJeu === 'parc') return getRandomPositionInPark(disneylandParisBounds, usedPositions);
    const lat = Math.random() * 180 - 90;
    const lng = Math.random() * 360 - 180;
    return { lat, lng };
}

function checkStreetViewAvailable(position, callback) {
    streetViewService.getPanorama({ location: position, radius: 5000 }, (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data.links && data.links.length > 0) {
            callback(true, data.location.latLng);
        } else {
            callback(false);
        }
    });
}
function loadRound() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    timeRemaining = 120;
    updateTimerDisplay();

    const tryPosition = () => {
        const randomPosition = getRandomPosition();
        checkStreetViewAvailable(randomPosition, (available, position) => {
            if (available) {
                correctPoint = { lat: position.lat(), lng: position.lng() };
                initialPosition = correctPoint;
                previousPositions = [];

                panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
                    position: correctPoint,
                    pov: { heading: 0, pitch: 0 },
                    zoom: 0,
                    addressControl: false,
                    linksControl: false,
                    panControl: false,
                    enableCloseButton: false,
                    fullscreenControl: false,
                    zoomControl: false,
                    showRoadLabels: false
                });

                panorama.addListener('pano_changed', function() {
                    document.getElementById('loadingOverlay').style.display = 'none';
                    savePreviousPosition();
                });

                resetRoundElements();
            } else {
                tryPosition();
            }
        });
    };

    tryPosition();
}

function setupPanorama(position) {
    correctPoint = { lat: position.lat(), lng: position.lng() };
    initialPosition = correctPoint;
    previousPositions = [];

    panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
        position: correctPoint,
        pov: { heading: 0, pitch: 0 },
        zoom: 0,
        addressControl: false,
        linksControl: false,
        panControl: false,
        enableCloseButton: false,
        fullscreenControl: false,
        zoomControl: false,
        showRoadLabels: false
    });

    panorama.addListener('pano_changed', function() {
        document.getElementById('loadingOverlay').style.display = 'none';
        savePreviousPosition();
    });

    resetRoundElements();
}
function startTimer() {
    timeRemaining = 120;
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            autoValidateChoice();
        }
    }, 1000);

    const progressBar = document.getElementById('timerProgressBar');
    progressBar.style.width = '100%';
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('timerText').textContent = `Temps: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    const totalDuration = 120;
    const progressBar = document.getElementById('timerProgressBar');
    const percentRemaining = (timeRemaining / totalDuration) * 100;
    progressBar.style.width = `${percentRemaining}%`;

    if (timeRemaining <= 10) {
        progressBar.classList.add('warning');
        document.getElementById('timerText').style.color = '#ff6347';
        document.getElementById('timerText').style.textShadow = '0 0 10px rgba(255, 69, 0, 0.8)';
    } else {
        progressBar.classList.remove('warning');
        document.getElementById('timerText').style.color = '#ffffff';
        document.getElementById('timerText').style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.5)';
    }
}

function updateRoundCounter() {
    document.getElementById('roundCounter').textContent = `Manche: ${currentRound + 1}/${totalRounds}`;
}

function resetRoundElements() {
    if (userMarker) userMarker.remove();
    if (correctMarker) correctMarker.remove();
    removeLine();
    document.getElementById('distanceDisplay').style.display = 'none';
    document.getElementById('validateChoiceBtn').style.display = 'block';
    document.getElementById('validateChoiceBtn').disabled = true;
    document.getElementById('validateChoiceBtn').classList.add('disabled-button');
    document.getElementById('nextRoundBtn').style.display = 'none';
    choiceValidated = false;
    document.getElementById('pano').style.display = 'block';
    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('showMapBtn').textContent = 'Ouvrir la Carte';
}

function calculateScore(distance) {
    if (modeDeJeu === 'parc' || modeDeJeu === 'nevers' || modeDeJeu === 'versailles') {
        const distanceMeters = distance * 1000;
        const maxScore = 1000;
        const penalty = Math.max(0, distanceMeters - 10);
        const score = Math.floor(Math.max(0, maxScore - penalty));
        return score;
    } else {
        const distanceScore = Math.floor(Math.max(0, 1000 - distance * 10));
        const timeScore = Math.floor(timeRemaining * 5);
        return distanceScore + timeScore;
    }
}
function validateChoice() {
    if (choiceValidated || !userMarker || isProcessingRound) return;
    isProcessingRound = true;

    clearInterval(timerInterval);
    choiceValidated = true;
    const userPosition = userMarker.getLngLat();

    correctMarker = new mapboxgl.Marker({ color: "red" })
        .setLngLat([correctPoint.lng, correctPoint.lat])
        .addTo(map);

    drawLineBetweenPoints({ lng: userPosition.lng, lat: userPosition.lat }, correctPoint);

    const distance = turf.distance(
        [userPosition.lng, userPosition.lat],
        [correctPoint.lng, correctPoint.lat],
        { units: (modeDeJeu === 'nevers' || modeDeJeu === 'parc' || modeDeJeu === 'versailles') ? 'meters' : 'kilometers' }
    );

    const distanceText = (modeDeJeu === 'nevers' || modeDeJeu === 'parc' || modeDeJeu === 'versailles')
        ? `${Math.round(distance)} mètres`
        : `${Math.round(distance)} km`;
    document.getElementById('distanceDisplay').textContent = `Distance au point correct : ${distanceText}`;
    document.getElementById('distanceDisplay').style.display = 'block';

    const roundScore = calculateScore(distance);
    totalScore += roundScore;

    document.getElementById('validateChoiceBtn').style.display = 'none';
    document.getElementById('nextRoundBtn').style.display = 'block';
    if (currentRound + 1 >= totalRounds) {
        document.getElementById('nextRoundBtn').textContent = 'Terminer la partie';
    }

    centerMapBetweenPoints({ lng: userPosition.lng, lat: userPosition.lat }, correctPoint);
    isProcessingRound = false;
}

function autoValidateChoice() {
    if (isProcessingRound) return;
    choiceValidated = true;

    document.getElementById('validateChoiceBtn').style.display = 'none';
    document.getElementById('nextRoundBtn').style.display = 'block';

    if (currentRound + 1 >= totalRounds) {
        endGame();
    } else {
        nextRound();
    }
}

function nextRound() {
    if (!choiceValidated) return;

    if (currentRound + 1 >= totalRounds) {
        endGame();
    } else {
        currentRound++;
        choiceValidated = false;
        isProcessingRound = false;

        updateRoundCounter();
        loadRound();
        startTimer();
    }
}
async function endGame() {
    const resultOverlay = document.getElementById('resultOverlay');
    resultOverlay.innerHTML = "";

    const resultContent = document.createElement("div");
    resultContent.classList.add("result-content");

    const title = document.createElement("h1");
    title.textContent = "Résultat de la partie";

    const score = document.createElement("p");
    score.id = "finalScore";
    score.textContent = `Score final: ${Math.floor(totalScore)}`;

    const accueilButton = document.createElement("button");
    accueilButton.textContent = "Accueil";
    accueilButton.classList.add("button-return");
    accueilButton.onclick = () => window.location.href = 'accueil.html';

    const restartIcon = document.createElement("i");
    restartIcon.classList.add("bx", "bx-refresh", "restart-icon");
    restartIcon.onclick = restartGame;

    const leaderboardButton = document.createElement("button");
    leaderboardButton.textContent = "Classement";
    leaderboardButton.classList.add("button-leaderboard");
    leaderboardButton.onclick = () => window.location.href = 'leaderboard.html';

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("result-buttons");
    buttonContainer.appendChild(accueilButton);
    buttonContainer.appendChild(restartIcon);
    buttonContainer.appendChild(leaderboardButton);

    resultContent.appendChild(title);
    resultContent.appendChild(score);
    resultContent.appendChild(buttonContainer);
    resultOverlay.appendChild(resultContent);

    resultOverlay.style.display = 'flex';
    resultOverlay.style.alignItems = 'center';
    resultOverlay.style.justifyContent = 'center';

    if (totalScore > 0) {
        const saved = await saveScore(totalScore);
        if (!saved) {
            const errorDiv = document.createElement('p');
            errorDiv.textContent = "Erreur lors de la sauvegarde du score.";
            errorDiv.style.color = 'red';
            resultContent.appendChild(errorDiv);
        }
    }
}

function restartGame() {
    currentRound = 0;
    totalScore = 0;
    choiceValidated = false;
    isProcessingRound = false;
    timeRemaining = 120;

    usedPositions = [];
    usedPositionsEuropa = [];

    document.getElementById('nextRoundBtn').textContent = "Manche Suivante";
    document.getElementById('nextRoundBtn').style.display = 'none';

    document.getElementById('resultOverlay').style.display = 'none';
    document.getElementById('finalScore').textContent = "Score final: 0";

    updateRoundCounter();
    startTimer();
    loadRound();
}
function centerMapBetweenPoints(pointA, pointB) {
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([pointA.lng, pointA.lat]);
    bounds.extend([pointB.lng, pointB.lat]);

    const fitOptions = {
        padding: 50,
        maxZoom: (modeDeJeu === 'parc') ? disneylandParisBounds.validateZoomLevel 
                  : (modeDeJeu === 'nevers') ? neversBounds.validateZoomLevel
                  : (modeDeJeu === 'versailles') ? versaillesBounds.validateZoomLevel
                  : 10,
        duration: 2000
    };

    map.fitBounds(bounds, fitOptions);
}

function drawLineBetweenPoints(pointA, pointB) {
    if (map.getSource('line-source')) removeLine();

    map.addSource('line-source', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [pointA.lng, pointA.lat],
                    [pointB.lng, pointB.lat]
                ]
            }
        }
    });

    map.addLayer({
        id: 'line-layer',
        type: 'line',
        source: 'line-source',
        layout: {
            'line-cap': 'round',
            'line-join': 'round'
        },
        paint: {
            'line-color': '#000000',
            'line-width': 4
        }
    });
}

function removeLine() {
    if (map.getLayer('line-layer')) {
        map.removeLayer('line-layer');
        map.removeSource('line-source');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.resume-button').addEventListener('click', () => {
        const settingsOverlay = document.getElementById('settingsOverlay');
        settingsOverlay.style.visibility = 'hidden';
        settingsOverlay.style.opacity = '0';
    });

    document.querySelector('.leave-button').addEventListener('click', () => {
        const confirmOverlay = document.getElementById('confirmOverlay');
        confirmOverlay.style.visibility = 'visible';
        confirmOverlay.style.opacity = '1';
    });

    document.getElementById('confirmYes').addEventListener('click', () => {
        localStorage.removeItem('userProgress');
        localStorage.removeItem('currentRound');
        localStorage.removeItem('totalScore');
        window.location.href = 'accueil.html';
    });

    document.getElementById('confirmNo').addEventListener('click', () => {
        const confirmOverlay = document.getElementById('confirmOverlay');
        confirmOverlay.style.visibility = 'hidden';
        confirmOverlay.style.opacity = '0';
    });

    const soundToggle = document.getElementById('soundToggle');
    const soundLabel = soundToggle.closest('.settings-control').querySelector('p');
    soundToggle.addEventListener('change', (event) => {
        soundLabel.textContent = event.target.checked ? "Son activé" : "Son désactivé";
    });

    const fullscreenToggle = document.getElementById('fullscreenToggle');
    const fullscreenLabel = fullscreenToggle.closest('.settings-control').querySelector('p');
    fullscreenToggle.addEventListener('change', (event) => {
        if (event.target.checked) {
            fullscreenLabel.textContent = "Plein écran activé";
            document.documentElement.requestFullscreen();
        } else {
            fullscreenLabel.textContent = "Plein écran désactivé";
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }
    });
});

function createMap() {
    const mapOptions = {
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [2.2945, 48.8584],
        zoom: 2,
        minZoom: 2
    };

    if (modeDeJeu === 'parc') {
        mapOptions.center = [disneylandParisBounds.centerLng, disneylandParisBounds.centerLat];
        mapOptions.zoom = disneylandParisBounds.zoomLevel;
    } else if (modeDeJeu === 'nevers') {
        mapOptions.center = [neversBounds.centerLng, neversBounds.centerLat];
        mapOptions.zoom = neversBounds.zoomLevel;
    } else if (modeDeJeu === 'versailles') {
        mapOptions.center = [versaillesBounds.centerLng, versaillesBounds.centerLat];
        mapOptions.zoom = versaillesBounds.zoomLevel;
    }

    map = new mapboxgl.Map(mapOptions);
    map.scrollZoom.setZoomRate(0.1);
    map.scrollZoom.setWheelZoomRate(0.1);
    map.on('click', onMapClick);
}

function toggleMap() {
    const pano = document.getElementById('pano');
    const mapContainer = document.getElementById('mapContainer');
    const mapVisible = mapContainer.style.display === 'block';

    mapContainer.style.display = mapVisible ? 'none' : 'block';
    pano.style.display = mapVisible ? 'block' : 'none';
    document.getElementById('showMapBtn').textContent = mapVisible ? 'Ouvrir la Carte' : 'Retour à Street View';
    map.resize();
}

function onMapClick(e) {
    if (choiceValidated) return;
    if (userMarker) userMarker.remove();

    userMarker = new mapboxgl.Marker()
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(map);

    document.getElementById('validateChoiceBtn').disabled = false;
    document.getElementById('validateChoiceBtn').classList.remove('disabled-button');
}

function adjustZoom(direction) {
    const currentZoom = panorama.getZoom();
    panorama.setZoom(currentZoom + direction);
}

function savePreviousPosition() {
    const currentPosition = panorama.getPosition();
    if (currentPosition) {
        previousPositions.push({ lat: currentPosition.lat(), lng: currentPosition.lng() });
    }
}

function undoMove() {
    if (previousPositions.length > 1) {
        previousPositions.pop();
        const lastPosition = previousPositions[previousPositions.length - 1];
        panorama.setPosition(new google.maps.LatLng(lastPosition.lat, lastPosition.lng));
    }
}

function resetToInitialPosition() {
    panorama.setPosition(new google.maps.LatLng(initialPosition.lat, initialPosition.lng));
}

function toggleSettings() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.style.visibility = settingsOverlay.style.visibility === 'visible' ? 'hidden' : 'visible';
        settingsOverlay.style.opacity = settingsOverlay.style.opacity === '1' ? '0' : '1';
    }
}

window.onload = initialize;
