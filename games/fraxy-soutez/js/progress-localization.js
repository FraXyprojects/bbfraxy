const countryNamesCs = {
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

const progressList = document.getElementById('remaining-countries');

if (progressList) {
    const localizeProgressList = () => {
        const items = Array.from(progressList.children);

        items.forEach((item) => {
            const key = item.dataset.countryKey || item.textContent.trim();
            const localizedName = countryNamesCs[key];

            if (!localizedName) {
                return;
            }

            item.dataset.countryKey = key;
            item.textContent = localizedName;
        });

        items.sort((a, b) =>
            a.textContent.localeCompare(b.textContent, 'cs-CZ', {
                sensitivity: 'base'
            })
        );

        for (const item of items) {
            progressList.appendChild(item);
        }
    };

    const observer = new MutationObserver(localizeProgressList);

    observer.observe(progressList, {
        childList: true
    });

    localizeProgressList();
}
