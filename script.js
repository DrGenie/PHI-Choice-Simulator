// --- PARAMETERS & COEFFICIENTS ---
const stateParams = {
  National:{price:-0.016, rebate:0.010, mls:0.020, tier:0.025, col:1.00},
  NSW:      {price:-0.015, rebate:0.010, mls:0.020, tier:0.025, col:1.05},
  VIC:      {price:-0.017, rebate:0.009, mls:0.018, tier:0.023, col:1.03},
  QLD:      {price:-0.016, rebate:0.010, mls:0.019, tier:0.024, col:0.98},
  WA:       {price:-0.015, rebate:0.011, mls:0.017, tier:0.022, col:1.02},
  SA:       {price:-0.014, rebate:0.010, mls:0.018, tier:0.021, col:0.95},
  TAS:      {price:-0.013, rebate:0.012, mls:0.019, tier:0.020, col:0.90},
  NT:       {price:-0.018, rebate:0.008, mls:0.021, tier:0.019, col:1.10},
  ACT:      {price:-0.016, rebate:0.010, mls:0.020, tier:0.022, col:1.00}
};
const fundingMult = { uniform:1, block:0.9, abf:1.1 };
const baseline = { uptake:0.35, premium:1200, rebate:25 };

// --- DOM REFERENCES ---
const D = {
  state:  document.getElementById('selectState'),
  fund:   document.getElementById('selectFunding'),
  rebate: document.getElementById('sliderRebate'),
  mls:    document.getElementById('sliderMLS'),
  prem:   document.getElementById('sliderPremium'),
  tier:   document.getElementById('sliderTier'),
  col:    document.getElementById('chkCOL'),
  vals: {
    rebate:  document.getElementById('valRebate'),
    mls:     document.getElementById('valMLS'),
    prem:    document.getElementById('valPremium'),
    tier:    document.getElementById('valTier')
  },
  runBtn: document.getElementById('runBtn'),
  res: {
    uptake: document.getElementById('resUptake'),
    rebate: document.getElementById('resRebateCost'),
    offset: document.getElementById('resOffset')
  },
  rec:     document.getElementById('recommendation'),
  tbl:     document.querySelector('#tblScenarios tbody'),
  btnAdd:  document.getElementById('btnAddScenario'),
  btnCSV:  document.getElementById('btnDownloadCSV'),
  btnPDF:  document.getElementById('btnDownloadPDF')
};

// --- Populate dropdowns ---
Object.keys(stateParams).forEach(s => D.state.add(new Option(s)));
['uniform','block','abf'].forEach(f => D.fund.add(new Option(f,f)));

// --- Tab navigation ---
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(sec=>sec.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

// --- Chart helpers ---
Chart.defaults.font.family = 'Arial';
Chart.defaults.font.size   = 12;
function makeLine(ctx,color){
  const grad=ctx.createLinearGradient(0,0,0,300);
  grad.addColorStop(0,color.replace('1)','0.4)'));
  grad.addColorStop(1,color.replace('1)','0)'));
  return new Chart(ctx,{
    type:'line',
    data:{ labels:[], datasets:[{data:[], borderColor:color, backgroundColor:grad, tension:0.3, fill:true}]},
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true,max:100}}}
  });
}
function makeBar(ctx,labels,colors){
  return new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[{data:[], backgroundColor:colors}]},
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true} } }
  });
}

// --- Initialize charts ---
const chartU = makeLine(document.getElementById('chartUptake').getContext('2d'),'rgba(0,114,189,1)');
const chartB = makeBar(document.getElementById('chartBudget').getContext('2d'),
  ['Rebate Cost','Hospital Saving'],['rgba(237,125,49,0.8)','rgba(112,173,71,0.8)']);
const chartC = makeBar(document.getElementById('chartCoeffs').getContext('2d'),
  ['β_prem','β_rebate','β_mls','β_tier'],['#0072B2','#E69F00','#009E73','#CC79A7']);

// --- Logistic helper ---
function logistic(x){ return 1/(1+Math.exp(-x)); }

// --- Simulation function ---
function simulate(){
  // read inputs
  const st = D.state.value, fm = D.fund.value;
  const R  = +D.rebate.value, M = +D.mls.value,
        P  = +D.prem.value, T = +D.tier.value;
  const useCOL = D.col.checked;

  // display slider values
  D.vals.rebate.textContent = R;
  D.vals.mls.textContent    = M.toFixed(1);
  D.vals.prem.textContent   = P;
  D.vals.tier.textContent   = T;

  // get params
  const p = stateParams[st];
  const β0 = Math.log(baseline.uptake/(1-baseline.uptake));
  const βprem   = p.price;
  const βreb    = p.rebate;
  const βmls    = p.mls;
  const βtier   = p.tier;
  const colF    = useCOL ? p.col : 1;
  const premAmt = baseline.premium * colF * (1 + P/100);

  // utility & uptake
  const U = β0
          + βprem * (-(premAmt - baseline.premium*colF))
          + βreb  * R
          + βmls  * M
          + βtier * (T-1);
  const uptake = logistic(U) * 100;

  // costs
  const rebateCost = premAmt * (R/100) * (uptake/100);
  const hospSave   = 400 * (uptake/100) * fundingMult[fm];

  // display results
  D.res.uptake.textContent = uptake.toFixed(1) + ' %';
  D.res.rebate.textContent = rebateCost.toFixed(0);
  D.res.offset.textContent = hospSave.toFixed(0);

  // recommendation
  let rec = '';
  if(uptake < 30) rec = `Low uptake (${uptake.toFixed(1)}%). Increase rebate or reduce premium.`;
  else if(uptake < 60) rec = `Moderate uptake (${uptake.toFixed(1)}%). Small tweaks to rebate/MLS.`;
  else rec = `High uptake (${uptake.toFixed(1)}%). Consider reducing rebate to save budget.`;
  D.rec.textContent = rec;

  // update charts
  const label = `${st}|R${R}|P${P}|M${M}|T${T}`;
  if(chartU.data.labels.length > 20){
    chartU.data.labels.shift(); chartU.data.datasets[0].data.shift();
  }
  chartU.data.labels.push(label);
  chartU.data.datasets[0].data.push(uptake.toFixed(1));
  chartU.update();

  chartB.data.datasets[0].data = [rebateCost.toFixed(0), hospSave.toFixed(0)];
  chartB.update();

  chartC.data.datasets[0].data = [
    βprem, βreb, βmls, βtier
  ];
  chartC.update();
}

// --- Wire events ---
D.runBtn.onclick = simulate;
[
  D.state, D.fund, D.rebate, D.mls, D.prem, D.tier, D.col
].forEach(el => el.oninput = () => D.runBtn.disabled = false);

// --- Scenario Compare ---
let count=0;
D.btnAdd.onclick = () => {
  count++;
  const tr = D.tbl.insertRow();
  tr.insertCell().textContent = count;
  tr.insertCell().textContent = `${D.state.value}|${D.fund.value}|R${D.rebate.value}|P${D.prem.value}`;
  tr.insertCell().textContent = D.res.uptake.textContent;
  tr.insertCell().textContent = D.res.rebate.textContent;
  tr.insertCell().textContent = D.res.offset.textContent;
};

// --- Export CSV ---
D.btnCSV.onclick = () => {
  const hdr = ['State','Funding','Rebate','MLS','PremiumΔ','Tier','Uptake%','RebateCost','HospSave'];
  const row = [
    D.state.value, D.fund.value,
    D.rebate.value, D.mls.value,
    D.prem.value, D.tier.value,
    D.res.uptake.textContent.replace('%',''),
    D.res.rebate.textContent,
    D.res.offset.textContent
  ];
  const csv = [hdr.join(','), row.join(',')].join('\n');
  const blob = new Blob([csv],{type:'text/csv'}), url=URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='scenario.csv'; a.click();
  URL.revokeObjectURL(url);
};

// --- Export PDF (simple) ---
D.btnPDF.onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('PHI Scenario Report',10,10);
  doc.setFontSize(12);
  doc.text(`State: ${D.state.value}`,10,20);
  doc.text(`Funding: ${D.fund.value}`,10,30);
  doc.text(`Rebate: ${D.rebate.value}%`,10,40);
  doc.text(`Uptake: ${D.res.uptake.textContent}`,10,50);
  doc.save('scenario.pdf');
};

// --- Initial simulate ---
simulate();
