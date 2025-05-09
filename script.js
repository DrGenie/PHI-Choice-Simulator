// --- Parameters ---
const stateElast = {
  NSW:{price:-0.28, rebate:0.22, mls:0.12, tier:0.14, col:1.05},
  VIC:{price:-0.32, rebate:0.18, mls:0.10, tier:0.16, col:1.03},
  QLD:{price:-0.30, rebate:0.20, mls:0.11, tier:0.15, col:0.98},
  WA: {price:-0.29, rebate:0.21, mls:0.10, tier:0.14, col:1.02},
  SA: {price:-0.31, rebate:0.19, mls:0.11, tier:0.15, col:0.95},
  TAS:{price:-0.27, rebate:0.23, mls:0.13, tier:0.13, col:0.90},
  NT: {price:-0.33, rebate:0.17, mls:0.14, tier:0.12, col:1.10},
  ACT:{price:-0.30, rebate:0.20, mls:0.12, tier:0.15, col:1.00}
};
const fundingMult = { uniform:1, block:0.9, abf:1.1 };
const baseline = { uptake:0.35, premium:1200, rebatePct:25, hospitalOffsetPer:400 };

// --- DOM refs ---
const D = {
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
  rec:     document.getElementById('recommendation'),
  dl:      document.getElementById('downloadBtn')
};

// --- Tab navigation ---
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(sec=>sec.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

// --- Chart defaults ﹣ professional fonts/colors ---
Chart.defaults.font.family = 'Arial, sans-serif';
Chart.defaults.font.size   = 12;
Chart.defaults.color        = '#333';

// --- Create charts ﹣ empty initially ---
function makeLine(ctx, color) {
  const grad = ctx.createLinearGradient(0,0,0,300);
  grad.addColorStop(0, color.replace('1)','0.4)'));
  grad.addColorStop(1, color.replace('1)','0)'));
  return new Chart(ctx, {
    type:'line',
    data:{ labels:[], datasets:[{
      label: '', data:[], borderColor:color, backgroundColor:grad,
      tension:0.3, fill:true, pointRadius:4
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true, max:100, title:{display:true,text:'%'} } }
    }
  });
}
function makeBar(ctx, labels, colors) {
  return new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'', data:[], backgroundColor:colors }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true, title:{display:true,text:'AUD'} } }
    }
  });
}

const chartU = makeLine(document.getElementById('chartUptake').getContext('2d'), 'rgba(0,114,189,1)');
const chartB = makeBar(document.getElementById('chartBudget').getContext('2d'),
  ['Rebate Cost','Hospital Savings'], ['rgba(237,125,49,0.8)','rgba(112,173,71,0.8)']);
const chartE = makeBar(document.getElementById('chartElasticity').getContext('2d'),
  ['Price','Rebate','MLS','Tier'], ['#0072B2','#E69F00','#009E73','#CC79A7']);
const rebates = Array.from({length:11},(_,i)=>i*5);
const chartS = makeLine(document.getElementById('chartScenario').getContext('2d'),'rgba(255,192,0,1)');
chartS.data.labels = rebates.map(r=>r+'%');
const stateNames = Object.keys(stateElast);
const chartSC = makeBar(document.getElementById('chartStateComparison').getContext('2d'),
  stateNames, stateNames.map((_,i)=>`hsl(${i*40},70%,50%)`));

// --- Simulation & update function ---
function simulate() {
  const st = D.state.value, fm = D.funding.value;
  const R = +D.rebate.value, M = +D.mls.value;
  const P = +D.premium.value, T = +D.tier.value;
  // display inputs
  D.valR.textContent = R;
  D.valM.textContent = M.toFixed(1);
  D.valP.textContent = P;
  D.valT.textContent = T;

  // get state params
  const e = stateElast[st];
  const col = e.col;

  // compute delta uptake
  let deltaU = e.price*P + e.rebate*(R - baseline.rebatePct)
             + e.mls*M + e.tier*(T - 1);
  let uptake = baseline.uptake*col + deltaU/100;           // adjust baseline by cost-of-living
  uptake = Math.max(0, Math.min(1, uptake));

  // calculate costs
  const basePrem = baseline.premium * col;
  const premAmt = basePrem * (1 + P/100);
  const rebatePer = premAmt * (R/100);
  const rebateCost = rebatePer * uptake;
  const hospOffset = baseline.hospitalOffsetPer * uptake * fundingMult[fm];

  // display results
  D.resU.textContent = (uptake*100).toFixed(1) + ' %';
  D.resRC.textContent = rebateCost.toFixed(0);
  D.resO.textContent = hospOffset.toFixed(0);

  // dynamic recommendation
  let rec = '';
  if (uptake < 0.30) {
    const needed = ((0.30 - uptake)*100 / e.rebate).toFixed(1);
    rec = `Low uptake (${(uptake*100).toFixed(1)}%). Consider ↑ rebate by ~${needed}% or ↓ premium.`;
  } else if (uptake < 0.60) {
    rec = `Moderate uptake (${(uptake*100).toFixed(1)}%). Small tweak to rebate or MLS could help.`;
  } else {
    rec = `High uptake (${(uptake*100).toFixed(1)}%). You might reduce rebate to save budget.`;
  }
  D.rec.textContent = rec;

  // update charts
  const label = `${st}|R${R}|P${P}|M${M}|T${T}`;
  // Uptake chart
  if (chartU.data.labels.length > 20) {
    chartU.data.labels.shift(); chartU.data.datasets[0].data.shift();
  }
  chartU.data.labels.push(label);
  chartU.data.datasets[0].data.push((uptake*100).toFixed(1));
  chartU.update();
  // Budget
  chartB.data.datasets[0].data = [rebateCost.toFixed(0), hospOffset.toFixed(0)];
  chartB.update();
  // Elasticities
  chartE.data.datasets[0].data = [e.price, e.rebate, e.mls, e.tier];
  chartE.update();
  // Uptake vs Rebate
  chartS.data.datasets[0].data = rebates.map(r => {
    const d2 = e.rebate*(r - baseline.rebatePct);
    return Math.max(0, Math.min(1, baseline.uptake*col + d2/100))*100;
  });
  chartS.update();
  // State Comparison
  chartSC.data.datasets[0].data = stateNames.map(s => {
    const es = stateElast[s];
    const u2 = baseline.uptake*es.col
             + (es.price*P + es.rebate*(R-baseline.rebatePct)
             + es.mls*M + es.tier*(T-1))/100;
    return Math.max(0,Math.min(1,u2))*100;
  });
  chartSC.update();
}

// --- Wire inputs for dynamic update ---
[D.state, D.funding, D.rebate, D.mls, D.premium, D.tier]
  .forEach(el => el.addEventListener('input', simulate));

// --- Download CSV ---
D.dl.addEventListener('click', () => {
  const headers = ['State','Funding','Rebate','MLS','PremiumΔ','Tier','Uptake%','RebateCost','HospitalSavings'];
  const row = [
    D.state.value,
    D.funding.value,
    D.rebate.value,
    D.mls.value,
    D.premium.value,
    D.tier.value,
    D.resU.textContent.replace(' %',''),
    D.resRC.textContent,
    D.resO.textContent
  ];
  const csv = [headers.join(','), row.join(',')].join('\n');
  const blob = new Blob([csv],{type:'text/csv'}), url=URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'phi_scenario.csv'; a.click();
  URL.revokeObjectURL(url);
});

// --- Initial run ---
simulate();
