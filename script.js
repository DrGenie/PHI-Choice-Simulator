// Elasticities & multipliers
const stateElast = {
  NSW:{price:-0.28,rebate:0.22,mls:0.12,tier:0.14},
  VIC:{price:-0.32,rebate:0.18,mls:0.10,tier:0.16},
  QLD:{price:-0.30,rebate:0.20,mls:0.11,tier:0.15},
  WA: {price:-0.29,rebate:0.21,mls:0.10,tier:0.14},
  SA: {price:-0.31,rebate:0.19,mls:0.11,tier:0.15},
  TAS:{price:-0.27,rebate:0.23,mls:0.13,tier:0.13},
  NT: {price:-0.33,rebate:0.17,mls:0.14,tier:0.12},
  ACT:{price:-0.30,rebate:0.20,mls:0.12,tier:0.15}
};
const fundingMult = { uniform:1, block:0.9, abf:1.1 };
const baseline = { uptake:0.35, premium:1200, rebatePct:25, hospitalOffsetPer:400 };

// Tabs
document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));
  b.classList.add('active');
  document.getElementById(b.dataset.tab).classList.add('active');
});

// DOM
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
  run:     document.getElementById('runBtn')
};

// Charts init (empty)
function makeLine(ctx,color){
  const grad=ctx.createLinearGradient(0,0,0,300);
  grad.addColorStop(0, color.replace('1)','0.5)'));
  grad.addColorStop(1, color.replace('1)','0)'));
  return new Chart(ctx,{type:'line',data:{labels:[],datasets:[{data:[],borderColor:color,backgroundColor:grad,tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,max:100}}}});
}
function makeBar(ctx,labels,colors){
  return new Chart(ctx,{type:'bar',data:{labels, datasets:[{data:[],backgroundColor:colors}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});
}

const chartU = makeLine(document.getElementById('chartUptake').getContext('2d'),'rgba(0,95,115,1)');
const chartB = makeBar(document.getElementById('chartBudget').getContext('2d'),['Rebate Cost','Hospital Savings'],['rgba(10,147,150,0.7)','rgba(148,210,189,0.7)']);
const chartE = makeBar(document.getElementById('chartElasticity').getContext('2d'),['Price','Rebate','MLS','Tier'],['#005f73','#0a9396','#94d2bd','#ee9b00']);

const rebates = Array.from({length:11},(_,i)=>i*5);
const chartS = makeLine(document.getElementById('chartScenario').getContext('2d'),'rgba(238,155,0,1)');
chartS.data.labels = rebates.map(r=>r+'%');

const states = Object.keys(stateElast);
const chartSC = makeBar(document.getElementById('chartStateComparison').getContext('2d'), states, states.map((_,i)=>`hsl(${i*40},70%,50%)`));

// Simulation logic
D.run.addEventListener('click',()=>{
  // read & display inputs
  const st=D.state.value, fm=D.funding.value;
  const R=+D.rebate.value, M=+D.mls.value, P=+D.premium.value, T=+D.tier.value;
  D.valR.textContent=R; D.valM.textContent=M.toFixed(1);
  D.valP.textContent=P; D.valT.textContent=T;

  // compute uptake
  const e=stateElast[st];
  let delta = e.price*P + e.rebate*(R-baseline.rebatePct) + e.mls*M + e.tier*(T-1);
  let up   = Math.max(0,Math.min(1, baseline.uptake + delta/100 ));

  // costs
  const premAmt   = baseline.premium*(1+P/100);
  const rebatePer = premAmt*(R/100);
  const rebateCost= rebatePer*up;
  const hospOff   = baseline.hospitalOffsetPer*up*fundingMult[fm];

  D.resU.textContent=(up*100).toFixed(1)+' %';
  D.resRC.textContent=rebateCost.toFixed(0);
  D.resO.textContent=hospOff.toFixed(0);

  // recommendation
  let rec='';
  if(up<0.30){
    const needed = ((0.30-baseline.uptake)*100/e.rebate).toFixed(1);
    rec = `Uptake is low (${(up*100).toFixed(1)}%). Try ↑ rebate by ~${needed}% to reach 30% uptake.`;
  } else if(up<0.60){
    rec = `Uptake ${(up*100).toFixed(1)}% is moderate. Consider small rebate ↑ or premium ↓ to boost further.`;
  } else {
    rec = `Uptake ${(up*100).toFixed(1)}% is strong. You might reduce rebate to save budget.`;
  }
  D.rec.textContent = rec;

  // update charts
  const label=`${st}-R${R}-P${P}-M${M}-T${T}`;
  // Uptake over scenarios
  if(chartU.data.labels.length>20){
    chartU.data.labels.shift(); chartU.data.datasets[0].data.shift();
  }
  chartU.data.labels.push(label);
  chartU.data.datasets[0].data.push((up*100).toFixed(1));
  chartU.update();

  // Budget impact
  chartB.data.datasets[0].data=[rebateCost.toFixed(0), hospOff.toFixed(0)];
  chartB.update();

  // Elasticities (state)
  chartE.data.datasets[0].data=[e.price,e.rebate,e.mls,e.tier];
  chartE.update();

  // Uptake vs rebate
  chartS.data.datasets[0].data = rebates.map(r=>{
    const d2 = e.rebate*(r-baseline.rebatePct);
    return Math.max(0,Math.min(1, baseline.uptake + d2/100 ))*100;
  });
  chartS.update();

  // State comparison
  chartSC.data.datasets[0].data = states.map(s=>{
    const es=stateElast[s];
    const d3=es.price*P + es.rebate*(R-baseline.rebatePct)+es.mls*M+es.tier*(T-1);
    return Math.max(0,Math.min(1, baseline.uptake + d3/100 ))*100;
  });
  chartSC.update();
});
