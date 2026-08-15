export function showResult({
    result,
    gameBoard,
    questionContainer,
    wrongAnswersElement,
    completionTimeElement,
    wrongAnswers,
    timeElapsed
}) {
    questionContainer.style.display = 'none';
    gameBoard.style.display = 'none';
    result.style.display = 'block';
    wrongAnswersElement.textContent = wrongAnswers;
    completionTimeElement.textContent = timeElapsed;
}

export function downloadResult({ result }) {
    if (!window.html2canvas) {
        alert('Chyba: html2canvas není dostupné.');
        return;
    }

    window.html2canvas(result, {
        useCORS: true
    })
        .then((canvas) => {
            const link = document.createElement('a');
            link.download = 'vysledek.png';
            link.href = canvas.toDataURL();
            link.click();
        })
        .catch(() => {
            alert('Chyba při generování obrázku výsledku.');
        });
}

export function restartGame() {
    window.location.reload();
}
