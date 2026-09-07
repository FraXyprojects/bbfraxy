(() => {
  const form = document.getElementById("dp-form");
  const outputSection = document.getElementById("dp-output-section");
  const outputEl = document.getElementById("dp-output");
  const copyBtn = document.getElementById("dp-copy-btn");

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

  const generateMarkdown = (data) => {
    const title = data.title ? `🎉 **${data.title}** 🎉` : `🎉 **Discord Party: ${data.game}** 🎉`;
    const formattedDate = formatDate(data.date);

    let markdown = `${title}\n`;
    markdown += `📅 **Datum:** ${formattedDate}\n`;
    markdown += `⏰ **Čas:** ${data.time}\n`;
    markdown += `🎲 **Hra:** ${data.game}\n`;

    if (data.notes) {
      markdown += `ℹ️ **Info:** ${data.notes}\n`;
    }

    markdown += `\n@based`;

    return markdown;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = {
      title: document.getElementById("dp-title").value.trim(),
      date: document.getElementById("dp-date").value,
      time: document.getElementById("dp-time").value,
      game: document.getElementById("dp-game").value,
      notes: document.getElementById("dp-notes").value.trim()
    };

    const markdown = generateMarkdown(data);

    outputEl.textContent = markdown;
    outputSection.classList.add("is-visible");

    // Reset copy button if it was in copied state
    copyBtn.classList.remove("copied");

    // Use the translation system to reset text if available, fallback to basic text
    if (window.BBFRAXY_I18N) {
      copyBtn.textContent = window.BBFRAXY_I18N.translate("tools.discordParty.copyBtn");
    } else {
      copyBtn.textContent = "Kopírovat do schránky";
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
