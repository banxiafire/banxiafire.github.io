// ====== Profile Page JS (was first IIFE in merged file) ======
(function () {
  if (!document.getElementById('avatar-svg')) return;
  try {
    // ========== STATE MANAGEMENT ==========
    const state = {
      gender: 'male',
      height: 170,
      heightMin: null,
      heightMax: null,
      weight: 70,
      weightMin: null,
      weightMax: null,
      heightMode: 'exact',
      weightMode: 'exact'
    };

    const HEIGHT_RANGE = { min: 149, max: 201 };
    const WEIGHT_RANGE = { min: 39, max: 131 };
    const ANIMATION_DURATION = 450;

    // ========== D3 SETUP ==========
    const svg = d3.select('#avatar-svg');
    const avatarGroup = svg.append('g').attr('class', 'avatar-group');

    let maleAvatar, femaleAvatar;

    // ========== ORGANIC AVATAR CREATION with SMOOTH CURVES ==========

    function createAvatar(gender) {
      const isMale = gender === 'male';
      const group = avatarGroup.append('g')
        .attr('class', `${gender}-avatar`)
        .style('display', isMale ? 'block' : 'none');

      // Add subtle shadow/gradient defs
      const defs = svg.append('defs');

      // Create gradient for depth
      const skinGradient = defs.append('linearGradient')
        .attr('id', `skin-gradient-${gender}`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '100%');

      skinGradient.append('stop')
        .attr('offset', '0%')
        .style('stop-color', '#FFD4A3')
        .style('stop-opacity', 1);

      skinGradient.append('stop')
        .attr('offset', '100%')
        .style('stop-color', '#F5C28F')
        .style('stop-opacity', 1);

      // Create filter for soft shadow
      const filter = defs.append('filter')
        .attr('id', `soften-${gender}`)
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');

      filter.append('feGaussianBlur')
        .attr('in', 'SourceGraphic')
        .attr('stdDeviation', '0.5');

      // Order matters for layering!
      // 1. Shadow layer (optional)
      group.append('ellipse')
        .attr('class', 'shadow')
        .attr('cx', 160)
        .attr('cy', 460)
        .attr('rx', 40)
        .attr('ry', 8)
        .attr('fill', '#000')
        .attr('opacity', 0.1);

      // 2. Back arm (behind body)
      group.append('rect')
        .attr('class', 'arm-back')
        .attr('fill', `url(#skin-gradient-${gender})`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      // 3. Legs
      group.append('rect')
        .attr('class', 'leg-left')
        .attr('fill', `url(#skin-gradient-${gender})`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      group.append('rect')
        .attr('class', 'leg-right')
        .attr('fill', `url(#skin-gradient-${gender})`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      // 4. Main body/torso
      group.append('rect')
        .attr('class', 'body-torso')
        .attr('fill', `url(#skin-gradient-${gender})`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      // 5. Front arm
      group.append('rect')
        .attr('class', 'arm-front')
        .attr('fill', `url(#skin-gradient-${gender})`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      // 6. Clothing layers
      group.append('rect')
        .attr('class', 'shirt')
        .attr('fill', isMale ? '#7C9FB0' : '#6E8B3D')
        .attr('opacity', 1)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      group.append('rect')
        .attr('class', 'shorts')
        .attr('fill', isMale ? '#4A5A7A' : '#78583B')
        .attr('opacity', 1)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      // Sleeves
      group.append('rect')
        .attr('class', 'sleeve-left')
        .attr('fill', isMale ? '#7C9FB0' : '#6E8B3D')
        .attr('opacity', 1)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      group.append('rect')
        .attr('class', 'sleeve-right')
        .attr('fill', isMale ? '#7C9FB0' : '#6E8B3D')
        .attr('opacity', 1)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      // 7. Head
      group.append('path')
        .attr('class', 'neck')
        .attr('d', '')
        .attr('fill', 'none');

      group.append('rect')
        .attr('class', 'head')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', `url(#skin-gradient-${gender})`);

      // 8. Hair
      group.append('rect')
        .attr('class', 'hair')
        .attr('fill', isMale ? '#6B4423' : '#E69138')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      if (!isMale) {
        group.append('rect')
          .attr('class', 'hair-left')
          .attr('fill', '#E69138')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', 0)
          .attr('height', 0);

        group.append('rect')
          .attr('class', 'hair-right')
          .attr('fill', '#E69138')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', 0)
          .attr('height', 0);
      }

      // 9. Facial features
      const eyeGroup = group.append('g').attr('class', 'eyes');

      eyeGroup.append('rect')
        .attr('class', 'eye-left')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', 'white');

      eyeGroup.append('rect')
        .attr('class', 'pupil-left')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', '#333');

      eyeGroup.append('rect')
        .attr('class', 'eye-right')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', 'white');

      eyeGroup.append('rect')
        .attr('class', 'pupil-right')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', '#333');

      group.append('rect')
        .attr('class', 'nose')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', '#8B6F47')
        .attr('opacity', 0.5);

      group.append('rect')
        .attr('class', 'mouth')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', '#5A3A1A')
        .attr('opacity', 0.6);

      // 10. Shoes
      group.append('rect')
        .attr('class', 'shoe-left')
        .attr('fill', '#333')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      group.append('rect')
        .attr('class', 'shoe-right')
        .attr('fill', '#333')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

      return group;
    }

    // ========== MINECRAFT AVATAR (STEVE / ALEX) ==========

    function updateAvatar(animate = true) {
      const duration = animate ? 450 : 0;
      const easing = d3.easeCubicInOut;

      const heightNorm = (state.height - HEIGHT_RANGE.min) / (HEIGHT_RANGE.max - HEIGHT_RANGE.min);
      const weightNorm = (state.weight - WEIGHT_RANGE.min) / (WEIGHT_RANGE.max - WEIGHT_RANGE.min);

      const heightScale = 0.85 + (heightNorm * 0.3);
      const widthScale = 0.85 + (weightNorm * 0.3);

      const isMale = state.gender === 'male';
      const avatar = isMale ? maleAvatar : femaleAvatar;

      const scale = 1.6;
      const headSize = 32 * widthScale * scale;
      const headY = 80;

      const bodyWidth = (isMale ? 32 : 24) * widthScale * scale;
      const bodyHeight = 48 * heightScale * scale;
      const bodyY = headY + headSize / 2 + 2;

      const armWidth = (isMale ? 16 : 12) * widthScale * scale;
      const armHeight = 48 * heightScale * scale;
      const armY = bodyY;

      const legWidth = 16 * widthScale * scale;
      const legHeight = 48 * heightScale * scale;
      const legY = bodyY + bodyHeight;

      const footY = legY + legHeight + 2;

      const hairHeight = 6 * widthScale * scale;
      const hairWidth = headSize * 0.95;
      const hairX = 160 - hairWidth / 2;
      const hairY = headY - headSize / 2 - hairHeight + 2;

      const bodyX = 160 - bodyWidth / 2;

      const leftArmX = 160 - bodyWidth / 2 - armWidth - 1 * scale;
      const rightArmX = 160 + bodyWidth / 2 + 1 * scale;

      const legGap = 0;
      const leftLegX = 160 - legWidth - legGap / 2;
      const rightLegX = 160 + legGap / 2;

      const shirtHeight = bodyHeight;
      const pantsHeight = legHeight;

      const shoeHeight = 6 * widthScale * scale;
      const shoeWidth = legWidth;

      const shadowWidth = (bodyWidth + armWidth * 2) * 0.6;
      const shadowY = footY + 5;

      const t = avatar.transition()
        .duration(duration)
        .ease(easing);

      t.select('.shadow')
        .attr('cx', 160)
        .attr('cy', shadowY)
        .attr('rx', shadowWidth)
        .attr('ry', shadowWidth * 0.15)
        .attr('opacity', 0.15);

      t.select('.head')
        .attr('x', 160 - headSize / 2)
        .attr('y', headY - headSize / 2)
        .attr('width', headSize)
        .attr('height', headSize);

      t.select('.hair')
        .attr('x', hairX)
        .attr('y', hairY)
        .attr('width', hairWidth)
        .attr('height', hairHeight);

      if (!isMale) {
        const sideHairWidth = headSize * 0.15;
        const sideHairHeight = headSize * 0.8;
        const sideHairY = headY - headSize / 2 + 4;

        t.select('.hair-left')
          .attr('x', 160 - headSize / 2 - 2)
          .attr('y', sideHairY)
          .attr('width', sideHairWidth)
          .attr('height', sideHairHeight);

        t.select('.hair-right')
          .attr('x', 160 + headSize / 2 - sideHairWidth + 2)
          .attr('y', sideHairY)
          .attr('width', sideHairWidth)
          .attr('height', sideHairHeight);
      }

      t.select('.neck').attr('d', '');
      t.select('.body-torso')
        .attr('x', bodyX)
        .attr('y', bodyY)
        .attr('width', bodyWidth)
        .attr('height', bodyHeight);

      t.select('.arm-back')
        .attr('x', leftArmX)
        .attr('y', armY)
        .attr('width', armWidth)
        .attr('height', armHeight);

      t.select('.arm-front')
        .attr('x', rightArmX)
        .attr('y', armY)
        .attr('width', armWidth)
        .attr('height', armHeight);

      t.select('.leg-left')
        .attr('x', leftLegX)
        .attr('y', legY)
        .attr('width', legWidth)
        .attr('height', legHeight);

      t.select('.leg-right')
        .attr('x', rightLegX)
        .attr('y', legY)
        .attr('width', legWidth)
        .attr('height', legHeight);

      t.select('.shirt')
        .attr('x', bodyX)
        .attr('y', bodyY)
        .attr('width', bodyWidth)
        .attr('height', shirtHeight);

      t.select('.shorts')
        .attr('x', Math.min(leftLegX, rightLegX))
        .attr('y', legY)
        .attr('width', legWidth * 2)
        .attr('height', pantsHeight);

      t.select('.sleeve-left')
        .attr('x', leftArmX)
        .attr('y', armY)
        .attr('width', armWidth)
        .attr('height', armHeight);

      t.select('.sleeve-right')
        .attr('x', rightArmX)
        .attr('y', armY)
        .attr('width', armWidth)
        .attr('height', armHeight);

      t.select('.shoe-left')
        .attr('x', leftLegX)
        .attr('y', footY)
        .attr('width', shoeWidth)
        .attr('height', shoeHeight);

      t.select('.shoe-right')
        .attr('x', rightLegX)
        .attr('y', footY)
        .attr('width', shoeWidth)
        .attr('height', shoeHeight);

      const eyeSize = headSize * 0.12;
      const eyeSpacing = headSize * 0.25;
      const eyeY = headY - headSize * 0.1;

      t.selectAll('.eye-left, .pupil-left')
        .attr('x', 160 - eyeSpacing - eyeSize / 2)
        .attr('y', eyeY - eyeSize / 2)
        .attr('width', eyeSize)
        .attr('height', eyeSize);

      t.selectAll('.eye-right, .pupil-right')
        .attr('x', 160 + eyeSpacing - eyeSize / 2)
        .attr('y', eyeY - eyeSize / 2)
        .attr('width', eyeSize)
        .attr('height', eyeSize);

      const noseSize = headSize * 0.08;
      t.select('.nose')
        .attr('x', 160 - noseSize / 2)
        .attr('y', headY + headSize * 0.05)
        .attr('width', noseSize)
        .attr('height', noseSize);

      const mouthWidth = headSize * 0.35;
      const mouthHeight = headSize * 0.06;
      t.select('.mouth')
        .attr('x', 160 - mouthWidth / 2)
        .attr('y', headY + headSize * 0.2)
        .attr('width', mouthWidth)
        .attr('height', mouthHeight);

      d3.select('#stat-height').text(state.height);
      d3.select('#stat-weight').text(state.weight);
    }

    // ========== GENDER SWITCHING ==========
    function switchGender(animate = true) {
      const duration = animate ? ANIMATION_DURATION : 0;

      updateAvatar(false);

      if (state.gender === 'male') {
        femaleAvatar.transition().duration(duration).style('opacity', 0)
          .on('end', () => femaleAvatar.style('display', 'none'));
        maleAvatar.style('display', 'block').style('opacity', 0)
          .transition().duration(duration).style('opacity', 1);
      } else {
        maleAvatar.transition().duration(duration).style('opacity', 0)
          .on('end', () => maleAvatar.style('display', 'none'));
        femaleAvatar.style('display', 'block').style('opacity', 0)
          .transition().duration(duration).style('opacity', 1);
      }
    }

    // ========== BRUSH FOR RANGE SELECTION ==========
    function createBrush(containerId, min, max, defaultMin, defaultMax, unit, onBrush) {
      const container = d3.select(`#${containerId}`);
      container.html('');

      const width = container.node().getBoundingClientRect().width;
      const height = 70;
      const margin = { top: 5, right: 20, bottom: 25, left: 20 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const brushSvg = container.append('svg')
        .attr('width', width)
        .attr('height', height);

      const g = brushSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .domain([min, max])
        .range([0, innerWidth]);

      const brush = d3.brushX()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('brush end', brushed);

      const axis = d3.axisBottom(x)
        .tickValues(
          containerId === 'height-range'
            ? [150, 160, 170, 180, 190, 200]
            : containerId === 'weight-range'
              ? [40, 55, 70, 85, 100, 115, 130]
              : d3.range(min, max + 1e-6, 10)
        )
        .tickFormat(d => `${d}${unit}`);

      g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(axis);

      const brushG = g.append('g')
        .attr('class', 'brush')
        .call(brush);

      brushG.call(brush.move, [x(defaultMin), x(defaultMax)]);

      function brushed(event) {
        if (event.selection) {
          const [x0, x1] = event.selection.map(x.invert);
          onBrush(Math.round(x0), Math.round(x1));
        }
      }

      return { brush, brushG, x };
    }

    let heightBrush, weightBrush;

    function initHeightBrush(defaultMin = 165, defaultMax = 175) {
      state.heightMin = defaultMin;
      state.heightMax = defaultMax;
      state.height = Math.round((defaultMin + defaultMax) / 2);

      heightBrush = createBrush('height-range', HEIGHT_RANGE.min, HEIGHT_RANGE.max, defaultMin, defaultMax, '', (min, max) => {
        state.heightMin = min;
        state.heightMax = max;
        state.height = Math.round((min + max) / 2);
        d3.select('#height-display').text(`${min} - ${max} cm (avg: ${state.height} cm)`);
        d3.select('#stat-height').text(state.height);
        updateAvatar(true);
      });
    }

    function initWeightBrush(defaultMin = 65, defaultMax = 75) {
      state.weightMin = defaultMin;
      state.weightMax = defaultMax;
      state.weight = Math.round((defaultMin + defaultMax) / 2);

      weightBrush = createBrush('weight-range', WEIGHT_RANGE.min, WEIGHT_RANGE.max, defaultMin, defaultMax, '', (min, max) => {
        state.weightMin = min;
        state.weightMax = max;
        state.weight = Math.round((min + max) / 2);
        d3.select('#weight-display').text(`${min} - ${max} kg (avg: ${state.weight} kg)`);
        d3.select('#stat-weight').text(state.weight);
        updateAvatar(true);
      });
    }

    // ========== EVENT HANDLERS ==========

    d3.selectAll('.gender-btn').on('click', function () {
      state.gender = d3.select(this).attr('data-gender');
      d3.selectAll('.gender-btn').classed('active', false);
      d3.select(this).classed('active', true);
      switchGender(true);
    });

    d3.selectAll('.mode-btn').on('click', function () {
      const mode = d3.select(this).attr('data-mode');
      const control = d3.select(this).attr('data-control');

      d3.selectAll(`.mode-btn[data-control="${control}"]`).classed('active', false);
      d3.select(this).classed('active', true);

      if (control === 'height') {
        state.heightMode = mode;
        if (mode === 'exact') {
          d3.select('#height-exact-wrapper').classed('hidden', false);
          d3.select('#height-range').classed('active', false);
          d3.select('#height-display').text(`${state.height} cm`);
          state.heightMin = null;
          state.heightMax = null;
        } else {
          d3.select('#height-exact-wrapper').classed('hidden', true);
          d3.select('#height-range').classed('active', true);
          if (!heightBrush) initHeightBrush(state.height - 5, state.height + 5);
          d3.select('#height-display').text(`${state.heightMin} - ${state.heightMax} cm (avg: ${state.height} cm)`);
          d3.select('#height-error').classed('show', false);
        }
      } else {
        state.weightMode = mode;
        if (mode === 'exact') {
          d3.select('#weight-exact-wrapper').classed('hidden', false);
          d3.select('#weight-range').classed('active', false);
          d3.select('#weight-display').text(`${state.weight} kg`);
          state.weightMin = null;
          state.weightMax = null;
        } else {
          d3.select('#weight-exact-wrapper').classed('hidden', true);
          d3.select('#weight-range').classed('active', true);
          if (!weightBrush) initWeightBrush(state.weight - 5, state.weight + 5);
          d3.select('#weight-display').text(`${state.weightMin} - ${state.weightMax} kg (avg: ${state.weight} kg)`);
          d3.select('#weight-error').classed('show', false);
        }
      }
    });

    d3.select('#height-exact').on('input', function () {
      const value = +this.value;
      const error = d3.select('#height-error');

      if (value >= HEIGHT_RANGE.min && value <= HEIGHT_RANGE.max) {
        state.height = value;
        d3.select('#height-display').text(`${value} cm`);
        d3.select('#stat-height').text(value);
        error.classed('show', false);
        updateAvatar(true);
      } else if (value) {
        error.classed('show', true);
      }
    });

    d3.select('#weight-exact').on('input', function () {
      const value = +this.value;
      const error = d3.select('#weight-error');

      if (value >= WEIGHT_RANGE.min && value <= WEIGHT_RANGE.max) {
        state.weight = value;
        d3.select('#weight-display').text(`${value} kg`);
        d3.select('#stat-weight').text(value);
        error.classed('show', false);
        updateAvatar(true);
      } else if (value) {
        error.classed('show', true);
      }
    });

    d3.select('#continue-btn').on('click', function () {
      const heightValid = state.height >= HEIGHT_RANGE.min && state.height <= HEIGHT_RANGE.max;
      const weightValid = state.weight >= WEIGHT_RANGE.min && state.weight <= WEIGHT_RANGE.max;

      if (!heightValid) d3.select('#height-error').classed('show', true);
      if (!weightValid) d3.select('#weight-error').classed('show', true);

      let valid = heightValid && weightValid;

      d3.select('#height-error').classed('show', false);
      d3.select('#weight-error').classed('show', false);

      if (state.heightMode === 'exact') {
        const v = +d3.select('#height-exact').property('value');
        if (isNaN(v) || v < HEIGHT_RANGE.min || v > HEIGHT_RANGE.max) {
          d3.select('#height-error').classed('show', true);
          valid = false;
        }
      } else {
        if (!state.heightMin || !state.heightMax ||
          state.heightMin < HEIGHT_RANGE.min || state.heightMax > HEIGHT_RANGE.max) {
          d3.select('#height-error').classed('show', true);
          valid = false;
        }
      }

      if (state.weightMode === 'exact') {
        const v = +d3.select('#weight-exact').property('value');
        if (isNaN(v) || v < WEIGHT_RANGE.min || v > WEIGHT_RANGE.max) {
          d3.select('#weight-error').classed('show', true);
          valid = false;
        }
      } else {
        if (!state.weightMin || !state.weightMax ||
          state.weightMin < WEIGHT_RANGE.min || state.weightMax > WEIGHT_RANGE.max) {
          d3.select('#weight-error').classed('show', true);
          valid = false;
        }
      }

      if (!valid) return;

      localStorage.setItem('gender', state.gender);
      localStorage.setItem('height', state.height);
      localStorage.setItem('weight', state.weight);

      if (state.heightMode === 'range') {
        localStorage.setItem('height_min', state.heightMin);
        localStorage.setItem('height_max', state.heightMax);
      } else {
        localStorage.removeItem('height_min');
        localStorage.removeItem('height_max');
      }

      if (state.weightMode === 'range') {
        localStorage.setItem('weight_min', state.weightMin);
        localStorage.setItem('weight_max', state.weightMax);
      } else {
        localStorage.removeItem('weight_min');
        localStorage.removeItem('weight_max');
      }

      window.location.href = 'explorer_page.html';
    });

    // ========== INITIALIZATION ==========
    maleAvatar = createAvatar('male');
    femaleAvatar = createAvatar('female');
    maleAvatar.style('opacity', 1);
    updateAvatar(false);

    (function preloadFromStorage() {
      const fromMain = localStorage.getItem('from_main') === '1';
      const g = localStorage.getItem('gender');

      if (g) {
        state.gender = g;
        d3.selectAll('.gender-btn').classed('active', false);
        d3.select(`.gender-btn[data-gender="${g}"]`).classed('active', true);
        switchGender(false);
      }

      if (fromMain) {
        const hMode = localStorage.getItem('height_mode');
        const wMode = localStorage.getItem('weight_mode');
        const hMinLS = +localStorage.getItem('height_min');
        const hMaxLS = +localStorage.getItem('height_max');
        const wMinLS = +localStorage.getItem('weight_min');
        const wMaxLS = +localStorage.getItem('weight_max');

        if (hMode === 'range' && hMinLS && hMaxLS) {
          state.heightMode = 'range';
          d3.select('#height-exact-wrapper').classed('hidden', true);
          d3.select('#height-range').classed('active', true);
          d3.selectAll(`.mode-btn[data-control="height"]`).classed('active', false);
          d3.select(`.mode-btn[data-control="height"][data-mode="range"]`).classed('active', true);
          initHeightBrush(hMinLS, hMaxLS);
          state.heightMin = hMinLS; state.heightMax = hMaxLS;
          state.height = Math.round((hMinLS + hMaxLS) / 2);
          d3.select('#height-display').text(`${hMinLS} - ${hMaxLS} cm (avg: ${state.height} cm)`);
          d3.select('#stat-height').text(state.height);
        }

        if (wMode === 'range' && wMinLS && wMaxLS) {
          state.weightMode = 'range';
          d3.select('#weight-exact-wrapper').classed('hidden', true);
          d3.select('#weight-range').classed('active', true);
          d3.selectAll(`.mode-btn[data-control="weight"]`).classed('active', false);
          d3.select(`.mode-btn[data-control="weight"][data-mode="range"]`).classed('active', true);
          initWeightBrush(wMinLS, wMaxLS);
          state.weightMin = wMinLS; state.weightMax = wMaxLS;
          state.weight = Math.round((wMinLS + wMaxLS) / 2);
          d3.select('#weight-display').text(`${wMinLS} - ${wMaxLS} kg (avg: ${state.weight} kg)`);
          d3.select('#stat-weight').text(state.weight);
        }

        localStorage.removeItem('from_main');
      }

      d3.select('#height-exact').property('value', state.height);
      d3.select('#weight-exact').property('value', state.weight);
      d3.select('#height-display').text(`${state.height} cm`);
      d3.select('#weight-display').text(`${state.weight} kg`);

      updateAvatar(false);
    })();

  } catch (e) { console.error('Profile init error:', e); }
})();
