import {
    checkAnswer,
    clearGameTimer,
    createGameState,
    getQuestion,
    shuffleAnswers,
    startGame
} from './game.js';
import {
    downloadResult,
    restartGame,
    showResult
} from './results.js';

const gameBoard = document.getElementById('game-board');
const questionContainer = document.getElementById('question-container');
const questionText = document.getElementById('question-text');
const answerButtons = document.getElementById('answer-buttons');
const result = document.getElementById('result');
const wrongAnswersElement = document.getElementById('wrong-answers');
const completionTimeElement = document.getElementById('completion-time');
const timerElement = document.getElementById('timer');
const squares = Array.from(document.querySelectorAll('.square'));

const state = createGameState();

function updateActiveSquare() {
    squares.forEach((square, index) => {
        square.classList.toggle(
            'active',
            index === state.currentIndex
        );
    });
}

function askQuestion(index) {
    const question = getQuestion({
        state,
        index,
        gameBoard
    });

    if (!question) {
        endGame();
        return;
    }

    questionText.textContent = question.question;
    answerButtons.style.display = 'block';
    answerButtons.innerHTML = '';

    shuffleAnswers(
        question.answers.map((answer, answerIndex) => ({
            answer,
            index: answerIndex
        }))
    ).forEach(({ answer, index: answerIndex }) => {
        const button = document.createElement('button');
        button.textContent = answer;
        button.classList.add('answer');
        button.onclick = () => {
            checkAnswer({
                state,
                selected: answerIndex,
                correct: question.correct,
                gameBoard,
                updateActiveSquare,
                askQuestion,
                endGame,
                showRetry
            });
        };

        answerButtons.appendChild(button);
    });
}

function showRetry() {
    questionText.textContent =
        'To se ti nepovedlo. Klikni na pokračovat nebo restart.';
    answerButtons.style.display = 'none';

    const continueButton = document.createElement('button');
    continueButton.textContent = 'Pokračovat';
    continueButton.classList.add('btn', 'btn-restart');
    continueButton.onclick = () => {
        questionContainer.style.display = 'block';
        askQuestion(state.currentIndex);
        continueButton.remove();
        restartButton.remove();
    };

    const restartButton = document.createElement('button');
    restartButton.textContent = 'Restartovat';
    restartButton.classList.add('btn', 'btn-restart');
    restartButton.onclick = restartGame;

    questionContainer.appendChild(continueButton);
    questionContainer.appendChild(restartButton);
}

function endGame() {
    clearGameTimer(state);

    showResult({
        result,
        gameBoard,
        questionContainer,
        wrongAnswersElement,
        completionTimeElement,
        wrongAnswers: state.wrongAnswers,
        timeElapsed: state.timeElapsed
    });
}

squares[0].addEventListener('click', () => {
    if (!state.gameStarted) {
        startGame({
            state,
            gameBoard,
            timerElement,
            updateActiveSquare,
            askQuestion
        });
    }
});

document
    .querySelector('.btn-download')
    ?.addEventListener('click', () => {
        downloadResult({ result });
    });

document
    .querySelector('.btn-restart')
    ?.addEventListener('click', restartGame);
