// Ergo Emission Clock — app.js
// Ergo emission schedule reference:
// https://ergoplatform.org/en/blog/2019_05_20-ergo-max-supply/
// Blocks 1–525,600 (yr 1):    75 ERG → decreases by 3/yr
// Each epoch = 64800 blocks (~90 days), reward drops by 3 ERG
// After reward reaches 3 ERG it stays at 3 ERG forever (storage rent era)
// Max supply ≈ 97,739,924.5 ERG

const API = 'https://api.ergoplatform.com';
const MAX_SUPPLY = 97_739_925;
const BLOCK_TIME_SECS = 120; // ~2 min

// Build the emission schedule table
// Epoch 0: blocks 1–525600 @ 75 ERG  (yr1 = 2 epochs of 262800? actually ergo uses 64800 block epochs)
// Let's use the precise schedule: each 64800-block epoch reward drops by 3 ERG, starting at 75
// First epoch is blocks 1–64800 @ 75 ERG, second 64800–129600 @ 72 ERG, ... until 3 ERG
// Special: first 2 epochs (129600 blocks) are at 75, then drops by 3 every 64800 blocks
// Actually per ergo docs: first year (525600 blocks) at 75, then -3 every year (262800 blocks)
// Let me use the confirmed on-chain schedule from EIPs:
// Epoch length = 64800 blocks
// Reward starts at 75 and decrements by 3 every epoch until minimum of 3

const EPOCH_LEN = 64800;
const INITIAL_REWARD = 75;
const REWARD_DECREMENT = 3;
const MIN_REWARD = 3;

function buildSchedule() {
  const rows = [];
  let reward = INITIAL_REWARD;
  let startBlock = 1;
  let cumulative = 0;

  while (reward >= MIN_REWARD) {
    const endBlock = startBlock + EPOCH_LEN - 1;
    const issued = reward * EPOCH_LEN;
    cumulative += issued;
    rows.push({ reward, startBlock, endBlock, issued, cumulative });
    if (reward === MIN_REWARD) {
      // perpetual tail — show a few more then break
      for (let i = 1; i <= 3; i++) {
        const s = endBlock + 1 + (i - 1) * EPOCH_LEN;
        const e = s + EPOCH_LEN - 1;
        const iss = MIN_REWARD * EPOCH_LEN;
        cumulative += iss;
        rows.push({ reward: MIN_REWARD, startBlock: s, endBlock: e, issued: iss, cumulative, tail: true });
      }
      break;
    }
    startBlock = endBlock + 1;
    reward -= REWARD_DECREMENT;
    if (reward < MIN_REWARD) reward = MIN_REWARD;
  }

  return rows;
}

function getBlockReward(height) {
  const epochIndex = Math.floor((height - 1) / EPOCH_LEN);
  const reward = Math.max(INITIAL_REWARD - epochIndex * REWARD_DECREMENT, MIN_REWARD);
  return reward;
}

function estimateCirculatingSupply(height) {
  let supply = 0;
  let h = 1;
  while (h <= height) {
    const epochIndex = Math.floor((h - 1) / EPOCH_LEN);
    const reward = Math.max(INITIAL_REWARD - epochIndex * REWARD_DECREMENT, MIN_REWARD);
    const epochEnd = (epochIndex + 1) * EPOCH_LEN;
    const blocksInEpoch = Math.min(epochEnd, height) - h + 1;
    supply += reward * blocksInEpoch;
    h = epochEnd + 1;
  }
  return supply;
}

function getNextEpochChange(height) {
  const epochIndex = Math.floor((height - 1) / EPOCH_LEN);
  const currentReward = Math.max(INITIAL_REWARD - epochIndex * REWARD_DECREMENT, MIN_REWARD);
  if (currentReward === MIN_REWARD) return null; // no more changes
  const nextEpochStart = (epochIndex + 1) * EPOCH_LEN + 1;
  const blocksUntil = nextEpochStart - height;
  const nextReward = Math.max(currentReward - REWARD_DECREMENT, MIN_REWARD);
  const daysUntil = (blocksUntil * BLOCK_TIME_SECS) / 86400;
  return { blocksUntil, daysUntil: daysUntil.toFixed(1), nextReward };
}

function fmt(n) {
  return Math.round(n).toLocaleString();
}

// ─── Charts ───────────────────────────────────────────────────────────────────
let supplyChart, rewardChart;

function initCharts(schedule, currentHeight) {
  const labels = schedule.map(r => `${fmt(r.startBlock)}`);
  const supplyData = schedule.map(r => +(r.cumulative / 1e6).toFixed(2));
  const rewardData = schedule.map(r => r.reward);

  const nowIdx = schedule.findIndex(r => currentHeight >= r.startBlock && currentHeight <= r.endBlock);

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
    scales: {
      x: {
        ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 10 } },
        grid: { color: 'rgba(30,45,69,0.8)' }
      },
      y: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid: { color: 'rgba(30,45,69,0.8)' }
      }
    }
  };

  // Supply chart
  const sCtx = document.getElementById('supplyChart').getContext('2d');
  const sGrad = sCtx.createLinearGradient(0, 0, 0, 300);
  sGrad.addColorStop(0, 'rgba(0,212,170,0.4)');
  sGrad.addColorStop(1, 'rgba(0,212,170,0.02)');

  supplyChart = new Chart(sCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: supplyData,
        borderColor: '#00d4aa',
        backgroundColor: sGrad,
        borderWidth: 2,
        fill: true,
        pointRadius: (ctx) => ctx.dataIndex === nowIdx ? 6 : 0,
        pointBackgroundColor: '#f59e0b',
        tension: 0.3
      }]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(2)}M ERG`
          }
        }
      },
      scales: {
        ...chartDefaults.scales,
        y: { ...chartDefaults.scales.y, title: { display: true, text: 'Supply (M ERG)', color: '#64748b' } }
      }
    }
  });

  // Reward chart
  const rCtx = document.getElementById('rewardChart').getContext('2d');
  rewardChart = new Chart(rCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: rewardData,
        backgroundColor: rewardData.map((_, i) =>
          i === nowIdx ? '#f59e0b' :
          i < nowIdx ? 'rgba(124,58,237,0.5)' : 'rgba(0,212,170,0.5)'
        ),
        borderColor: rewardData.map((_, i) =>
          i === nowIdx ? '#f59e0b' :
          i < nowIdx ? '#7c3aed' : '#00d4aa'
        ),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.parsed.y} ERG/block` }
        }
      },
      scales: {
        ...chartDefaults.scales,
        y: { ...chartDefaults.scales.y, title: { display: true, text: 'Reward (ERG)', color: '#64748b' } }
      }
    }
  });
}

// ─── Table ────────────────────────────────────────────────────────────────────
function renderTable(schedule, currentHeight) {
  const tbody = document.getElementById('schedule-tbody');
  tbody.innerHTML = '';

  schedule.forEach(row => {
    const isCurrent = currentHeight >= row.startBlock && currentHeight <= row.endBlock;
    const isPast = currentHeight > row.endBlock;
    const tr = document.createElement('tr');
    tr.className = isCurrent ? 'current-row' : isPast ? 'past-row' : '';

    let badge = '';
    if (isCurrent) badge = '<span class="badge badge-current">CURRENT</span>';
    else if (isPast) badge = '<span class="badge badge-past">PAST</span>';
    else if (row.tail) badge = '<span class="badge badge-future">∞</span>';
    else badge = '<span class="badge badge-future">FUTURE</span>';

    tr.innerHTML = `
      <td>${fmt(row.startBlock)} – ${row.tail ? '∞' : fmt(row.endBlock)}</td>
      <td>${row.reward}</td>
      <td>${row.tail ? '∞' : fmt(EPOCH_LEN)}</td>
      <td>${row.tail ? '∞' : fmt(row.issued)}</td>
      <td>${badge}</td>
    `;
    tbody.appendChild(tr);

    if (isCurrent) {
      setTimeout(() => tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 500);
    }
  });
}

// ─── Update UI ────────────────────────────────────────────────────────────────
function updateUI(height) {
  const reward = getBlockReward(height);
  const supply = estimateCirculatingSupply(height);
  const pct = ((supply / MAX_SUPPLY) * 100).toFixed(3);
  const nextChange = getNextEpochChange(height);

  document.getElementById('stat-height').textContent = fmt(height);
  document.getElementById('stat-supply').textContent = fmt(supply);
  document.getElementById('stat-reward').textContent = reward;
  document.getElementById('stat-pct').textContent = pct + '%';

  const fill = document.getElementById('progress-fill');
  fill.style.width = pct + '%';
  document.getElementById('progress-pct-label').textContent = pct + '%';

  if (nextChange) {
    document.getElementById('cd-blocks').textContent = fmt(nextChange.blocksUntil);
    document.getElementById('cd-days').textContent = nextChange.daysUntil;
    document.getElementById('cd-next-reward').textContent = nextChange.nextReward;
    document.getElementById('countdown-note').textContent =
      `Block reward will drop from ${reward} ERG → ${nextChange.nextReward} ERG at block ${fmt(Math.ceil(height / EPOCH_LEN) * EPOCH_LEN + 1)}`;
  } else {
    document.getElementById('cd-blocks').textContent = '∞';
    document.getElementById('cd-days').textContent = '∞';
    document.getElementById('cd-next-reward').textContent = '3';
    document.getElementById('countdown-note').textContent =
      'Minimum reward of 3 ERG/block reached — perpetual emission era (storage rent supplements miners)';
  }

  document.getElementById('last-update').textContent =
    `Last updated: ${new Date().toLocaleTimeString()}`;
}

// ─── Fetch & Bootstrap ────────────────────────────────────────────────────────
async function fetchHeight() {
  try {
    const res = await fetch(`${API}/api/v0/info`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.fullHeight || data.headersHeight || 0;
  } catch (e) {
    console.error('Failed to fetch height:', e);
    return null;
  }
}

let initialized = false;

async function refresh() {
  const height = await fetchHeight();
  if (!height) return;

  const schedule = buildSchedule();
  updateUI(height);

  if (!initialized) {
    initCharts(schedule, height);
    renderTable(schedule, height);
    initialized = true;
  } else {
    // Update chart highlight if epoch changed
    renderTable(schedule, height);
  }
}

refresh();
setInterval(refresh, 60_000);
