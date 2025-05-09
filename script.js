// Elasticity parameters (from lit review)
const elasticities = {
  price: -0.30,
  rebate: 0.20,
  mls: 0.10,
  tier: 0.15
};

// Baseline values
const baseline = {
  uptake: 0.35,
  premium: 1200,
  rebatePct: 25,
  hospitalOffsetPer: 400
};

// DOM references
const sliders = {
  rebate: document.getElementById('sliderRebate'),
  mls:   document.getElementById('sliderMLS'),
  premium: document.getElementById('sliderPremium'),
  tier:   document.getElementById('sliderTier')
};
const displays = {
  rebate: document.getElementById('valRebate'),
  mls:    document.getElementById('valMLS'),
  premium: document.getElementById('valPremium'),
  tier:   document.getElementById('valTier'),
  uptake: document.getElementById('resUptake'),
  rebateCost: document.getElementById('resRebateCost'),
  offset: document.getElementById('resOffset')
};

// Chart.js setup
const chartUptake = new Chart(
  document.getElementById('chartUptake').getContext('2d'),
  {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Uptake (%)', data: [], borderColor: elasticities } ] },
    options: { scales: { y: { beginAtZero: true, max: 100 } } }
  }
);
const chartBudget = new Chart(
  document.getElementById('chartBudget').getContext('2d'),
  {
    type: 'bar',
    data: {
      labels: ['Rebate Cost', 'Hospital Savings'],
      datasets: [{ label: 'AUD per Person', data: [], backgroundColor: ['rgba(10,147,150,0.7)','rgba(148,210,189,0.7)'] }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  }
);

function updateSimulation() {
  const R = +sliders.rebate.value;
  const M = +sliders.mls.value;
  const P = +sliders.premium.value;
  const T = +sliders.tier.value;

  displays.rebate.textContent = R;
  displays.mls.textContent = M.toFixed(1);
  displays.premium.textContent = P;
  displays.tier.textContent = T;

  // Log-linear elasticity
  const delta = elasticities.price * P
              + elasticities.rebate * (R - baseline.rebatePct)
              + elasticities.mls * M
              + elasticities.tier * (T - 1);
  let uptakeProb = baseline.uptake + delta / 100;
  uptakeProb = Math.max(0, Math.min(1, uptakeProb));

  // Costs
  const premiumAmt = baseline.premium * (1 + P/100);
  const rebatePer = premiumAmt * (R/100);
  const rebateCost = rebatePer * uptakeProb;
  const hospitalOffset = baseline.hospitalOffsetPer * uptakeProb;

  displays.uptake.textContent = (uptakeProb*100).toFixed(1);
  displays.rebateCost.textContent = rebateCost.toFixed(0);
  displays.offset.textContent = hospitalOffset.toFixed(0);

  // Update uptake chart
  const label = `R${R}-P${P}-M${M}-T${T}`;
  if (chartUptake.data.labels.length > 20) {
    chartUptake.data.labels.shift();
    chartUptake.data.datasets[0].data.shift();
  }
  chartUptake.data.labels.push(label);
  chartUptake.data.datasets[0].data.push((uptakeProb*100).toFixed(1));
  chartUptake.update();

  // Update budget chart
  chartBudget.data.datasets[0].data = [rebateCost.toFixed(0), hospitalOffset.toFixed(0)];
  chartBudget.update();
}

// Attach listeners
Object.values(sliders).forEach(slider => {
  slider.addEventListener('input', updateSimulation);
});

// Initial draw
updateSimulation();
