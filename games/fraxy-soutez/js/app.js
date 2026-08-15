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
const resultStartTimeElement = document.getElementById('result-start-time');
const resultEndTimeElement = document.getElementById('result-end-time');
const resultDurationElement = document.getElementById('result-duration');
const finishEarlyButton = document.getElementById('finish-early');
const downloadResultButton = document.getElementById('download-result');
const resultExport = document.getElementById('result-export');

let map;
let totalScore = 0;
let currentCountry = null;
let startTime = null;
let endTime = null;
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
        if (answeredCountries.has(country)) {
            return;
        }

        const item = document.createElement('li');
        item.textContent = country;
        item.tabIndex = 0;
        item.addEventListener('click', () => focusCountry(country));
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                focusCountry(country);
            }
        });

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
    const difference = Math.abs(answer - correctAnswer);
    const score = Math.max(
        100 - difference / correctAnswer * 100,
        0
    );
    const roundedScore = Number.parseFloat(score.toFixed(2));

    totalScore += roundedScore;
    answeredCountries.add(country);
    answerHistory.set(country, {
        answer,
        correctAnswer,
        difference,
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

        if (history) {
            answer.textContent =
                `Tvoje odpověď: ${formatNumber(history.answer)} · ` +
                `Správná odpověď: ${formatNumber(history.correctAnswer)} · ` +
                `Rozdíl: ${formatNumber(history.difference)}`;
        } else {
            answer.textContent = 'Tvoje odpověď: nezodpovězeno · Správná odpověď: ' +
                `${formatNumber(data.answer)}`;
            answer.classList.add('unanswered');
        }

        details.append(question, answer);

        const score = document.createElement('div');
        score.className = 'question-history-score';

        if (history) {
            score.classList.toggle('low', history.score < 50);
            score.textContent = `+${history.score.toFixed(2)} b.`;
        } else {
            score.classList.add('low');
            score.textContent = '0 b.';
        }

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

function formatDateTime(value) {
    return new Intl.DateTimeFormat('cs-CZ', {
        dateStyle: 'short',
        timeStyle: 'medium'
    }).format(value);
}

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours} h ${minutes} min ${seconds} s`;
    }

    if (minutes > 0) {
        return `${minutes} min ${seconds} s`;
    }

    return `${seconds} s`;
}

function finishCompetition() {
    if (endTime) {
        return;
    }

    endTime = new Date();
    closeQuestion();
    mapScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    totalScoreElement.textContent = totalScore.toFixed(2);

    const total = Object.keys(countries).length;
    const answered = answeredCountries.size;
    const unanswered = total - answered;

    resultSummary.textContent = unanswered > 0
        ? `Odpověděl jsi na ${answered} z ${total} otázek. ${unanswered} zůstalo nezodpovězených.`
        : `Odpověděl jsi na všech ${total} otázek.`;

    resultStartTimeElement.textContent = startTime
        ? formatDateTime(startTime)
        : '—';
    resultEndTimeElement.textContent = formatDateTime(endTime);
    resultDurationElement.textContent = startTime
        ? formatDuration(endTime - startTime)
        : '—';

    renderQuestionHistory();
}

function downloadResult() {
    if (typeof html2canvas !== 'function') {
        alert('Nepodařilo se načíst nástroj pro stažení výsledku.');
        return;
    }

    const excludedElements = resultExport.querySelectorAll('.download-exclude');
    excludedElements.forEach((element) => {
        element.classList.add('download-hidden');
    });

    html2canvas(resultExport, {
        backgroundColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--bg')
            .trim() || '#050607',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true
    })
        .then((canvas) => {
            const link = document.createElement('a');
            const timestamp = new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, '-');

            link.download = `fraxyho-soutez-${timestamp}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        })
        .catch(() => {
            alert('Výsledek se nepodařilo připravit ke stažení.');
        })
        .finally(() => {
            excludedElements.forEach((element) => {
                element.classList.remove('download-hidden');
            });
        });
}

const mapMarkers = new Map();

function initializeMap() {
    startTime = new Date();

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
                offset: [0, -8],
                opacity: 1,
                sticky: true
            });

        marker.on('mouseover', () => marker.openTooltip());
        marker.on('mouseout', () => marker.closeTooltip());
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
finishEarlyButton.onclick = () => {
    const unanswered = Object.keys(countries).length - answeredCountries.size;

    if (unanswered > 0) {
        const confirmed = window.confirm(
            `Opravdu chceš soutěž ukončit? ${unanswered} otázek zůstane nezodpovězených a dostane za ně 0 bodů.`
        );

        if (!confirmed) {
            return;
        }
    }

    finishCompetition();
};

downloadResultButton.onclick = downloadResult;

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
