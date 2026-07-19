


const el = (id) => document.getElementById(id);

const OLD_PER_NEW = 100;

const state = {
    mode: "pay",
    priceSourceField: null,
};

const inputs = {
    priceOld: el("priceOld"),
    priceNew: el("priceNew"),
    priceUsd: el("priceUsd"),
    priceTry: el("priceTry"),
    priceUsdRate: el("priceUsdRate"),
    priceTryRate: el("priceTryRate"),
    paidOld: el("paidOld"),
    paidNew: el("paidNew"),
    paidUsd: el("paidUsd"),
    paidTry: el("paidTry"),
    usdRate: el("usdRate"),
    tryRate: el("tryRate"),
};

const ui = {
    topReset: el("topReset"),
    resetAll: el("resetAll"),
    settledOld: el("settledOld"),
    settledNew: el("settledNew"),
    resultCard: el("resultCard"),
    balanceBox: el("balanceBox"),
    balanceTitle: el("balanceTitle"),
    balanceOld: el("balanceOld"),
    balanceNew: el("balanceNew"),
    paymentsTitle: el("paymentsTitle"),
    paidOldLabel: el("paidOldLabel"),
    paidNewLabel: el("paidNewLabel"),
    resultTitle: el("resultTitle"),
    mirawareWebsiteLink: el("mirawareWebsiteLink"),

    priceUsdRateChip: el("priceUsdRateChip"),
    priceTryRateChip: el("priceTryRateChip"),
    priceUsdRateBtn: el("priceUsdRateBtn"),
    priceTryRateBtn: el("priceTryRateBtn"),
    priceUsdRatePopover: el("priceUsdRatePopover"),
    priceTryRatePopover: el("priceTryRatePopover"),

    usdRateChip: el("usdRateChip"),
    tryRateChip: el("tryRateChip"),
    usdRateBtn: el("usdRateBtn"),
    tryRateBtn: el("tryRateBtn"),
    usdRatePopover: el("usdRatePopover"),
    tryRatePopover: el("tryRatePopover"),
};

const GROUPED_AMOUNT_FIELDS = [
    "priceOld",
    "priceNew",
    "priceUsd",
    "priceTry",
    "paidOld",
    "paidNew",
    "paidUsd",
    "paidTry",
];

const INPUT_MAX_FONT_SIZE = 24;
const INPUT_MIN_FONT_SIZE = 8;
const RESULT_MAX_FONT_SIZE = 24;
const RESULT_MIN_FONT_SIZE = 8;
const fitCanvas = document.createElement("canvas");
const fitContext = fitCanvas.getContext("2d");
const STORAGE_PREFIX = "syrianCalculator.v1";
const STORAGE_KEYS = {
    usdRate: `${STORAGE_PREFIX}.usdRate`,
    tryRate: `${STORAGE_PREFIX}.tryRate`,
};

const CALC_DECIMALS = 8;
const DISPLAY_DECIMALS = 4;
const USD_TRY_DISPLAY_DECIMALS = 1;
const SETTLEMENT_EPSILON = 1 / (10 ** DISPLAY_DECIMALS * 2);
const MAX_ALLOWED_NUMERIC = Number.MAX_SAFE_INTEGER;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function getRateInputs(which) {
    if (which === "usd") return [inputs.usdRate, inputs.priceUsdRate].filter(Boolean);
    return [inputs.tryRate, inputs.priceTryRate].filter(Boolean);
}

function getRateChips(which) {
    if (which === "usd") return [ui.usdRateChip, ui.priceUsdRateChip].filter(Boolean);
    return [ui.tryRateChip, ui.priceTryRateChip].filter(Boolean);
}

function getRateButtons(which) {
    if (which === "usd") return [ui.usdRateBtn, ui.priceUsdRateBtn].filter(Boolean);
    return [ui.tryRateBtn, ui.priceTryRateBtn].filter(Boolean);
}

function getRatePopovers(which) {
    if (which === "usd") return [ui.usdRatePopover, ui.priceUsdRatePopover].filter(Boolean);
    return [ui.tryRatePopover, ui.priceTryRatePopover].filter(Boolean);
}

function setRateValue(which, rawValue, sourceInput) {
    const text = String(rawValue ?? "").trim();
    const normalized = text ? formatNumericStringWithGrouping(text) : "";
    getRateInputs(which).forEach((node) => {
        if (!node || node === sourceInput) return;
        node.value = normalized;
    });
    if (sourceInput) sourceInput.value = normalized;
}

function getRateRawText(which) {
    const inputsForRate = getRateInputs(which);
    if (!inputsForRate.length) return "";
    const preferred = inputsForRate.find((node) => String(node.value ?? "").trim() !== "");
    return String((preferred || inputsForRate[0]).value ?? "");
}

function getRateNumber(which) {
    return readNonNegativeNumber(getRateRawText(which), CALC_DECIMALS);
}

function roundToDecimals(value, decimals = 2) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** decimals;
    if (!Number.isFinite(factor) || factor <= 0) return 0;
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    return (Math.round((abs + Number.EPSILON) * factor) / factor) * sign;
}

function clampToMax(value, max = MAX_ALLOWED_NUMERIC) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    return Math.min(value, max);
}

function clampSignedMagnitude(value, max = MAX_ALLOWED_NUMERIC) {
    if (!Number.isFinite(value) || value === 0) return 0;
    return Math.sign(value) * Math.min(Math.abs(value), max);
}

function readNonNegativeNumber(value, decimals = CALC_DECIMALS, options = {}) {
    void decimals;
    return clampToMax(toNumber(value, options));
}

function normalizeRawNumericText(rawValue) {
    let text = normalizeDigitsAndSeparators(String(rawValue ?? "")).trim();
    if (!text) return "";
    if (text.startsWith("-")) text = text.slice(1);
    text = normalizeDecimalComma(text, { preserveTrailingDecimal: false });
    text = text.replace(/,/g, "").replace(/[\s_'’`]/g, "");
    const firstDot = text.indexOf(".");
    if (firstDot !== -1) {
        const head = text.slice(0, firstDot + 1);
        const tail = text.slice(firstDot + 1).replace(/\./g, "");
        text = head + tail;
    }
    return text;
}

function hasUnsafeIntegerPrecision(rawValue) {
    const normalized = normalizeRawNumericText(rawValue);
    if (!normalized) return false;
    if (!/^\d*(?:\.\d*)?$/.test(normalized)) return false;

    const integerPart = (normalized.split(".")[0] || "").replace(/\D/g, "");
    const integerDigits = integerPart.replace(/^0+(?=\d)/, "");
    if (!integerDigits) return false;
    if (integerDigits.length < 16) return false;

    try {
        return BigInt(integerDigits) > MAX_SAFE_INTEGER_BIGINT;
    } catch {
        return true;
    }
}

function normalizeIntegerDigits(rawDigits, allowEmpty = false) {
    const digits = String(rawDigits ?? "").replace(/\D/g, "");
    if (!digits) return allowEmpty ? "" : "0";
    const trimmed = digits.replace(/^0+(?=\d)/, "");
    return trimmed || "0";
}

function toNumber(value, options = {}) {
    void options;
    if (value == null) return 0;

    const cleanUnsigned = normalizeRawNumericText(value);
    if (!cleanUnsigned) return 0;

    // Strictly accept decimal numeric input to avoid accidental concatenation
    // when users paste text like "12abc34".
    if (!/^\d*(?:\.\d*)?$/.test(cleanUnsigned)) return 0;
    if (!/[0-9]/.test(cleanUnsigned)) return 0;

    if (hasUnsafeIntegerPrecision(cleanUnsigned)) return Number.NaN;

    const clean = cleanUnsigned;

    const n = Number(clean);
    if (!Number.isFinite(n)) return 0;
    return Math.abs(n) > MAX_ALLOWED_NUMERIC ? Math.sign(n) * MAX_ALLOWED_NUMERIC : n;
}

function format(value) {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString("en-US", {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: DISPLAY_DECIMALS,
    });
}

function normalizeDigitsAndSeparators(text) {
    // Converts Arabic digits and decimal separator to a normalized form.
    return String(text)
        .replace(/،/g, ",")
        .replace(/٫/g, ".")
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function normalizeDecimalComma(
    text,
    { preserveTrailingDecimal = false } = {}
) {
    void preserveTrailingDecimal;

    // Comma is treated strictly as thousands separator.
    // Decimal separator is dot only.
    let t = String(text);

    // Arabic thousands separator is always grouping.
    t = t.replace(/٬/g, "");

    // Support dot-grouping inputs used by some keyboards/locales.
    // Examples:
    // - 15.000   -> 15000 (grouping)
    // - 1.234.567 -> 1234567 (grouping)
    // - 1.5      -> 1.5 (decimal)
    if (t.includes(".") && !t.includes(",")) {
        const dotParts = t.split(".");
        const allPartsDigits = dotParts.every((p) => /^\d+$/.test(p));

        if (
            dotParts.length > 2 &&
            allPartsDigits &&
            dotParts.slice(1).every((p) => p.length === 3)
        ) {
            return dotParts.join("");
        }

        if (
            dotParts.length === 2 &&
            /^\d+$/.test(dotParts[0]) &&
            /^\d+$/.test(dotParts[1]) &&
            dotParts[0].length <= 3 &&
            dotParts[0] !== "0" &&
            dotParts[1].length === 3
        ) {
            return dotParts[0] + dotParts[1];
        }
    }

    // If both separators appear, comma is grouping and dot is decimal.
    if (t.includes(".") && t.includes(",")) {
        return t.replace(/,/g, "");
    }

    // If dot exists alone, it can be either decimal or thousands grouping.
    if (t.includes(".")) {
        // Handle trailing decimal point while typing, e.g. "12.".
        if (/^\d+\.$/.test(t)) return t;
        return t;
    }

    const commaCount = (t.match(/,/g) || []).length;
    if (commaCount === 0) return t;

    // Comma-only inputs are treated as thousands grouping.
    return commaCount > 0 ? t.replace(/,/g, "") : t;
}

function formatNumericStringWithGrouping(raw, options = {}) {
    if (raw == null) return "";
    const original = String(raw);
    if (original.trim() === "") return "";

    let text = normalizeDigitsAndSeparators(original).trim();

    // Amount and rate inputs are non-negative only.
    if (text.startsWith("-")) {
        text = text.slice(1);
    }

    text = normalizeDecimalComma(text, { preserveTrailingDecimal: true });

    // Remove grouping separators.
    text = text.replace(/[٬,]/g, "");

    const hadDot = text.includes(".");
    const endsWithDot = /\.\s*$/.test(text);

    const parts = text.split(".");
    const intDigits = (parts[0] || "").replace(/\D/g, "");
    const fracDigits = (parts[1] || "").replace(/\D/g, "");

    // If user hasn't typed any digits yet, keep as-is (minus handled above).
    if (intDigits.length === 0 && fracDigits.length === 0) return "";

    const normalizedInt = normalizeIntegerDigits(intDigits, !hadDot && fracDigits.length === 0);
    const wholePart = normalizedInt || "0";
    const useGrouping = options.useGrouping !== false;
    const intText = useGrouping ? wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : wholePart;
    if (!hadDot) return intText;
    if (endsWithDot && fracDigits.length === 0) return intText + ".";
    return intText + (fracDigits.length ? "." + fracDigits : "");
}

function setCaretByDigitCount(input, digitCount) {
    if (!input || typeof input.setSelectionRange !== "function") return;
    if (!Number.isFinite(digitCount) || digitCount <= 0) {
        input.setSelectionRange(0, 0);
        return;
    }
    const text = String(input.value || "");
    let seen = 0;
    for (let i = 0; i < text.length; i++) {
        if (/[0-9]/.test(text[i])) {
            seen++;
            if (seen >= digitCount) {
                const pos = i + 1;
                input.setSelectionRange(pos, pos);
                return;
            }
        }
    }
    const end = text.length;
    input.setSelectionRange(end, end);
}

function formatAmountInputLive(input) {
    if (!input) return;
    const raw = String(input.value ?? "");
    const selStart = input.selectionStart ?? raw.length;
    const before = raw.slice(0, selStart);
    const digitCountBefore = (normalizeDigitsAndSeparators(before).match(/[0-9]/g) || []).length;

    const formatted = formatNumericStringWithGrouping(raw);
    if (formatted === raw) return;

    input.value = formatted;
    setCaretByDigitCount(input, digitCountBefore);
}

function fitTextToBox(node, minFontSize, maxFontSize) {
    if (!node || !fitContext) return;

    const text = String(node.value ?? node.textContent ?? "").trim();
    if (!text) {
        node.style.fontSize = `${maxFontSize}px`;
        return;
    }

    const availableWidth = node.clientWidth;
    if (!Number.isFinite(availableWidth) || availableWidth <= 0) return;

    const computed = window.getComputedStyle(node);
    const fontStyle = computed.fontStyle || "normal";
    const fontVariant = computed.fontVariant || "normal";
    const fontWeight = computed.fontWeight || "900";
    const fontFamily = computed.fontFamily || "Segoe UI, Tahoma, Arial, sans-serif";

    let fontSize = maxFontSize;
    while (fontSize > minFontSize) {
        fitContext.font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}px ${fontFamily}`;
        const textWidth = fitContext.measureText(text).width;
        if (textWidth <= availableWidth - 2) break;
        fontSize -= 1;
    }

    node.style.fontSize = `${fontSize}px`;
}

function fitAllAmountInputs() {
    GROUPED_AMOUNT_FIELDS.forEach((id) => {
        const node = inputs[id];
        if (!node) return;
        fitTextToBox(node, INPUT_MIN_FONT_SIZE, INPUT_MAX_FONT_SIZE);
    });
}

function fitResultValues() {
    const values = [ui.settledOld, ui.settledNew, ui.balanceOld, ui.balanceNew];
    values.forEach(node => {
        if (!node) return;
        fitTextToBox(node, RESULT_MIN_FONT_SIZE, RESULT_MAX_FONT_SIZE);
        
        // Add pulse animation
        node.classList.remove("result-pulse");
        void node.offsetWidth; // Trigger reflow
        node.classList.add("result-pulse");
    });
}

function setNeutralResultMessage(message) {
    const resultCard = ui.resultCard;
    if (resultCard) resultCard.classList.remove("status-danger", "status-success", "status-neutral");
    if (resultCard) resultCard.classList.add("status-neutral");
    ui.resultTitle.textContent = message;
    ui.settledNew.textContent = "0";
    ui.settledOld.textContent = "0";
    ui.balanceBox.hidden = true;
    fitResultValues();
}

function getMissingRateMessage(usesUsd, usesTry) {
    if (usesUsd && usesTry) return "أدخل سعر الدولار والتركية أولًا";
    if (usesUsd) return "أدخل سعر الدولار أولًا";
    if (usesTry) return "أدخل سعر التركية أولًا";
    return "";
}

function saveRatesToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.usdRate, String(getRateNumber("usd")));
        localStorage.setItem(STORAGE_KEYS.tryRate, String(getRateNumber("try")));
    } catch {
        // Local storage might be unavailable in some webviews/private modes.
    }
}

function updateRateChips() {
    const usdNum = getRateNumber("usd");
    const tryNum = getRateNumber("try");
    const usdText = usdNum > 0
        ? formatNumericStringWithGrouping(String(roundToDecimals(usdNum, USD_TRY_DISPLAY_DECIMALS)))
        : "غير محدد";
    const tryText = tryNum > 0
        ? formatNumericStringWithGrouping(String(roundToDecimals(tryNum, USD_TRY_DISPLAY_DECIMALS)))
        : "غير محدد";
    getRateChips("usd").forEach((node) => {
        node.textContent = usdText;
    });
    getRateChips("try").forEach((node) => {
        node.textContent = tryText;
    });
}

function loadRatesFromStorage() {
    let usdStored = 0;
    let tryStored = 0;
    try {
        const usdNew = localStorage.getItem(STORAGE_KEYS.usdRate);
        const tryNew = localStorage.getItem(STORAGE_KEYS.tryRate);
        const usdLegacy = localStorage.getItem("usdRate");
        const tryLegacy = localStorage.getItem("tryRate");

        // One-time key migration to keep a single source of truth.
        if (usdNew == null && usdLegacy != null) {
            localStorage.setItem(STORAGE_KEYS.usdRate, usdLegacy);
            localStorage.removeItem("usdRate");
        }
        if (tryNew == null && tryLegacy != null) {
            localStorage.setItem(STORAGE_KEYS.tryRate, tryLegacy);
            localStorage.removeItem("tryRate");
        }

        usdStored = toNumber(localStorage.getItem(STORAGE_KEYS.usdRate));
        tryStored = toNumber(localStorage.getItem(STORAGE_KEYS.tryRate));
    } catch {
        usdStored = 0;
        tryStored = 0;
    }
    // Defaults are in "ليرة جديدة" per 1 unit of currency.
    // If you want to override, edit the inputs directly in the UI.
    const usdValue = usdStored > 0 ? String(usdStored) : "";
    const tryValue = tryStored > 0 ? String(tryStored) : "";
    setRateValue("usd", usdValue);
    setRateValue("try", tryValue);
    updateRateChips();
}

function setPopoverOpen(which, open, targetPopover) {
    const popovers = getRatePopovers(which);
    const buttons = getRateButtons(which);
    const chips = getRateChips(which);

    popovers.forEach((node) => {
        node.hidden = true;
    });
    [...buttons, ...chips].forEach((node) => {
        node.setAttribute("aria-expanded", "false");
    });

    if (!open) return;
    const popover = targetPopover || popovers[0];
    if (!popover) return;
    popover.hidden = false;

    [...buttons, ...chips]
        .filter((node) => node.getAttribute("aria-controls") === popover.id)
        .forEach((node) => node.setAttribute("aria-expanded", "true"));

    const rateInput = popover.querySelector(".rate-popover-input");
    if (rateInput) {
        rateInput.focus();
        if (typeof rateInput.select === "function") rateInput.select();
    }
}

function closeAllPopovers() {
    setPopoverOpen("usd", false);
    setPopoverOpen("try", false);
}

function getTriggerPopover(which, trigger) {
    const popovers = getRatePopovers(which);
    if (!trigger) return popovers[0] || null;
    const popoverId = trigger.getAttribute("aria-controls");
    if (!popoverId) return popovers[0] || null;
    return popovers.find((node) => node.id === popoverId) || popovers[0] || null;
}

function togglePopover(which, trigger, ev) {
    if (ev) ev.stopPropagation();
    const targetPopover = getTriggerPopover(which, trigger);
    const isOpen = Boolean(targetPopover && !targetPopover.hidden);
    closeAllPopovers();
    if (!isOpen) setPopoverOpen(which, true, targetPopover);
}

function isInside(elm, target) {
    if (!elm || !target) return false;
    return elm === target || elm.contains(target);
}

function updateModeUI() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
        const active = btn.dataset.mode === state.mode;
        btn.setAttribute("aria-pressed", String(active));
    });

    const isPay = state.mode === "pay";
    ui.paymentsTitle.textContent = isPay ? "المدفوعات" : "المقبوضات";
    ui.paidOldLabel.textContent = isPay ? "مدفوع قديم 🏛️" : "مقبوض قديم 🏛️";
    ui.paidNewLabel.textContent = isPay ? "مدفوع جديد ✨" : "مقبوض جديد ✨";
}

function hasValue(id) {
    return String(inputs[id]?.value ?? "").trim() !== "";
}

function getBestPriceSourceField() {
    const lockedField = state.priceSourceField;
    if (lockedField && hasValue(lockedField)) return lockedField;
    if (hasValue("priceNew")) return "priceNew";
    if (hasValue("priceOld")) return "priceOld";
    if (hasValue("priceUsd")) return "priceUsd";
    if (hasValue("priceTry")) return "priceTry";
    return null;
}

function syncPriceFromBestSource() {
    const sourceField = getBestPriceSourceField();
    if (!sourceField) return;
    syncPriceFromField(sourceField);
}

function setPriceFieldsFromNew(newValue) {
    if (!(newValue > 0)) {
        inputs.priceOld.value = "";
        inputs.priceNew.value = "";
        inputs.priceUsd.value = "";
        inputs.priceTry.value = "";
        return;
    }

    const usdRate = getRateNumber("usd");
    const tryRate = getRateNumber("try");

    const normalizedNewValue = clampToMax(roundToDecimals(newValue, CALC_DECIMALS));
    const oldValue = clampToMax(roundToDecimals(normalizedNewValue * OLD_PER_NEW, CALC_DECIMALS));
    const usdValue = usdRate > 0
        ? clampToMax(roundToDecimals(normalizedNewValue / usdRate, CALC_DECIMALS))
        : 0;
    const tryValue = tryRate > 0
        ? clampToMax(roundToDecimals(normalizedNewValue / tryRate, CALC_DECIMALS))
        : 0;

    inputs.priceOld.value = formatNumericStringWithGrouping(String(oldValue));
    inputs.priceNew.value = formatNumericStringWithGrouping(String(normalizedNewValue));
    // Round USD and TRY to USD_TRY_DISPLAY_DECIMALS decimals for display
    inputs.priceUsd.value = usdValue > 0 ? formatNumericStringWithGrouping(String(roundToDecimals(usdValue, USD_TRY_DISPLAY_DECIMALS))) : "";
    inputs.priceTry.value = tryValue > 0 ? formatNumericStringWithGrouping(String(roundToDecimals(tryValue, USD_TRY_DISPLAY_DECIMALS))) : "";

}

function syncPriceFromField(sourceField) {
    if (hasUnsafeIntegerPrecision(inputs[sourceField].value)) {
        setNeutralResultMessage("الرقم كبير جدًا لهذه الدقة، خفّف عدد الخانات");
        return;
    }

    state.priceSourceField = sourceField;
    const usdRate = getRateNumber("usd");
    const tryRate = getRateNumber("try");
    const sourceValue = readNonNegativeNumber(inputs[sourceField].value);

    let newValue = 0;
    if (sourceField === "priceOld") {
        newValue = sourceValue / OLD_PER_NEW;
    } else if (sourceField === "priceNew") {
        newValue = sourceValue;
    } else if (sourceField === "priceUsd") {
        if (!(usdRate > 0)) {
            inputs.priceOld.value = "";
            inputs.priceNew.value = "";
            inputs.priceTry.value = "";
            return;
        }
        newValue = sourceValue * usdRate;
    } else if (sourceField === "priceTry") {
        if (!(tryRate > 0)) {
            inputs.priceOld.value = "";
            inputs.priceNew.value = "";
            inputs.priceUsd.value = "";
            return;
        }
        newValue = sourceValue * tryRate;
    }

    setPriceFieldsFromNew(newValue);
}
function recalc() {
    const unsafeField = GROUPED_AMOUNT_FIELDS.find((id) => hasUnsafeIntegerPrecision(inputs[id]?.value));
    if (unsafeField) {
        setNeutralResultMessage("الرقم كبير جدًا لهذه الدقة، خفّف عدد الخانات");
        return;
    }

    const usdRate = getRateNumber("usd");
    const tryRate = getRateNumber("try");
    const priceUsd = readNonNegativeNumber(inputs.priceUsd.value);
    const priceTry = readNonNegativeNumber(inputs.priceTry.value);
    const paidUsd = readNonNegativeNumber(inputs.paidUsd.value);
    const paidTry = readNonNegativeNumber(inputs.paidTry.value);

    const usesUsdWithoutRate = (priceUsd > 0 || paidUsd > 0) && !(usdRate > 0);
    const usesTryWithoutRate = (priceTry > 0 || paidTry > 0) && !(tryRate > 0);
    if (usesUsdWithoutRate || usesTryWithoutRate) {
        setNeutralResultMessage(getMissingRateMessage(usesUsdWithoutRate, usesTryWithoutRate));
        return;
    }

    const priceNew = readNonNegativeNumber(inputs.priceNew.value);

    if (!(priceNew > 0)) {
        setNeutralResultMessage("أدخل سعر الخدمة أولًا");
        return;
    }

    const paidOldAsNew = readNonNegativeNumber(inputs.paidOld.value) / OLD_PER_NEW;
    const paidNew = readNonNegativeNumber(inputs.paidNew.value);
    const paidUsdRounded = roundToDecimals(paidUsd, USD_TRY_DISPLAY_DECIMALS);
    const paidTryRounded = roundToDecimals(paidTry, USD_TRY_DISPLAY_DECIMALS);
    const paidUsdAsNew = paidUsdRounded * usdRate;
    const paidTryAsNew = paidTryRounded * tryRate;


    const totalPaidNew = clampToMax(paidOldAsNew + paidNew + paidUsdAsNew + paidTryAsNew);
    const diffNewRaw = clampSignedMagnitude(priceNew - totalPaidNew);
    const diffNew = roundToDecimals(diffNewRaw, CALC_DECIMALS);

    const resultCard = ui.resultCard;
    if (resultCard) resultCard.classList.remove("status-danger", "status-success", "status-neutral");

    const isSettled = Math.abs(diffNew) < SETTLEMENT_EPSILON;
    if (isSettled) {
        if (resultCard) resultCard.classList.add("status-neutral");
        ui.resultTitle.textContent = "تم التسديد";
        ui.settledNew.textContent = "0";
        ui.settledOld.textContent = "0";
        ui.balanceBox.hidden = true;
        fitResultValues();
        return;
    }

    const isRemaining = diffNew > 0;
    const isPay = state.mode === "pay";

    let title = "";
    let statusClass = "status-neutral";

    if (isPay) {
        if (isRemaining) {
            title = "المبلغ المتبقي للدفع";
            statusClass = "status-danger";
        } else {
            title = "المبلغ الباقي لك";
            statusClass = "status-success";
        }
    } else {
        if (isRemaining) {
            title = "المبلغ المتبقي للقبض";
            statusClass = "status-success";
        } else {
            title = "المبلغ الواجب إعادته";
            statusClass = "status-danger";
        }
    }

    if (resultCard) resultCard.classList.add(statusClass);
    ui.resultTitle.textContent = title;

    ui.balanceBox.hidden = true;

    const balanceNew = roundToDecimals(Math.abs(diffNew), DISPLAY_DECIMALS);
    const balanceOld = roundToDecimals(balanceNew * OLD_PER_NEW, DISPLAY_DECIMALS);
    ui.settledNew.textContent = format(balanceNew);
    ui.settledOld.textContent = format(balanceOld);
    fitResultValues();
}

function resetAllFields() {
    state.priceSourceField = null;
    inputs.priceOld.value = "";
    inputs.priceNew.value = "";
    inputs.priceUsd.value = "";
    inputs.priceTry.value = "";
    inputs.paidOld.value = "";
    inputs.paidNew.value = "";
    inputs.paidUsd.value = "";
    inputs.paidTry.value = "";
    closeAllPopovers();
    fitAllAmountInputs();
    recalc();
}

function toLocalArabicTime(utcText) {
    if (!utcText) return "";
    const date = new Date(utcText);
    if (Number.isNaN(date.getTime())) return utcText;
    return date.toLocaleString("ar-SY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function bindAmountFieldFormatting() {
    const fieldsToBind = [
        ...GROUPED_AMOUNT_FIELDS,
        "usdRate",
        "tryRate",
        "priceUsdRate",
        "priceTryRate"
    ];
    fieldsToBind.forEach((id) => {
        const node = inputs[id];
        if (!node) return;
        const isUsdTry = id.toLowerCase().includes("usd") || id.toLowerCase().includes("try");
        const decimals = isUsdTry ? USD_TRY_DISPLAY_DECIMALS : DISPLAY_DECIMALS;

        const handleBlurOrChange = () => {
            const val = readNonNegativeNumber(node.value);
            if (val > 0) {
                node.value = String(roundToDecimals(val, decimals));
            }
            formatAmountInputLive(node);
            fitTextToBox(node, INPUT_MIN_FONT_SIZE, INPUT_MAX_FONT_SIZE);
        };

        node.addEventListener("blur", handleBlurOrChange);
        node.addEventListener("change", handleBlurOrChange);
    });
}

function bindEvents() {
    // Theme Toggle Logic
    const themeToggle = el("themeToggle");
    const sunIcon = themeToggle.querySelector(".sun-icon");
    const moonIcon = themeToggle.querySelector(".moon-icon");

    themeToggle.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-mode");
        sunIcon.style.display = isDark ? "none" : "block";
        moonIcon.style.display = isDark ? "block" : "none";
        localStorage.setItem("theme", isDark ? "dark" : "light");
    });

    // Load saved theme
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        sunIcon.style.display = "none";
        moonIcon.style.display = "block";
    }

    if (ui.mirawareWebsiteLink) {
        ui.mirawareWebsiteLink.addEventListener("click", (ev) => {
            ev.preventDefault();
            const url = "https://www.miraware.net/";

            // Prefer external browser in hybrid runtimes, then fallback.
            if (window?.cordova?.InAppBrowser?.open) {
                window.cordova.InAppBrowser.open(url, "_system");
                return;
            }

            const popup = window.open(url, "_blank", "noopener,noreferrer");
            if (!popup) {
                window.location.href = url;
            }
        });
    }

    document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            state.mode = btn.dataset.mode;
            updateModeUI();
            recalc();
        });
    });

    [inputs.priceOld, inputs.priceNew, inputs.priceUsd, inputs.priceTry].forEach((field) => {
        field.addEventListener("input", () => {
            formatAmountInputLive(field);
            syncPriceFromField(field.id);
            fitAllAmountInputs();
            recalc();
        });
    });

    [inputs.paidOld, inputs.paidNew, inputs.paidUsd, inputs.paidTry].forEach((field) => {
        field.addEventListener("input", () => {
            formatAmountInputLive(field);
            fitTextToBox(field, INPUT_MIN_FONT_SIZE, INPUT_MAX_FONT_SIZE);
            recalc();
        });
    });

    [inputs.usdRate, inputs.tryRate, inputs.priceUsdRate, inputs.priceTryRate].forEach((field) => {
        if (!field) return;
        field.addEventListener("input", () => {
            const which = field.id.toLowerCase().includes("usd") ? "usd" : "try";
            setRateValue(which, field.value, field);
            updateRateChips();
            saveRatesToStorage();
            syncPriceFromBestSource();
            fitAllAmountInputs();
            recalc();
        });
    });

    [...getRateButtons("usd"), ...getRateChips("usd")].forEach((node) => {
        node.addEventListener("click", (ev) => togglePopover("usd", node, ev));
    });
    [...getRateButtons("try"), ...getRateChips("try")].forEach((node) => {
        node.addEventListener("click", (ev) => togglePopover("try", node, ev));
    });

    document.addEventListener("click", (ev) => {
        const t = ev.target;
        const interactiveNodes = [
            ...getRatePopovers("usd"),
            ...getRatePopovers("try"),
            ...getRateButtons("usd"),
            ...getRateButtons("try"),
            ...getRateChips("usd"),
            ...getRateChips("try"),
            ...getRateInputs("usd"),
            ...getRateInputs("try"),
        ];
        if (interactiveNodes.some((node) => isInside(node, t))) {
            return;
        }
        closeAllPopovers();
    });

    document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") closeAllPopovers();
    });

    [ui.topReset, ui.resetAll].filter(Boolean).forEach((button) => {
        button.addEventListener("click", resetAllFields);
    });

    window.addEventListener("resize", () => {
        fitAllAmountInputs();
        fitResultValues();
    });

}

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
        await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (err) {
        // Keep failure visible during release validation and QA.
        console.warn("Service Worker registration failed", err);
    }
}

function init() {
    loadRatesFromStorage();
    bindAmountFieldFormatting();
    bindEvents();
    fitAllAmountInputs();
    updateModeUI();
    recalc();
    registerServiceWorker();
}

init();
