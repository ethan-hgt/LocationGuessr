mapboxgl.accessToken =
  "pk.eyJ1IjoiNGtlZXppeCIsImEiOiJjbTF5c2ZucmEwMThzMnFzanNreXJzOW5uIn0.OR0rEGAdPmQIGBBd2hGv_g";

let currentRound = 0;
let totalScore = 0;
let totalDistance = 0;
let bestRoundScore = 0;
let worstRoundScore = 1000;
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

let modeDeJeu = localStorage.getItem("gameMode") || "mondial";
console.log("Mode de jeu actuel:", modeDeJeu);
const totalRounds = 5;

//Normalise le mode de jeu en fonction d'une correspondance prédéfinie pour gérer les erreurs de frappe ou de compatibilité.
function normalizeGameMode(mode) {
  const modeMapping = {
    parc: "disneyland",
    versailles: "versailles",
    versaille: "versailles",
    nevers: "nevers",
    france: "france",
    mondial: "mondial",
    dark: "dark",
  };
  const normalizedMode = modeMapping[mode] || mode;
  console.log("Mode normalisé:", mode, "->", normalizedMode);
  return normalizedMode;
}

//Enregistre le score final du joueur dans la base de données via une API sécurisée
async function saveScore(finalScore) {
  const token = AuthUtils.getAuthToken();
  if (!token) {
    window.location.href = "/login";
    return;
  }

  const normalizedScore = Math.floor(finalScore);
  const normalizedMode = normalizeGameMode(modeDeJeu);
  console.log("Sauvegarde du score pour le mode:", normalizedMode);

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/user/stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        score: normalizedScore,
        mode: normalizedMode,
        gameDetails: {
          roundsPlayed: totalRounds,
          bestRoundScore: bestRoundScore,
          worstRoundScore: worstRoundScore,
          averageDistance: totalDistance / totalRounds,
          date: new Date(),
        },
      }),
    });

    const data = await response.json();
    console.log("Réponse du serveur:", data);

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
//Initialise le jeu en vérifiant l'authentification, charge la carte, et prépare les paramètres de la première manche
async function initialize() {
  const token = AuthUtils.getAuthToken();
  console.log("Token trouvé:", token ? "oui" : "non");

  if (!token) {
    window.location.href = "/login";
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Token invalide");
    }

    createMap();
    loadRound();
    updateRoundCounter();
    startTimer();

    document.getElementById("validateChoiceBtn").disabled = true;
    document
      .getElementById("validateChoiceBtn")
      .classList.add("disabled-button");
    document.getElementById("zoomIn").onclick = () => adjustZoom(1);
    document.getElementById("zoomOut").onclick = () => adjustZoom(-1);
    document.getElementById("undoMove").onclick = undoMove;
    document.getElementById("settings").onclick = toggleSettings;
    document.getElementById("resetPosition").onclick = resetToInitialPosition;
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    AuthUtils.clearAuth(); // nettoyer les tokens invalides
    window.location.href = "/login";
  }
}

//Génère une position aléatoire dans des zones prédéfinies en France pour le mode de jeu France
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

  if (lng < -4.5 || lng > 7.5 || lat < 43.5 || lat > 51) {
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
  centerLat: 48.87,
  centerLng: 2.779,
  zoomLevel: 16,
  validateZoomLevel: 18,
};

const neversBounds = {
  minLat: 46.981,
  maxLat: 47.001,
  minLng: 3.121,
  maxLng: 3.141,
  centerLat: 46.991,
  centerLng: 3.131,
  zoomLevel: 11,
  validateZoomLevel: 18,
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
  validateZoomLevel: 17,
};

let usedVersaillesPositions = [];

//Génère une position aléatoire dans les limites définies de Versailles tout en évitant les positions déjà utilisées
function getRandomPositionInVersailles() {
  let lat, lng, position;
  do {
    lat =
      Math.random() * (versaillesBounds.maxLat - versaillesBounds.minLat) +
      versaillesBounds.minLat;
    lng =
      Math.random() * (versaillesBounds.maxLng - versaillesBounds.minLng) +
      versaillesBounds.minLng;
    position = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  } while (usedVersaillesPositions.includes(position));

  usedVersaillesPositions.push(position);
  return { lat, lng };
}

//Génère une position aléatoire dans les limites définies de Nevers tout en évitant les positions déjà utilisées.
function getRandomPositionInNevers() {
  let lat, lng, position;
  do {
    lat =
      Math.random() * (neversBounds.maxLat - neversBounds.minLat) +
      neversBounds.minLat;
    lng =
      Math.random() * (neversBounds.maxLng - neversBounds.minLng) +
      neversBounds.minLng;
    position = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  } while (usedNeversPositions.includes(position));

  usedNeversPositions.push(position);
  return { lat, lng };
}

//Vérifie la disponibilité d'un panorama Google Street View pour une position donnée
function checkPhotoSphereAvailable(position, callback) {
  streetViewService.getPanorama(
    { location: position, radius: 50 },
    (data, status) => {
      if (
        status === google.maps.StreetViewStatus.OK &&
        data &&
        data.links.length === 0
      ) {
        callback(true, data.location.latLng);
      } else {
        callback(false);
      }
    }
  );
}

//Ajoute un effet de lampe torche avec des overlays dynamiques autour du curseur pour le mode 'dark'.
function setupLampModeOverlay() {
  const overlay1 = document.createElement("div");
  const overlay2 = document.createElement("div");

  overlay1.id = "lampOverlay1";
  overlay2.id = "lampOverlay2";

  [overlay1, overlay2].forEach((overlay) => {
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 1)";
    overlay.style.zIndex = "10";
    document.getElementById("pano").appendChild(overlay);
  });

  document.getElementById("pano").addEventListener("mousemove", (e) => {
    const x = e.clientX;
    const y = e.clientY;
    overlay1.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent 150px, rgba(0, 0, 0, 1) 250px)`;
    overlay2.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent 140px, rgba(0, 0, 0, 1) 260px)`;
  });
}

if (modeDeJeu === "dark") {
  setupLampModeOverlay();
}

//Génère une position aléatoire dans les limites d'un parc en évitant les positions déjà utilisées.
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

//Retourne une position aléatoire en fonction du mode de jeu sélectionné
function getRandomPosition() {
  if (modeDeJeu === "versailles") return getRandomPositionInVersailles();
  if (modeDeJeu === "nevers") return getRandomPositionInNevers();
  if (modeDeJeu === "france") return getRandomPositionInFrance();
  if (modeDeJeu === "parc")
    return getRandomPositionInPark(disneylandParisBounds, usedPositions);
  const lat = Math.random() * 180 - 90;
  const lng = Math.random() * 360 - 180;
  return { lat, lng };
}

//Vérifie si un panorama Google Street View est disponible pour une position donnée avec une distance spécifiée
function checkStreetViewAvailable(position, callback) {
  streetViewService.getPanorama(
    { location: position, radius: 5000 },
    (data, status) => {
      if (
        status === google.maps.StreetViewStatus.OK &&
        data.links &&
        data.links.length > 0
      ) {
        callback(true, data.location.latLng);
      } else {
        callback(false);
      }
    }
  );
}

//Charge une nouvelle manche en positionnant le joueur dans un panorama Street View valide et en réinitialisant les paramètres nécessaires
function loadRound() {
  document.getElementById("loadingOverlay").style.display = "flex";
  timeRemaining = 120;
  updateTimerDisplay();

  const tryPosition = () => {
    const randomPosition = getRandomPosition();
    checkStreetViewAvailable(randomPosition, (available, position) => {
      if (available) {
        correctPoint = { lat: position.lat(), lng: position.lng() };
        initialPosition = correctPoint;
        previousPositions = [];

        panorama = new google.maps.StreetViewPanorama(
          document.getElementById("pano"),
          {
            position: correctPoint,
            pov: { heading: 0, pitch: 0 },
            zoom: 0,
            addressControl: false,
            linksControl: false,
            panControl: false,
            enableCloseButton: false,
            fullscreenControl: false,
            zoomControl: false,
            showRoadLabels: false,
          }
        );

        panorama.addListener("position_changed", () => {
          const position = panorama.getPosition();
          if (position) {
            const newPos = {
              lat: position.lat(),
              lng: position.lng(),
            };

            const lastPos = previousPositions[previousPositions.length - 1];
            if (
              !lastPos ||
              newPos.lat !== lastPos.lat ||
              newPos.lng !== lastPos.lng
            ) {
              previousPositions.push(newPos);
            }
          }
        });

        const checkStreetViewReady = setInterval(() => {
          if (
            panorama.getStatus() === google.maps.StreetViewStatus.OK &&
            panorama.getPano()
          ) {
            clearInterval(checkStreetViewReady);
            document.getElementById("loadingOverlay").style.display = "none";

            // Sauvegarde la position initiale
            if (previousPositions.length === 0) {
              previousPositions.push({
                lat: correctPoint.lat,
                lng: correctPoint.lng,
              });
            }

            startTimer();
          }
        }, 100);

        resetRoundElements();
      } else {
        tryPosition();
      }
    });
  };

  tryPosition();
}

//Configure le panorama Street View pour une position donnée et réinitialise les éléments de la manche.
function setupPanorama(position) {
  correctPoint = { lat: position.lat(), lng: position.lng() };
  initialPosition = correctPoint;
  previousPositions = [];

  panorama = new google.maps.StreetViewPanorama(
    document.getElementById("pano"),
    {
      position: correctPoint,
      pov: { heading: 0, pitch: 0 },
      zoom: 0,
      addressControl: false,
      linksControl: false,
      panControl: false,
      enableCloseButton: false,
      fullscreenControl: false,
      zoomControl: false,
      showRoadLabels: false,
    }
  );

  panorama.addListener("pano_changed", function () {
    document.getElementById("loadingOverlay").style.display = "none";
    savePreviousPosition();
  });

  resetRoundElements();
}

//Démarre le chronomètre pour la manche en mettant à jour l'affichage et en réduisant le temps restant à intervalles réguliers.
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

  const progressBar = document.getElementById("timerProgressBar");
  progressBar.style.width = "100%";
}

//Met à jour l'affichage du chronomètre et gère les styles en fonction du temps restant.
function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  document.getElementById("timerText").textContent = `Temps: ${minutes}:${
    seconds < 10 ? "0" : ""
  }${seconds}`;

  const totalDuration = 120;
  const progressBar = document.getElementById("timerProgressBar");
  const percentRemaining = (timeRemaining / totalDuration) * 100;
  progressBar.style.width = `${percentRemaining}%`;

  if (timeRemaining <= 10) {
    progressBar.classList.add("warning");
    document.getElementById("timerText").style.color = "#ff6347";
    document.getElementById("timerText").style.textShadow =
      "0 0 10px rgba(255, 69, 0, 0.8)";
  } else {
    progressBar.classList.remove("warning");
    document.getElementById("timerText").style.color = "#ffffff";
    document.getElementById("timerText").style.textShadow =
      "0 1px 3px rgba(0, 0, 0, 0.5)";
  }
}

//Met à jour l'affichage du compteur de manches.
function updateRoundCounter() {
  document.getElementById("roundCounter").textContent = `Manche: ${
    currentRound + 1
  }/${totalRounds}`;
}

//Réinitialise les éléments de la manche, y compris les marqueurs, les boutons, et les lignes de la carte
function resetRoundElements() {
  if (userMarker) userMarker.remove();
  if (correctMarker) correctMarker.remove();
  removeLine();
  document.getElementById("distanceDisplay").style.display = "none";
  document.getElementById("validateChoiceBtn").style.display = "block";
  document.getElementById("validateChoiceBtn").disabled = true;
  document.getElementById("validateChoiceBtn").classList.add("disabled-button");
  document.getElementById("nextRoundBtn").style.display = "none";
  choiceValidated = false;
  document.getElementById("pano").style.display = "block";
  document.getElementById("mapContainer").style.display = "none";
  document.getElementById("showMapBtn").textContent = "Ouvrir la Carte";
}

//Calcule le score basé sur la distance entre la position du joueur et le point correct, adapté au mode de jeu
function calculateScore(distance) {
  let roundScore;
  if (
    modeDeJeu === "parc" ||
    modeDeJeu === "nevers" ||
    modeDeJeu === "versailles"
  ) {
    // Pour les petites zones (en mètres)
    if (distance <= 5) roundScore = 1000;
    else if (distance <= 10) roundScore = 999 - (distance - 5);
    else if (distance <= 50) roundScore = 900 - (distance - 10) * 3;
    else if (distance <= 100) roundScore = 780 - (distance - 50) * 3;
    else if (distance <= 200) roundScore = 630 - (distance - 100) * 1.4;
    else if (distance <= 500) roundScore = 490 - (distance - 200) * 0.4;
    else if (distance <= 1000) roundScore = 370 - (distance - 500) * 0.2;
    else if (distance <= 2000) roundScore = 270 - (distance - 1000) * 0.08;
    else if (distance <= 5000) roundScore = 190 - (distance - 2000) * 0.04;
    else roundScore = Math.max(0, 70 - (distance - 5000) * 0.02);
  } else {
    // Pour les modes monde et France (en kilomètres)
    if (distance <= 0.5) roundScore = 1000;
    else if (distance <= 1) roundScore = 999 - distance * 2;
    else if (distance <= 5) roundScore = 900 - distance * 60;
    else if (distance <= 10) roundScore = 780 - distance * 30;
    else if (distance <= 20) roundScore = 630 - distance * 15;
    else if (distance <= 50) roundScore = 490 - distance * 5;
    else if (distance <= 100) roundScore = 370 - distance * 2;
    else if (distance <= 200) roundScore = 270 - distance * 0.8;
    else if (distance <= 500) roundScore = 190 - distance * 0.24;
    else roundScore = Math.max(0, 70 - distance * 0.04);
  }

  return roundScore;
}

//Valide le choix du joueur, calcule la distance, le score, et affiche les résultats de la manche
function validateChoice() {
  if (choiceValidated || !userMarker || isProcessingRound) return;
  isProcessingRound = true;

  clearInterval(timerInterval);
  choiceValidated = true;
  const userPosition = userMarker.getLngLat();

  correctMarker = new mapboxgl.Marker({ color: "red" })
    .setLngLat([correctPoint.lng, correctPoint.lat])
    .addTo(map);

  drawLineBetweenPoints(
    { lng: userPosition.lng, lat: userPosition.lat },
    correctPoint
  );

  const distance = turf.distance(
    [userPosition.lng, userPosition.lat],
    [correctPoint.lng, correctPoint.lat],
    {
      units:
        modeDeJeu === "nevers" ||
        modeDeJeu === "parc" ||
        modeDeJeu === "versailles"
          ? "meters"
          : "kilometers",
    }
  );

  totalDistance += distance;
  const roundScore = calculateScore(distance);
  totalScore += roundScore;

  // Mise à jour des meilleurs/pires scores
  bestRoundScore = Math.max(bestRoundScore, roundScore);
  worstRoundScore = Math.min(worstRoundScore, roundScore);

  const distanceText =
    modeDeJeu === "nevers" || modeDeJeu === "parc" || modeDeJeu === "versailles"
      ? `${Math.round(distance)} mètres`
      : `${Math.round(distance * 100) / 100} km`;

  document.getElementById(
    "distanceDisplay"
  ).innerHTML = `Distance : ${distanceText}<br>Score de la manche : ${Math.round(
    roundScore
  )}<br>Score cumulé : ${Math.round((totalScore / totalRounds) * 5)}/5000`;

  document.getElementById(
    "distanceDisplay"
  ).innerHTML = `Distance : ${distanceText}<br>Points : ${Math.round(
    roundScore
  )}`;
  document.getElementById("distanceDisplay").style.display = "block";

  document.getElementById("validateChoiceBtn").style.display = "none";
  document.getElementById("nextRoundBtn").style.display = "block";
  if (currentRound + 1 >= totalRounds) {
    document.getElementById("nextRoundBtn").textContent = "Terminer la partie";
  }

  centerMapBetweenPoints(
    { lng: userPosition.lng, lat: userPosition.lat },
    correctPoint
  );
  isProcessingRound = false;
}

//Valide automatiquement le choix du joueur lorsque le temps est écoulé.
function autoValidateChoice() {
  if (isProcessingRound) return;
  choiceValidated = true;

  document.getElementById("validateChoiceBtn").style.display = "none";
  document.getElementById("nextRoundBtn").style.display = "block";

  if (currentRound + 1 >= totalRounds) {
    endGame();
  } else {
    nextRound();
  }
}

//Passe à la manche suivante ou termine le jeu si toutes les manches sont complétées.
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

//Affiche les résultats finaux, enregistre le score et propose des options pour redémarrer ou quitter.
async function endGame() {
  const resultOverlay = document.getElementById("resultOverlay");
  resultOverlay.innerHTML = "";

  const resultContent = document.createElement("div");
  resultContent.classList.add("result-content");

  const title = document.createElement("h1");
  title.textContent = "Résultat de la partie";

  const finalScore = Math.floor((totalScore / totalRounds) * 5);

  const score = document.createElement("p");
  score.id = "finalScore";
  score.textContent = `Score final: ${finalScore}`;

  const accueilButton = document.createElement("button");
  accueilButton.textContent = "Accueil";
  accueilButton.classList.add("button-return");
  accueilButton.onclick = () => (window.location.href = "/");

  const restartIcon = document.createElement("i");
  restartIcon.classList.add("bx", "bx-refresh", "restart-icon");
  restartIcon.onclick = restartGame;

  const leaderboardButton = document.createElement("button");
  leaderboardButton.textContent = "Classement";
  leaderboardButton.classList.add("button-leaderboard");
  leaderboardButton.onclick = () => (window.location.href = "leaderboard.html");

  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("result-buttons");
  buttonContainer.appendChild(accueilButton);
  buttonContainer.appendChild(restartIcon);
  buttonContainer.appendChild(leaderboardButton);

  resultContent.appendChild(title);
  resultContent.appendChild(score);
  resultContent.appendChild(buttonContainer);
  resultOverlay.appendChild(resultContent);

  resultOverlay.style.display = "flex";
  resultOverlay.style.alignItems = "center";
  resultOverlay.style.justifyContent = "center";

  const saved = await saveScore(finalScore);
  if (!saved) {
    const errorDiv = document.createElement("p");
    errorDiv.textContent = "Erreur lors de la sauvegarde du score.";
    errorDiv.style.color = "red";
    resultContent.appendChild(errorDiv);
  }
}

//Redémarre le jeu en réinitialisant tous les paramètres et les scores
function restartGame() {
  currentRound = 0;
  totalScore = 0;
  choiceValidated = false;
  isProcessingRound = false;
  timeRemaining = 120;

  usedPositions = [];
  usedPositionsEuropa = [];

  document.getElementById("nextRoundBtn").textContent = "Manche Suivante";
  document.getElementById("nextRoundBtn").style.display = "none";

  document.getElementById("resultOverlay").style.display = "none";
  document.getElementById("finalScore").textContent = "Score final: 0";

  updateRoundCounter();
  startTimer();
  loadRound();
}

//Centre la carte entre deux points pour ajuster l'affichage et la navigation.
function centerMapBetweenPoints(pointA, pointB) {
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend([pointA.lng, pointA.lat]);
  bounds.extend([pointB.lng, pointB.lat]);

  const fitOptions = {
    padding: 50,
    maxZoom:
      modeDeJeu === "parc"
        ? disneylandParisBounds.validateZoomLevel
        : modeDeJeu === "nevers"
        ? neversBounds.validateZoomLevel
        : modeDeJeu === "versailles"
        ? versaillesBounds.validateZoomLevel
        : 10,
    duration: 2000,
  };

  map.fitBounds(bounds, fitOptions);
}

//Dessine une ligne sur la carte entre deux points pour représenter la distance entre eux.
function drawLineBetweenPoints(pointA, pointB) {
  if (map.getSource("line-source")) removeLine();

  map.addSource("line-source", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [pointA.lng, pointA.lat],
          [pointB.lng, pointB.lat],
        ],
      },
    },
  });

  map.addLayer({
    id: "line-layer",
    type: "line",
    source: "line-source",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#000000",
      "line-width": 4,
    },
  });
}

//Supprime la ligne existante sur la carte si elle est présente.
function removeLine() {
  if (map.getLayer("line-layer")) {
    map.removeLayer("line-layer");
    map.removeSource("line-source");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".resume-button").addEventListener("click", () => {
    const settingsOverlay = document.getElementById("settingsOverlay");
    settingsOverlay.style.visibility = "hidden";
    settingsOverlay.style.opacity = "0";
  });

  document.querySelector(".leave-button").addEventListener("click", () => {
    const confirmOverlay = document.getElementById("confirmOverlay");
    confirmOverlay.style.visibility = "visible";
    confirmOverlay.style.opacity = "1";
  });

  document.getElementById("confirmYes").addEventListener("click", () => {
    localStorage.removeItem("userProgress");
    localStorage.removeItem("currentRound");
    localStorage.removeItem("totalScore");
    window.location.href = "/";
  });

  document.getElementById("confirmNo").addEventListener("click", () => {
    const confirmOverlay = document.getElementById("confirmOverlay");
    confirmOverlay.style.visibility = "hidden";
    confirmOverlay.style.opacity = "0";
  });

  const soundToggle = document.getElementById("soundToggle");
  const soundLabel = soundToggle
    .closest(".settings-control")
    .querySelector("p");
  soundToggle.addEventListener("change", (event) => {
    soundLabel.textContent = event.target.checked
      ? "Son activé"
      : "Son désactivé";
  });

  const fullscreenToggle = document.getElementById("fullscreenToggle");
  const fullscreenLabel = fullscreenToggle
    .closest(".settings-control")
    .querySelector("p");
  fullscreenToggle.addEventListener("change", (event) => {
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

//Crée et configure la carte Mapbox pour le mode de jeu sélectionné.
function createMap() {
  const mapOptions = {
    container: "map",
    style: "mapbox://styles/mapbox/streets-v11",
    center: [2.2945, 48.8584],
    zoom: 2,
    minZoom: 2,
  };

  if (modeDeJeu === "parc") {
    mapOptions.center = [
      disneylandParisBounds.centerLng,
      disneylandParisBounds.centerLat,
    ];
    mapOptions.zoom = disneylandParisBounds.zoomLevel;
  } else if (modeDeJeu === "nevers") {
    mapOptions.center = [neversBounds.centerLng, neversBounds.centerLat];
    mapOptions.zoom = neversBounds.zoomLevel;
  } else if (modeDeJeu === "versailles") {
    mapOptions.center = [
      versaillesBounds.centerLng,
      versaillesBounds.centerLat,
    ];
    mapOptions.zoom = versaillesBounds.zoomLevel;
  }

  map = new mapboxgl.Map(mapOptions);
  map.scrollZoom.setZoomRate(0.1);
  map.scrollZoom.setWheelZoomRate(0.1);
  map.on("click", onMapClick);
}

//Bascule entre la vue de la carte et celle de Street View
function toggleMap() {
  const pano = document.getElementById("pano");
  const mapContainer = document.getElementById("mapContainer");
  const mapVisible = mapContainer.style.display === "block";

  mapContainer.style.display = mapVisible ? "none" : "block";
  pano.style.display = mapVisible ? "block" : "none";
  document.getElementById("showMapBtn").textContent = mapVisible
    ? "Ouvrir la Carte"
    : "Retour à Street View";
  map.resize();
}

//Ajoute un marqueur sur la carte à la position cliquée par l'utilisateur et active le bouton de validation
function onMapClick(e) {
  if (choiceValidated) return;
  if (userMarker) userMarker.remove();

  userMarker = new mapboxgl.Marker()
    .setLngLat([e.lngLat.lng, e.lngLat.lat])
    .addTo(map);

  document.getElementById("validateChoiceBtn").disabled = false;
  document
    .getElementById("validateChoiceBtn")
    .classList.remove("disabled-button");
}

//Ajuste le zoom dans Street View en fonction de la direction spécifiée
function adjustZoom(direction) {
  const currentZoom = panorama.getZoom();
  panorama.setZoom(currentZoom + direction);
}

//Enregistre la position actuelle dans l'historique des déplacements pour permettre un retour en arrière
function savePreviousPosition() {
  const currentPosition = panorama.getPosition();
  if (currentPosition) {
    previousPositions.push({
      lat: currentPosition.lat(),
      lng: currentPosition.lng(),
    });
  }
}

//Repositionne le joueur à la position précédente enregistrée dans l'historique des déplacements.
function undoMove() {
  if (previousPositions.length > 1) {
    previousPositions.pop();
    const lastPosition = previousPositions[previousPositions.length - 1];
    panorama.setPosition(
      new google.maps.LatLng(lastPosition.lat, lastPosition.lng)
    );
  }
}

//Repositionne le joueur à la position initiale de la manche
function resetToInitialPosition() {
  panorama.setPosition(
    new google.maps.LatLng(initialPosition.lat, initialPosition.lng)
  );
}

//Affiche ou masque le menu des paramètres en ajustant sa visibilité et son opacité
function toggleSettings() {
  const settingsOverlay = document.getElementById("settingsOverlay");
  if (settingsOverlay) {
    settingsOverlay.style.visibility =
      settingsOverlay.style.visibility === "visible" ? "hidden" : "visible";
    settingsOverlay.style.opacity =
      settingsOverlay.style.opacity === "1" ? "0" : "1";
  }
}

window.onload = initialize;
