// State-specific elasticities
const stateElasticities = {
  NSW: { price:-0.28, rebate:0.22, mls:0.12, tier:0.14 },
  VIC: { price:-0.32, rebate:0.18, mls:0.10, tier:0.16 },
  QLD: { price:-0.30, rebate:0.20, mls:0.11, tier:0.15 },
  WA:  { price:-0.29, rebate:0.21, mls:0.10, tier:0.14 },
  SA:  { price:-0.31, rebate:0.19, mls:0.11, tier:0.15 },
  TAS: { price:-0.27, rebate:0.23, mls:0.13, tier:0.13 },
  NT:  { price:-0.33, rebate:0.17, mls:0.14, tier:0.12 },
  ACT: { price:-0.30, rebate:0.20, mls:0.12, tier:0.15 }
};
// Funding multipliers
const fundingMult = { uniform:1, block:0.9, abf:1.1 };
// Baseline values
const baseline = {
  uptake: 0.35,
  premium: 1200,
  rebatePct: 25,
  hospitalOffsetPer: 400
};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// DOM references
const elems = {
  state:   document.getElementById('selectState'),
  funding: document.getElementById('selectFunding'),
  rebate:  document.getElementById('sliderRebate'),
  mls:     document.getElementById('sliderMLS'),
  premium: document.getElementById('sliderPremium'),
  tier:    document.getElementById('sliderTier'),
  valR:    document.getElementById('valRebate'),
  valM:    document.getElementById('valMLS'),
  valP:    document.getElementById('valPremium'),
  valT:    document.getElementById('valTier'),
  resU:    document.getElementById('resUptake'),
  resRC:   document.getElementById('resRebateCost'),
  resO:    document.getElementById('resOffset'),
  runBtn:  document.getElementById('runBtn')
};

// Initialize charts with baseline
const chartUptake = new Chart(document.getElementById('chartUptake').getContext('2d'), {
  type: 'line',
  data: { labels: ['Baseline'], datasets: [{ label: 'Uptake (%)', data: [baseline.uptake*100], borderColor: '#005f73', fill:false }] },
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});
const chartBudget = new Chart(document.getElementById('chartBudget').getContext('2d'), {
  type:'bar',
  data:{ labels:['Rebate Cost','Hospital Savings'], datasets:[{ label:'AUD/person', data:[baseline.premium*baseline.rebatePct/100*baseline.uptake, baseline.hospitalOffsetPer*baseline.uptake], backgroundColor:['rgba(10,147,150,0.7)','rgba(148,210,189,0.7)'] }] },
  options:{ scales:{ y:{ beginAtZero:true } } }
});
const chartElasticity = new Chart(document.getElementById('chartElasticity').getContext('2d'), {
  type:'bar',
  data:{ labels:['Price','Rebate','MLS','Tier'], datasets:[{ label:'Elasticity', data:Object.values(stateElasticities[elems.state.value]), backgroundColor:['#005f73','#0a9396','#94d2bd','#ee9b00'] }] },
  options:{ indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
});
const rebates = Array.from({length:11},(_,i)=>i*5);
const uptakeCurve = rebates.map(R => {
  const d = stateElasticities[elems.state.value].rebate*(R-baseline.rebatePct);
  return Math.max(0,Math.min(1,baseline.uptake + d/100))*100;
});
const chartScenario = new Chart(document.getElementById('chartScenario').getContext('2d'), {
  type:'line',
  data:{ labels:rebates.map(r=>r+'%'), datasets:[{ label:'Uptake vs Rebate', data:uptakeCurve, borderColor:'#ee9b00', fill:false }] },
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});
const stateNames = Object.keys(stateElasticities);
const chartStateComparison = new Chart(document.getElementById('chartStateComparison').getContext('2d'), {
  type:'bar',
  data:{ labels:stateNames, datasets:[{ label:'Baseline Uptake (%)', data:stateNames.map(s=>baseline.uptake*100), backgroundColor:stateNames.map((_,i)=>`hsl(${i*40},70%,50%)`) }] },
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});

// Run simulation on click
elems.runBtn.addEventListener('click', () => {
  const st = elems.state.value,
        fm = elems.funding.value,
        R  = +elems.rebate.value,
        M  = +elems.mls.value,
        P  = +elems.premium.value,
        T  = +elems.tier.value;
  // Update display values
  elems.valR.textContent = R;
  elems.valM.textContent = M.toFixed(1);
  elems.valP.textContent = P;
  elems.valT.textContent = T;

  // Compute uptake
  const e = stateElasticities[st];
  const deltaU = e.price*P + e.rebate*(R-baseline.rebatePct) + e.mls*M + e.tier*(T-1);
  let uptake = baseline.uptake + deltaU/100;
  uptake = Math.max(0, Math.min(1, uptake));

  // Costs
  const premiumAmt = baseline.premium*(1+P/100),
        rebatePer  = premiumAmt*(R/100),
        rebateCost = rebatePer*uptake,
        hospOffset = baseline.hospitalOffsetPer*uptake*fundingMult[fm];

  // Update results
  elems.resU.textContent  = (uptake*100).toFixed(1);
  elems.resRC.textContent = rebateCost.toFixed(0);
  elems.resO.textContent  = hospOffset.toFixed(0);

  // Update uptake chart
  const label = `${st}-R${R}-P${P}-M${M}-T${T}`;
  if(chartUptake.data.labels.length>20){
    chartUptake.data.labels.shift();
    chartUptake.data.datasets[0].data.shift();
  }
  chartUptake.data.labels.push(label);
  chartUptake.data.datasets[0].data.push((uptake*100).toFixed(1));
  chartUptake.update();

  // Update budget chart
  chartBudget.data.datasets[0].data = [rebateCost.toFixed(0), hospOffset.toFixed(0)];
  chartBudget.update();

  // Update elasticity chart
  chartElasticity.data.datasets[0].data = [e.price, e.rebate, e.mls, e.tier];
  chartElasticity.update();

  // Update scenario chart
  const newCurve = rebates.map(r => {
    const d2 = e.rebate*(r-baseline.rebatePct);
    return Math.max(0, Math.min(1,baseline.uptake + d2/100))*100;
  });
  chartScenario.data.datasets[0].data = newCurve;
  chartScenario.update();

  // Update state comparison
  const comp = stateNames.map(s => {
    const es = stateElasticities[s];
    const d3 = es.price*P + es.rebate*(R-baseline.rebatePct) + es.mls*M + es.tier*(T-1);
    return Math.max(0, Math.min(1, baseline.uptake + d3/100))*100;
  });
  chartStateComparison.data.datasets[0].data = comp;
  chartStateComparison.update();
});
