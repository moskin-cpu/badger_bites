"use strict";

const LOVE_OPTIONS = [
  ["spicy", "🌶️", "Spicy food"], ["protein", "🍗", "High protein"],
  ["global", "🌏", "Global flavors"], ["vegetables", "🥦", "Vegetables"],
  ["comfort", "🍕", "Comfort food"], ["lighter", "🥗", "Lighter meals"],
];
const CUISINES = ["Italian", "Mexican", "Asian", "Chinese", "Japanese", "Indian", "Mediterranean", "American"];
const ALLERGENS = ["dairy", "egg", "fish", "peanut", "sesame", "shellfish", "soy", "tree-nuts", "wheat"];
const ALLERGEN_LABELS = { dairy:"Dairy", egg:"Egg", fish:"Fish", peanut:"Peanuts", sesame:"Sesame", shellfish:"Shellfish", soy:"Soy", "tree-nuts":"Tree nuts", wheat:"Wheat" };
const RESIDENCE_HALLS = [
  { name:"Adams", latitude:43.07788036306996, longitude:-89.4119889394122 },
  { name:"Barnard", latitude:43.07367782597888, longitude:-89.40222699941677 },
  { name:"Bradley", latitude:43.07790973063353, longitude:-89.41643740567213 },
  { name:"Chadbourne", latitude:43.07380625427833, longitude:-89.40121067983512 },
  { name:"Cole", latitude:43.07736434754442, longitude:-89.41497582918734 },
  { name:"Dejope", latitude:43.07775001972469, longitude:-89.41776736230737 },
  { name:"Kronshage", latitude:43.07805728011479, longitude:-89.41451668739317 },
  { name:"Leopold", latitude:43.07780565355987, longitude:-89.41442379330158 },
  { name:"Lowell Center", latitude:43.07626741285504, longitude:-89.3958111338856 },
  { name:"Merit", latitude:43.07075343657847, longitude:-89.40142974354197 },
  { name:"Ogg", latitude:43.070536335080945, longitude:-89.40002924881604 },
  { name:"Phillips", latitude:43.07855215848702, longitude:-89.4179873011807 },
  { name:"Sellery", latitude:43.07164463190376, longitude:-89.40000895469616 },
  { name:"Slichter", latitude:43.07712886046986, longitude:-89.41220813731039 },
  { name:"Smith", latitude:43.06903738975022, longitude:-89.40039268946671 },
  { name:"Sullivan", latitude:43.07760382061325, longitude:-89.415510654597 },
  { name:"Tripp", latitude:43.077994145559124, longitude:-89.41096614975703 },
  { name:"Waters", latitude:43.07694917047651, longitude:-89.40694288799442 },
  { name:"Witte", latitude:43.07159091764505, longitude:-89.3969440656365 },
];
const DEFAULT_PREFERENCES = {
  loves:["spicy", "protein", "comfort"],
  cuisines:["Mexican", "Chinese", "Japanese", "Indian", "American"],
  avoidCuisines:["Italian", "Mediterranean"], likedDishes:["sushi", "steak"], dislikedDishes:["spaghetti and meatballs", "salad"], avoids:[], diet:"none", residenceHall:"",
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
function degreesToRadians(value) { return value * Math.PI / 180; }
function distanceMiles(origin, destination) {
  const latitudeDelta = degreesToRadians(destination.latitude - origin.latitude);
  const longitudeDelta = degreesToRadians(destination.longitude - origin.longitude);
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return 3958.8 * 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}
function formatDistance(miles, residenceHall) {
  if (miles < 0.03) return `Same building as ${residenceHall}`;
  if (miles < 0.2) return `About ${Math.max(50, Math.round(miles * 5280 / 50) * 50)} ft from ${residenceHall}`;
  return `About ${miles.toFixed(1)} mi from ${residenceHall}`;
}
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
    if (preferences.avoidCuisines.some((cuisine) => CUISINE_PATTERNS[cuisine]?.test(itemText(item)))) return false;
    return !preferences.dislikedDishes.some((dish) => item.name.toLowerCase().includes(dish.toLowerCase()));
  });
  const scoredItems = safeItems.map((item) => {
    const text = itemText(item);
    const lovePoints = preferences.loves.reduce((sum, love) => sum + (loveMatch(item, love) ? 1 : 0), 0);
    const cuisinePoints = preferences.cuisines.reduce((sum, cuisine) => sum + (CUISINE_PATTERNS[cuisine]?.test(text) ? 2 : 0), 0);
    const dishPoints = preferences.likedDishes.reduce((sum, dish) => sum + (item.name.toLowerCase().includes(dish.toLowerCase()) ? 4 : 0), 0);
    return { item, points:lovePoints + cuisinePoints + dishPoints };
  }).sort((a, b) => b.points - a.points || (b.item.protein || 0) - (a.item.protein || 0));
  const residenceHall = RESIDENCE_HALLS.find((hall) => hall.name === preferences.residenceHall);
  const coordinates = { latitude:Number(location.latitude), longitude:Number(location.longitude) };
  const distance = residenceHall && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude) ? distanceMiles(residenceHall, coordinates) : null;
  return { ...location, items, safeItems, scoredItems, distance, excluded:items.length - safeItems.length };
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
  const ranked = state.data.locations.map(scoreLocation).sort((a, b) => b.safeItems.length - a.safeItems.length || a.name.localeCompare(b.name));
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
    const distance = hall.distance == null ? "" : `<p class="distance-copy">⌖ ${escapeHtml(formatDistance(hall.distance, state.preferences.residenceHall))}</p>`;
    const menu = isOpen ? `<div class="full-menu">${hall.safeItems.length ? hall.safeItems.map((item) => `<div class="menu-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.section)}${item.protein != null ? ` · ${Math.round(item.protein)}g protein` : ""}</small></div><div class="trait-tags">${(item.traits || []).slice(0, 2).map((trait) => `<span>${escapeHtml(trait.replaceAll("-", " "))}</span>`).join("")}</div></div>`).join("") : "<p>Adjust your preferences to see more choices.</p>"}</div>` : "";
    return `<article class="hall-card ${index === 0 ? "winner" : ""}">
      <div class="rank">${index + 1}</div><div class="hall-art ${["coral", "amber", "blue"][index % 3]}" aria-hidden="true"><span>${escapeHtml(hall.name.charAt(0))}</span></div>
      <div class="hall-content"><div class="hall-title-row"><div>${index === 0 ? '<span class="top-pick">Most compatible items</span>' : ""}<h3>${escapeHtml(hall.name)}</h3><p>${escapeHtml(hall.address)} · ${hall.items.length} menu items</p>${distance}</div></div>
      ${picks[0] ? `<p class="best-dish"><span>★</span> Best match: <strong>${escapeHtml(picks[0].item.name)}</strong></p><div class="chips">${picks.map(({item}) => `<span>${escapeHtml(item.name)}</span>`).join("")}</div>` : hall.items.length ? '<p class="no-match">No items match all of your current filters.</p>' : '<p class="no-match">No menu is published for this meal and date.</p>'}
      <div class="card-footer"><span>${hall.safeItems.length} compatible item${hall.safeItems.length === 1 ? "" : "s"}${hall.excluded ? ` · ${hall.excluded} filtered out` : ""}</span><button type="button" data-expand="${hall.id}" aria-expanded="${isOpen}">${isOpen ? "Hide menu ↑" : "See full menu →"}</button></div>${menu}</div></article>`;
  }).join("");
  list.querySelectorAll("[data-expand]").forEach((button) => button.addEventListener("click", () => { state.expanded = state.expanded === Number(button.dataset.expand) ? null : Number(button.dataset.expand); renderLocations(); }));
}

function preferenceGroup(title, className, values) {
  return `<div class="preference-group"><h3>${title}</h3><div class="${className}">${values.length ? values.join("") : '<span class="empty-copy">Nothing selected</span>'}</div></div>`;
}

function renderProfile() {
  const p = state.preferences;
  $("#profile-diet").textContent = titleCase(p.diet);
  const loveTags = p.loves.map((id) => LOVE_OPTIONS.find(([key]) => key === id)).filter(Boolean).map(([, icon, label]) => `<span>${icon} ${escapeHtml(label)}</span>`);
  const cuisineTags = p.cuisines.map((value) => `<span>${escapeHtml(value)}</span>`);
  const avoidedCuisineTags = p.avoidCuisines.map((value) => `<span>${escapeHtml(value)}</span>`);
  const dishTags = p.dislikedDishes.map((value) => `<span>${escapeHtml(value)}</span>`);
  const avoidTags = p.avoids.map((value) => `<span>${escapeHtml(ALLERGEN_LABELS[value] || value)}</span>`);
  $("#profile-summary").innerHTML = preferenceGroup("You love", "love-list", loveTags) + preferenceGroup("Favorite cuisines", "cuisine-list", cuisineTags) + preferenceGroup("Cuisines to avoid", "avoid-list", avoidedCuisineTags) + preferenceGroup("Skip these dishes", "avoid-list", dishTags) + preferenceGroup("Allergens filtered", "avoid-list", avoidTags);
}

function toggleArray(key, value) {
  const values = state.preferences[key];
  state.preferences[key] = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  renderPreferences(); renderProfile(); renderLocations();
}

function toggleCuisinePreference(key, otherKey, value) {
  const values = state.preferences[key];
  const adding = !values.includes(value);
  state.preferences[key] = adding ? [...values, value] : values.filter((item) => item !== value);
  if (adding) state.preferences[otherKey] = state.preferences[otherKey].filter((item) => item !== value);
  renderPreferences(); renderProfile(); renderLocations();
}

function renderPreferences() {
  const p = state.preferences;
  $("#love-choices").innerHTML = LOVE_OPTIONS.map(([id, icon, label]) => `<button type="button" data-love="${id}" class="${p.loves.includes(id) ? "selected" : ""}" aria-pressed="${p.loves.includes(id)}"><span>${icon}</span>${label}<b>✓</b></button>`).join("");
  $("#cuisine-choices").innerHTML = CUISINES.map((cuisine) => `<button type="button" data-cuisine="${cuisine}" class="${p.cuisines.includes(cuisine) ? "selected" : ""}" aria-pressed="${p.cuisines.includes(cuisine)}">${cuisine}<b>✓</b></button>`).join("");
  $("#cuisine-avoid-choices").innerHTML = CUISINES.map((cuisine) => `<button type="button" data-avoid-cuisine="${cuisine}" class="${p.avoidCuisines.includes(cuisine) ? "selected" : ""}" aria-pressed="${p.avoidCuisines.includes(cuisine)}">${cuisine}<b>×</b></button>`).join("");
  $("#diet-choices").innerHTML = ["none", "vegetarian", "vegan", "halal"].map((diet) => `<button type="button" data-diet="${diet}" class="${p.diet === diet ? "selected" : ""}">${titleCase(diet)}</button>`).join("");
  $("#residence-hall-choice").innerHTML = '<option value="">None</option>' + RESIDENCE_HALLS.map((hall) => `<option value="${escapeHtml(hall.name)}">${escapeHtml(hall.name)}</option>`).join("");
  $("#residence-hall-choice").value = p.residenceHall;
  $("#residence-hall-choice").onchange = (event) => { p.residenceHall = event.target.value; renderLocations(); };
  $("#allergen-choices").innerHTML = ALLERGENS.map((allergen) => `<button type="button" data-allergen="${allergen}" class="${p.avoids.includes(allergen) ? "danger" : ""}" aria-pressed="${p.avoids.includes(allergen)}">${ALLERGEN_LABELS[allergen]}<b>${p.avoids.includes(allergen) ? "×" : "+"}</b></button>`).join("");
  $("#liked-dishes").innerHTML = p.likedDishes.map((dish) => `<button type="button" data-remove-liked="${escapeHtml(dish)}">${escapeHtml(dish)} ×</button>`).join("");
  $("#disliked-dishes").innerHTML = p.dislikedDishes.map((dish) => `<button type="button" data-remove-disliked="${escapeHtml(dish)}">${escapeHtml(dish)} ×</button>`).join("");
  $("#love-choices").querySelectorAll("[data-love]").forEach((button) => button.addEventListener("click", () => toggleArray("loves", button.dataset.love)));
  $("#cuisine-choices").querySelectorAll("[data-cuisine]").forEach((button) => button.addEventListener("click", () => toggleCuisinePreference("cuisines", "avoidCuisines", button.dataset.cuisine)));
  $("#cuisine-avoid-choices").querySelectorAll("[data-avoid-cuisine]").forEach((button) => button.addEventListener("click", () => toggleCuisinePreference("avoidCuisines", "cuisines", button.dataset.avoidCuisine)));
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
$("#reset-preferences").addEventListener("click", () => { state.preferences = structuredClone(DEFAULT_PREFERENCES); renderPreferences(); renderProfile(); renderLocations(); });

renderPreferences(); renderProfile(); loadMenus();
