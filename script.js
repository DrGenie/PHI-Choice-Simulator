// Elasticities & baseline
const elasticities = { price: -0.30, rebate: 0.20, mls: 0.10, tier: 0.15 };
const baseline = { uptake: 0.35, premium: 1200, rebatePct: 25, hospitalOffsetPer: 400 };

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(sec=>sec.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// DOM refs
const sliders = {
  rebate: document.getElementById('sliderRebate'),
  mls:    document.getElementById('sliderMLS'),
  premium: document.getElementById('sliderPremium'),
  tier:   document.getElementById('sliderTier')
};
const disp = {
  rebate:      document.getElementById('valRebate'),
  mls:         document.getElementById('valMLS'),
  premium:     document.getElementById('valPremium'),
  tier:        document.getElementById('valTier'),
  uptake:      document.getElementById('resUptake'),
  rebateCost:  document.getElementById('resRebateCost'),
  offset:      document.getElementById('resOffset'),
};

// Charts
const chartUptake = new Chart(
  document.getElementById('chartUptake').getContext('2d'),
  {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Uptake (%)', data: [], borderColor: '#005f73', fill: false }] },
    options: { scales: { y: { beginAtZero:true, max:100 } } }
  }
);
const chartBudget = new Chart(
  document.getElementById('chartBudget').getContext('2d'),
  {
    type: 'bar',
    data: {
      labels: ['Rebate Cost','Hospital Savings'],
      datasets: [{
        label: 'AUD per Person',
        data: [],
        backgroundColor: ['rgba(10,147,150,0.7)','rgba(148,210,189,0.7)']
      }]
    },
    options: { scales:{ y:{ beginAtZero:true } } }
  }
);
// Elasticity bar chart
const chartElasticity = new Chart(
  document.getElementById('chartElasticity').getContext('2d'),
  {
    type: 'bar',
    data: {
      labels: ['Price','Rebate','MLS','Tier'],
      datasets: [{
        label: 'Elasticity',
        data: [
          elasticities.price,
          elasticities.rebate,
          elasticities.mls,
          elasticities.tier
        ],
        backgroundColor: ['#005f73','#0a9396','#94d2bd','#ee9b00']
      }]
    },
    options: {
      indexAxis: 'y',
      scales: { x: { beginAtZero:true } }
    }
  }
);
// Uptake vs Rebate curve
const rebates = Array.from({length: 11}, (_,i)=>i*5); // 0,5,...,50
const uptakeVals = rebates.map(R => {
  const Δ = elasticities.rebate*(R-baseline.rebatePct);
  let u = baseline.uptake + Δ/100;
  return Math.max(0,Math.min(1,u))*100;
});
const chartScenario = new Chart(
  document.getElementById('chartScenario').getContext('2d'),
  {
    type: 'line',
    data: {
      labels: rebates.map(r=>r+'%'),
      datasets: [{
        label: 'Uptake vs Rebate',
        data: uptakeVals,
        borderColor: '#ee9b00', fill: false
      }]
    },
    options: { scales:{ y:{ beginAtZero:true, max:100 } } }
  }
);

// Simulation
function updateSimulation() {
  const R = +sliders.rebate.value,
        M = +sliders.mls.value,
        P = +sliders.premium.value,
        T = +sliders.tier.value;

  disp.rebate.textContent  = R;
  disp.mls.textContent     = M.toFixed(1);
  disp.premium.textContent = P;
  disp.tier.textContent    = T;

  // ΔU log-linear
  const delta = elasticities.price*P
              + elasticities.rebate*(R-baseline.rebatePct)
              + elasticities.mls*M
              + elasticities.tier*(T-1);
  let up = baseline.uptake + delta/100;
  up = Math.max(0,Math.min(1,up));

  // Costs
  const premAmt = baseline.premium*(1+P/100),
        rebatePer = premAmt*(R/100),
        rebateCost = rebatePer*up,
        hospOffset = baseline.hospitalOffsetPer*up;

  disp.uptake.textContent     = (up*100).toFixed(1);
  disp.rebateCost.textContent = rebateCost.toFixed(0);
  disp.offset.textContent     = hospOffset.toFixed(0);

  // Update live charts
  const label = `R${R}-P${P}-M${M}-T${T}`;
  if (chartUptake.data.labels.length>20) {
    chartUptake.data.labels.shift(); chartUptake.data.datasets[0].data.shift();
  }
  chartUptake.data.labels.push(label);
  chartUptake.data.datasets[0].data.push((up*100).toFixed(1));
  chartUptake.update();

  chartBudget.data.datasets[0].data = [rebateCost.toFixed(0), hospOffset.toFixed(0)];
  chartBudget.update();
}

// Attach listeners & init
Object.values(sliders).forEach(s=>s.addEventListener('input', updateSimulation));
updateSimulation();
