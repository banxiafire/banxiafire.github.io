const WIDTH = 980, HEIGHT = 600;
const MARGIN = { top: 14, right: 26, bottom: 56, left: 70 }; // space for axis titles

const DUR = { arc: 450, fade: 250, zoom: 200, swap: 220, bars: 450, axes: 200, snap: 80 };
const EASE = { main: d3.easeCubicOut, io: d3.easeCubicInOut };

const LIVE_PREVIEW = false;
const LIVE_PREVIEW_MS = 80;

const ATTRS = ["Carbs", "Proteins", "Fats"];
const COLOR = d3.scaleOrdinal()
  .domain(ATTRS)
  .range(["#4895EF", "#3A0CA3", "#F72585"]);

const ALIAS = new Map([
  ["Height(m)", "Height(m)"], ["Height (m)", "Height(m)"], ["height", "Height(m)"],
  ["Weight(kg)", "Weight(kg)"], ["Weight (kg)", "Weight(kg)"], ["weight", "Weight(kg)"],
  ["Carbs", "Carbs"], ["carbohydrates", "Carbs"], ["carb", "Carbs"],
  ["Proteins", "Proteins"], ["protein", "Proteins"],
  ["Fats", "Fats"], ["fat", "Fats"],
  ["Calories", "Calories"], ["kcal", "Calories"],
  ["Sport", "Sport"], ["Name of Exercise", "Sport"],
  ["Gender", "Gender"], ["Sex", "Gender"]
]);

const CANDIDATE_PATHS = [
  "Final_data.csv",
  "meal_metadata.csv",
  "data/Final_data.csv",
  "data/meal_metadata.csv"
];

// Create (or return existing) SVG under a root element
function ensureSvg(rootSelector, { width, height, ariaLabel, id }) {
  const root = d3.select(rootSelector);
  let svg = root.select("svg");
  if (svg.empty()) {
    svg = root.append("svg");
  }
  svg.attr("width", width).attr("height", height);
  if (ariaLabel) svg.attr("aria-label", ariaLabel);
  if (id) svg.attr("id", id);
  return svg;
}

function ensureAggControls() {
  let agg = document.getElementById("aggMode");
  let pct = document.getElementById("showPerc");
  if (!agg || !pct) {
    const container = document.createElement("div");
    container.className = "agg-controls";

    const aggLabel = document.createElement("label");
    aggLabel.className = "agg-label";
    aggLabel.textContent = "Aggregation";

    agg = document.createElement("select");
    agg.id = "aggMode";
    agg.className = "agg-select";
    agg.innerHTML = `<option value="mean" selected>Mean</option><option value="median">Median</option>`;

    const pctWrap = document.createElement("label");
    pctWrap.className = "agg-checkbox-wrap";
    pct = document.createElement("input");
    pct.type = "checkbox";
    pct.id = "showPerc";
    pctWrap.appendChild(pct);
    pctWrap.appendChild(document.createTextNode("Show % on slices"));

    container.appendChild(aggLabel);
    container.appendChild(agg);
    container.appendChild(pctWrap);

    const target = document.getElementById("aggPanel");
    if (target) { target.appendChild(container); }
    else {
      const app = document.getElementById("app");
      if (app && app.parentNode) app.parentNode.insertBefore(container, app);
      else document.body.insertBefore(container, document.body.firstChild);
    }
  }
  return { agg, pct };
}

// ---------- Utils ----------
function throttle(ms, fn) {
  let last = 0, timer = null, queuedArgs = null;
  return (...args) => {
    const now = performance.now();
    const invoke = () => { last = performance.now(); timer = null; fn(...(queuedArgs || args)); queuedArgs = null; };
    if (now - last >= ms) invoke();
    else { queuedArgs = args; if (!timer) timer = setTimeout(invoke, ms - (now - last)); }
  };
}

// Data helpers
const toNumber = (v) => {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  return +String(v).replace(",", ".");
};

function normalizeRow(row, headerMap) {
  const get = (k) => row[headerMap.get(k)];
  return {
    height: toNumber(get("Height(m)")),
    weight: toNumber(get("Weight(kg)")),
    Carbs: toNumber(get("Carbs")),
    Proteins: toNumber(get("Proteins")),
    Fats: toNumber(get("Fats")),
    Calories: toNumber(get("Calories")),
    Sport: get("Sport") ?? "",
    Gender: get("Gender") ?? ""
  };
}

function buildHeaderMap(columns) {
  const map = new Map();
  for (const col of columns) {
    const canon = ALIAS.get(col) || ALIAS.get(col.trim()) || col;
    if (!map.has(canon)) map.set(canon, col);
  }
  for (const key of ["Height(m)", "Weight(kg)", "Carbs", "Proteins", "Fats", "Calories", "Sport", "Gender"]) {
    if (!map.has(key)) map.set(key, key);
  }
  return map;
}

async function loadFirstAvailable(paths) {
  let lastErr = null;
  for (const p of paths) {
    try {
      const text = await d3.text(p);
      const parsed = d3.csvParse(text);
      const headerMap = buildHeaderMap(parsed.columns);
      const cleaned = parsed.map((row) => normalizeRow(row, headerMap))
        .filter(d => !(isNaN(d.Carbs) && isNaN(d.Proteins) && isNaN(d.Fats)));
      if (cleaned.length > 0) return cleaned;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not load any CSV from:\n${paths.join("\n")}\n\n${lastErr ? lastErr.message : ""}\nTip: serve files via a local server (e.g., "python -m http.server").`);
}

// ---------- State & UI ----------
const ui = {
  sport: d3.select("#sportSelect"),
  gender: d3.select("#genderSelect"),
  hVal: d3.select("#heightVal"),
  wVal: d3.select("#weightVal"),
  back: d3.select("#backBtn"),
  reset: d3.select("#resetBtn"),
    hSvg: null,
  wSvg: null,
  aggSel: null,
  showPerc: null
};

const state = {
  raw: [],
  filtered: [],
  mode: "donut",
  histAttr: null,
  transitioning: false,
  sport: "All",
  gender: "All",
  hMin: null, hMax: null,
  wMin: null, wMax: null,
  domain: { h: [1.2, 2.2], w: [40, 140] },
  xScales: {},
  binGens: {},
  agg: "mean",
  showPerc: false
};

// Filtering
function applyFilters() {
  const s = state;
  let out = s.raw;
  if (s.sport !== "All") out = out.filter(d => d.Sport === s.sport);
  if (s.gender !== "All") out = out.filter(d => d.Gender === s.gender);
  out = out.filter(d =>
    (isNaN(d.height) || (d.height >= s.hMin && d.height <= s.hMax)) &&
    (isNaN(d.weight) || (d.weight >= s.wMin && d.weight <= s.wMax))
  );
  state.filtered = out;
}
function updateFilterPills() {
  ui.hVal && ui.hVal.text(`${(+state.hMin).toFixed(2)}–${(+state.hMax).toFixed(2)}`);
  ui.wVal && ui.wVal.text(`${Math.round(state.wMin)}–${Math.round(state.wMax)}`);
}

// Aggregation
function mean(arr, key) { return d3.mean(arr, d => d[key]); }
function median(arr, key) { return d3.median(arr.map(d => d[key]).filter(v => !isNaN(v))); }
function aggregate(arr, key, mode) { return mode === "median" ? median(arr, key) : mean(arr, key); }

// Tooltip
const tip = d3.select("body").append("div").attr("id", "tooltip");
function showTip(html, [x, y]) { tip.html(html).style("left", x + "px").style("top", y + "px").style("opacity", 1); }
function hideTip() { tip.style("opacity", 0); }

// === Create SVGs dynamically ===
ui.hSvg = ensureSvg("#heightBrushRoot", { width: 600, height: 84, ariaLabel: "Height scale", id: "heightBrush" });
ui.wSvg = ensureSvg("#weightBrushRoot", { width: 600, height: 84, ariaLabel: "Weight scale", id: "weightBrush" });
const donutSvg = ensureSvg("#donutRoot", { width: WIDTH, height: HEIGHT, ariaLabel: "Donut chart", id: "donut" });
const histSvg = ensureSvg("#histRoot", { width: WIDTH, height: HEIGHT, ariaLabel: "Histogram", id: "hist" });

// Donut
const donutG = donutSvg.append("g").attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 - 5}) scale(1)`);


const donutInner = 0;
const donutOuter = 180;
const outerRingInner = donutOuter + 5;
const outerRingOuter = outerRingInner + 50;



const pie = d3.pie().sort(null).value(d => d.value);

const centerG = donutG.append("g");
const centerTitle = centerG.append("text").attr("class", "center-text").attr("y", -10);
const centerValue = centerG.append("text").attr("class", "center-text").attr("y", 20);

function renderDonut() {

    const data = state.filtered;
    donutG.selectAll("path.arc").filter(function() {
        return !d3.select(this).classed("inner") && !d3.select(this).classed("outer");
    }).remove();
    const carbsMean = mean(data, "Carbs") ?? 0, carbsMedian = median(data, "Carbs") ?? 0;
    const protMean = mean(data, "Proteins") ?? 0, protMedian = median(data, "Proteins") ?? 0;
    const fatMean = mean(data, "Fats") ?? 0, fatMedian = median(data, "Fats") ?? 0;

    const aggVal = (k) => aggregate(data, k, state.agg) ?? 0;

    // inner pie data
    const innerStats = [
        { key: "Carbs", value: aggVal("Carbs"), mean: carbsMean, median: carbsMedian, image: "carbon_rice.png" },
        { key: "Proteins", value: aggVal("Proteins"), mean: protMean, median: protMedian, image: "protein_fish.png" },
        { key: "Fats", value: aggVal("Fats"), mean: fatMean, median: fatMedian, image: "fat_cheese.png" }
    ];

    // outter ring info
    const outerRingStats = [{ key: "VeggieRing", value: 1, image: "veggie.png" }]; // value: 1 用于完整环

    const kcalAgg = aggregate(data, "Calories", state.agg);
    const innerArcs = pie(innerStats);
    const outerRingArcs = d3.pie().sort(null).value(d => d.value)(outerRingStats);

    const total = innerStats.reduce((s, d) => s + (isFinite(d.value) ? d.value : 0), 0);
    const pct = (v) => !total || !isFinite(v) ? "0%" : d3.format(".0%")(v / total);

    // --- Patterns ---
    const defs = donutG.selectAll("defs").data([null]).enter().append("defs");


    const innerPatterns = defs.selectAll("pattern.inner").data(innerStats, d => d.key).join(
        enter => enter.append("pattern").attr("class", "inner").attr("id", d => `pattern-${d.key}`)
            .attr("width", 1).attr("height", 1).attr("patternContentUnits", "objectBoundingBox")
            .append("image").attr("xlink:href", d => `data/${d.image}`).attr("width", 1).attr("height", 1).attr("preserveAspectRatio", "xMidYMid slice")
    );


    const outerRingPattern = defs.selectAll("pattern.outer").data(outerRingStats, d => d.key).join(
        enter => enter.append("pattern").attr("class", "outer").attr("id", d => `pattern-${d.key}`)
            .attr("width", 1).attr("height", 1).attr("patternContentUnits", "objectBoundingBox")
            .append("image").attr("xlink:href", d => `data/${d.image}`).attr("width", 1).attr("height", 1).attr("preserveAspectRatio", "xMidYMid slice")
    );

    // --- (Pie Chart Paths) ---
    const pieArc = d3.arc().innerRadius(donutInner).outerRadius(donutOuter).padAngle(0.02).cornerRadius(8);
    const paths = donutG.selectAll("path.arc.inner").data(innerArcs, d => d.data.key);

    paths.join(
        enter => enter.append("path").attr("class", "arc inner")
            .attr("fill", d => `url(#pattern-${d.data.key})`)
            .each(function (d) { this._current = d; })
            .attr("d", pieArc)
            .on("click", (ev, d) => onSliceClick(d))
            .on("mousemove", (ev, d) => {
                const html = `<div class="title">${d.data.key}</div><div class="row">
                                        <span>Mean</span><span>${d3.format(".2f")(d.data.mean)}</span></div>
                                        <div class="row"><span>Median</span>
                                        <span>${d3.format(".2f")(d.data.median)}</span>
                                        </div><div class="row"><span>%</span>
                                        <span>${pct(d.data.value)}</span></div>`;
                showTip(html, [ev.clientX, ev.clientY]);
            })
            .on("mouseleave", hideTip),
        update => update.transition().duration(DUR.arc).ease(EASE.main)
            .attrTween("d", function (d) {
                const i = d3.interpolate(this._current, d);
                this._current = i(1);
                return t => pieArc(i(t));
            }),
        exit => exit.transition().duration(150).style("opacity", 0).remove()
    );

    // (Outer Ring Paths) ---
    const outerRingArc = d3.arc().innerRadius(outerRingInner).outerRadius(outerRingOuter).padAngle(0.005).cornerRadius(0);
    const outerPaths = donutG.selectAll("path.arc.outer").data(outerRingArcs, d => d.data.key);

    outerPaths.join(
        enter => enter.append("path").attr("class", "arc outer")
            .attr("fill", d => `url(#pattern-${d.data.key})`)
            .each(function (d) { this._current = d; })
            .attr("d", outerRingArc)
            .on("click", (ev) => ev.stopPropagation()) //
            .on("mousemove", (ev, d) => {
                const html = `
                    <div class="title">Veggies</div>
                    <div style="font-weight: bold; margin-top: 5px;">Unlimited Intake</div>
                `;
                showTip(html, [ev.clientX, ev.clientY]);
            })
            .on("mouseleave", hideTip),
        update => update.transition().duration(DUR.arc).ease(EASE.main)
            .attrTween("d", function (d) {
                const i = d3.interpolate(this._current, d);
                this._current = i(1);
                return t => outerRingArc(i(t));
            }),
        exit => exit.transition().duration(150).style("opacity", 0).remove()
    );

    // --- (Labels) ---
    donutG.selectAll("text.slice-label").remove(); // force remove old labels

    const midR = donutOuter / 2;
    const labArc = d3.arc().innerRadius(midR).outerRadius(midR);

    donutG.selectAll("text.slice-label")
        .data(innerArcs, d => d.data.key)
        .enter()
        .append("text")
        .attr("class", d => `slice-label slice-label-${d.data.key}`)
        .attr("text-anchor", "middle")
        .attr("transform", d => `translate(${labArc.centroid(d)})`)
        .style("opacity", d => d.data.value > 0 ? 1 : 0)
        .text(d => state.showPerc ? `${d.data.key} ${pct(d.data.value)}` : d.data.key);

    const cap = state.agg === "median" ? "Median" : "Avg";
    centerTitle.text(`${cap} Calories`);
    centerValue.text(Number.isFinite(kcalAgg) ? Math.round(kcalAgg).toLocaleString() : "—");
}

// Histogram
const histG = histSvg.append("g").attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);
const innerW = WIDTH - MARGIN.left - MARGIN.right;
const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

const xAxisG = histG.append("g").attr("transform", `translate(0, ${innerH})`);
const yAxisG = histG.append("g");
const xLabel = histSvg.append("text").attr("x", WIDTH / 2).attr("y", HEIGHT - 10).attr("text-anchor", "middle").attr("class", "axis-label");
const yLabel = histSvg.append("text").attr("transform", "rotate(-90)").attr("x", -(HEIGHT / 2)).attr("y", 16).attr("text-anchor", "middle").attr("class", "axis-label");
const title = histSvg.append("text").attr("x", WIDTH / 2).attr("y", 24).attr("text-anchor", "middle").attr("class", "axis-title");

function renderHistogram(key) {
  const vals = state.filtered.map(d => d[key]).filter(v => !isNaN(v));
  const x = state.xScales[key];
  const bin = state.binGens[key];
  const bins = bin(vals);

  const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length) || 1]).nice().range([innerH, 0]);

  const bars = histG.selectAll("rect.bar").data(bins, d => `${d.x0}-${d.x1}`);

  bars.enter().append("rect").attr("class", "bar").attr("shape-rendering", "crispEdges")
    .attr("x", d => Math.round(x(d.x0)) + 1).attr("y", innerH)
    .attr("width", d => Math.max(0, Math.round(x(d.x1)) - Math.round(x(d.x0)) - 1)).attr("height", 0)
    .merge(bars)
    .attr("fill", COLOR(key))
    .transition().duration(DUR.bars).ease(EASE.main)
    .attr("x", d => Math.round(x(d.x0)) + 1)
    .attr("width", d => Math.max(0, Math.round(x(d.x1)) - Math.round(x(d.x0)) - 1))
    .attr("y", d => y(d.length))
    .attr("height", d => innerH - y(d.length));

  bars.exit().transition().duration(150).attr("y", innerH).attr("height", 0).remove();

  xAxisG.transition().duration(DUR.axes).call(d3.axisBottom(x).ticks(8));
  yAxisG.transition().duration(DUR.axes).call(d3.axisLeft(y).ticks(6));

  title.text(`${key} distribution`);
  xLabel.text(key);
  yLabel.text("Count");
}

// Transitions
function onSliceClick(d) {
    if (state.transitioning || state.mode !== "donut") return;
    state.transitioning = true;
    const selectedKey = d.data.key;

    // fade out un selected inner slices
    donutG.selectAll("path.arc.inner").filter(a => a.data.key !== selectedKey)
        .transition().duration(DUR.fade).style("opacity", 0.15);
    donutG.selectAll("text.slice-label").filter(a => a.data.key !== selectedKey)
        .transition().duration(DUR.fade).style("opacity", 0);

    // outter ring visilbe
    donutG.selectAll("path.arc.outer").transition().duration(DUR.fade).style("opacity", 1);

    // (innerRadius kept 0)
    const biggerArc = d3.arc().innerRadius(donutInner).outerRadius(donutOuter + 28).padAngle(0.02).cornerRadius(8);
    const clicked = donutG.selectAll("path.arc.inner").filter(a => a.data.key === selectedKey);

    clicked.raise().transition().duration(DUR.arc).ease(EASE.io)
        .attrTween("d", function (dd) { const i = d3.interpolate(this._current, dd); return t => biggerArc(i(t)); });


    donutG.transition().duration(DUR.zoom).ease(EASE.io)
        .attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 + 16}) scale(1.12)`)
        .on("end", () => {
            d3.select("#donutCard").transition().duration(DUR.swap).style("opacity", 0).on("end", () => {
                d3.select("#donutCard").classed("hidden", true).style("opacity", 1);
                state.mode = "hist"; state.histAttr = selectedKey;
                renderHistogram(selectedKey);
                d3.select("#histCard").classed("hidden", false).style("opacity", 0)
                    .transition().duration(DUR.swap).style("opacity", 1)
                    .on("end", () => { ui.back && ui.back.attr("disabled", null); state.transitioning = false; resetDonutVisualState(); });
            });
        });
}

function resetDonutVisualState() {
    // curve of inner
    const pieArc = d3.arc().innerRadius(donutInner).outerRadius(donutOuter).padAngle(0.02).cornerRadius(8);
    // curve of outer
    const outerRingArc = d3.arc().innerRadius(outerRingInner).outerRadius(outerRingOuter).padAngle(0.005).cornerRadius(0);

    donutG.attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 + 16}) scale(1)`);

    // reset inner part
    donutG.selectAll("path.arc.inner").interrupt().style("opacity", 1).transition().duration(0).attr("d", d => pieArc(d));
    donutG.selectAll("text.slice-label").interrupt().style("opacity", d => d.data.value > 0 ? 1 : 0.0001);

    // reset outter part
    donutG.selectAll("path.arc.outer").interrupt().style("opacity", 1).transition().duration(0).attr("d", d => outerRingArc(d));
}

function toDonut() {
  if (state.mode !== "hist" || state.transitioning) return;
  state.transitioning = true; ui.back && ui.back.attr("disabled", true);
  d3.select("#histCard").transition().duration(DUR.swap).style("opacity", 0).on("end", () => {
    d3.select("#histCard").classed("hidden", true);
    d3.select("#donutCard").classed("hidden", false).style("opacity", 0);
    resetDonutVisualState();
    renderDonut();
    d3.select("#donutCard").transition().duration(DUR.swap).style("opacity", 1)
      .on("end", () => { state.mode = "donut"; state.histAttr = null; state.transitioning = false; });
  });
}

// Dropdown & brush wiring
function onDropdownChange() {
  state.sport = ui.sport.node() ? ui.sport.property("value") : "All";
  state.gender = ui.gender.node() ? ui.gender.property("value") : "All";
  applyFilters();
  if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
}

let heightBrush, weightBrush;
function createRangeBrush(svg, { domain, step = 1, initial = domain, height = 80, onChange = () => { } }) {
  const margin = { top: 12, right: 12, bottom: 18, left: 12 };
  const W = +svg.attr("width"), H = height;
  const innerW = W - margin.left - margin.right, innerH = H - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain(domain).range([0, innerW]).nice();
  const axis = d3.axisBottom(x).ticks(6);
  const axisG = g.append("g").attr("transform", `translate(0, ${innerH})`).call(axis);
  g.append("line").attr("class", "track").attr("x1", 0).attr("x2", innerW).attr("y1", innerH / 2).attr("y2", innerH / 2);
  const brush = d3.brushX().extent([[0, innerH / 2 - 12], [innerW, innerH / 2 + 12]]).handleSize(10).on("brush", brushed).on("end", brushEnded);
  const brushG = g.append("g").attr("class", "brush").call(brush);
  const handles = brushG.selectAll(".handle--custom").data([{ type: "w" }, { type: "e" }]).enter().append("rect").attr("class", "handle handle--custom").attr("width", 4).attr("height", 24).attr("y", innerH / 2 - 12).attr("rx", 2).attr("ry", 2);
  let [a0, a1] = initial; brushG.call(brush.move, [x(a0), x(a1)]);
  function brushed({ selection }) {
    if (!selection) return;
    const [x0, x1] = selection; handles.attr("x", (d, i) => i === 0 ? x0 - 2 : x1 - 2);
    const v0 = x.invert(x0), v1 = x.invert(x1); onChange([v0, v1], false);
  }
  function brushEnded(ev) {
    if (!ev.selection) return;
    const [x0, x1] = ev.selection;
    const v0 = snap(x.invert(x0), step, domain), v1 = snap(x.invert(x1), step, domain);
    const s0 = x(v0), s1 = x(v1);
    d3.select(this).transition().duration(DUR.snap).call(brush.move, [s0, s1]);
    handles.transition().duration(DUR.snap).attr("x", (d, i) => i === 0 ? s0 - 2 : s1 - 2);
    onChange([v0, v1], true);
  }
  function snap(v, step, [d0, d1]) { const s = Math.max(step, 1e-9); const clamped = Math.min(Math.max(v, d0), d1); return Math.round(clamped / s) * s; }
  return { x, axisG, brushG, setRange([v0, v1]) { brushG.call(brush.move, [x(v0), x(v1)]); } };
}

const liveUpdateThrottled = throttle(LIVE_PREVIEW_MS, () => {
  if (!LIVE_PREVIEW) return;
  applyFilters();
  if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
});

// Bootstrap
(async function init() {
  try {
    const raw = await loadFirstAvailable(CANDIDATE_PATHS);
    state.raw = raw;

    // Controls
    const created = ensureAggControls();
    ui.aggSel = created.agg; ui.showPerc = created.pct;
    ui.aggSel.addEventListener("change", () => { state.agg = ui.aggSel.value; if (state.mode === "donut") renderDonut(); });
    ui.showPerc.addEventListener("change", () => { state.showPerc = ui.showPerc.checked; if (state.mode === "donut") renderDonut(); });

    // Domains for filters
    const hExtent = d3.extent(raw.map(d => d.height).filter(v => !isNaN(v)));
    const wExtent = d3.extent(raw.map(d => d.weight).filter(v => !isNaN(v)));
    state.domain.h = [+(hExtent?.[0] ?? 1.2), +(hExtent?.[1] ?? 2.2)];
    state.domain.w = [+(wExtent?.[0] ?? 40), +(wExtent?.[1] ?? 140)];
    state.hMin = state.domain.h[0]; state.hMax = state.domain.h[1];
    state.wMin = state.domain.w[0]; state.wMax = state.domain.w[1];

    // Dropdowns
    if (ui.sport.node()) {
      const sports = Array.from(new Set(raw.map(d => d.Sport).filter(Boolean))).sort();
      ui.sport.selectAll("option").data(["All", ...sports]).join("option").attr("value", d => d).text(d => d);
      ui.sport.on("change", onDropdownChange);
    }
    if (ui.gender.node()) {
      const genders = Array.from(new Set(raw.map(d => d.Gender).filter(Boolean))).sort();
      ui.gender.selectAll("option").data(["All", ...genders]).join("option").attr("value", d => d).text(d => d);
      ui.gender.on("change", onDropdownChange);
    }

    // Brushes
    if (ui.hSvg.node()) {
      heightBrush = createRangeBrush(ui.hSvg, {
        domain: state.domain.h, step: 0.01, initial: [state.hMin, state.hMax],
        onChange: ([v0, v1], snapped) => {
          state.hMin = Math.min(v0, v1); state.hMax = Math.max(v0, v1);
          updateFilterPills();
          if (snapped) { applyFilters(); if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr); }
          else { liveUpdateThrottled(); }
        }
      });
    }
    if (ui.wSvg.node()) {
      weightBrush = createRangeBrush(ui.wSvg, {
        domain: state.domain.w, step: 1, initial: [state.wMin, state.wMax],
        onChange: ([v0, v1], snapped) => {
          state.wMin = Math.min(v0, v1); state.wMax = Math.max(v0, v1);
          updateFilterPills();
          if (snapped) { applyFilters(); if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr); }
          else { liveUpdateThrottled(); }
        }
      });
    }

    updateFilterPills();

    // Stabilize x-scales & bins once (from RAW)
    for (const k of ATTRS) {
      const ext = d3.extent(raw.map(d => d[k]).filter(v => !isNaN(v)));
      const x = d3.scaleLinear().domain(ext).range([0, WIDTH - MARGIN.left - MARGIN.right]).nice();
      const thresholds = x.ticks(20);
      const bin = d3.bin().domain(x.domain()).thresholds(thresholds);
      state.xScales[k] = x;
      state.binGens[k] = bin;
    }

    applyFilters();
    renderDonut();

    // Reset button: reset dropdowns + brushes + filters
    ui.reset && ui.reset.on("click", () => {
      if (ui.sport.node()) { ui.sport.property("value", "All"); state.sport = "All"; }
      if (ui.gender.node()) { ui.gender.property("value", "All"); state.gender = "All"; }
      state.hMin = state.domain.h[0]; state.hMax = state.domain.h[1];
      state.wMin = state.domain.w[0]; state.wMax = state.domain.w[1];
      if (heightBrush) heightBrush.setRange([state.hMin, state.hMax]);
      if (weightBrush) weightBrush.setRange([state.wMin, state.wMax]);
      updateFilterPills();
      applyFilters();
      if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
    });
    // Back
    ui.back && ui.back.on("click", () => toDonut());

  } catch (err) {
    console.error(err);
    const app = d3.select("body");
    app.append("pre").style("color", "#b00020").text(String(err));
  }
})();
