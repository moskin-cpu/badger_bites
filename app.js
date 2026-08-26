"use strict";

const LOVE_OPTIONS = [
  ["spicy", "🌶️", "Spicy food"], ["protein", "🍗", "High protein"],
  ["global", "🌏", "Global flavors"], ["vegetables", "🥦", "Vegetables"],
  ["comfort", "🍕", "Comfort food"], ["lighter", "🥗", "Lighter meals"],
];
const CUISINES = ["Italian", "Mexican", "Asian", "Chinese", "Japanese", "Indian", "Mediterranean", "American"];
const ALLERGENS = ["dairy", "egg", "fish", "peanut", "sesame", "shellfish", "soy", "tree-nuts", "wheat"];
const ALLERGEN_LABELS = { dairy:"Dairy", egg:"Egg", fish:"Fish", peanut:"Peanuts", sesame:"Sesame", shellfish:"Shellfish", soy:"Soy", "tree-nuts":"Tree nuts", wheat:"Wheat" };
const DEFAULT_PREFERENCES = {
  loves:["spicy", "protein", "global", "vegetables"],
  cuisines:["Italian", "Mexican", "Asian", "Chinese", "Japanese"],
  likedDishes:["sushi"], dislikedDishes:["spaghetti and meatballs"], avoids:[], diet:"none",
};
const CUISINE_PATTERNS = {
  Italian:/pizza|pasta|pesto|lasagna|ravioli|cavatappi|marinara|parmesan|alfredo|italian/i,
  Mexican:/taco|quesadilla|salsa|burrito|fajita|enchilada|queso|carnitas|mexican|que rico/i,
  Asian:/asian|korean|kimchi|bulgogi|thai|pad thai|vietnamese|pho|banh mi|satay|laksa/i,
  Chinese:/chinese|stir.?fry|fried rice|lo mein|chow mein|kung pao|mapo|dumpling|wonton|szechuan|sesame chicken/i,
  Japanese:/japanese|teriyaki|ramen|sushi|udon|soba|tempura|katsu|miso|yakisoba/i,
  Indian:/tandoori|curry|masala|biryani|naan|indian/i,
  Mediterranean:/mediterranean|falafel|hummus|gyro|pita|tzatziki/i,
  American:/burger|sandwich|mac|fries|barbecue|bbq|chili dog|american/i,
};

const state = {
  data:null, date:"", meal:"lunch", expanded:null,
  preferences:structuredClone(DEFAULT_PREFERENCES),
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const titleCase = (value) => value === "none" ? "No restriction" : value.charAt(0).toUpperCase() + value.slice(1);

function itemText(item) { return `${item.name} ${item.description || ""} ${item.section || ""}`; }
function loveMatch(item, love) {
  const text = itemText(item).toLowerCase();
  if (love === "protein") return (item.protein || 0) >= 18 || /chicken|beef|turkey|tuna|tofu|egg|pork/.test(text);
  if (love === "spicy") return /spicy|chili|tandoori|curry|buffalo|cajun|pepper|jerk/.test(text);
  if (love === "global") return /curry|tandoori|teriyaki|island|mediterranean|taco|quesadilla|masala|kimchi|pesto/.test(text);
  if (love === "vegetables") return /vegetable|veggie|cauliflower|mushroom|salad|squash|okra|tomato|greens|carrot/.test(text);
  if (love === "comfort") return /pizza|burger|sandwich|mac|cheese|waffle|fries|pasta/.test(text);
  return /salad|fruit|grilled|vegetable|greens|grain|tofu/.test(text) || (item.calories != null && item.calories < 350);
}

function scoreLocation(location) {
  const items = location.menus?.[state.date]?.[state.meal] || [];
  const { preferences } = state;
  const safeItems = items.filter((item) => {
    if (preferences.diet !== "none" && !(item.traits || []).includes(preferences.diet)) return false;
    if ((item.allergens || []).some((allergen) => preferences.avoids.includes(allergen))) return false;
    return !preferences.dislikedDishes.some((dish) => item.name.toLowerCase().includes(dish.toLowerCase()));
  });
  const scoredItems = safeItems.map((item) => {
    const text = itemText(item);
    const lovePoints = preferences.loves.reduce((sum, love) => sum + (loveMatch(item, love) ? 1 : 0), 0);
    const cuisinePoints = preferences.cuisines.reduce((sum, cuisine) => sum + (CUISINE_PATTERNS[cuisine]?.test(text) ? 2 : 0), 0);
    const dishPoints = preferences.likedDishes.reduce((sum, dish) => sum + (item.name.toLowerCase().includes(dish.toLowerCase()) ? 4 : 0), 0);
    return { item, points:lovePoints + cuisinePoints + dishPoints };
  }).sort((a, b) => b.points - a.points || (b.item.protein || 0) - (a.item.protein || 0));
  const loveHits = scoredItems.reduce((sum, entry) => sum + entry.points, 0);
  const score = safeItems.length ? Math.min(99, 54 + Math.min(14, safeItems.length) * 2 + Math.min(17, loveHits) * 2 + (preferences.diet !== "none" ? 4 : 0)) : 18;
  return { ...location, items, safeItems, scoredItems, score, excluded:items.length - safeItems.length };
}

function prettyDate(value) {
  return new Intl.DateTimeFormat("en-US", { weekday:"long", month:"long", day:"numeric" }).format(new Date(`${value}T12:00:00`));
}

function renderControls() {
  const dateSelect = $("#date-select");
  dateSelect.innerHTML = (state.data?.dates || []).map((date) => `<option value="${date}" ${date === state.date ? "selected" : ""}>${escapeHtml(prettyDate(date))}</option>`).join("");
  $("#date-kicker").textContent = state.date ? `${prettyDate(state.date)} · ${state.meal}` : "UW–Madison Dining";
  $("#meal-heading").textContent = state.meal;
  $("#meal-select").value = state.meal;
  const index = (state.data?.dates || []).indexOf(state.date);
  $("#previous-day").disabled = index <= 0;
  $("#next-day").disabled = index < 0 || index >= state.data.dates.length - 1;
}

function renderLocations() {
  if (!state.data) return;
  const ranked = state.data.locations.map(scoreLocation).sort((a, b) => b.score - a.score);
  const list = $("#hall-list");
  list.classList.remove("is-loading");
  list.setAttribute("aria-busy", "false");
  if (!ranked.some((location) => location.items.length)) {
    list.innerHTML = `<div class="empty-state"><strong>No ${escapeHtml(state.meal)} menus found.</strong><span>Try another meal or date.</span></div>`;
    return;
  }
  list.innerHTML = ranked.map((hall, index) => {
    const picks = hall.scoredItems.slice(0, 3);
    const isOpen = state.expanded === hall.id;
    const menu = isOpen ? `<div class="full-menu">${hall.safeItems.length ? hall.safeItems.map((item) => `<div class="menu-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.section)}${item.protein != null ? ` · ${Math.round(item.protein)}g protein` : ""}</small></div><div class="trait-tags">${(item.traits || []).slice(0, 2).map((trait) => `<span>${escapeHtml(trait.replaceAll("-", " "))}</span>`).join("")}</div></div>`).join("") : "<p>Adjust your preferences to see more choices.</p>"}</div>` : "";
    return `<article class="hall-card ${index === 0 ? "winner" : ""}">
      <div class="rank">${index + 1}</div><div class="hall-art ${["coral", "amber", "blue"][index % 3]}" aria-hidden="true"><span>${escapeHtml(hall.name.charAt(0))}</span></div>
      <div class="hall-content"><div class="hall-title-row"><div>${index === 0 ? '<span class="top-pick">Top pick</span>' : ""}<h3>${escapeHtml(hall.name)}</h3><p>${escapeHtml(hall.address)} · ${hall.items.length} menu items</p></div><div class="score" aria-label="${hall.score} percent match"><strong>${hall.score}</strong><span>%</span><small>match</small></div></div>
      ${picks[0] ? `<p class="best-dish"><span>★</span> Best match: <strong>${escapeHtml(picks[0].item.name)}</strong></p><div class="chips">${picks.map(({item}) => `<span>${escapeHtml(item.name)}</span>`).join("")}</div>` : '<p class="no-match">No items match all of your current filters.</p>'}
      <div class="card-footer"><span>${hall.safeItems.length} compatible item${hall.safeItems.length === 1 ? "" : "s"}${hall.excluded ? ` · ${hall.excluded} filtered out` : ""}</span><button type="button" data-expand="${hall.id}" aria-expanded="${isOpen}">${isOpen ? "Hide menu ↑" : "See full menu →"}</button></div>${menu}</div></article>`;
  }).join("");
  list.querySelectorAll("[data-expand]").forEach((button) => button.addEventListener("click", () => { state.expanded = state.expanded === Number(button.dataset.expand) ? null : Number(button.dataset.expand); renderLocations(); }));
}

function preferenceGroup(title, className, values) {
  return `<div class="preference-group"><h3>${title}</h3><div class="${className}">${values.length ? values.join("") : '<span class="empty-copy">Nothing selected</span>'}</div></div>`;
}

function renderProfile() {
  const p = state.preferences;
  const complete = Math.min(100, 35 + p.loves.length * 6 + p.cuisines.length * 6 + (p.likedDishes.length + p.dislikedDishes.length) * 4 + p.avoids.length * 3 + (p.diet !== "none" ? 6 : 0));
  $("#profile-complete").textContent = `${complete}%`;
  $("#profile-progress").style.width = `${complete}%`;
  $("#profile-diet").textContent = titleCase(p.diet);
  const loveTags = p.loves.map((id) => LOVE_OPTIONS.find(([key]) => key === id)).filter(Boolean).map(([, icon, label]) => `<span>${icon} ${escapeHtml(label)}</span>`);
  const cuisineTags = p.cuisines.map((value) => `<span>${escapeHtml(value)}</span>`);
  const dishTags = p.dislikedDishes.map((value) => `<span>${escapeHtml(value)}</span>`);
  const avoidTags = p.avoids.map((value) => `<span>${escapeHtml(ALLERGEN_LABELS[value] || value)}</span>`);
  $("#profile-summary").innerHTML = preferenceGroup("You love", "love-list", loveTags) + preferenceGroup("Favorite cuisines", "cuisine-list", cuisineTags) + preferenceGroup("Skip these dishes", "avoid-list", dishTags) + preferenceGroup("You avoid", "avoid-list", avoidTags);
}

function toggleArray(key, value) {
  const values = state.preferences[key];
  state.preferences[key] = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  renderPreferences(); renderProfile(); renderLocations();
}

function renderPreferences() {
  const p = state.preferences;
  $("#love-choices").innerHTML = LOVE_OPTIONS.map(([id, icon, label]) => `<button type="button" data-love="${id}" class="${p.loves.includes(id) ? "selected" : ""}" aria-pressed="${p.loves.includes(id)}"><span>${icon}</span>${label}<b>✓</b></button>`).join("");
  $("#cuisine-choices").innerHTML = CUISINES.map((cuisine) => `<button type="button" data-cuisine="${cuisine}" class="${p.cuisines.includes(cuisine) ? "selected" : ""}" aria-pressed="${p.cuisines.includes(cuisine)}">${cuisine}<b>✓</b></button>`).join("");
  $("#diet-choices").innerHTML = ["none", "vegetarian", "vegan", "halal"].map((diet) => `<button type="button" data-diet="${diet}" class="${p.diet === diet ? "selected" : ""}">${titleCase(diet)}</button>`).join("");
  $("#allergen-choices").innerHTML = ALLERGENS.map((allergen) => `<button type="button" data-allergen="${allergen}" class="${p.avoids.includes(allergen) ? "danger" : ""}" aria-pressed="${p.avoids.includes(allergen)}">${ALLERGEN_LABELS[allergen]}<b>${p.avoids.includes(allergen) ? "×" : "+"}</b></button>`).join("");
  $("#liked-dishes").innerHTML = p.likedDishes.map((dish) => `<button type="button" data-remove-liked="${escapeHtml(dish)}">${escapeHtml(dish)} ×</button>`).join("");
  $("#disliked-dishes").innerHTML = p.dislikedDishes.map((dish) => `<button type="button" data-remove-disliked="${escapeHtml(dish)}">${escapeHtml(dish)} ×</button>`).join("");
  $("#love-choices").querySelectorAll("[data-love]").forEach((button) => button.addEventListener("click", () => toggleArray("loves", button.dataset.love)));
  $("#cuisine-choices").querySelectorAll("[data-cuisine]").forEach((button) => button.addEventListener("click", () => toggleArray("cuisines", button.dataset.cuisine)));
  $("#diet-choices").querySelectorAll("[data-diet]").forEach((button) => button.addEventListener("click", () => { p.diet = button.dataset.diet; renderPreferences(); renderProfile(); renderLocations(); }));
  $("#allergen-choices").querySelectorAll("[data-allergen]").forEach((button) => button.addEventListener("click", () => toggleArray("avoids", button.dataset.allergen)));
  $("#liked-dishes").querySelectorAll("[data-remove-liked]").forEach((button) => button.addEventListener("click", () => toggleArray("likedDishes", button.dataset.removeLiked)));
  $("#disliked-dishes").querySelectorAll("[data-remove-disliked]").forEach((button) => button.addEventListener("click", () => toggleArray("dislikedDishes", button.dataset.removeDisliked)));
}

function addDish(key, input) {
  const value = input.value.trim();
  if (value && !state.preferences[key].some((item) => item.toLowerCase() === value.toLowerCase())) state.preferences[key].push(value);
  input.value = ""; renderPreferences(); renderProfile(); renderLocations();
}

function openPreferences() { $("#preferences-modal").hidden = false; document.body.style.overflow = "hidden"; $("#close-preferences").focus(); }
function closePreferences() { $("#preferences-modal").hidden = true; document.body.style.overflow = ""; }

async function loadMenus() {
  try {
    const response = await fetch(`./data/menus.json?v=${Date.now()}`, { cache:"no-store" });
    if (!response.ok) throw new Error("Menu snapshot could not be loaded");
    state.data = await response.json();
    state.date = state.data.dates.includes(state.data.firstDate) ? state.data.firstDate : state.data.dates[0];
    const ageHours = Math.round((Date.now() - new Date(state.data.generatedAt).getTime()) / 3600000);
    $("#data-status").innerHTML = `<i></i> ${ageHours > 6 ? "Menu snapshot" : "Recently refreshed"}`;
    $("#data-status").classList.toggle("stale", ageHours > 6);
    renderControls(); renderLocations();
  } catch {
    $("#data-status").innerHTML = "Menu data unavailable";
    $("#data-status").classList.add("stale");
    $("#hall-list").classList.remove("is-loading");
    $("#hall-list").innerHTML = '<div class="empty-state"><strong>Menus could not be loaded.</strong><span>Run the GitHub Pages workflow to refresh data.</span></div>';
  }
}

$("#date-select").addEventListener("change", (event) => { state.date = event.target.value; state.expanded = null; renderControls(); renderLocations(); });
$("#meal-select").addEventListener("change", (event) => { state.meal = event.target.value; state.expanded = null; renderControls(); renderLocations(); });
$("#previous-day").addEventListener("click", () => { const index = state.data.dates.indexOf(state.date); if (index > 0) { state.date = state.data.dates[index - 1]; renderControls(); renderLocations(); } });
$("#next-day").addEventListener("click", () => { const index = state.data.dates.indexOf(state.date); if (index < state.data.dates.length - 1) { state.date = state.data.dates[index + 1]; renderControls(); renderLocations(); } });
document.querySelectorAll("[data-open-preferences]").forEach((button) => button.addEventListener("click", openPreferences));
$("#close-preferences").addEventListener("click", closePreferences);
$("#save-preferences").addEventListener("click", closePreferences);
$("#preferences-modal").addEventListener("mousedown", (event) => { if (event.target === event.currentTarget) closePreferences(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#preferences-modal").hidden) closePreferences(); });
$("#liked-dish-form").addEventListener("submit", (event) => { event.preventDefault(); addDish("likedDishes", $("#liked-dish")); });
$("#disliked-dish-form").addEventListener("submit", (event) => { event.preventDefault(); addDish("dislikedDishes", $("#disliked-dish")); });
$("#reset-preferences").addEventListener("click", () => { state.preferences = { loves:[], cuisines:[], likedDishes:[], dislikedDishes:[], avoids:[], diet:"none" }; renderPreferences(); renderProfile(); renderLocations(); });

renderPreferences(); renderProfile(); loadMenus();
