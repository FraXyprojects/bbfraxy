const state = {
  players: null,
  time: null,
  platform: null,
  tags: new Set(),
};

const resultNote = document.createElement("div");
resultNote.className = "coop-result-note";
resultNote.hidden = true;
resultNote.innerHTML = `
  <strong>Matching engine coming next.</strong>
  Your preferences are ready — the game database and recommendation scoring will use them here.
`;

document.querySelector(".coop-card")?.append(resultNote);

for (const group of document.querySelectorAll("[data-group]")) {
  const groupName = group.dataset.group;

  group.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;

    if (groupName === "tags") {
      const value = button.dataset.value;
      if (state.tags.has(value)) {
        state.tags.delete(value);
        button.classList.remove("is-selected");
      } else {
        state.tags.add(value);
        button.classList.add("is-selected");
      }
      return;
    }

    for (const sibling of group.querySelectorAll("button[data-value]")) {
      sibling.classList.toggle("is-selected", sibling === button);
    }

    state[groupName] = button.dataset.value;
  });
}

document.querySelector("#find-games")?.addEventListener("click", () => {
  resultNote.hidden = false;
  resultNote.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
