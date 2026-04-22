const MAX_SCENARIOS = 4;
const DEBOUNCE_MS = 100;

const addScenarioBtn = document.getElementById("add-scenario-btn");
const resetBtn = document.getElementById("reset-btn");
const scenarioList = document.getElementById("scenario-list");
const scenarioTemplate = document.getElementById("scenario-template");

const defaultScenario = () => ({
  target: 120000,
  apr: 2.2,
  cashbackRate: 1.5,
  months: 12,
});

let scenarios = [defaultScenario(), defaultScenario()];
let debounceTimer = null;

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
};

const normalizeInput = (raw) => {
  const target = toFiniteNumber(raw.target);
  const apr = toFiniteNumber(raw.apr);
  const cashbackRate = toFiniteNumber(raw.cashbackRate);
  const months = Math.floor(toFiniteNumber(raw.months));

  return {
    target,
    apr,
    cashbackRate,
    months,
    valid:
      target > 0 &&
      apr >= 0 &&
      cashbackRate >= 0 &&
      Number.isInteger(months) &&
      months > 0,
  };
};

function calcScenario(target, apr, cashbackRate, months) {
  const r = apr / 12 / 100;
  const monthlyDeposit = target / months;
  const futureValue =
    r === 0
      ? monthlyDeposit * months
      : monthlyDeposit * ((((1 + r) ** months - 1) / r) * (1 + r));
  const interestEarned = futureValue - target;
  const cashback = target * (cashbackRate / 100);
  const endIncome = interestEarned + cashback;

  return {
    monthlyDeposit,
    futureValue,
    interestEarned,
    cashback,
    endIncome,
  };
}

const money = (value) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);

const bestScenarioIndexes = (calculatedRows) => {
  if (!calculatedRows.length) return new Set();

  const maxIncome = Math.max(...calculatedRows.map((row) => row.endIncome));
  const incomeCandidates = calculatedRows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => Math.abs(row.endIncome - maxIncome) < 1e-8);

  if (incomeCandidates.length === 1)
    return new Set([incomeCandidates[0].index]);

  const maxFv = Math.max(...incomeCandidates.map((row) => row.futureValue));
  const winners = incomeCandidates
    .filter((row) => Math.abs(row.futureValue - maxFv) < 1e-8)
    .map((row) => row.index);

  return new Set(winners);
};

function updateButtons() {
  addScenarioBtn.disabled = scenarios.length >= MAX_SCENARIOS;
  resetBtn.disabled = scenarios.length === 0;
}

function updateScenarioField(index, field, value) {
  scenarios[index] = {
    ...scenarios[index],
    [field]: value,
  };
  scheduleUpdate();
}

function removeScenario(index) {
  scenarios.splice(index, 1);
  if (scenarios.length === 0) {
    scenarios.push(defaultScenario());
  }
  fullRender();
}

function addScenario() {
  if (scenarios.length >= MAX_SCENARIOS) return;
  scenarios.push(defaultScenario());
  fullRender();
}

function resetScenarios() {
  scenarios = [defaultScenario(), defaultScenario()];
  fullRender();
}

function scheduleUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateComputedAndUI, DEBOUNCE_MS);
}

function computeRows() {
  const normalized = scenarios.map((item) => normalizeInput(item));
  const calculatedRows = normalized.map((item) =>
    item.valid
      ? calcScenario(item.target, item.apr, item.cashbackRate, item.months)
      : null
  );
  const rankInput = calculatedRows.reduce((acc, row, index) => {
    if (row) acc.push({ ...row, index });
    return acc;
  }, []);
  const winners = bestScenarioIndexes(rankInput);

  return { calculatedRows, winners };
}

function updateComputedAndUI() {
  const { calculatedRows, winners } = computeRows();

  const cards = Array.from(scenarioList.querySelectorAll(".scenario-card"));
  cards.forEach((card, index) => {
    const titleEl = card.querySelector(".scenario-title");
    const badgeEl = card.querySelector(".best-badge");
    const removeBtn = card.querySelector(".remove-btn");

    titleEl.textContent = `狀況 ${index + 1}`;
    removeBtn.disabled = scenarios.length <= 1;

    const isBest = winners.has(index);
    card.classList.toggle("is-best", isBest);
    badgeEl.hidden = !isBest;

    const row = calculatedRows[index];
    const outputs = {
      monthlyDeposit: "-",
      interestEarned: "-",
      cashback: "-",
      endIncome: "-",
    };

    if (row) {
      outputs.monthlyDeposit = money(row.monthlyDeposit);
      outputs.interestEarned = money(row.interestEarned);
      outputs.cashback = money(row.cashback);
      outputs.endIncome = money(row.endIncome);
    }

    Object.entries(outputs).forEach(([key, value]) => {
      const outputEl = card.querySelector(`[data-result="${key}"]`);
      outputEl.textContent = value;
    });
  });

  updateButtons();
}

function fullRender() {
  clearTimeout(debounceTimer);
  scenarioList.innerHTML = "";

  scenarios.forEach((scenario, index) => {
    const clone = scenarioTemplate.content.cloneNode(true);
    const card = clone.querySelector(".scenario-card");
    const removeBtn = clone.querySelector(".remove-btn");

    const fields = clone.querySelectorAll("input[data-field]");
    fields.forEach((inputEl) => {
      const field = inputEl.dataset.field;
      inputEl.value = scenario[field];
      inputEl.addEventListener("input", (event) =>
        updateScenarioField(index, field, event.target.value)
      );
    });

    removeBtn.addEventListener("click", () => removeScenario(index));

    scenarioList.appendChild(card);
  });

  updateComputedAndUI();
}

addScenarioBtn.addEventListener("click", addScenario);
resetBtn.addEventListener("click", resetScenarios);

fullRender();
