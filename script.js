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
// Funding multipliers for hospital savings
const fundingMult = { uniform:1, block:0.9, abf:1.1 };

// Baseline
const baseline = {
  uptake:0.35,
  premium:1200,
  rebatePct:25,
  hospitalOffsetPer:400
};

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

// DOM
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
  resO:    document.getElementById('resOffset')
};

// Charts
const chartU = new Chart(elems.canvasU = document.getElementById('chartUptake').getContext('2d'), {
  type:'line',
  data:{ labels:[], datasets:[{ label:'Uptake (%)', data:[], borderColor:'#005f73', fill:false }]},
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});
const chartB = new Chart(document.getElementById('chartBudget').getContext('2d'), {
  type:'bar',
  data:{ labels:['Rebate Cost','Hospital Savings'], datasets:[{ label:'AUD/person', data:[], backgroundColor:['rgba(10,147,150,0.7)','rgba(148,210,189,0.7)'] }]},
  options:{ scales:{ y:{ beginAtZero:true } } }
});
const chartE = new Chart(document.getElementById('chartElasticity').getContext('2d'), {
  type:'bar',
  data:{ labels:['Price','Rebate','MLS','Tier'], datasets:[{ label:'Elasticity', data:[0,0,0,0], backgroundColor:['#005f73','#0a9396','#94d2bd','#ee9b00'] }] },
  options:{ indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
});
const rebates = Array.from({length:11},(_,i)=>i*5), uptakeCurve = rebates.map(R=>{
  const d = elasticities.rebate*(R-baseline.rebatePct);
  return Math.max(0,Math.min(1,baseline.uptake + d/100))*100;
});
const chartS = new Chart(document.getElementById('chartScenario').getContext('2d'), {
  type:'line',
  data:{ labels:rebates.map(r=>r+'%'), datasets:[{ label:'Uptake vs Rebate', data:uptakeCurve, borderColor:'#ee9b00', fill:false }]},
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});
const stateNames = Object.keys(stateElasticities);
const chartSC = new Chart(document.getElementById('chartStateComparison').getContext('2d'), {
  type:'bar',
  data:{ labels:stateNames, datasets:[{ label:'Uptake (%) by State', data:[], backgroundColor:stateNames.map((_,i)=>`hsl(${i*40},70%,50%)`) }]},
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});

// Update
function update() {
  const st = elems.state.value, fm = elems.funding.value,
        R = +elems.rebate.value, M = +elems.mls.value,
        P = +elems.premium.value, T = +elems.tier.value;
  elems.valR.textContent=R;
  elems.valM.textContent=M.toFixed(1);
  elems.valP.textContent=P;
  elems.valT.textContent=T;

  // state elasticities
  const e = stateElasticities[st];
  const dU = e.price*P + e.rebate*(R-baseline.rebatePct) + e.mls*M + e.tier*(T-1);
  let up = baseline.uptake + dU/100;
  up = Math.max(0,Math.min(1,up));

  const premAmt = baseline.premium*(1+P/100),
        rebatePer = premAmt*(R/100),
        rebateCost = rebatePer*up,
        hospOffset = baseline.hospitalOffsetPer*up*fundingMult[fm];

  elems.resU.textContent = (up*100).toFixed(1);
  elems.resRC.textContent = rebateCost.toFixed(0);
  elems.resO.textContent = hospOffset.toFixed(0);

  // Uptake chart
  const lbl=`${st}-R${R}-P${P}-M${M}-T${T}`;
  if(chartU.data.labels.length>20){
    chartU.data.labels.shift(); chartU.data.datasets[0].data.shift();
  }
  chartU.data.labels.push(lbl);
  chartU.data.datasets[0].data.push((up*100).toFixed(1));
  chartU.update();

  // Budget
  chartB.data.datasets[0].data=[rebateCost.toFixed(0), hospOffset.toFixed(0)];
  chartB.update();

  // Elasticities
  chartE.data.datasets[0].data=[ e.price, e.rebate, e.mls, e.tier ];
  chartE.update();

  // State comparison
  chartSC.data.datasets[0].data = stateNames.map(s=>{
    const es = stateElasticities[s];
    const du = es.price*P + es.rebate*(R-baseline.rebatePct) + es.mls*M + es.tier*(T-1);
    const upS = Math.max(0,Math.min(1,baseline.uptake + du/100));
    return +(upS*100).toFixed(1);
  });
  chartSC.update();
}

// listeners
[...Object.values(elems).slice(2,6), elems.state, elems.funding]
  .forEach(el=>el.addEventListener('input', update));

update();
