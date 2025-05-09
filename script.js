document.addEventListener('DOMContentLoaded', () => {
  // PARAMETERS & COEFFICIENTS
  const stateParams = {
    National: { price:-0.016, rebate:0.010, mls:0.020, tier:0.025, col:1.00 },
    NSW:      { price:-0.015, rebate:0.010, mls:0.020, tier:0.025, col:1.05 },
    VIC:      { price:-0.017, rebate:0.009, mls:0.018, tier:0.023, col:1.03 },
    QLD:      { price:-0.016, rebate:0.010, mls:0.019, tier:0.024, col:0.98 },
    WA:       { price:-0.015, rebate:0.011, mls:0.017, tier:0.022, col:1.02 },
    SA:       { price:-0.014, rebate:0.010, mls:0.018, tier:0.021, col:0.95 },
    TAS:      { price:-0.013, rebate:0.012, mls:0.019, tier:0.020, col:0.90 },
    NT:       { price:-0.018, rebate:0.008, mls:0.021, tier:0.019, col:1.10 },
    ACT:      { price:-0.016, rebate:0.010, mls:0.020, tier:0.022, col:1.00 }
  };
  const fundingMult = { uniform:1, block:0.9, abf:1.1 };
  const baseline = { uptake:0.35, premium:1200, rebate:25 };

  // DOM REFERENCES
  const D = {
    state:  document.getElementById('selectState'),
    fund:   document.getElementById('selectFunding'),
    rebate: document.getElementById('sliderRebate'),
    mls:    document.getElementById('sliderMLS'),
    prem:   document.getElementById('sliderPremium'),
    tier:   document.getElementById('sliderTier'),
    col:    document.getElementById('chkCOL'),
    vals: {
      rebate: document.getElementById('valRebate'),
      mls:    document.getElementById('valMLS'),
      prem:   document.getElementById('valPremium'),
      tier:   document.getElementById('valTier')
    },
    runBtn: document.getElementById('runBtn'),
    res: {
      uptake: document.getElementById('resUptake'),
      rebate: document.getElementById('resRebateCost'),
      offset: document.getElementById('resOffset')
    },
    rec:    document.getElementById('recommendation'),
    tbl:    document.querySelector('#tblScenarios tbody'),
    btnAdd: document.getElementById('btnAddScenario'),
    btnCSV: document.getElementById('btnDownloadCSV'),
    btnPDF: document.getElementById('btnDownloadPDF')
  };

  // Populate location dropdown
  Object.keys(stateParams).forEach(loc => {
    let o = new Option(loc, loc);
    D.state.add(o);
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Chart setup
  Chart.defaults.font.family = 'Arial';
  Chart.defaults.font.size   = 12;
  const makeLine = (ctx,color) => {
    const grad = ctx.createLinearGradient(0,0,0,300);
    grad.addColorStop(0, color.replace('1)','0.4)'));
    grad.addColorStop(1, color.replace('1)','0)'));
    return new Chart(ctx, {
      type:'line',
      data:{ labels:[], datasets:[{ data:[], borderColor:color, backgroundColor:grad, tension:0.3, fill:true }] },
      options:{ responsive:true, maintainAspectRatio:false,
        scales:{ x:{ ticks:{ maxRotation:45,minRotation:45 } }, y:{ beginAtZero:true,max:100 } }
      }
    });
  };
  const makeBar = (ctx,labels,colors) => new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data:[], backgroundColor:colors }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  const chartU = makeLine(document.getElementById('chartUptake').getContext('2d'),'rgba(0,114,189,1)');
  const chartB = makeBar(document.getElementById('chartBudget').getContext('2d'),
    ['Rebate Cost','Hospital Savings'], ['rgba(237,125,49,0.8)','rgba(112,173,71,0.8)']);
  const chartC = makeBar(document.getElementById('chartCoeffs').getContext('2d'),
    ['β_prem','β_rebate','β_mls','β_tier'], ['#0072B2','#E69F00','#009E73','#CC79A7']);

  // Logistic helper
  const logistic = x => 1/(1+Math.exp(-x));

  // Main simulate function
  function simulate() {
    const loc = D.state.value, fm = D.fund.value;
    const R  = +D.rebate.value, M = +D.mls.value, P = +D.prem.value, T = +D.tier.value;
    const useCOL = D.col.checked;

    // Display slider values
    D.vals.rebate.textContent = R;
    D.vals.mls.textContent    = M.toFixed(1);
    D.vals.prem.textContent   = P;
    D.vals.tier.textContent   = T;

    const p     = stateParams[loc];
    const colF  = useCOL ? p.col : 1;
    const β0    = Math.log(baseline.uptake/(1-baseline.uptake));
    const βprem = p.price, βreb = p.rebate, βmls = p.mls, βtier = p.tier;
    const premAmt = baseline.premium * colF * (1 + P/100);

    // Utility & uptake
    const U      = β0
                 + βprem * (-(premAmt - baseline.premium*colF))
                 + βreb  * R
                 + βmls  * M
                 + βtier * (T - 1);
    const uptake = logistic(U) * 100;

    // Costs
    const rebateCost = premAmt * (R/100) * (uptake/100);
    const hospSave   = 400 * (uptake/100) * fundingMult[fm];

    // Display results
    D.res.uptake.textContent = uptake.toFixed(1) + ' %';
    D.res.rebate.textContent = rebateCost.toFixed(0);
    D.res.offset.textContent = hospSave.toFixed(0);

    // Expanded recommendation
    let rec = '';
    if (uptake < 30) rec =
      `Coverage at ${uptake.toFixed(1)}% is below target. Consider increasing the rebate by 5–10 points or reducing premiums by 5–10% to raise coverage among price-sensitive groups.`;
    else if (uptake < 60) rec =
      `Coverage at ${uptake.toFixed(1)}% is moderate. A small rebate bump (2–3%) or MLS adjustment could move uptake above 60%, optimizing cost vs. benefit.`;
    else rec =
      `Coverage is strong at ${uptake.toFixed(1)}%. To preserve budget, you might reduce rebates by 5% without dropping coverage below 60%.`;
    D.rec.textContent = rec;

    // Update charts
    const label = `${loc}|R${R}|P${P}|M${M}|T${T}`;
    if (chartU.data.labels.length > 20) {
      chartU.data.labels.shift();
      chartU.data.datasets[0].data.shift();
    }
    chartU.data.labels.push(label);
    chartU.data.datasets[0].data.push(uptake.toFixed(1));
    chartU.update();

    chartB.data.datasets[0].data = [rebateCost.toFixed(0), hospSave.toFixed(0)];
    chartB.update();

    chartC.data.datasets[0].data = [βprem, βreb, βmls, βtier];
    chartC.update();
  }

  // Wire events
  D.runBtn.addEventListener('click', simulate);
  [D.state, D.fund, D.rebate, D.mls, D.prem, D.tier, D.col].forEach(el => {
    el.addEventListener('input', () => { D.runBtn.disabled = false; });
  });

  // Scenario Compare
  let idx = 0;
  D.btnAdd.addEventListener('click', () => {
    idx++;
    const tr = D.tbl.insertRow();
    tr.insertCell().textContent = idx;
    tr.insertCell().textContent = `${D.state.value},${D.fund.value},R${D.rebate.value},MLS${D.mls.value},P${D.prem.value},T${D.tier.value}`;
    tr.insertCell().textContent = D.res.uptake.textContent;
    tr.insertCell().textContent = D.res.rebate.textContent;
    tr.insertCell().textContent = D.res.offset.textContent;
  });

  // CSV Export
  D.btnCSV.addEventListener('click', () => {
    const hdr = ['Location','Funding','Rebate','MLS','PremiumΔ','Tier','Uptake%','RebateCost','HospSave'];
    const row = [
      D.state.value, D.fund.value,
      D.rebate.value, D.mls.value,
      D.prem.value, D.tier.value,
      D.res.uptake.textContent.replace(' %',''),
      D.res.rebate.textContent,
      D.res.offset.textContent
    ];
    const csv  = [hdr.join(','), row.join(',')].join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'HIPIS_scenario.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // PDF Export
  D.btnPDF.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('HIPIS Scenario Report',10,10);
    doc.setFontSize(12);
    let y = 20;
    [
      `Location: ${D.state.value}`,
      `Funding: ${D.fund.value}`,
      `Rebate: ${D.rebate.value}%`,
      `MLS: ${D.mls.value}%`,
      `Premium Δ: ${D.prem.value}%`,
      `Tier: ${D.tier.value}`,
      `Uptake: ${D.res.uptake.textContent}`,
      `Rebate Cost: $${D.res.rebate.textContent}`,
      `Hospital Savings: $${D.res.offset.textContent}`
    ].forEach(line => {
      doc.text(line,10,y);
      y += 10;
    });
    doc.save('HIPIS_report.pdf');
  });

  // Initial simulate
  simulate();
});
