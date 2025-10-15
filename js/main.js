(function () {
    const APP_ID = 'app';
    const DEFAULT_PATH = 'data/Final_data.csv';

    // color scale
    const color = d3.scaleOrdinal()
        .domain(['Carbs', 'Proteins', 'Fats'])
        .range(['#4e79a7', '#59a14f', '#e15759']);

    // dimensions
    const width = 760, height = 420, donutOuter = 150, donutInner = 85;
    const histWidth = 760, histHeight = 360, margin = { top: 36, right: 24, bottom: 52, left: 64 };

    // attribute aliases
    const ALIAS = {
        height: ['Height(m)', 'Height (m)'],
        weight: ['Weight(kg)', 'Weight (kg)'],
        carbs: ['Carbs'],
        proteins: ['Proteins'],
        fats: ['Fats'],
        calories: ['Calories'],
        sport: ['Name of Exercise', 'Sport', 'Exercise'],
        gender: ['Gender']
    };

    // Main container
    let app = d3.select(`#${APP_ID}`);
    if (app.empty()) app = d3.select('body').append('div').attr('id', APP_ID);

    // Layout containers
    const controls = app.append('div').attr('class', 'controls')
        .style('display', 'grid')
        .style('grid-template-columns', '1fr 1fr')
        .style('gap', '12px')
        .style('align-items', 'center')
        .style('margin', '12px 0 8px');

    const ranges = controls.append('div').style('display', 'grid')
        .style('grid-template-columns', '1fr')
        .style('gap', '10px');

    const selects = controls.append('div').style('display', 'grid')
        .style('grid-template-columns', '1fr 1fr')
        .style('gap', '10px');

    const vizWrap = app.append('div').attr('id', 'viz-wrap')
        .style('display', 'grid')
        .style('grid-template-columns', '1fr')
        .style('gap', '16px');

    // Card: Donut Chart
    const chartCard = vizWrap.append('div')
        .style('border', '1px solid #333')
        .style('border-radius', '12px')
        .style('padding', '10px');

    const chartHeader = chartCard.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'space-between')
        .style('gap', '10px');

    chartHeader.append('h3').text('Average Macros (by filters)').style('margin', '6px 0');

    const backBtn = chartHeader.append('button')
        .text('Back to Donut Chart')
        .attr('disabled', true)
        .style('padding', '6px 10px')
        .on('click', () => {
            backBtn.attr('disabled', true);
            state.mode = 'donut';
            state.histAttr = null;
            update();
        });

    const chart = chartCard.append('div').attr('id', 'chart');

    // Card: Histogram
    const histCard = vizWrap.append('div')
        .style('border', '1px solid #333')
        .style('border-radius', '12px')
        .style('padding', '10px');

    histCard.append('h3').text('Distribution (Histogram)').style('margin', '6px 0');
    const histogramWrap = histCard.append('div').attr('id', 'histogram');

    // Utility functions
    const roundInt = v => (Number.isFinite(v) ? Math.round(v) : 0);
    const snapToStep = (v, step, [min, max]) => {
        const s = Math.round(v / step) * step;
        return Math.max(min, Math.min(max, s));
    };
    const pickFirst = (obj, keys) => {
        for (const k of keys) {
            if (obj[k] !== undefined && obj[k] !== '') return obj[k];
        }
        return undefined;
    };
    const toNumber = v => {
        if (v === null || v === undefined) return NaN;
        const x = +(`${v}`.toString().replace(',', '.')); // support decimal commas
        return Number.isFinite(x) ? x : NaN;
    };

    function cleanRow(row) {
        const r = {};
        for (const k in row) r[k.trim()] = row[k];

        return {
            'Height(m)': toNumber(pickFirst(r, ALIAS.height)),
            'Weight(kg)': toNumber(pickFirst(r, ALIAS.weight)),
            'Carbs': toNumber(pickFirst(r, ALIAS.carbs)),
            'Proteins': toNumber(pickFirst(r, ALIAS.proteins)),
            'Fats': toNumber(pickFirst(r, ALIAS.fats)),
            'Calories': toNumber(pickFirst(r, ALIAS.calories)),
            'Sport': pickFirst(r, ALIAS.sport),
            'Gender': pickFirst(r, ALIAS.gender)
        };
    }

    function parseTextToRows(text) {
        const hasComma = text.includes(',');
        const hasSemi = text.includes(';');
        if (hasComma && !hasSemi) return d3.csvParse(text, cleanRow);
        if (!hasComma && hasSemi) return d3.dsvFormat(';').parse(text, cleanRow);
        // If both or neither exist, default to comma
        return d3.csvParse(text, cleanRow);
    }

    const CANDIDATE_PATHS = [
        DEFAULT_PATH,
        './data/meal_metadata.csv',
        'meal_metadata.csv',
        './meal_metadata.csv'
    ];

    async function loadData(paths) {
        const errors = [];
        for (const p of paths) {
            try {
                const txt = await d3.text(p);
                const rows = parseTextToRows(txt);
                if (!rows || !rows.length) throw new Error('File is empty or contains no valid data');
                return rows;
            } catch (e) {
                errors.push(`${p} -> ${e.message}`);
            }
        }
        throw new Error('All candidate paths failed:\n' + errors.join('\n'));
    }

    // Brush Slider with step-snapping — Fix for recursive stack overflow: only snap back on user-triggered 'end' events
    function createBrushSlider(container, { title, domain, step, width = 720, height = 60, onChange }) {
        const wrap = container.append('div').style('display', 'grid').style('gap', '4px');
        const labelRow = wrap.append('div').style('display', 'flex').style('justify-content', 'space-between');
        labelRow.append('div').text(title);
        const valLabel = labelRow.append('div').text('');

        const svg = wrap.append('svg').attr('width', width).attr('height', height);
        const padding = { left: 12, right: 12 };
        const x = d3.scaleLinear().domain(domain).range([padding.left, width - padding.right]);

        svg.append('g')
            .attr('transform', `translate(0, ${height - 18})`)
            .call(d3.axisBottom(x).ticks(6));

        svg.append('rect')
            .attr('x', x.range()[0])
            .attr('y', 16)
            .attr('width', x.range()[1] - x.range()[0])
            .attr('height', 12)
            .attr('fill', '#2a2a2a')
            .attr('rx', 6);

        const brush = d3.brushX()
            .extent([[x.range()[0], 10], [x.range()[1], 38]])
            .on('brush end', brushed);

        const gBrush = svg.append('g').attr('class', 'brush').call(brush);
        gBrush.call(brush.move, x.range()); // Initially select the entire range

        function brushed(event) {
            const { selection, type, sourceEvent } = event;
            if (!selection) return;
            const [x0, x1] = selection.map(x.invert);
            const v0 = snapToStep(x0, step, domain);
            const v1 = snapToStep(x1, step, domain);
            valLabel.text(`${v0.toFixed(step < 1 ? 2 : 0)} – ${v1.toFixed(step < 1 ? 2 : 0)}`);

            // Only snap the brush on 'end' events triggered by user interaction to avoid stack overflow from programmatic 'move' events.
            if (type === 'end' && sourceEvent) {
                gBrush.call(brush.move, [x(v0), x(v1)]);
            }
            onChange && onChange([v0, v1]);
        }

        return {
            setRange(min, max) {
                const v0 = snapToStep(min, step, domain);
                const v1 = snapToStep(max, step, domain);
                valLabel.text(`${v0.toFixed(step < 1 ? 2 : 0)} – ${v1.toFixed(step < 1 ? 2 : 0)}`);
                gBrush.call(brush.move, [x(v0), x(v1)]);
            }
        };
    }

    // Global state
    const state = {
        data: [],
        height: [NaN, NaN],
        weight: [NaN, NaN],
        sport: 'All',
        gender: 'All',
        mode: 'donut',  // or 'hist'
        histAttr: null
    };

    // Donut chart elements
    const donutSvg = chart.append('svg').attr('width', width).attr('height', height);
    const donutG = donutSvg.append('g').attr('transform', `translate(${width / 2}, ${height / 2 + 10})`);
    const arc = d3.arc().innerRadius(donutInner).outerRadius(donutOuter).padAngle(0.015).cornerRadius(6);
    const pie = d3.pie().value(d => d.value).sort(null);
    const centerGroup = donutG.append('g').attr('text-anchor', 'middle').style('cursor', 'default');
    const kcalText = centerGroup.append('text').attr('dy', '-0.15em').style('font-size', '28px').style('font-weight', 700);
    centerGroup.append('text').attr('dy', '1.2em').style('fill', '#aaa').style('font-size', '12px').text('Avg Calories');

    const legend = donutSvg.append('g').attr('transform', `translate(${width - 140}, 20)`);
    ['Carbs', 'Proteins', 'Fats'].forEach((k, i) => {
        const g = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
        g.append('rect').attr('width', 14).attr('height', 14).attr('fill', color(k)).attr('rx', 3);
        g.append('text').attr('x', 20).attr('y', 12).text(k).style('font-size', '12px');
    });

    // Histogram elements
    const histSvg = histogramWrap.append('svg').attr('width', histWidth).attr('height', histHeight);
    const histG = histSvg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    const histInnerW = histWidth - margin.left - margin.right;
    const histInnerH = histHeight - margin.top - margin.bottom;
    const histX = d3.scaleLinear().range([0, histInnerW]);
    const histY = d3.scaleLinear().range([histInnerH, 0]);
    const histXAxisG = histG.append('g').attr('transform', `translate(0, ${histInnerH})`);
    const histYAxisG = histG.append('g');
    const histBarsG = histG.append('g');
    const histTitle = histSvg.append('text').attr('x', margin.left).attr('y', 22).style('font-weight', 700).text('');
    const xLab = histSvg.append('text')
        .attr('x', margin.left + histInnerW / 2)
        .attr('y', histHeight - 8)
        .attr('text-anchor', 'middle')
        .style('fill', '#aaa');
    histSvg.append('text')
        .attr('transform', `translate(16, ${margin.top + histInnerH / 2}) rotate(-90)`)
        .attr('text-anchor', 'middle')
        .style('fill', '#aaa')
        .text('Count');

    // Dropdown builder function
    function buildSelect(container, label, options, onChange) {
        const wrap = container.append('label').style('display', 'grid').style('gap', '6px');
        wrap.append('div').text(label);
        const sel = wrap.append('select')
            .style('padding', '6px 8px')
            .style('border-radius', '8px');
        sel.selectAll('option')
            .data(options)
            .enter()
            .append('option')
            .attr('value', d => d)
            .text(d => d);
        sel.on('change', (e) => onChange(e.target.value));
    }

    // Filtering, computation, and rendering
    function filterData(rows) {
        const st = state;
        return rows.filter(d =>
            d['Height(m)'] >= st.height[0] && d['Height(m)'] <= st.height[1] &&
            d['Weight(kg)'] >= st.weight[0] && d['Weight(kg)'] <= st.weight[1] &&
            (st.sport === 'All' || d.Sport === st.sport) &&
            (st.gender === 'All' || d.Gender === st.gender)
        );
    }

    function computeAverages(rows) {
        if (!rows.length) return { Carbs: 0, Proteins: 0, Fats: 0, Calories: 0 };
        const mean = k => d3.mean(rows, d => d[k]);
        return {
            Carbs: roundInt(mean('Carbs')),
            Proteins: roundInt(mean('Proteins')),
            Fats: roundInt(mean('Fats')),
            Calories: roundInt(mean('Calories'))
        };
    }

    function renderDonut(rows) {
        state.mode = 'donut';
        state.histAttr = null;
        backBtn.attr('disabled', true);

        const avg = computeAverages(rows);
        const data = [
            { key: 'Carbs', value: avg.Carbs },
            { key: 'Proteins', value: avg.Proteins },
            { key: 'Fats', value: avg.Fats }
        ];

        kcalText.text(Number.isFinite(avg.Calories) ? `${avg.Calories}` : '—');

        const pieData = pie(data);

        // 1) Bind data
        const arcs = donutG.selectAll('path.arc').data(pieData, d => d.data.key);

        // 2) Enter: Grow from a zero-angle arc and store the current state
        const arcsEnter = arcs.enter()
            .append('path')
            .attr('class', 'arc')
            .attr('fill', d => color(d.data.key))
            .attr('stroke', '#111')
            .attr('stroke-width', 1)
            .on('click', (_, d) => {
                state.mode = 'hist';
                state.histAttr = d.data.key;
                backBtn.attr('disabled', false);
                renderHistogram(filterData(state.data), d.data.key);
            })
            .each(function(d) {
                // Initial state: start and end angles are the same (zero arc)
                this._current = { startAngle: d.startAngle, endAngle: d.startAngle };
            });

        // 3) Enter+Update: Smoothly transition from the previous state to the new state
        arcsEnter.merge(arcs)
            .transition().duration(700).ease(d3.easeCubicInOut)
            .attrTween('d', function(d) {
                const i = d3.interpolate(this._current, d);
                this._current = i(1); // Remember the current state for the next transition
                return t => arc(i(t));
            });

        // 4) Exit: Smoothly shrink to a zero-angle arc and then remove
        arcs.exit()
            .transition().duration(500).ease(d3.easeCubicInOut)
            .attrTween('d', function(d) {
                const end0 = { startAngle: d.endAngle, endAngle: d.endAngle };
                const i = d3.interpolate(this._current || d, end0);
                return t => arc(i(t));
            })
            .remove();

        // 5) Interpolate label positions as well
        const labels = donutG.selectAll('text.slice-label').data(pieData, d => d.data.key);

        const labelsEnter = labels.enter().append('text')
            .attr('class', 'slice-label')
            .style('font-size', '12px')
            .style('fill', '#ddd')
            .attr('text-anchor', 'middle')
            .style('opacity', 0) // Start transparent for fade-in
            .each(function(d){ this._current = { startAngle: d.startAngle, endAngle: d.startAngle }; });

        labelsEnter.merge(labels)
            .transition().duration(700).ease(d3.easeCubicInOut)
            .tween('pos', function(d){
                const i = d3.interpolate(this._current, d);
                this._current = i(1);
                return t => d3.select(this).attr('transform', `translate(${arc.centroid(i(t))})`);
            })
            // Improvement: Fade labels in or out depending on their value
            .style('opacity', d => d.data.value > 0 ? 1 : 0)
            .text(d => `${d.data.key}: ${d.data.value}`);

        labels.exit().transition().duration(300).style('opacity', 0).remove();
    }

    function renderHistogram(rows, attr) {
        state.mode = 'hist';
        state.histAttr = attr;
        backBtn.attr('disabled', false);

        histTitle.text(`${attr} — Histogram`);
        xLab.text(attr);

        const values = rows.map(d => +d[attr]).filter(Number.isFinite);
        const safe = values.length ? values : [0];

        const vMin = d3.min(safe), vMax = d3.max(safe);
        const pad = (vMax - vMin) * 0.05 || 1;
        histX.domain([vMin - pad, vMax + pad]);

        const bins = d3.bin().domain(histX.domain()).thresholds(20)(safe);
        histY.domain([0, d3.max(bins, b => b.length) || 1]);

        histXAxisG.transition().duration(400).call(d3.axisBottom(histX));
        histYAxisG.transition().duration(400).call(d3.axisLeft(histY));

        const bars = histBarsG.selectAll('rect').data(bins);
        bars.enter().append('rect')
            .attr('x', d => histX(d.x0))
            .attr('y', histInnerH)
            .attr('width', d => Math.max(0, histX(d.x1) - histX(d.x0) - 1))
            .attr('height', 0)
            .attr('fill', color(attr))
            .attr('rx', 2)
            .merge(bars)
            .transition().duration(500)
            .attr('x', d => histX(d.x0))
            .attr('y', d => histY(d.length))
            .attr('width', d => Math.max(0, histX(d.x1) - histX(d.x0) - 1))
            .attr('height', d => histInnerH - histY(d.length));

        bars.exit().transition().duration(300).attr('y', histInnerH).attr('height', 0).remove();
    }

    function update() {
        const rows = filterData(state.data);
        if (state.mode === 'donut') renderDonut(rows);
        else if (state.mode === 'hist' && state.histAttr) renderHistogram(rows, state.histAttr);
    }

    // Initialization: Load data + create controls
    loadData(CANDIDATE_PATHS)
        .then(rows => {
            // Clean and perform initial filtering
            const clean = rows.filter(d =>
                Number.isFinite(d['Height(m)']) &&
                Number.isFinite(d['Weight(kg)']) &&
                Number.isFinite(d['Carbs']) &&
                Number.isFinite(d['Proteins']) &&
                Number.isFinite(d['Fats']) &&
                Number.isFinite(d['Calories'])
            );

            if (!clean.length) throw new Error('CSV has 0 valid records (check column names or data format)');

            state.data = clean;

            // Dropdown options
            const sports = Array.from(new Set(clean.map(d => d.Sport).filter(v => v != null && v !== ''))).sort();
            const genders = Array.from(new Set(clean.map(d => d.Gender).filter(v => v != null && v !== ''))).sort();
            buildSelect(selects, 'Sport', ['All', ...sports], v => { state.sport = v; update(); });
            buildSelect(selects, 'Gender', ['All', ...genders], v => { state.gender = v; update(); });

            // Sliders
            const hMin = d3.min(clean, d => d['Height(m)']);
            const hMax = d3.max(clean, d => d['Height(m)']);
            const wMin = d3.min(clean, d => d['Weight(kg)']);
            const wMax = d3.max(clean, d => d['Weight(kg)']);

            const hStep = 0.05, wStep = 2;
            state.height = [hMin, hMax].map(v => snapToStep(v, hStep, [hMin, hMax]));
            state.weight = [wMin, wMax].map(v => snapToStep(v, wStep, [wMin, wMax]));

            const heightSlider = createBrushSlider(ranges, {
                title: 'Height Range (m) — Step 0.05m',
                domain: [hMin, hMax],
                step: hStep,
                onChange: rng => { state.height = rng; update(); }
            });
            const weightSlider = createBrushSlider(ranges, {
                title: 'Weight Range (kg) — Step 2kg',
                domain: [wMin, wMax],
                step: wStep,
                onChange: rng => { state.weight = rng; update(); }
            });
            heightSlider.setRange(state.height[0], state.height[1]);
            weightSlider.setRange(state.weight[0], state.weight[1]);

            // Initial render
            update();
        })
        .catch(err => {
            console.error('[CSV Load Failure Diagnosis]', err);
            const tip = [
                'Data loading failed:',
                err.message,
                ].join('\n');
            app.append('pre')
                .style('white-space', 'pre-wrap')
                .style('color', 'tomato')
                .style('font-size', '13px')
                .text(tip);
        });
})();