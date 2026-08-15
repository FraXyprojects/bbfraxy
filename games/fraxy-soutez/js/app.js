import { countries } from './data.js';

const welcomeScreen = document.getElementById('welcome-screen');
const rulesScreen = document.getElementById('rules-screen');
const mapScreen = document.getElementById('map-screen');
const resultScreen = document.getElementById('result-screen');
const remainingCountriesElement = document.getElementById('remaining-countries');
const progressLabel = document.getElementById('progress-label');
const progressBar = document.getElementById('progress-bar');
const modalOverlay = document.getElementById('modal-overlay');
const questionModal = document.getElementById('question-modal');
const countryName = document.getElementById('country-name');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer');
const totalScoreElement = document.getElementById('total-score');
const resultSummary = document.getElementById('result-summary');
const submitAnswerButton = document.getElementById('submit-answer');
const closeModalButton = document.getElementById('close-question');

let map;
let totalScore = 0;
let currentCountry = null;
const answeredCountries = new Set();

function updateRemaining() {
    remainingCountriesElement.innerHTML = '';

    Object.keys(countries).forEach((country) => {
        if (answeredCountries.has(country)) {
            return;
        }

        const item = document.createElement('li');
        item.textContent = country;
        remainingCountriesElement.appendChild(item);
    });

    const total = Object.keys(countries).length;
    const answered = answeredCountries.size;
    const percentage = total ? (answered / total) * 100 : 0;

    progressLabel.textContent = `${answered} / ${total} zodpovězeno`;
    progressBar.style.width = `${percentage}%`;
}

function openQuestion(country) {
    if (answeredCountries.has(country)) {
        return;
    }

    const data = countries[country];
    currentCountry = country;

    countryName.textContent = country;
    questionText.textContent = data.question;
    answerInput.value = '';

    questionModal.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
    answerInput.focus();
}

function closeQuestion() {
    currentCountry = null;
    questionModal.classList.add('hidden');
    modalOverlay.classList.add('hidden');
    answerInput.value = '';
}

function submitAnswer() {
    const answer = Number.parseFloat(answerInput.value);

    if (!currentCountry || Number.isNaN(answer)) {
        alert('Prosím zadej číselnou odpověď.');
        return;
    }

    const correctAnswer = countries[currentCountry].answer;
    const score = Math.max(
        100 - Math.abs(answer - correctAnswer) / correctAnswer * 100,
        0
    );

    totalScore += Number.parseFloat(score.toFixed(2));
    answeredCountries.add(currentCountry);

    closeQuestion();
    updateRemaining();
    updateMarkerAfterAnswer(currentCountry, score);

    if (answeredCountries.size === Object.keys(countries).length) {
        finishCompetition();
    }
}

function finishCompetition() {
    mapScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    totalScoreElement.textContent = totalScore.toFixed(2);
    resultSummary.textContent = `Odpověděl jsi na všech ${Object.keys(countries).length} otázek.`;
}

function updateMarkerAfterAnswer(country, score) {
    const marker = mapMarkers.get(country);

    if (!marker) {
        return;
    }

    marker.setOpacity(0.55);
    marker.setTooltipContent(`${country} · ${score.toFixed(2)} bodů`);
}

const mapMarkers = new Map();

function initializeMap() {
    map = L.map('map', {
        minZoom: 3,
        maxZoom: 8,
        zoomControl: true
    }).setView([54, 15], 4.25);

    const tiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }
    );

    tiles.addTo(map);

    Object.entries(countries).forEach(([country, data]) => {
        const icon = L.divIcon({
            className: '',
            html: '<span class="custom-marker"></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const marker = L.marker(data.coords, { icon })
            .addTo(map)
            .bindTooltip(country, {
                direction: 'top',
                offset: [0, -8]
            });

        marker.on('click', () => openQuestion(country));
        mapMarkers.set(country, marker);
    });

    window.setTimeout(() => map.invalidateSize(), 200);
    updateRemaining();
}

document.getElementById('start-rules').onclick = () => {
    welcomeScreen.classList.add('hidden');
    rulesScreen.classList.remove('hidden');
};

document.getElementById('start-map').onclick = () => {
    rulesScreen.classList.add('hidden');
    mapScreen.classList.remove('hidden');
    initializeMap();
};

submitAnswerButton.onclick = submitAnswer;
closeModalButton.onclick = closeQuestion;
modalOverlay.onclick = closeQuestion;

answerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        submitAnswer();
    }

    if (event.key === 'Escape') {
        closeQuestion();
    }
});

document.getElementById('restart-competition').onclick = () => {
    window.location.reload();
};

document.getElementById('back-to-rules').onclick = () => {
    mapScreen.classList.add('hidden');
    rulesScreen.classList.remove('hidden');
};
