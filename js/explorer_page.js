// ====== Explorer Page JS (was second IIFE in merged file) ======
(function () {
  var hasMain = document.getElementById('donutRoot') || document.getElementById('histRoot') || document.getElementById('profile-avatar-svg');
  if (!hasMain) return;
  try {
    if (typeof USE_IMAGE_PATTERNS === 'undefined') { window.USE_IMAGE_PATTERNS = false; }
    if (typeof OUTER_RING_COLOR === 'undefined') { window.OUTER_RING_COLOR = '#6BCF7F'; }
    const WIDTH = 980, HEIGHT = 600;
    const MARGIN = { top: 14, right: 26, bottom: 56, left: 70 };

    const DUR = { arc: 450, fade: 250, zoom: 200, swap: 220, bars: 450, axes: 200, snap: 80 };
    const EASE = { main: d3.easeCubicOut, io: d3.easeCubicInOut };

    const LIVE_PREVIEW = false;
    const LIVE_PREVIEW_MS = 80;

    const ATTRS = ["Carbs", "Proteins", "Fats"];
    const COLOR = d3.scaleOrdinal()
      .domain(ATTRS)
      .range(["#EDE7D3", "#F28C73", "#A8C686"]);

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

        // --- Row 1: Aggregation label + select ---
        const aggRow = document.createElement("div");
        aggRow.className = "filter-row";

        const aggLabel = document.createElement("span");
        aggLabel.className = "filter-label";
        aggLabel.textContent = "Aggregation";

        agg = document.createElement("select");
        agg.id = "aggMode";
        agg.className = "control-select";
        agg.innerHTML = `
      <option value="mean" selected>Mean</option>
      <option value="median">Median</option>
    `;
        aggRow.appendChild(aggLabel);
        aggRow.appendChild(agg);

        // --- Row 2: checkbox (one line) ---
        const pctRow = document.createElement("div");
        pctRow.className = "agg-checkbox-wrap";   // <— use our own class

        pct = document.createElement("input");
        pct.type = "checkbox";
        pct.id = "showPerc";

        const pctText = document.createElement("span");
        pctText.textContent = "Show % on slices";

        pctRow.appendChild(pct);
        pctRow.appendChild(pctText);

        container.appendChild(aggRow);
        container.appendChild(pctRow);

        const target = document.getElementById("aggPanel");
        if (target) {
          target.appendChild(container);
        } else {
          const app = document.getElementById("app");
          if (app && app.parentNode) app.parentNode.insertBefore(container, app);
          else document.body.insertBefore(container, document.body.firstChild);
        }
      }

      return { agg, pct };
    }



    function throttle(ms, fn) {
      let last = 0, timer = null, queuedArgs = null;
      return (...args) => {
        const now = performance.now();
        const invoke = () => { last = performance.now(); timer = null; fn(...(queuedArgs || args)); queuedArgs = null; };
        if (now - last >= ms) invoke();
        else { queuedArgs = args; if (!timer) timer = setTimeout(invoke, ms - (now - last)); }
      };
    }

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

    // ---------- Profile Avatar Rendering ----------
    function createMiniAvatar(svg, gender, height, weight) {
      const isMale = gender === 'male';
      const scale = 1.2;

      const heightNorm = (height - 149) / (201 - 149);
      const weightNorm = (weight - 39) / (131 - 39);
      const heightScale = 0.85 + (heightNorm * 0.3);
      const widthScale = 0.85 + (weightNorm * 0.3);

      const headSize = 32 * widthScale * scale;
      const headY = 80;
      const bodyWidth = (isMale ? 32 : 24) * widthScale * scale;
      const bodyHeight = 48 * heightScale * scale;
      const bodyY = headY + headSize / 2 + 2;
      const bodyX = 120 - bodyWidth / 2;

      const armWidth = (isMale ? 16 : 12) * widthScale * scale;
      const armHeight = 48 * heightScale * scale;
      const armY = bodyY;
      const leftArmX = 120 - bodyWidth / 2 - armWidth - 1 * scale;
      const rightArmX = 120 + bodyWidth / 2 + 1 * scale;

      const legWidth = 16 * widthScale * scale;
      const legHeight = 48 * heightScale * scale;
      const legY = bodyY + bodyHeight;
      const leftLegX = 120 - legWidth - 0 / 2;
      const rightLegX = 120 + 0 / 2;

      const footY = legY + legHeight + 2;
      const shoeHeight = 6 * widthScale * scale;

      const hairHeight = 6 * widthScale * scale;
      const hairWidth = headSize * 0.95;
      const hairX = 120 - hairWidth / 2;
      const hairY = headY - headSize / 2 - hairHeight + 2;

      const defs = svg.append('defs');
      const skinGradient = defs.append('linearGradient').attr('id', `skin-gradient-mini`)
        .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
      skinGradient.append('stop').attr('offset', '0%').style('stop-color', '#FFD4A3').style('stop-opacity', 1);
      skinGradient.append('stop').attr('offset', '100%').style('stop-color', '#F5C28F').style('stop-opacity', 1);

      const group = svg.append('g');

      group.append('ellipse').attr('cx', 120).attr('cy', footY + 5)
        .attr('rx', (bodyWidth + armWidth * 2) * 0.6 * 0.6).attr('ry', (bodyWidth + armWidth * 2) * 0.6 * 0.15)
        .attr('fill', '#000').attr('opacity', 0.15);

      group.append('rect').attr('fill', `url(#skin-gradient-mini)`)
        .attr('x', leftArmX).attr('y', armY).attr('width', armWidth).attr('height', armHeight);

      group.append('rect').attr('fill', `url(#skin-gradient-mini)`)
        .attr('x', leftLegX).attr('y', legY).attr('width', legWidth).attr('height', legHeight);
      group.append('rect').attr('fill', `url(#skin-gradient-mini)`)
        .attr('x', rightLegX).attr('y', legY).attr('width', legWidth).attr('height', legHeight);

      group.append('rect').attr('fill', `url(#skin-gradient-mini)`)
        .attr('x', bodyX).attr('y', bodyY).attr('width', bodyWidth).attr('height', bodyHeight);

      group.append('rect').attr('fill', `url(#skin-gradient-mini)`)
        .attr('x', rightArmX).attr('y', armY).attr('width', armWidth).attr('height', armHeight);

      group.append('rect').attr('fill', isMale ? '#7C9FB0' : '#6E8B3D')
        .attr('x', bodyX).attr('y', bodyY).attr('width', bodyWidth).attr('height', bodyHeight);

      group.append('rect').attr('fill', isMale ? '#4A5A7A' : '#78583B')
        .attr('x', Math.min(leftLegX, rightLegX)).attr('y', legY)
        .attr('width', legWidth * 2).attr('height', legHeight);

      group.append('rect').attr('fill', isMale ? '#7C9FB0' : '#6E8B3D')
        .attr('x', leftArmX).attr('y', armY).attr('width', armWidth).attr('height', armHeight);
      group.append('rect').attr('fill', isMale ? '#7C9FB0' : '#6E8B3D')
        .attr('x', rightArmX).attr('y', armY).attr('width', armWidth).attr('height', armHeight);

      group.append('rect').attr('fill', `url(#skin-gradient-mini)`)
        .attr('x', 120 - headSize / 2).attr('y', headY - headSize / 2)
        .attr('width', headSize).attr('height', headSize);

      group.append('rect').attr('fill', isMale ? '#6B4423' : '#E69138')
        .attr('x', hairX).attr('y', hairY).attr('width', hairWidth).attr('height', hairHeight);

      if (!isMale) {
        const sideHairWidth = headSize * 0.15;
        const sideHairHeight = headSize * 0.8;
        const sideHairY = headY - headSize / 2 + 4;
        group.append('rect').attr('fill', '#E69138')
          .attr('x', 120 - headSize / 2 - 2).attr('y', sideHairY)
          .attr('width', sideHairWidth).attr('height', sideHairHeight);
        group.append('rect').attr('fill', '#E69138')
          .attr('x', 120 + headSize / 2 - sideHairWidth + 2).attr('y', sideHairY)
          .attr('width', sideHairWidth).attr('height', sideHairHeight);
      }

      const eyeSize = headSize * 0.12;
      const eyeSpacing = headSize * 0.25;
      const eyeY = headY - headSize * 0.1;
      group.append('rect').attr('fill', 'white')
        .attr('x', 120 - eyeSpacing - eyeSize / 2).attr('y', eyeY - eyeSize / 2)
        .attr('width', eyeSize).attr('height', eyeSize);
      group.append('rect').attr('fill', '#333')
        .attr('x', 120 - eyeSpacing - eyeSize / 2).attr('y', eyeY - eyeSize / 2)
        .attr('width', eyeSize).attr('height', eyeSize);
      group.append('rect').attr('fill', 'white')
        .attr('x', 120 + eyeSpacing - eyeSize / 2).attr('y', eyeY - eyeSize / 2)
        .attr('width', eyeSize).attr('height', eyeSize);
      group.append('rect').attr('fill', '#333')
        .attr('x', 120 + eyeSpacing - eyeSize / 2).attr('y', eyeY - eyeSize / 2)
        .attr('width', eyeSize).attr('height', eyeSize);

      const noseSize = headSize * 0.08;
      group.append('rect').attr('fill', '#8B6F47').attr('opacity', 0.5)
        .attr('x', 120 - noseSize / 2).attr('y', headY + headSize * 0.05)
        .attr('width', noseSize).attr('height', noseSize);

      const mouthWidth = headSize * 0.35;
      const mouthHeight = headSize * 0.06;
      group.append('rect').attr('fill', '#5A3A1A').attr('opacity', 0.6)
        .attr('x', 120 - mouthWidth / 2).attr('y', headY + headSize * 0.2)
        .attr('width', mouthWidth).attr('height', mouthHeight);

      group.append('rect').attr('fill', '#333')
        .attr('x', leftLegX).attr('y', footY).attr('width', legWidth).attr('height', shoeHeight);
      group.append('rect').attr('fill', '#333')
        .attr('x', rightLegX).attr('y', footY).attr('width', legWidth).attr('height', shoeHeight);
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
      if (ui.hVal) {
        // height is stored in meters → convert to cm
        ui.hVal.text(`${Math.round(state.hMin * 100)}–${Math.round(state.hMax * 100)}`);
      }
      if (ui.wVal) {
        ui.wVal.text(`${Math.round(state.wMin)}–${Math.round(state.wMax)}`);
      }
    }

    function mean(arr, key) { return d3.mean(arr, d => d[key]); }
    function median(arr, key) { return d3.median(arr.map(d => d[key]).filter(v => !isNaN(v))); }
    function aggregate(arr, key, mode) { return mode === "median" ? median(arr, key) : mean(arr, key); }

    const tip = d3.select("body").append("div").attr("id", "tooltip");
    function showTip(html, [x, y]) { tip.html(html).style("left", x + "px").style("top", y + "px").style("opacity", 1); }
    function hideTip() { tip.style("opacity", 0); }

    ui.hSvg = ensureSvg("#heightBrushRoot", { width: 600, height: 84, ariaLabel: "Height scale", id: "heightBrush" });
    ui.wSvg = ensureSvg("#weightBrushRoot", { width: 600, height: 84, ariaLabel: "Weight scale", id: "weightBrush" });
    const donutSvg = ensureSvg("#donutRoot", { width: WIDTH, height: HEIGHT, ariaLabel: "Donut chart", id: "donut" });
    const histSvg = ensureSvg("#histRoot", { width: WIDTH, height: HEIGHT, ariaLabel: "Histogram", id: "hist" });

    const donutG = donutSvg.append("g").attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 - 65}) scale(1)`);

    // Spoon under the pokebowl for calories
    const spoonG = donutSvg.append("g")
      .attr("class", "spoon-group")
      // tweak the Y value if you want it closer/further
      .attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 + 260})`);

    spoonG.append("image")
      // change path if your spoon file is elsewhere
      .attr("href", "data/spoon.png")
      .attr("x", -320)   // center the image around (0,0)
      .attr("y", -90)
      .attr("width", 640)
      .attr("height", 160);

    const spoonText = spoonG.append("text")
      .attr("class", "spoon-text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("y", -50)
      .text("");

    const donutInner = 0;
    const donutOuter = 150;
    const outerRingInner = donutOuter + 5;
    const outerRingOuter = outerRingInner + 50;


    const pie = d3.pie().sort(null).value(d => d.value);

    const centerG = donutG.append("g").attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 - 10}) scale(1)`);
    const centerTitle = centerG.append("text").attr("class", "center-text").attr("y", -10);
    const centerValue = centerG.append("text").attr("class", "center-text").attr("y", 20);

    function renderDonut() {
      const data = state.filtered;
      donutG.selectAll("path.arc").filter(function () {
        return !d3.select(this).classed("inner") && !d3.select(this).classed("outer");
      }).remove();
      const carbsMean = mean(data, "Carbs") ?? 0, carbsMedian = median(data, "Carbs") ?? 0;
      const protMean = mean(data, "Proteins") ?? 0, protMedian = median(data, "Proteins") ?? 0;
      const fatMean = mean(data, "Fats") ?? 0, fatMedian = median(data, "Fats") ?? 0;

      const aggVal = (k) => aggregate(data, k, state.agg) ?? 0;

      const innerStats = [
        { key: "Carbs", value: aggVal("Carbs"), mean: carbsMean, median: carbsMedian, image: "carbon_rice.png" },
        { key: "Proteins", value: aggVal("Proteins"), mean: protMean, median: protMedian, image: "protein_fish.png" },
        { key: "Fats", value: aggVal("Fats"), mean: fatMean, median: fatMedian, image: "fat_avocado.png" }
      ];

      const outerRingStats = [{ key: "VeggieRing", value: 1, image: "veggie.png" }];

      const kcalAgg = aggregate(data, "Calories", state.agg);

      // Update spoon text: mean or median calories depending on Analysis Options
      if (typeof spoonText !== "undefined") {
        if (!data.length || !isFinite(kcalAgg)) {
          spoonText.text("No data");
        } else {
          const label = state.agg === "mean" ? "Mean" : "Median";
          spoonText.text(`${label}: ${d3.format(".0f")(kcalAgg)} kcal`);
        }
      }

      const innerArcs = pie(innerStats);
      const outerRingArcs = d3.pie().sort(null).value(d => d.value)(outerRingStats);

      const total = innerStats.reduce((s, d) => s + (isFinite(d.value) ? d.value : 0), 0);
      const pct = (v) => !total || !isFinite(v) ? "0%" : d3.format(".0%")(v / total);

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

      const pieArc = d3.arc().innerRadius(donutInner).outerRadius(donutOuter).padAngle(0.02).cornerRadius(8);
      const paths = donutG.selectAll("path.arc.inner").data(innerArcs, d => d.data.key);

      paths.join(
        enter => enter.append("path").attr("class", "arc inner")
          .attr("fill", d => `url(#pattern-${d.data.key})`)
          .each(function (d) { this._current = d; })
          .attr("d", pieArc)
          .on("click", (ev, d) => onSliceClick(d))
          .on("mousemove", (ev, d) => {
            const fmt = d3.format(".2f");
            const html = `
                          <div class="tip-title">${d.data.key}</div>
                          <div class="tip-row">
                            <span>Mean</span>
                            <span>${fmt(d.data.mean)}</span>
                          </div>
                          <div class="tip-row">
                            <span>Median</span>
                            <span>${fmt(d.data.median)}</span>
                          </div>
                        `;
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

      const outerRingArc = d3.arc().innerRadius(outerRingInner).outerRadius(outerRingOuter).padAngle(0.005).cornerRadius(0);
      const outerPaths = donutG.selectAll("path.arc.outer").data(outerRingArcs, d => d.data.key);

      outerPaths.join(
        enter => enter.append("path").attr("class", "arc outer")
          .attr("fill", d => `url(#pattern-${d.data.key})`)
          .each(function (d) { this._current = d; })
          .attr("d", outerRingArc)
          .on("click", (ev) => ev.stopPropagation())
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

      const labelRadius = donutOuter + 90;
      const bendRadius = donutOuter + 80;
      const labelArc = d3.arc().innerRadius(labelRadius).outerRadius(labelRadius);
      const bendArc = d3.arc().innerRadius(bendRadius).outerRadius(bendRadius);
      const midAngle = d => (d.startAngle + d.endAngle) / 2;

      const leaders = donutG.selectAll("path.slice-leader")
        .data(innerArcs, d => d.data.key);

      leaders.join(
        enter => enter.append("path")
          .attr("class", "slice-leader")
          .attr("d", d => {
            const c0 = d3.arc().innerRadius(donutOuter).outerRadius(donutOuter).centroid(d);
            const c1 = bendArc.centroid(d);
            const c2 = labelArc.centroid(d);
            c2[0] = (midAngle(d) < Math.PI) ? labelRadius : -labelRadius;
            return `M${c0[0]},${c0[1]} L${c1[0]},${c1[1]} L${c2[0]},${c2[1]}`;
          })
          .attr("opacity", d => d.data.value > 0 ? 1 : 0),
        update => update
          .transition().duration(DUR.arc).ease(EASE.main)
          .attr("d", d => {
            const c0 = d3.arc().innerRadius(donutOuter).outerRadius(donutOuter).centroid(d);
            const c1 = bendArc.centroid(d);
            const c2 = labelArc.centroid(d);
            c2[0] = (midAngle(d) < Math.PI) ? labelRadius : -labelRadius;
            return `M${c0[0]},${c0[1]} L${c1[0]},${c1[1]} L${c2[0]},${c2[1]}`;
          })
          .attr("opacity", d => d.data.value > 0 ? 1 : 0),
        exit => exit.transition().duration(150).style("opacity", 0).remove()
      );

      const labels = donutG.selectAll("text.out-label")
        .data(innerArcs, d => d.data.key);

      labels.join(
        enter => enter.append("text")
          .attr("class", "out-label")
          .attr("dy", "0.32em")
          .text(d => {
            const base = state.showPerc ? `${d.data.key} ${pct(d.data.value)}` : d.data.key;
            return base;
          })
          .attr("text-anchor", d => (midAngle(d) < Math.PI) ? "start" : "end")
          .attr("transform", d => {
            const p = labelArc.centroid(d);
            p[0] = (midAngle(d) < Math.PI) ? labelRadius : -labelRadius;
            return `translate(${p[0]},${p[1]})`;
          })
          .attr("opacity", d => d.data.value > 0 ? 1 : 0),
        update => update
          .text(d => state.showPerc ? `${d.data.key} ${pct(d.data.value)}` : d.data.key)
          .transition().duration(DUR.arc).ease(EASE.main)
          .attr("text-anchor", d => (midAngle(d) < Math.PI) ? "start" : "end")
          .attr("transform", d => {
            const p = labelArc.centroid(d);
            p[0] = (midAngle(d) < Math.PI) ? labelRadius : -labelRadius;
            return `translate(${p[0]},${p[1]})`;
          })
          .attr("opacity", d => d.data.value > 0 ? 1 : 0),
        exit => exit.transition().duration(150).style("opacity", 0).remove()
      );

      centerTitle.text(`NOT ENOUGH DATA`);
    }

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

    function onSliceClick(d) {
      const selectedKey = d.data.key;

      // remember which attribute we’re showing
      state.mode = "hist";
      state.histAttr = selectedKey;

      // hide donut card, show histogram card (same place)
      d3.select("#donutCard").classed("hidden", true);
      d3.select("#histCard").classed("hidden", false);

      // render the histogram for this nutrient
      renderHistogram(selectedKey);

      // enable back button
      if (ui.back) ui.back.attr("disabled", null);
    }


    function resetDonutVisualState() {
      const pieArc = d3.arc().innerRadius(donutInner).outerRadius(donutOuter).padAngle(0.02).cornerRadius(8);
      const outerRingArc = d3.arc().innerRadius(outerRingInner).outerRadius(outerRingOuter).padAngle(0.005).cornerRadius(0);

      donutG.attr("transform", `translate(${WIDTH / 2}, ${HEIGHT / 2 + 16}) scale(1)`);

      donutG.selectAll("path.arc.inner").interrupt().style("opacity", 1).transition().duration(0).attr("d", d => pieArc(d));
      donutG.selectAll("text.slice-label").interrupt().style("opacity", d => d.data.value > 0 ? 1 : 0.0001);

      donutG.selectAll("path.arc.outer").interrupt().style("opacity", 1).transition().duration(0).attr("d", d => outerRingArc(d));
    }

    function toDonut() {
      if (state.mode !== "hist") return;

      state.mode = "donut";
      state.histAttr = null;

      // hide histogram, show donut again
      d3.select("#histCard").classed("hidden", true);
      d3.select("#donutCard").classed("hidden", false);

      renderDonut();

      // disable back button (no histogram open)
      if (ui.back) ui.back.attr("disabled", true);
    }


    function onDropdownChange() {
      state.sport = ui.sport.node() ? ui.sport.property("value") : "All";
      state.gender = ui.gender.node() ? ui.gender.property("value") : "All";
      applyFilters();
      if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
    }

    let heightBrush, weightBrush;
    // --- Profile-style brush for Explorer (looks like your screenshot) ---
    function createExplorerBrush(containerSelector, config) {
      const {
        type,          // "height" or "weight"
        min, max,      // domain (cm for height, kg for weight)
        defaultMin,
        defaultMax,
        onChange       // ([min, max], snapped)
      } = config;

      const container = d3.select(containerSelector);
      container.html("");

      const width = container.node().getBoundingClientRect().width || 500;
      const height = 84;

      const margin = { top: 10, right: 20, bottom: 24, left: 20 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .domain([min, max])
        .range([0, innerW]);

      // Tick style like your screenshot
      let tickValues;
      if (type === "height") {
        // still using meters internally, but show labels in cm
        tickValues = [1.5, 1.6, 1.7, 1.8, 1.9, 2.0];
      } else {
        tickValues = [40, 55, 70, 85, 100, 115, 130];
      }

      const axis = d3.axisBottom(x)
        .tickValues(tickValues)
        .tickFormat(d =>
          type === "height"
            ? d3.format("d")(d * 100)    // 1.6 → "160"
            : d3.format("d")(d)          // weight stays as 40, 60, ...
        );


      g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerH})`)
        .call(axis);

      // Pale track behind the brush selection
      g.append("line")
        .attr("class", "track")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", innerH / 2)
        .attr("y2", innerH / 2);

      const brush = d3.brushX()
        .extent([[0, innerH / 2 - 12], [innerW, innerH / 2 + 12]])
        .handleSize(5)
        .on("brush", brushed)
        .on("end", brushEnded);

      const brushG = g.append("g")
        .attr("class", "brush")
        .call(brush);

      const handles = brushG.selectAll(".handle--custom")
        .data([{ type: "w" }, { type: "e" }])
        .enter()
        .append("rect")
        .attr("class", "handle handle--custom")
        .attr("width", 4)
        .attr("height", 24)
        .attr("y", innerH / 2 - 12)
        .attr("rx", 2)
        .attr("ry", 2);

      // Initial range
      brushG.call(brush.move, [x(defaultMin), x(defaultMax)]);

      function brushed(ev) {
        if (!ev.selection) return;
        const [x0, x1] = ev.selection;
        handles.attr("x", (_, i) => (i === 0 ? x0 - 2 : x1 - 2));
        const v0 = x.invert(x0);
        const v1 = x.invert(x1);
        onChange([v0, v1], false);
      }

      function brushEnded(ev) {
        if (!ev.selection) return;
        const [x0, x1] = ev.selection;
        const v0 = snap(x.invert(x0));
        const v1 = snap(x.invert(x1));
        const s0 = x(v0);
        const s1 = x(v1);

        d3.select(this)
          .transition()
          .duration(80)
          .call(brush.move, [s0, s1]);

        handles
          .transition()
          .duration(80)
          .attr("x", (_, i) => (i === 0 ? s0 - 2 : s1 - 2));

        onChange([v0, v1], true);
      }

      function snap(v) {
        const step = (type === "height") ? 0.01 : 1; // 0.01 m, 1 kg
        const clamped = Math.min(Math.max(v, min), max);
        return Math.round(clamped / step) * step;
      }

      return {
        setRange([v0, v1]) {
          brushG.call(brush.move, [x(v0), x(v1)]);
        }
      };
    }



    const liveUpdateThrottled = throttle(LIVE_PREVIEW_MS, () => {
      if (!LIVE_PREVIEW) return;
      applyFilters();
      if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
    });

    (async function init() {
      try {
        const raw = await loadFirstAvailable(CANDIDATE_PATHS);
        state.raw = raw;

        const created = ensureAggControls();
        ui.aggSel = created.agg; ui.showPerc = created.pct;
        ui.aggSel.addEventListener("change", () => { state.agg = ui.aggSel.value; if (state.mode === "donut") renderDonut(); });
        ui.showPerc.addEventListener("change", () => { state.showPerc = ui.showPerc.checked; if (state.mode === "donut") renderDonut(); });

        const hExtent = d3.extent(raw.map(d => d.height).filter(v => !isNaN(v)));
        const wExtent = d3.extent(raw.map(d => d.weight).filter(v => !isNaN(v)));
        state.domain.h = [+(hExtent?.[0] ?? 1.2), +(hExtent?.[1] ?? 2.2)];
        state.domain.w = [+(wExtent?.[0] ?? 40), +(wExtent?.[1] ?? 140)];
        state.hMin = state.domain.h[0]; state.hMax = state.domain.h[1];
        state.wMin = state.domain.w[0]; state.wMax = state.domain.w[1];

        const userGender = localStorage.getItem('gender');
        const userHeight = localStorage.getItem('height');
        const userWeight = localStorage.getItem('weight');
        const userHeightMin = localStorage.getItem('height_min');
        const userHeightMax = localStorage.getItem('height_max');
        const userWeightMin = localStorage.getItem('weight_min');
        const userWeightMax = localStorage.getItem('weight_max');

        if (userGender) {
          state.gender = userGender.charAt(0).toUpperCase() + userGender.slice(1);
        }

        if (userHeightMin && userHeightMax) {
          state.hMin = +userHeightMin / 100;
          state.hMax = +userHeightMax / 100;
        } else if (userHeight) {
          const heightM = +userHeight / 100;
          const range = 0.05;
          state.hMin = Math.max(state.domain.h[0], heightM - range);
          state.hMax = Math.min(state.domain.h[1], heightM + range);
        }

        if (userWeightMin && userWeightMax) {
          state.wMin = +userWeightMin;
          state.wMax = +userWeightMax;
        } else if (userWeight) {
          const weight = +userWeight;
          const range = 5;
          state.wMin = Math.max(state.domain.w[0], weight - range);
          state.wMax = Math.min(state.domain.w[1], weight + range);
        }

        if (userGender && userHeight && userWeight) {
          const profileSvg = d3.select('#profile-avatar-svg');
          createMiniAvatar(profileSvg, userGender, +userHeight, +userWeight);

          d3.select('#profile-gender').text(userGender.charAt(0).toUpperCase() + userGender.slice(1));
          d3.select('#profile-height').text(`${userHeight} cm`);
          d3.select('#profile-weight').text(`${userWeight} kg`);

          d3.select('#edit-profile-btn').on('click', () => {
            localStorage.setItem('from_main', '1');

            localStorage.setItem('gender', (state.gender || 'All').toLowerCase());

            localStorage.setItem('height_mode', 'range');
            localStorage.setItem('weight_mode', 'range');

            localStorage.setItem('height_min', Math.round(state.hMin * 100));
            localStorage.setItem('height_max', Math.round(state.hMax * 100));

            localStorage.setItem('weight_min', Math.round(state.wMin));
            localStorage.setItem('weight_max', Math.round(state.wMax));

            localStorage.setItem('height', Math.round((state.hMin * 100 + state.hMax * 100) / 2));
            localStorage.setItem('weight', Math.round((state.wMin + state.wMax) / 2));

            window.location.href = 'profile_page.html';
          });

        }

        if (ui.gender.node()) {
          ui.gender.node().parentElement.style.display = 'none';
        }

        if (ui.sport.node()) {
          const sports = Array.from(new Set(raw.map(d => d.Sport).filter(Boolean))).sort();
          ui.sport.selectAll("option").data(["All", ...sports]).join("option").attr("value", d => d).text(d => d);
          ui.sport.on("change", onDropdownChange);
        }
        if (ui.gender.node()) {
          const genders = Array.from(new Set(raw.map(d => d.Gender).filter(Boolean))).sort();
          ui.gender.selectAll("option").data(["All", ...genders]).join("option").attr("value", d => d).text(d => d);
          ui.gender.on("change", onDropdownChange);
          if (userGender) {
            ui.gender.property("value", state.gender);
          }
        }

        // After we have state.domain.h / state.domain.w and user preferences:

        // Decide initial height range in cm (149-201)
        let initHeightMinCm = 149;
        let initHeightMaxCm = 201;

        // If user has specific height range saved in cm:
        if (userHeightMin && userHeightMax) {
          initHeightMinCm = Math.max(149, Math.min(201, +userHeightMin));
          initHeightMaxCm = Math.max(149, Math.min(201, +userHeightMax));
        } else if (userHeight) {
          // exact height in cm → ±5cm range
          const h = +userHeight;
          initHeightMinCm = Math.max(149, h - 5);
          initHeightMaxCm = Math.min(201, h + 5);
        }

        // Update state for filtering (convert to meters)
        state.hMin = initHeightMinCm / 100;
        state.hMax = initHeightMaxCm / 100;

        // Weight in kg: 39-131
        let initWeightMinKg = 39;
        let initWeightMaxKg = 131;

        if (userWeightMin && userWeightMax) {
          initWeightMinKg = Math.max(39, Math.min(131, +userWeightMin));
          initWeightMaxKg = Math.max(39, Math.min(131, +userWeightMax));
        } else if (userWeight) {
          const w = +userWeight;
          initWeightMinKg = Math.max(39, w - 5);
          initWeightMaxKg = Math.min(131, w + 5);
        }

        state.wMin = initWeightMinKg;
        state.wMax = initWeightMaxKg;

        // Height / weight domains already computed from data:
        state.hMin = state.domain.h[0];
        state.hMax = state.domain.h[1];
        state.wMin = state.domain.w[0];
        state.wMax = state.domain.w[1];

        // If user preferences exist, override:
        if (userHeightMin && userHeightMax) {
          state.hMin = +userHeightMin / 100;
          state.hMax = +userHeightMax / 100;
        } else if (userHeight) {
          const h = +userHeight / 100;
          state.hMin = Math.max(state.domain.h[0], h - 0.05);
          state.hMax = Math.min(state.domain.h[1], h + 0.05);
        }
        if (userWeightMin && userWeightMax) {
          state.wMin = +userWeightMin;
          state.wMax = +userWeightMax;
        } else if (userWeight) {
          const w = +userWeight;
          state.wMin = Math.max(state.domain.w[0], w - 5);
          state.wMax = Math.min(state.domain.w[1], w + 5);
        }

        // Create profile-style brushes that look like the screenshot
        heightBrush = createExplorerBrush("#heightBrushRoot", {
          type: "height",
          min: state.domain.h[0],
          max: state.domain.h[1],
          defaultMin: state.hMin,
          defaultMax: state.hMax,
          onChange: ([v0, v1], snapped) => {
            state.hMin = Math.min(v0, v1);
            state.hMax = Math.max(v0, v1);
            updateFilterPills();
            if (snapped) {
              applyFilters();
              if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
            } else {
              liveUpdateThrottled();
            }
          }
        });

        weightBrush = createExplorerBrush("#weightBrushRoot", {
          type: "weight",
          min: state.domain.w[0],
          max: state.domain.w[1],
          defaultMin: state.wMin,
          defaultMax: state.wMax,
          onChange: ([v0, v1], snapped) => {
            state.wMin = Math.min(v0, v1);
            state.wMax = Math.max(v0, v1);
            updateFilterPills();
            if (snapped) {
              applyFilters();
              if (state.mode === "donut") renderDonut(); else renderHistogram(state.histAttr);
            } else {
              liveUpdateThrottled();
            }
          }
        });

        updateFilterPills();

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

        ui.back && ui.back.on("click", () => toDonut());

      } catch (err) {
        console.error(err);
        const app = d3.select("body");
        app.append("pre").style("color", "#b00020").text(String(err));
      }
    })();

  } catch (e) { console.error('Main init error:', e); }
})();
