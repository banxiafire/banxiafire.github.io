// ============ BOWL BUILDER JS (D3-Powered) ============

(function () {
  // ====== STATE ======
  const state = {
    ingredients: [], // All available ingredients
    bowl: [], // Ingredients currently in bowl
    targets: {
      carbs: 250,
      protein: 100,
      fat: 65,
      calories: 1800
    },
    totals: {
      carbs: 0,
      protein: 0,
      fat: 0,
      calories: 0
    },
    nextId: 0,
    simulation: null // D3 force simulation
  };

  // Bowl dimensions
  const centerX = 250;
  const centerY = 250;
  const bowlRadius = 180;

  // ====== LOAD USER PROFILE ======
  function loadUserProfile() {
    const gender = localStorage.getItem('gender') || 'male';
    const height = localStorage.getItem('height') || '170';
    const weight = localStorage.getItem('weight') || '70';

    // Calculate rough daily targets (simplified formulas)
    const bmr = gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * 30 + 5
      : 10 * weight + 6.25 * height - 5 * 30 - 161;

    const dailyCalories = Math.round(bmr * 1.5); // Moderate activity level
    state.targets.calories = dailyCalories;
    state.targets.carbs = Math.round(dailyCalories * 0.5 / 4); // 50% from carbs
    state.targets.protein = Math.round(dailyCalories * 0.25 / 4); // 25% from protein
    state.targets.fat = Math.round(dailyCalories * 0.25 / 9); // 25% from fat

    // Update UI with D3
    d3.select('#carbs-target').text(state.targets.carbs);
    d3.select('#protein-target').text(state.targets.protein);
    d3.select('#fat-target').text(state.targets.fat);
    d3.select('#calories-target').text(state.targets.calories);

    d3.select('#profile-summary').text(
      `${gender.charAt(0).toUpperCase() + gender.slice(1)}, ${height}cm, ${weight}kg - Your personalized macro targets`
    );
  }

  // ====== LOAD INGREDIENTS ======
  async function loadIngredients() {
    try {
      const data = await d3.csv('data/ingredients.csv');
      state.ingredients = data.map(d => ({
        name: d.name,
        category: d.category,
        carbs: +d.carbs_per_100g,
        protein: +d.protein_per_100g,
        fat: +d.fat_per_100g,
        calories: +d.calories_per_100g,
        emoji: d.emoji,
        serving: +d.serving_g
      }));
      renderIngredientShelves();
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  }

  // ====== RENDER INGREDIENT SHELVES WITH D3 ======
  function renderIngredientShelves() {
    const categories = {
      base: 'bases-list',
      protein: 'protein-list',
      veggie: 'veggie-list',
      fat: 'fat-list'
    };

    Object.entries(categories).forEach(([category, listId]) => {
      const ingredients = state.ingredients.filter(i => i.category === category);

      // D3 data join for ingredient cards
      const cards = d3.select(`#${listId}`)
        .selectAll('.ingredient-card')
        .data(ingredients, d => d.name)
        .join(
          enter => {
            const card = enter.append('div')
              .attr('class', 'ingredient-card')
              .attr('draggable', true)
              .style('opacity', 0)
              .on('click', (event, d) => addIngredientToBowl(d))
              .on('dragstart', function(event, d) {
                d3.select(this).classed('dragging', true);
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('text/plain', JSON.stringify(d));
              })
              .on('dragend', function(event) {
                d3.select(this).classed('dragging', false);
              });

            card.append('span')
              .attr('class', 'ingredient-icon')
              .text(d => d.emoji);

            card.append('div')
              .attr('class', 'ingredient-name')
              .text(d => d.name);

            card.append('div')
              .attr('class', 'ingredient-stats')
              .text(d => `${d.serving}g serving`);

            card.append('div')
              .attr('class', 'ingredient-stats')
              .text(d => `${Math.round(d.calories * d.serving / 100)} cal`);

            // Fade in animation
            return card.transition()
              .duration(300)
              .delay((d, i) => i * 30)
              .style('opacity', 1);
          }
        );
    });
  }

  // ====== SETUP FORCE SIMULATION ======
  function setupForceSimulation() {
    state.simulation = d3.forceSimulation()
      .force('x', d3.forceX(centerX).strength(0.05))
      .force('y', d3.forceY(centerY).strength(0.05))
      .force('collide', d3.forceCollide().radius(30).strength(0.8))
      .force('bounds', forceBounds())
      .alphaDecay(0.02)
      .on('tick', ticked);
  }

  // Custom force to keep ingredients inside bowl
  function forceBounds() {
    return function() {
      state.bowl.forEach(d => {
        const dx = d.x - centerX;
        const dy = d.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > bowlRadius - 30) {
          const angle = Math.atan2(dy, dx);
          d.x = centerX + Math.cos(angle) * (bowlRadius - 30);
          d.y = centerY + Math.sin(angle) * (bowlRadius - 30);
          d.vx *= 0.5;
          d.vy *= 0.5;
        }
      });
    };
  }

  // Update positions on simulation tick
  function ticked() {
    const group = d3.select('#ingredients-group');

    group.selectAll('.bowl-ingredient')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
  }

  // ====== SETUP DROP ZONE ======
  function setupDropZone() {
    const dropZone = d3.select('#bowl-drop-zone');

    dropZone.on('dragover', function(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });

    dropZone.on('dragenter', function(event) {
      event.preventDefault();
      d3.select(this).classed('drag-over', true);
    });

    dropZone.on('dragleave', function(event) {
      if (event.target.id === 'bowl-drop-zone' || event.target.closest('#bowl-drop-zone')) {
        d3.select(this).classed('drag-over', false);
      }
    });

    dropZone.on('drop', function(event) {
      event.preventDefault();
      d3.select(this).classed('drag-over', false);

      const ingredientData = JSON.parse(event.dataTransfer.getData('text/plain'));
      addIngredientToBowl(ingredientData);
    });
  }

  // ====== ADD INGREDIENT TO BOWL ======
  function addIngredientToBowl(ingredient) {
    const bowlItem = {
      id: state.nextId++,
      name: ingredient.name,
      emoji: ingredient.emoji,
      serving: ingredient.serving,
      carbs: ingredient.carbs * ingredient.serving / 100,
      protein: ingredient.protein * ingredient.serving / 100,
      fat: ingredient.fat * ingredient.serving / 100,
      calories: ingredient.calories * ingredient.serving / 100,
      // Random initial position for force simulation
      x: centerX + (Math.random() - 0.5) * 100,
      y: centerY - 100,
      vx: (Math.random() - 0.5) * 2,
      vy: 0
    };

    state.bowl.push(bowlItem);
    updateTotals();
    renderBowlVisual();
    renderBowlContents();
    updateMeters();
    hideBowlHint();
  }

  // ====== UPDATE TOTALS ======
  function updateTotals() {
    state.totals.carbs = d3.sum(state.bowl, d => d.carbs);
    state.totals.protein = d3.sum(state.bowl, d => d.protein);
    state.totals.fat = d3.sum(state.bowl, d => d.fat);
    state.totals.calories = d3.sum(state.bowl, d => d.calories);

    // Update totals display with D3 transitions
    d3.select('#total-carbs')
      .transition()
      .duration(300)
      .tween('text', function() {
        const i = d3.interpolate(+this.textContent.replace('g', '') || 0, Math.round(state.totals.carbs));
        return t => this.textContent = Math.round(i(t)) + 'g';
      });

    d3.select('#total-protein')
      .transition()
      .duration(300)
      .tween('text', function() {
        const i = d3.interpolate(+this.textContent.replace('g', '') || 0, Math.round(state.totals.protein));
        return t => this.textContent = Math.round(i(t)) + 'g';
      });

    d3.select('#total-fat')
      .transition()
      .duration(300)
      .tween('text', function() {
        const i = d3.interpolate(+this.textContent.replace('g', '') || 0, Math.round(state.totals.fat));
        return t => this.textContent = Math.round(i(t)) + 'g';
      });

    d3.select('#total-calories')
      .transition()
      .duration(300)
      .tween('text', function() {
        const i = d3.interpolate(+this.textContent.replace(' kcal', '') || 0, Math.round(state.totals.calories));
        return t => this.textContent = Math.round(i(t)) + ' kcal';
      });
  }

  // ====== UPDATE METERS WITH D3 ======
  function updateMeters() {
    const metrics = ['carbs', 'protein', 'fat', 'calories'];

    metrics.forEach(metric => {
      const current = state.totals[metric];
      const target = state.targets[metric];
      const percentage = (current / target) * 100;

      // Update current value with smooth number transition
      d3.select(`#${metric}-current`)
        .transition()
        .duration(400)
        .tween('text', function() {
          const i = d3.interpolate(+this.textContent || 0, Math.round(current));
          return t => this.textContent = Math.round(i(t));
        });

      // Update fill bar with smooth transition
      const fillElement = d3.select(`#${metric}-fill`);

      fillElement
        .transition()
        .duration(500)
        .style('width', Math.min(percentage, 100) + '%');

      // Update color based on percentage
      fillElement.attr('class', 'meter-fill');
      if (percentage < 50) {
        fillElement.classed('low', true);
      } else if (percentage >= 50 && percentage < 90) {
        fillElement.classed('low', true);
      } else if (percentage >= 90 && percentage <= 110) {
        fillElement.classed('good', true);
      } else if (percentage > 110 && percentage <= 130) {
        fillElement.classed('warning', true);
      } else if (percentage > 130) {
        fillElement.classed('over', true);
      }
    });

    // Check if all macros are in good range (90-110%)
    const allGood = metrics.every(metric => {
      const percentage = (state.totals[metric] / state.targets[metric]) * 100;
      return percentage >= 90 && percentage <= 110;
    });

    const successMessage = d3.select('#success-message');
    if (allGood && state.bowl.length > 0) {
      successMessage.classed('show', true);
    } else {
      successMessage.classed('show', false);
    }
  }

  // ====== RENDER BOWL VISUAL WITH D3 FORCE SIMULATION ======
  function renderBowlVisual() {
    const group = d3.select('#ingredients-group');

    // D3 data join with enter/update/exit
    const ingredients = group
      .selectAll('.bowl-ingredient')
      .data(state.bowl, d => d.id);

    // EXIT - remove ingredients with fade out
    ingredients.exit()
      .transition()
      .duration(300)
      .attr('transform', d => `translate(${centerX}, ${centerY - 200})`)
      .style('opacity', 0)
      .remove();

    // ENTER - add new ingredients
    const enter = ingredients.enter()
      .append('g')
      .attr('class', 'bowl-ingredient')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('opacity', 0)
      .style('cursor', 'pointer');

    // Background circle
    enter.append('circle')
      .attr('r', 25)
      .attr('fill', 'white')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 2);

    // Emoji
    enter.append('text')
      .attr('class', 'ingredient-emoji')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '1.8rem')
      .text(d => d.emoji);

    // Serving label
    enter.append('text')
      .attr('class', 'ingredient-serving')
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.7rem')
      .attr('fill', '#666')
      .text(d => `${d.serving}g`);

    // Animate entrance
    enter.transition()
      .duration(600)
      .style('opacity', 1);

    // Setup drag behavior
    const drag = d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded);

    enter.call(drag);

    // Click to remove
    enter.on('click', function(event, d) {
      if (!d3.select(this).classed('dragging')) {
        removeIngredientFromBowl(d.id);
      }
    });

    // UPDATE + ENTER - restart simulation
    state.simulation.nodes(state.bowl);
    state.simulation.alpha(0.3).restart();
  }

  // ====== D3 DRAG HANDLERS ======
  function dragStarted(event, d) {
    if (!event.active) state.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
    d3.select(this).classed('dragging', true).raise();
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragEnded(event, d) {
    if (!event.active) state.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    d3.select(this).classed('dragging', false);
  }

  // ====== RENDER BOWL CONTENTS LIST WITH D3 ======
  function renderBowlContents() {
    const container = d3.select('#contents-list');

    if (state.bowl.length === 0) {
      container.html('<p class="empty-message">Bowl is empty</p>');
      return;
    }

    // D3 data join for contents list
    const items = container
      .selectAll('.content-item')
      .data(state.bowl, d => d.id);

    // EXIT
    items.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .style('transform', 'translateX(-20px)')
      .remove();

    // ENTER
    const enter = items.enter()
      .append('div')
      .attr('class', 'content-item')
      .style('opacity', 0)
      .style('transform', 'translateX(-20px)');

    const nameSpan = enter.append('span')
      .attr('class', 'content-item-name');

    nameSpan.append('span')
      .text(d => d.emoji);

    nameSpan.append('span')
      .text(d => d.name);

    enter.append('span')
      .attr('class', 'content-item-amount')
      .text(d => `${d.serving}g`);

    enter.append('button')
      .attr('class', 'content-item-remove')
      .text('Remove')
      .on('click', (event, d) => removeIngredientFromBowl(d.id));

    // Animate entrance
    enter.transition()
      .duration(300)
      .style('opacity', 1)
      .style('transform', 'translateX(0)');
  }

  // ====== REMOVE INGREDIENT FROM BOWL ======
  function removeIngredientFromBowl(id) {
    state.bowl = state.bowl.filter(item => item.id !== id);
    updateTotals();
    renderBowlVisual();
    renderBowlContents();
    updateMeters();

    if (state.bowl.length === 0) {
      showBowlHint();
    }
  }

  // ====== CLEAR BOWL ======
  function clearBowl() {
    state.bowl = [];
    updateTotals();
    renderBowlVisual();
    renderBowlContents();
    updateMeters();
    showBowlHint();
  }

  // ====== RANDOM BOWL (SURPRISE ME) ======
  function generateRandomBowl() {
    clearBowl();

    // Add random base (1-2 servings)
    const bases = state.ingredients.filter(i => i.category === 'base');
    const randomBase = bases[Math.floor(Math.random() * bases.length)];
    addIngredientToBowl(randomBase);
    if (Math.random() > 0.5) addIngredientToBowl(randomBase);

    // Add random protein (1-2 servings)
    const proteins = state.ingredients.filter(i => i.category === 'protein');
    const randomProtein = proteins[Math.floor(Math.random() * proteins.length)];
    addIngredientToBowl(randomProtein);
    if (Math.random() > 0.5) addIngredientToBowl(randomProtein);

    // Add random veggies (2-4 servings)
    const veggies = state.ingredients.filter(i => i.category === 'veggie');
    const vegCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < vegCount; i++) {
      const randomVeg = veggies[Math.floor(Math.random() * veggies.length)];
      addIngredientToBowl(randomVeg);
    }

    // Add random fat/topping (1-2 servings)
    const fats = state.ingredients.filter(i => i.category === 'fat');
    const randomFat = fats[Math.floor(Math.random() * fats.length)];
    addIngredientToBowl(randomFat);
  }

  // ====== BOWL HINT ======
  function hideBowlHint() {
    d3.select('#bowl-hint').classed('hidden', true);
  }

  function showBowlHint() {
    d3.select('#bowl-hint').classed('hidden', false);
  }

  // ====== NAVIGATION ======
  function setupNavigation() {
    d3.select('#back-to-explorer').on('click', () => {
      window.location.href = 'explorer_page.html';
    });
  }

  // ====== SETUP BUTTONS ======
  function setupButtons() {
    d3.select('#clear-bowl').on('click', clearBowl);
    d3.select('#random-bowl').on('click', generateRandomBowl);
  }

  // ====== SETUP CATEGORY TABS WITH D3 ======
  function setupCategoryTabs() {
    const tabs = d3.selectAll('.category-tab');
    const grids = d3.selectAll('.ingredient-grid');

    tabs.on('click', function() {
      const category = d3.select(this).attr('data-category');

      // Update active tab
      tabs.classed('active', false);
      d3.select(this).classed('active', true);

      // Show corresponding grid with fade
      grids.each(function() {
        const grid = d3.select(this);
        if (grid.attr('data-category') === category) {
          grid.classed('active', true);
        } else {
          grid.classed('active', false);
        }
      });
    });
  }

  // ====== INITIALIZATION ======
  async function init() {
    loadUserProfile();
    await loadIngredients();
    setupForceSimulation();
    setupDropZone();
    setupCategoryTabs();
    setupButtons();
    setupNavigation();
  }

  // Start the app
  init();
})();
