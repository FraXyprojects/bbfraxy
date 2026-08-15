import { countries } from '../data.js';

const landingFixStylesheet = document.createElement('link');
landingFixStylesheet.rel = 'stylesheet';
landingFixStylesheet.href = './css/landing-fix.css';
document.head.appendChild(landingFixStylesheet);

const welcomeScreen = document.getElementById('welcome-screen');
const rulesScreen = document.getElementById('rules-screen');
const mapScreen = document.getElementById('map-screen');
const resultScreen = document.getElementById('result-screen');
const remainingCountriesElement = document.getElementById('remaining-countries');
const progressLabel = document.getElementById('progress-label');
const progressBar = document.getElementById('progress-bar');
const mapOverlay = document.getElementById('map-overlay');
const modalOverlay = document.getElementById('modal-overlay');
const questionModal = document.getElementById('question-modal');
const countryName = document.getElementById('country-name');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer');
const totalScoreElement = document.getElementById('total-score');
const resultSummary = document.getElementById('result-summary');
const submitAnswerButton = document.getElementById('submit-answer');
const closeModalButton = document.getElementById('close-question');
const questionHistoryElement = document.getElementById('question-history');

let map;
let totalScore = 0;
let currentCountry = null;
const answeredCountries = new Set();
const answerHistory = new Map();
const mapMarkers = new Map();

function createMarkerIcon(answered = false) {
    return L.divIcon({
        className: '',
        html: `<span class="custom-marker${answered ? ' answered' : ''}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });
}

function updateRemaining() {
    remainingCountriesElement.innerHTML = '';

    Object.keys(countries).forEach((country) => {
        const item = document.createElement('li');
        const isAnswered = answeredCountries.has(country);

        item.textContent = country;
        item.classList.toggle('answered', isAnswered);

        if (isAnswered) {
            item.setAttribute('aria-disabled', 'true');
        } else {
            item.tabIndex = 0;
            item.addEventListener('click', () => focusCountry(country));
            item.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    focusCountry(country);
                }
            });
        }

        remainingCountriesElement.appendChild(item);
    });

    const total = Object.keys(countries).length;
    const answered = answeredCountries.size;
    const percentage = total ? (answered / total) * 100 : 0;

    progressLabel.textContent = `${answered} / ${total} zodpovězeno`;
    progressBar.style.width = `${percentage}%`;
}

function focusCountry(country) {
    if (!map) {
        return;
    }

    const data = countries[country];
    map.setView(data.coords, Math.max(map.getZoom(), 6), {
        animate: true,
        duration: 0.5
    });

    const marker = mapMarkers.get(country);

    if (marker) {
        marker.openTooltip();
    }
}

function openQuestion(country) {
    if (answeredCountries.has(country)) {
        return;
    }

    const data = countries[country];
    currentCountry = country;

    if (mapOverlay) {
        mapOverlay.classList.add('map-overlay-hidden');
    }

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

    const country = currentCountry;
    const correctAnswer = countries[country].answer;
    const score = Math.max(
        100 - Math.abs(answer - correctAnswer) / correctAnswer * 100,
        0
    );
    const roundedScore = Number.parseFloat(score.toFixed(2));

    totalScore += roundedScore;
    answeredCountries.add(country);
    answerHistory.set(country, {
        answer,
        correctAnswer,
        score: roundedScore
    });

    closeQuestion();
    updateRemaining();
    updateMarkerAfterAnswer(country, roundedScore);

    if (answeredCountries.size === Object.keys(countries).length) {
        finishCompetition();
    }
}

function updateMarkerAfterAnswer(country, score) {
    const marker = mapMarkers.get(country);

    if (!marker) {
        return;
    }

    marker.setIcon(createMarkerIcon(true));
    marker.setOpacity(1);
    marker.setTooltipContent(`${country} · ${score.toFixed(2)} bodů`);
}

function renderQuestionHistory() {
    questionHistoryElement.innerHTML = '';

    Object.entries(countries).forEach(([country, data]) => {
        const history = answerHistory.get(country);

        if (!history) {
            return;
        }

        const group = document.createElement('section');
        group.className = 'question-history-group';

        const title = document.createElement('h3');
        title.textContent = country;

        const list = document.createElement('div');
        list.className = 'question-history-list';

        const item = document.createElement('article');
        item.className = 'question-history-item';

        const details = document.createElement('div');

        const question = document.createElement('div');
        question.className = 'question-history-question';
        question.textContent = data.question;

        const answer = document.createElement('div');
        answer.className = 'question-history-answer';
        answer.textContent =
            `Tvoje odpověď: ${formatNumber(history.answer)} · ` +
            `Správná odpověď: ${formatNumber(history.correctAnswer)}`;

        details.append(question, answer);

        const score = document.createElement('div');
        score.className = 'question-history-score';
        score.classList.toggle('low', history.score < 50);
        score.textContent = `+${history.score.toFixed(2)} b.`;

        item.append(details, score);
        list.appendChild(item);
        group.append(title, list);
        questionHistoryElement.appendChild(group);
    });
}

function formatNumber(value) {
    return new Intl.NumberFormat('cs-CZ', {
        maximumFractionDigits: 2
    }).format(value);
}

function finishCompetition() {
    mapScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    totalScoreElement.textContent = totalScore.toFixed(2);
    resultSummary.textContent =
        `Odpověděl jsi na všech ${Object.keys(countries).length} otázek.`;

    renderQuestionHistory();
}

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
        const marker = L.marker(data.coords, {
            icon: createMarkerIcon(false)
        })
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
