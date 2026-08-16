function getExportBackground() {
    return (
        getComputedStyle(document.documentElement)
            .getPropertyValue('--bg')
            .trim() || '#050607'
    );
}

async function exportElementAsPng(element, filename) {
    if (!window.html2canvas || !element) {
        throw new Error('Exportní nástroj nebo cílový prvek není dostupný.');
    }

    const canvas = await window.html2canvas(element, {
        backgroundColor: getExportBackground(),
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function setupResultDownloads() {
    const scoreDownloadButton = document.getElementById('download-score-result');
    const answerDownloadButton = document.getElementById('download-result');
    const scoreCard = document.querySelector('#result-export .result-card');
    const questionHistoryCard = document.getElementById('question-history-card');

    scoreDownloadButton?.addEventListener('click', async () => {
        const previousText = scoreDownloadButton.textContent;
        scoreDownloadButton.disabled = true;
        scoreDownloadButton.textContent = 'Generuji…';

        try {
            await exportElementAsPng(
                scoreCard,
                `fraxyho-soutez-vysledek-${new Date().toISOString().slice(0, 10)}.png`
            );
        } catch (error) {
            console.error(error);
            alert('Nepodařilo se stáhnout výsledek.');
        } finally {
            scoreDownloadButton.disabled = false;
            scoreDownloadButton.textContent = previousText;
        }
    });

    answerDownloadButton?.addEventListener(
        'click',
        async (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const previousText = answerDownloadButton.textContent;
            answerDownloadButton.disabled = true;
            answerDownloadButton.textContent = 'Generuji…';
            document.getElementById('result-screen')?.classList.add('exporting');

            try {
                await exportElementAsPng(
                    questionHistoryCard,
                    `fraxyho-soutez-odpovedi-${new Date().toISOString().slice(0, 10)}.png`
                );
            } catch (error) {
                console.error(error);
                alert('Nepodařilo se stáhnout přehled odpovědí.');
            } finally {
                document.getElementById('result-screen')?.classList.remove('exporting');
                answerDownloadButton.disabled = false;
                answerDownloadButton.textContent = previousText;
            }
        },
        true
    );
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupResultDownloads, {
        once: true
    });
} else {
    setupResultDownloads();
}
