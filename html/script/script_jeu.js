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
        { minLat: 48.0, maxLat: 51.0, minLng: -5.0, maxLng: 2.5 },
        { minLat: 45.0, maxLat: 48.0, minLng: -5.0, maxLng: 7.0 },
        { minLat: 43.5, maxLat: 45.0, minLng: -1.5, maxLng: 7.0 },
        { minLat: 41.5, maxLat: 43.5, minLng: 2.0, maxLng: 9.0 }
    ];

    const zone = zones[Math.floor(Math.random() * zones.length)];
    const lat = Math.random() * (zone.maxLat - zone.minLat) + zone.minLat;
    const lng = Math.random() * (zone.maxLng - zone.minLng) + zone.minLng;

    return { lat, lng };
}

function getRandomPosition() {
    if (modeDeJeu === 'france') {
        return getRandomPositionInFrance();
    } else {
        const lat = Math.random() * 180 - 90;
        const lng = Math.random() * 360 - 180;
        return { lat, lng };
    }
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

function createMap() {
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [2.2945, 48.8584],
        zoom: 2,
        minZoom: 2 
    });

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

function calculateScore(distance) {
    const distanceScore = Math.floor(Math.max(0, 1000 - distance * 10));
    const timeScore = Math.floor(timeRemaining * 5);
    return distanceScore + timeScore;
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
        { units: 'kilometers' }
    );

    document.getElementById('distanceDisplay').textContent = `Distance au point correct : ${Math.round(distance)} km`;
    document.getElementById('distanceDisplay').style.display = 'block';

    const roundScore = calculateScore(distance);
    totalScore = Math.floor(totalScore + roundScore);

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
  resultOverlay.innerHTML = `
      <div class="result-content">
          <h1>Résultat de la partie</h1>
          <p>Score final: ${Math.floor(totalScore)}</p>
          <div class="result-buttons">
              <button onclick="window.location.href='accueil.html'">Retourner à l'accueil</button>
              <button onclick="window.location.href='leaderboard.html'">Voir le classement</button>
          </div>
      </div>
  `;

  resultOverlay.style.display = 'flex';
  resultOverlay.style.alignItems = 'center';
  resultOverlay.style.justifyContent = 'center';

  if (totalScore > 0) {
      const saved = await saveScore(totalScore);
      if (!saved) {
          const errorDiv = document.createElement('p');
          errorDiv.textContent = "Erreur lors de la sauvegarde du score.";
          errorDiv.style.color = 'red';
          resultOverlay.querySelector('.result-content').appendChild(errorDiv);
      }
  }
}


function centerMapBetweenPoints(pointA, pointB) {
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([pointA.lng, pointA.lat]);
    bounds.extend([pointB.lng, pointB.lat]);
    map.fitBounds(bounds, { padding: 50, maxZoom: 10, duration: 2000 });
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
});

document.addEventListener('DOMContentLoaded', () => {
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
});

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

    const soundToggle = document.getElementById('soundToggle');
    const soundLabel = soundToggle.closest('.settings-control').querySelector('p');
    soundToggle.addEventListener('change', (event) => {
        if (event.target.checked) {
            soundLabel.textContent = "Son activé";
        } else {
            soundLabel.textContent = "Son désactivé";
        }
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


window.onload = initialize;
