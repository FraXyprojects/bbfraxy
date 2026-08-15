import { countries } from '../data.js';

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
const durationElement = document.getElementById('competition-duration');
const submitAnswerButton = document.getElementById('submit-answer');
const closeModalButton = document.getElementById('close-question');
const questionHistoryElement = document.getElementById('question-history');
const finishEarlyButton = document.getElementById('finish-early');
const downloadResultButton = document.getElementById('download-result');
const restartButton = document.getElementById('restart-competition');
const backToRulesButton = document.getElementById('back-to-rules');

const countryNames = {
    Albania: 'Albánie',
    Andorra: 'Andorra',
    Austria: 'Rakousko',
    Belgium: 'Belgie',
    'Bosnia and Herzegovina': 'Bosna a Hercegovina',
    Bulgaria: 'Bulharsko',
    Croatia: 'Chorvatsko',
    'Czech Republic': 'Česko',
    Denmark: 'Dánsko',
    Estonia: 'Estonsko',
    Finland: 'Finsko',
    France: 'Francie',
    Greece: 'Řecko',
    Hungary: 'Maďarsko',
    Iceland: 'Island',
    Ireland: 'Irsko',
    Italy: 'Itálie',
    Kosovo: 'Kosovo',
    Latvia: 'Lotyšsko',
    Liechtenstein: 'Lichtenštejnsko',
    Lithuania: 'Litva',
    Luxembourg: 'Lucembursko',
    Malta: 'Malta',
    Moldova: 'Moldavsko',
    Monaco: 'Monako',
    Montenegro: 'Černá Hora',
    Netherlands: 'Nizozemsko',
    Norway: 'Norsko',
    Poland: 'Polsko',
    Portugal: 'Portugalsko',
    Romania: 'Rumunsko',
    'San Marino': 'San Marino',
    Slovakia: 'Slovensko',
    Slovenia: 'Slovinsko',
    Spain: 'Španělsko',
    Sweden: 'Švédsko',
    Switzerland: 'Švýcarsko',
    Ukraine: 'Ukrajina',
    'United Kingdom': 'Spojené království'
};

const sortedCountries = Object.keys(countries).sort((first, second) => {
    return getCountryName(first).localeCompare(
        getCountryName(second),
        'cs-CZ',
        { sensitivity: 'base' }
    );
});

let map = null;
let totalScore = 0;
let currentCountry = null;
let activeTooltipMarker = null;
let startTime = null;
let endTime = null;

const answeredCountries = new Set();
const answerHistory = new Map();
const mapMarkers = new Map();

function getCountryName(country) {
    return countryNames[country] || country;
}

function ensureRequiredElements() {
    const required = [
        welcomeScreen,
        rulesScreen,
        mapScreen,
        resultScreen,
        remainingCountriesElement,
        progressLabel,
        progressBar,
        questionModal,
        modalOverlay,
        countryName,
        questionText,
        answerInput,
        totalScoreElement,
        resultSummary,
        durationElement,
        submitAnswerButton,
        closeModalButton,
        questionHistoryElement,
        finishEarlyButton,
        downloadResultButton,
        restartButton,
        backToRulesButton
    ];

    return required.every(Boolean);
}

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

    sortedCountries.forEach((country) => {
        if (answeredCountries.has(country)) {
            return;
        }

        const item = document.createElement('li');
        item.textContent = getCountryName(country);
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

function closeActiveTooltip() {
    if (!activeTooltipMarker) {
        return;
    }

    activeTooltipMarker.closeTooltip();
    activeTooltipMarker.unbindTooltip();
    activeTooltipMarker = null;
}

function showCountryTooltip(country) {
    const marker = mapMarkers.get(country);

    if (!marker) {
        return;
    }

    closeActiveTooltip();

    const history = answerHistory.get(country);
    const displayName = getCountryName(country);
    const tooltipText = history
        ? `${displayName} · ${history.score.toFixed(2)} bodů`
        : displayName;

    marker.bindTooltip(tooltipText, {
        direction: 'top',
        offset: [0, -8],
        interactive: false
    });

    marker.openTooltip();
    activeTooltipMarker = marker;
}

function focusCountry(country) {
    if (!map) {
        return;
    }

    const data = countries[country];
    closeActiveTooltip();

    const targetZoom = Math.max(map.getZoom(), 6);
    const currentCenter = map.getCenter();
    const alreadyThere =
        Math.abs(currentCenter.lat - data.coords[0]) < 0.01 &&
        Math.abs(currentCenter.lng - data.coords[1]) < 0.01 &&
        map.getZoom() >= targetZoom;

    if (alreadyThere) {
        showCountryTooltip(country);
        return;
    }

    const onMoveEnd = () => {
        map.off('moveend', onMoveEnd);
        showCountryTooltip(country);
    };

    map.on('moveend', onMoveEnd);
    map.setView(data.coords, targetZoom, {
        animate: true,
        duration: 0.5
    });
}

function openQuestion(country) {
    if (answeredCountries.has(country)) {
        return;
    }

    closeActiveTooltip();

    const data = countries[country];
    currentCountry = country;

    if (mapOverlay) {
        mapOverlay.classList.add('map-overlay-hidden');
    }

    countryName.textContent = getCountryName(country);
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
    updateMarkerAfterAnswer(country);

    if (answeredCountries.size === Object.keys(countries).length) {
        finishCompetition('complete');
    }
}

function updateMarkerAfterAnswer(country) {
    const marker = mapMarkers.get(country);

    if (!marker) {
        return;
    }

    marker.setIcon(createMarkerIcon(true));
    marker.setOpacity(1);
    closeActiveTooltip();
}

function renderQuestionHistory() {
    questionHistoryElement.innerHTML = '';

    sortedCountries.forEach((country) => {
        const data = countries[country];
        const history = answerHistory.get(country);

        const group = document.createElement('section');
        group.className = 'question-history-group';

        const title = document.createElement('h3');
        title.textContent = getCountryName(country);

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

        const score = document.createElement('div');
        score.className = 'question-history-score';

        if (!history) {
            answer.textContent =
                `Tvoje odpověď: nezodpovězeno · ` +
                `Správná odpověď: ${formatNumber(data.answer)}`;
            score.classList.add('low');
            score.textContent = '0 b.';
        } else {
            answer.textContent =
                `Tvoje odpověď: ${formatNumber(history.answer)} · ` +
                `Správná odpověď: ${formatNumber(history.correctAnswer)} · ` +
                `Rozdíl: ${formatNumber(history.difference)}`;
            score.classList.toggle('low', history.score < 50);
            score.textContent = `+${history.score.toFixed(2)} b.`;
        }

        details.append(question, answer);
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

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours} h ${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} s`;
    }

    return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

function finishCompetition(reason) {
    if (!startTime || endTime) {
        return;
    }

    endTime = new Date();
    closeQuestion();
    closeActiveTooltip();
    mapScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    const duration = endTime.getTime() - startTime.getTime();
    totalScoreElement.textContent = totalScore.toFixed(2);
    durationElement.textContent = `Trvání: ${formatDuration(duration)}`;

    if (reason === 'complete') {
        resultSummary.textContent =
            `Odpověděl jsi na všech ${Object.keys(countries).length} otázek.`;
    } else {
        const unanswered = Object.keys(countries).length - answeredCountries.size;
        resultSummary.textContent =
            `Soutěž ukončena předčasně. Nezodpovězeno: ${unanswered}.`;
    }

    renderQuestionHistory();
}

function initializeMap() {
    if (map) {
        map.remove();
        mapMarkers.clear();
        activeTooltipMarker = null;
    }

    map = L.map('map', {
        minZoom: 3,
        maxZoom: 8,
        zoomControl: true
    }).setView([54, 15], 4.25);

    const tiles = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }
    );

    tiles.addTo(map);

    Object.entries(countries).forEach(([country, data]) => {
        const marker = L.marker(data.coords, {
            icon: createMarkerIcon(false)
        }).addTo(map);

        marker.on('click', (event) => {
            if (event?.originalEvent) {
                L.DomEvent.stopPropagation(event.originalEvent);
            }

            closeActiveTooltip();
            openQuestion(country);
        });

        mapMarkers.set(country, marker);
    });

    map.on('click zoomstart dragstart movestart', closeActiveTooltip);

    window.setTimeout(() => map.invalidateSize(), 200);
    updateRemaining();
}

function startRules() {
    welcomeScreen.classList.add('hidden');
    rulesScreen.classList.remove('hidden');
}

function startMap() {
    rulesScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    mapScreen.classList.remove('hidden');

    totalScore = 0;
    currentCountry = null;
    startTime = new Date();
    endTime = null;
    answeredCountries.clear();
    answerHistory.clear();

    if (mapOverlay) {
        mapOverlay.classList.remove('map-overlay-hidden');
    }

    initializeMap();
}

function finishEarly() {
    const remaining = Object.keys(countries).length - answeredCountries.size;

    if (remaining === 0) {
        finishCompetition('complete');
        return;
    }

    const confirmed = window.confirm(
        `Opravdu chceš soutěž ukončit předčasně?\n\nNezodpovězeno zůstane ${remaining} otázek a ty získají 0 bodů.`
    );

    if (confirmed) {
        finishCompetition('early');
    }
}

async function downloadResult() {
    if (!window.html2canvas) {
        alert('Nástroj pro stažení výsledku není dostupný.');
        return;
    }

    const previousText = downloadResultButton.textContent;
    downloadResultButton.disabled = true;
    downloadResultButton.textContent = 'Generuji…';
    resultScreen.classList.add('exporting');

    try {
        const canvas = await window.html2canvas(resultScreen, {
            backgroundColor: getComputedStyle(document.documentElement)
                .getPropertyValue('--bg')
                .trim() || '#050607',
            scale: Math.min(window.devicePixelRatio || 1, 2),
            useCORS: true
        });

        const link = document.createElement('a');
        link.download = `fraxyho-soutez-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error(error);
        alert('Nepodařilo se vytvořit obrázek výsledku.');
    } finally {
        resultScreen.classList.remove('exporting');
        downloadResultButton.disabled = false;
        downloadResultButton.textContent = previousText;
    }
}

function setup() {
    if (!ensureRequiredElements()) {
        console.error('FraXyho soutěž: chybí některé prvky stránky.');
        return;
    }

    document.getElementById('start-rules').addEventListener('click', startRules);
    document.getElementById('start-map').addEventListener('click', startMap);
    finishEarlyButton.addEventListener('click', finishEarly);
    downloadResultButton.addEventListener('click', downloadResult);
    restartButton.addEventListener('click', () => window.location.reload());

    submitAnswerButton.addEventListener('click', submitAnswer);
    closeModalButton.addEventListener('click', closeQuestion);
    modalOverlay.addEventListener('click', closeQuestion);
    backToRulesButton.addEventListener('click', () => {
        closeActiveTooltip();
        mapScreen.classList.add('hidden');
        rulesScreen.classList.remove('hidden');
    });

    answerInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            submitAnswer();
        }

        if (event.key === 'Escape') {
            closeQuestion();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
} else {
    setup();
}
