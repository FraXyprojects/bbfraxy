(() => {
  const form = document.getElementById("dp-form");
  const outputSection = document.getElementById("dp-output-section");
  const outputEl = document.getElementById("dp-output");
  const previewEl = document.getElementById("dp-preview-text");
  const copyBtn = document.getElementById("dp-copy-btn");

  // Modal elements
  const modal = document.getElementById("dp-vote-modal");
  const modalTypeSelect = document.getElementById("dp-modal-type");
  const modalOptions = document.getElementById("dp-modal-options");
  const modalAddBtn = document.getElementById("dp-modal-add");
  const modalCancelBtn = document.getElementById("dp-modal-cancel");
  const modalSaveBtn = document.getElementById("dp-modal-save");

  const voteDateBtn = document.getElementById("dp-vote-date-btn");
  const voteTimeBtn = document.getElementById("dp-vote-time-btn");

  const inputDate = document.getElementById("dp-date");
  const inputTime = document.getElementById("dp-time");
  const hiddenVoteData = document.getElementById("dp-vote-data-hidden");

  let currentVoteData = null; // null | { type: 'dates' | 'times' | 'combined', options: string[] }

  const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const EMOJI_LETTERS = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Format to "D. M. YYYY" which is common in Czech
    return new Intl.DateTimeFormat('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const parseToDiscordHTML = (markdown) => {
    let html = markdown
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") // escape
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // bold
      .replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        const cleanUrl = url.trim();
        // Allow only safe protocols
        if (/^https?:|^mailto:/i.test(cleanUrl) || cleanUrl.startsWith('/')) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return `[${text}](${url})`; // fallback to text for unsafe URLs
      }) // links
      .replace(/\n/g, "<br>"); // new lines

    // Replace @based with a styled mention lookalike
    html = html.replace(/@based/g, '<span style="background: rgba(88, 101, 242, 0.3); color: #c9cdfb; border-radius: 3px; padding: 0 2px;">@based</span>');

    return html;
  };

  const generateMarkdown = (data) => {
    const t = window.BBFRAXY_I18N ? window.BBFRAXY_I18N.translate : (k) => k.split('.').pop();
    const title = data.title ? `🎉 **${data.title}** 🎉` : `🎉 **Discord Party: ${data.game}** 🎉`;
    let markdown = `${title}\n\n`;

    // Voting or Fixed Date/Time
    if (data.voteData) {
      if (data.voteData.type === 'dates') {
        markdown += `📅 **${t("tools.discordParty.md.whichDay") || "Který den se to hodí nejvíc?"}**\n`;
        data.voteData.options.forEach((opt, idx) => {
          const emoji = EMOJI_NUMBERS[idx % EMOJI_NUMBERS.length];
          markdown += `${emoji} ${formatDate(opt)}\n`;
        });
        markdown += `\n⏰ **${t("tools.discordParty.md.time") || "Čas:"}** ${data.time}\n`;
      } else if (data.voteData.type === 'times') {
        markdown += `📅 **${t("tools.discordParty.md.date") || "Datum:"}** ${formatDate(data.date)}\n`;
        markdown += `⏰ **${t("tools.discordParty.md.whatTime") || "V kolik hodin to odpálíme?"}**\n`;
        data.voteData.options.forEach((opt, idx) => {
          const emoji = EMOJI_LETTERS[idx % EMOJI_LETTERS.length];
          markdown += `${emoji} ${opt}\n`;
        });
      } else if (data.voteData.type === 'combined') {
        markdown += `📅 **${t("tools.discordParty.md.when") || "Kdy to odpálíme?"}**\n`;
        data.voteData.options.forEach((opt, idx) => {
          const emoji = EMOJI_NUMBERS[idx % EMOJI_NUMBERS.length];
          markdown += `${emoji} ${formatDate(opt.date)} v ${opt.time}\n`;
        });
      }
      markdown += `*(${t("tools.discordParty.md.voteDesc") || "Hlasujte pomocí reakcí pod zprávou"})*\n`;
    } else {
      markdown += `📅 **${t("tools.discordParty.md.date") || "Datum:"}** ${formatDate(data.date)}\n`;
      markdown += `⏰ **${t("tools.discordParty.md.time") || "Čas:"}** ${data.time}\n`;
    }

    markdown += `\n🎲 **${t("tools.discordParty.md.game") || "Hra:"}** ${data.game}\n`;

    if (data.place) {
      const isUrl = data.place.startsWith('http://') || data.place.startsWith('https://');
      if (isUrl) {
        markdown += `📍 **${t("tools.discordParty.md.where") || "Kde:"}** [${t("tools.discordParty.md.clickToJoin") || "Klikni pro připojení"}](${data.place})\n`;
      } else {
        markdown += `📍 **${t("tools.discordParty.md.where") || "Kde:"}** ${data.place}\n`;
      }
    }

    if (data.notes) {
      markdown += `ℹ️ **${t("tools.discordParty.md.info") || "Info:"}** ${data.notes}\n`;
    }

    markdown += `\n@based`;

    return markdown;
  };

  // --- Modal Logic ---

  const createOptionRow = (type, values = {}) => {
    const row = document.createElement("div");
    row.className = "dp-modal-option";

    if (type === 'dates') {
      row.innerHTML = `
        <div class="dp-modal-option-inputs">
          <input class="dp-input" type="date" value="${values.date || ''}" required>
        </div>
        <button type="button" class="dp-modal-option-remove" aria-label="Remove">×</button>
      `;
    } else if (type === 'times') {
      row.innerHTML = `
        <div class="dp-modal-option-inputs">
          <input class="dp-input" type="time" value="${values.time || '20:00'}" required>
        </div>
        <button type="button" class="dp-modal-option-remove" aria-label="Remove">×</button>
      `;
    } else if (type === 'combined') {
      row.innerHTML = `
        <div class="dp-modal-option-inputs">
          <input class="dp-input" type="date" value="${values.date || ''}" required>
          <input class="dp-input" type="time" value="${values.time || '20:00'}" required>
        </div>
        <button type="button" class="dp-modal-option-remove" aria-label="Remove">×</button>
      `;
    }

    row.querySelector(".dp-modal-option-remove").addEventListener("click", () => {
      row.remove();
    });

    return row;
  };

  const populateModal = () => {
    modalOptions.innerHTML = "";
    const type = modalTypeSelect.value;

    if (currentVoteData && currentVoteData.type === type) {
      currentVoteData.options.forEach(opt => {
        if (type === 'dates') modalOptions.appendChild(createOptionRow(type, { date: opt }));
        if (type === 'times') modalOptions.appendChild(createOptionRow(type, { time: opt }));
        if (type === 'combined') modalOptions.appendChild(createOptionRow(type, { date: opt.date, time: opt.time }));
      });
    } else {
      // Add default two options
      modalOptions.appendChild(createOptionRow(type));
      modalOptions.appendChild(createOptionRow(type));
    }
  };

  const openModal = (defaultType) => {
    modalTypeSelect.value = defaultType;
    populateModal();
    modal.classList.add("is-visible");
  };

  const closeModal = () => {
    modal.classList.remove("is-visible");
  };

  const syncUIState = () => {
    voteDateBtn.classList.remove("active");
    voteTimeBtn.classList.remove("active");
    inputDate.disabled = false;
    inputTime.disabled = false;

    if (!currentVoteData) return;

    if (currentVoteData.type === 'dates') {
      voteDateBtn.classList.add("active");
      inputDate.disabled = true;
    } else if (currentVoteData.type === 'times') {
      voteTimeBtn.classList.add("active");
      inputTime.disabled = true;
    } else if (currentVoteData.type === 'combined') {
      voteDateBtn.classList.add("active");
      voteTimeBtn.classList.add("active");
      inputDate.disabled = true;
      inputTime.disabled = true;
    }
  };

  modalTypeSelect.addEventListener("change", populateModal);

  modalAddBtn.addEventListener("click", () => {
    modalOptions.appendChild(createOptionRow(modalTypeSelect.value));
  });

  modalCancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  modalSaveBtn.addEventListener("click", () => {
    const type = modalTypeSelect.value;
    const rows = modalOptions.querySelectorAll(".dp-modal-option");
    let options = [];
    let isValid = true;

    rows.forEach(row => {
      if (type === 'dates') {
        const val = row.querySelector("input[type='date']").value;
        if (!val) isValid = false;
        options.push(val);
      } else if (type === 'times') {
        const val = row.querySelector("input[type='time']").value;
        if (!val) isValid = false;
        options.push(val);
      } else if (type === 'combined') {
        const dateVal = row.querySelectorAll("input")[0].value;
        const timeVal = row.querySelectorAll("input")[1].value;
        if (!dateVal || !timeVal) isValid = false;
        options.push({ date: dateVal, time: timeVal });
      }
    });

    if (!isValid || options.length === 0) {
      alert(window.BBFRAXY_I18N ? window.BBFRAXY_I18N.translate("tools.discordParty.alertFillAll") : "Vyplňte prosím všechna políčka v hlasování.");
      return;
    }

    currentVoteData = { type, options };
    syncUIState();
    closeModal();
  });

  // Un-vote
  voteDateBtn.addEventListener("click", () => {
    if (currentVoteData && (currentVoteData.type === 'dates' || currentVoteData.type === 'combined')) {
      currentVoteData = null;
      syncUIState();
    } else {
      openModal('dates');
    }
  });

  voteTimeBtn.addEventListener("click", () => {
    if (currentVoteData && (currentVoteData.type === 'times' || currentVoteData.type === 'combined')) {
      currentVoteData = null;
      syncUIState();
    } else {
      openModal('times');
    }
  });


  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = {
      title: document.getElementById("dp-title").value.trim(),
      date: document.getElementById("dp-date").value,
      time: document.getElementById("dp-time").value,
      place: document.getElementById("dp-place").value.trim(),
      game: document.getElementById("dp-game").value,
      notes: document.getElementById("dp-notes").value.trim(),
      voteData: currentVoteData
    };

    const markdown = generateMarkdown(data);

    // Raw markdown hidden for clipboard
    outputEl.textContent = markdown;
    // Discord Preview visual rendering
    previewEl.innerHTML = parseToDiscordHTML(markdown);

    outputSection.classList.add("is-visible");

    // Reset copy button if it was in copied state
    copyBtn.classList.remove("copied");

    // Use the translation system to reset text if available, fallback to basic text
    if (window.BBFRAXY_I18N) {
      copyBtn.textContent = window.BBFRAXY_I18N.translate("tools.discordParty.copyBtn");
    } else {
      copyBtn.textContent = "Kopírovat kód pro Discord";
    }
  });

  copyBtn.addEventListener("click", async () => {
    const textToCopy = outputEl.textContent;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      copyBtn.classList.add("copied");

      if (window.BBFRAXY_I18N) {
        copyBtn.textContent = window.BBFRAXY_I18N.translate("tools.discordParty.copiedBtn");
      } else {
        copyBtn.textContent = "Zkopírováno!";
      }

      setTimeout(() => {
        copyBtn.classList.remove("copied");
        if (window.BBFRAXY_I18N) {
          copyBtn.textContent = window.BBFRAXY_I18N.translate("tools.discordParty.copyBtn");
        } else {
          copyBtn.textContent = "Kopírovat do schránky";
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  });
})();
