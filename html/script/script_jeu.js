mapboxgl.accessToken = 'pk.eyJ1IjoiNGtlZXppeCIsImEiOiJjbTF5c2ZucmEwMThzMnFzanNreXJzOW5uIn0.OR0rEGAdPmQIGBBd2hGv_g';

let currentRound = 0;
let correctPoint;
let correctMarker, userMarker;
let map;
let choiceValidated = false;
const streetViewService = new google.maps.StreetViewService();

let modeDeJeu = localStorage.getItem('gameMode') || 'mondial';

function initialize() {
  createMap();
  loadRound();
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

  const tryPosition = () => {
    const randomPosition = getRandomPosition();
    checkStreetViewAvailable(randomPosition, (available, position) => {
      if (available) {
        correctPoint = { lat: position.lat(), lng: position.lng() };
        const panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
          position: correctPoint,
          pov: { heading: 0, pitch: 0 },
          zoom: 0,
          addressControl: false
        });
        
        panorama.addListener('pano_changed', function() {
          document.getElementById('loadingOverlay').style.display = 'none';
        });
        
        resetRoundElements();
      } else {
        tryPosition();
      }
    });
  };

  tryPosition();
}

function resetRoundElements() {
  if (userMarker) userMarker.remove();
  if (correctMarker) correctMarker.remove();
  removeLine();
  document.getElementById('distanceDisplay').style.display = 'none';
  document.getElementById('validateChoiceBtn').style.display = 'block';
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

  document.getElementById('validateChoiceBtn').style.display = 'block';
}

function validateChoice() {
    if (choiceValidated) return;
  
    choiceValidated = true;
    const userPosition = userMarker.getLngLat();
  
    correctMarker = new mapboxgl.Marker({ color: "red" })
      .setLngLat([correctPoint.lng, correctPoint.lat])
      .addTo(map);
  
    drawLineBetweenPoints({ lng: userPosition.lng, lat: userPosition.lat }, correctPoint);
  
    const distance = turf.distance([userPosition.lng, userPosition.lat], [correctPoint.lng, correctPoint.lat], { units: 'kilometers' });
    document.getElementById('distanceDisplay').textContent = `Distance au point correct : ${distance.toFixed(2)} km`;
    document.getElementById('distanceDisplay').style.display = 'block';
  
    document.getElementById('validateChoiceBtn').style.display = 'none';
    document.getElementById('nextRoundBtn').style.display = 'block';
  
    centerMapBetweenPoints({ lng: userPosition.lng, lat: userPosition.lat }, correctPoint);
}

function nextRound() {
  loadRound();
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

document.getElementById('changePositionBtn').onclick = nextRound;
window.onload = initialize;
