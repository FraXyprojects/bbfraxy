import { questions } from './data.js';

export function createGameState() {
    return {
        currentIndex: 0,
        wrongAnswers: 0,
        timeElapsed: 0,
        timer: null,
        gameStarted: false,
        usedQuestions: {
            math: [],
            history: [],
            fun: [],
            aktualni_udalosti: [],
            mista_cinu: [],
            elektronika: [],
            nove_technologie: [],
            hry: [],
            serialy: []
        }
    };
}

export function startGame({ state, gameBoard, timerElement, updateActiveSquare, askQuestion }) {
    state.gameStarted = true;
    timerElement.style.display = 'block';

    state.timer = setInterval(() => {
        state.timeElapsed += 1;
        timerElement.textContent = `Čas: ${state.timeElapsed}s`;
    }, 1000);

    state.currentIndex = 1;
    updateActiveSquare();
    askQuestion(state.currentIndex);
}

export function getQuestion({ state, index, gameBoard }) {
    const theme = gameBoard.children[index]?.dataset.theme;

    if (!theme) {
        return null;
    }

    const themeQuestions = questions[theme];

    if (!themeQuestions || !themeQuestions.length) {
        return null;
    }

    if (state.usedQuestions[theme].length === themeQuestions.length) {
        state.usedQuestions[theme] = [];
    }

    const available = themeQuestions.filter(
        (_, questionIndex) => !state.usedQuestions[theme].includes(questionIndex)
    );

    const question = available[
        Math.floor(Math.random() * available.length)
    ];

    state.usedQuestions[theme].push(themeQuestions.indexOf(question));

    return question;
}

export function shuffleAnswers(answers) {
    return answers
        .map((value) => ({
            value,
            sort: Math.random()
        }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
}

export function checkAnswer({
    state,
    selected,
    correct,
    gameBoard,
    updateActiveSquare,
    askQuestion,
    endGame,
    showRetry
}) {
    if (selected === correct) {
        if (state.currentIndex === gameBoard.children.length - 1) {
            endGame();
            return;
        }

        state.currentIndex += 1;
        updateActiveSquare();
        askQuestion(state.currentIndex);
        return;
    }

    state.wrongAnswers += 1;

    if (state.currentIndex > 1) {
        state.currentIndex -= 1;
        updateActiveSquare();
        askQuestion(state.currentIndex);
        return;
    }

    showRetry();
}

export function clearGameTimer(state) {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
}
