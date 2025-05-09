// --- PARAMETERS ---
const stateElast = {
  NSW:{price:-0.015,rebate:0.010,mls:0.020,breadth:0.030,network:0.025,col:1.05},
  VIC:{price:-0.017,rebate:0.009,mls:0.018,breadth:0.028,network:0.023,col:1.03},
  QLD:{price:-0.016,rebate:0.010,mls:0.019,breadth:0.029,network:0.024,col:0.98},
  WA: {price:-0.015,rebate:0.011,mls:0.017,breadth:0.027,network:0.022,col:1.02},
  SA: {price:-0.014,rebate:0.010,mls:0.018,breadth:0.026,network:0.021,col:0.95},
  TAS:{price:-0.013,rebate:0.012,mls:0.019,breadth:0.025,network:0.020,col:0.90},
  NT: {price:-0.018,rebate:0.008,mls:0.021,breadth:0.024,network:0.019,col:1.10},
  ACT:{price:-0.016,rebate:0.010,mls:0.020,breadth:0.027,network:0.022,col:1.00}
};
const fundingMult = { uniform:1, block:0.9, abf:1.1 };
const demoCoeff = {
  age: { '<35': -0.1, '35-60':0, '>60':0.1 },
  income: {'<50k':-0.05,'50-100k':0,'>100k':0.05},
  risk: {'Low':-0.1,'Medium':0,'High':0.1}
};
const baseline = { beta0: Math.log(0.35/0.65), premium0:1200, rebate0:25 };

// --- DOM refs ---
const D = {
  state:  document.getElementById('selectState'),
  fund:   document.getElementById('selectFunding'),
  rebate: document.getElementById('sliderRebate'),
  mls:    document.getElementById('sliderMLS'),
  prem:   document.getElementById('sliderPremium'),
  tier:   document.getElementById('sliderTier'),
  age:    document.getElementById('selAge'),
  inc:    document.getElementById('selIncome'),
  risk:   document.getElementById('selRisk'),
  year:   document.getElementById('sliderYear'),
  col:    document.getElementById('chkCOL'),
  vals: {
    rebate:  document.getElementById('valRebate'),
    mls:     document.getElementById('valMLS'),
    prem:    document.getElementById('valPremium'),
    tier:    document.getElementById('valTier'),
    year:    document.getElementById('valYear')
  },
  res: {
    uptake:  document.getElementById('resUptake'),
    rebate:  document.getElementById('resRebateCost'),
    offset:  document.getElementById('resOffset')
  },
  rec:    document.getElementById('recommendation'),
  tbl:    document.getElementById('tblScenarios').getElementsByTagName('tbody')[0],
  btnAdd: document.getElementById('btnAddScenario'),
  btnCSV: document.getElementById('btnDownloadCSV'),
  btnPDF: document.getElementById('btnDownloadPDF')
};

// --- Populate selects ---
['NSW','VIC','QLD','WA','SA','TAS','NT','ACT']
  .forEach(s=>{ let o=new Option(s,s);D.state.add(o);});
['uniform','block','abf']
  .forEach(f=>{ let o=new Option(f,f);D.fund.add(o);});
['<35','35-60','>60']
  .forEach(a=>{ D.age.add(new Option(a,a));});
['<50k','50-100k','>100k']
  .forEach(i=>{ D.inc.add(new Option(i,i));});
['Low','Medium','High']
  .forEach(r=>{ D.risk.add(new Option(r,r));});

// --- Tab nav ---
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

// --- Chart init ---
Chart.defaults.font.family='Arial, sans-serif';
Chart.defaults.font.size=12;

function makeLine(ctx,color){
  const grad=ctx.createLinearGradient(0,0,0,300);
  grad.addColorStop(0,color.replace('1)','0.4)'));
  grad.addColorStop(1,color.replace('1)','0)'));
  return new Chart(ctx,{
    type:'line',
    data:{ labels:[], datasets:[{
      label:'',data:[],borderColor:color,backgroundColor:grad,
      tension:0.3,fill:true,pointRadius:4
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,
      scales:{ y:{ beginAtZero:true,max:100,title:{display:true,text:'%'}}}
    }
  });
}
function makeBar(ctx,labels,colors,unit='%'){
  return new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[{data:[],backgroundColor:colors}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      scales:{ y:{ beginAtZero:true,title:{display:true,text:unit}}}
    }
  });
}

const chartU=makeLine(document.getElementById('chartUptake').getContext('2d'),'rgba(0,114,189,1)');
const chartB=makeBar(document.getElementById('chartBudget').getContext('2d'),
  ['Rebate Cost','Hosp Savings'],['rgba(237,125,49,0.8)','rgba(112,173,71,0.8)'],'AUD');
const chartC=makeBar(document.getElementById('chartCoeffs').getContext('2d'),
  ['β_prem','β_rebate','β_mls','β_breadth','β_network'],['#0072B2','#E69F00','#009E73','#CC79A7','#8C564B']);
const rebates=Array.from({length:11},(_,i)=>i*5);
const chartS=makeLine(document.getElementById('chartScenario').getContext('2d'),'rgba(255,192,0,1)');
chartS.data.labels=rebates.map(r=>r+'%');
const states=Object.keys(stateElast);
const chartSC=makeBar(document.getElementById('chartStateComparison').getContext('2d'),
  states,states.map((_,i)=>`hsl(${i*40},70%,50%)`),'%');

// --- Utility & logistic ---
function logistic(x){ return 1/(1+Math.exp(-x)); }

// --- Scenario storage ---
let scenarioCount=0;

// --- Main simulate function ---
function simulate(){
  // inputs
  const st=D.state.value, fm=D.fund.value,
        R=+D.rebate.value, M=+D.mls.value,
        P=+D.prem.value, T=+D.tier.value,
        age=D.age.value, inc=D.inc.value,
        risk=D.risk.value, year=+D.year.value,
        useCOL=D.col.checked;
  // display input values
  D.valR.textContent=R; D.valMLS.textContent=M.toFixed(1);
  D.valPremium.textContent=P; D.valTier.textContent=T;
  D.valYear.textContent=year;

  // get coefficients
  const e=stateElast[st];
  const β0=baseline.beta0 + (year-2025)*0.05;    // time trend
  const βprem=e.price, βreb=e.rebate, βmls=e.mls,
        βbread=e.breadth, βnet=e.network;
  const βage=demoCoeff.age[age],
        βinc=demoCoeff.income[inc],
        βrisk=demoCoeff.risk[risk];
  const colFactor=useCOL?e.col:1;

  // construct utility
  const Δprem=(baseline.premium*colFactor)*(P/100);
  const U = β0
          + βprem*(-Δprem)
          + βreb*(R)
          + βmls*(M)
          + βbread*(T-1)
          + βnet*(T)  // proxy for network index
          + βage + βinc + βrisk;
  const uptake=logistic(U)*100;

  // costs
  const rebateCost = (baseline.premium*colFactor*(1+P/100))*(R/100)*(uptake/100);
  const hospSave = baseline.hospitalOffsetPer*(uptake/100)*fundingMult[fm];

  // display results
  D.resU.textContent=uptake.toFixed(1)+' %';
  D.resCSR.textContent=rebateCost.toFixed(0);
  D.resOff.textContent=hospSave.toFixed(0);

  // recommendation
  let rec='';
  if(uptake<30) rec=`Low uptake (${uptake.toFixed(1)}%). Increase rebate or reduce premium.`;
  else if(uptake<60) rec=`Moderate uptake (${uptake.toFixed(1)}%). Fine-tune rebate/MLS.`;
  else rec=`High uptake (${uptake.toFixed(1)}%). Consider reducing rebate.`;
  D.rec.textContent=rec;

  // update charts
  const lbl=`${st}|Y${year}|R${R}|P${P}`;
  if(chartU.data.labels.length>20){
    chartU.data.labels.shift(); chartU.data.datasets[0].data.shift();
  }
  chartU.data.labels.push(lbl);
  chartU.data.datasets[0].data.push(uptake.toFixed(1));
  chartU.update();

  chartB.data.datasets[0].data=[rebateCost.toFixed(0),hospSave.toFixed(0)];
  chartB.update();

  chartC.data.datasets[0].data=[βprem,βreb,βmls,βbread,βnet];
  chartC.update();

  chartS.data.datasets[0].data=rebates.map(r=>(
    logistic(β0+βprem*(-baseline.premium*colFactor*(0)) + βreb*r )*100
  ));
  chartS.update();

  chartSC.data.datasets[0].data=states.map(s=>{
    const es=stateElast[s];
    return logistic(baseline.beta0*es.col)*100;
  });
  chartSC.update();
}

// --- Wire inputs to simulate ---
[
  D.state,D.fund,D.rebate,D.mls,D.prem,D.tier,
  D.age,D.inc,D.risk,D.year,D.col
].forEach(el=>el.oninput=simulate);

// --- Scenario Compare ---
D.btnAdd.onclick=()=>{
  scenarioCount++;
  const row=D.tbl.insertRow();
  row.insertCell().textContent=scenarioCount;
  row.insertCell().textContent=`${D.state.value}|${D.fund.value}|R${D.rebate.value}`;
  row.insertCell().textContent=D.resU.textContent;
  row.insertCell().textContent=D.resCSR.textContent;
  row.insertCell().textContent=D.resOff.textContent;
};

// --- Export CSV ---
D.btnCSV.onclick=()=>{
  const hdr=['State','Funding','Rebate','MLS','PremiumΔ','Tier','Age','Inc','Risk','Year','Uptake%','RebateCost','HospSave'];
  const vals=[
    D.state.value,D.fund.value,D.rebate.value,D.mls.value,D.prem.value,D.tier.value,
    D.age.value,D.inc.value,D.risk.value,D.year.value,
    D.resU.textContent.replace('%',''),
    D.resCSR.textContent,D.resOff.textContent
  ];
  const csv=[hdr.join(','),vals.join(',')].join('\n');
  const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='scenario.csv';a.click();
  URL.revokeObjectURL(url);
};

// --- Export PDF via jsPDF ---
D.btnPDF.onclick=()=>{
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF();
  doc.setFontSize(16);doc.text('PHI Scenario Report',10,10);
  doc.setFontSize(12);
  doc.text(`State: ${D.state.value}`,10,20);
  doc.text(`Funding: ${D.fund.value}`,10,30);
  doc.text(`Rebate: ${D.rebate.value}%`,10,40);
  doc.text(`Uptake: ${D.resU.textContent}`,10,50);
  doc.save('scenario.pdf');
};

// --- Init ---
simulate();
