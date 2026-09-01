// NUS CourseReg Demand & Vacancy Tracker
// Client-side Application Logic

let coursesData = {};
let metadata = {};
let currentPeriodKey = '';
let activeChart = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 24;

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const periodSelect = document.getElementById('period-select');
const facultySelect = document.getElementById('faculty-select');
const sortSelect = document.getElementById('sort-select');
const oversubscribedToggle = document.getElementById('oversubscribed-toggle');
const coursesGrid = document.getElementById('courses-grid');
const resultsCount = document.getElementById('results-count');
const datasetBadge = document.getElementById('dataset-badge');
const paginationBar = document.getElementById('pagination-bar');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');

// Modal Elements
const courseModal = document.getElementById('course-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCode = document.getElementById('modal-code');
const modalTitle = document.getElementById('modal-title');
const modalFaculty = document.getElementById('modal-faculty');
const modalDept = document.getElementById('modal-dept');
const nusmodsLink = document.getElementById('nusmods-link');
const msVacancy = document.getElementById('ms-vacancy');
const msDemand = document.getElementById('ms-demand');
const msRatio = document.getElementById('ms-ratio');
const msQuotaExceeded = document.getElementById('ms-quota-exceeded');
const historyTableBody = document.getElementById('history-table-body');
const classesTableBody = document.getElementById('classes-table-body');
const classBreakdownRoundName = document.getElementById('class-breakdown-round-name');

// Stats Elements
const statTotalCourses = document.getElementById('stat-total-courses');
const statPeriodName = document.getElementById('stat-period-name');
const statOversubscribedCount = document.getElementById('stat-oversubscribed-count');
const statOversubscribedPct = document.getElementById('stat-oversubscribed-pct');
const statTotalDemand = document.getElementById('stat-total-demand');
const statTotalVacancy = document.getElementById('stat-total-vacancy');
const statMostPopular = document.getElementById('stat-most-popular');
const statMostPopularRatio = document.getElementById('stat-most-popular-ratio');

// Initialize Application
async function init() {
  try {
    // Load metadata and course dataset
    const [metaRes, dataRes] = await Promise.all([
      fetch('data/metadata.json'),
      fetch('data/coursereg_data.json')
    ]);

    if (!metaRes.ok || !dataRes.ok) {
      throw new Error(`Failed to load dataset files (${metaRes.status}, ${dataRes.status})`);
    }

    metadata = await metaRes.json();
    coursesData = await dataRes.json();

    setupSelectors();
    setupEventListeners();
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error loading tracker data:', err);
    coursesGrid.innerHTML = `
      <div class="loading-spinner">
        <p style="color: #ef4444; font-weight: 700; margin-bottom: 0.5rem;">Failed to load CourseReg dataset</p>
        <p style="font-size: 0.9rem; color: #64748b;">${err.message}</p>
        <p style="font-size: 0.82rem; color: #94a3b8; margin-top: 1rem;">Please make sure 'parse_reports.py' has completed and generated 'data/coursereg_data.json'.</p>
      </div>
    `;
  }
}

// Setup Dropdowns and Metadata
function setupSelectors() {
  const periods = metadata.periods || [];
  periodSelect.innerHTML = '';

  // Reverse so newest period is first
  [...periods].reverse().forEach((p, idx) => {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    if (idx === 0) {
      opt.selected = true;
      currentPeriodKey = p.key;
    }
    periodSelect.appendChild(opt);
  });

  // Populate faculties
  facultySelect.innerHTML = '<option value="ALL">All Faculties / Schools</option>';
  (metadata.faculties || []).forEach(fac => {
    if (!fac) return;
    const opt = document.createElement('option');
    opt.value = fac;
    opt.textContent = fac;
    facultySelect.appendChild(opt);
  });

  // Header badge
  const numCourses = Object.keys(coursesData).length;
  datasetBadge.textContent = `${numCourses.toLocaleString()} Courses Indexed`;
}

// Setup Event Listeners
function setupEventListeners() {
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    currentPage = 1;
    applyFiltersAndRender();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    currentPage = 1;
    applyFiltersAndRender();
  });

  periodSelect.addEventListener('change', (e) => {
    currentPeriodKey = e.target.value;
    currentPage = 1;
    applyFiltersAndRender();
  });

  facultySelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  sortSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  oversubscribedToggle.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Keyboard shortcut '/'
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape' && courseModal.style.display !== 'none') {
      closeModal();
    }
  });

  // Modal close
  modalCloseBtn.addEventListener('click', closeModal);
  courseModal.addEventListener('click', (e) => {
    if (e.target === courseModal) closeModal();
  });

  // Pagination
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderCurrentPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

// Global state of filtered courses
let filteredCourses = [];

// Filter, Sort, and Calculate Overview
function applyFiltersAndRender() {
  const query = searchInput.value.trim().toUpperCase();
  const selectedFaculty = facultySelect.value;
  const oversubscribedOnly = oversubscribedToggle.checked;
  const sortMode = sortSelect.value;

  const currentPeriodMeta = (metadata.periods || []).find(p => p.key === currentPeriodKey);
  const periodLabel = currentPeriodMeta ? currentPeriodMeta.label : currentPeriodKey;

  // Filter courses
  filteredCourses = [];
  let roundTotalVac = 0;
  let roundTotalDem = 0;
  let roundOversubscribed = 0;
  let roundMaxRatioCourse = null;
  let roundMaxRatio = -1;

  for (const [code, course] of Object.entries(coursesData)) {
    const curRound = course.history[currentPeriodKey];
    
    // Only consider courses active in current round for round overview stats
    if (curRound) {
      roundTotalVac += curRound.vacancy;
      roundTotalDem += curRound.demand;
      if (curRound.oversubscribed) {
        roundOversubscribed++;
      }
      if (curRound.vacancy >= 10 && curRound.ratio > roundMaxRatio) {
        roundMaxRatio = curRound.ratio;
        roundMaxRatioCourse = { code, ratio: curRound.ratio, title: course.title };
      }
    }

    // Match Query
    if (query) {
      const matchCode = code.includes(query);
      const matchTitle = course.title && course.title.toUpperCase().includes(query);
      if (!matchCode && !matchTitle) continue;
    }

    // Match Faculty
    if (selectedFaculty !== 'ALL') {
      if (course.faculty !== selectedFaculty) continue;
    }

    // Match Oversubscribed Only
    if (oversubscribedOnly) {
      if (!curRound || !curRound.oversubscribed) continue;
    }

    filteredCourses.push({
      code,
      course,
      curRound
    });
  }

  // Update Overview Dashboard Stats
  statTotalCourses.textContent = Object.values(coursesData).filter(c => c.history[currentPeriodKey]).length.toLocaleString();
  statPeriodName.textContent = periodLabel;
  statOversubscribedCount.textContent = roundOversubscribed.toLocaleString();
  const totalInRound = Object.values(coursesData).filter(c => c.history[currentPeriodKey]).length;
  statOversubscribedPct.textContent = totalInRound > 0 ? `${((roundOversubscribed / totalInRound) * 100).toFixed(1)}% of courses` : '-';
  statTotalDemand.textContent = roundTotalDem.toLocaleString();
  statTotalVacancy.textContent = `vs ${roundTotalVac.toLocaleString()} Vacancies`;
  
  if (roundMaxRatioCourse) {
    statMostPopular.textContent = roundMaxRatioCourse.code;
    statMostPopularRatio.textContent = `${(roundMaxRatioCourse.ratio * 100).toFixed(0)}% (${roundMaxRatioCourse.ratio.toFixed(2)}x)`;
  } else {
    statMostPopular.textContent = 'None';
    statMostPopularRatio.textContent = '-';
  }

  // Sort filtered courses
  filteredCourses.sort((a, b) => {
    const ra = a.curRound;
    const rb = b.curRound;

    if (sortMode === 'code_asc') {
      return a.code.localeCompare(b.code);
    }

    // If one isn't offered in current round, sink to bottom
    if (!ra && !rb) return a.code.localeCompare(b.code);
    if (!ra) return 1;
    if (!rb) return -1;

    switch (sortMode) {
      case 'ratio_desc':
        return rb.ratio - ra.ratio;
      case 'demand_desc':
        return rb.demand - ra.demand;
      case 'diff_desc':
        return rb.diff - ra.diff;
      case 'vacancy_desc':
        return rb.vacancy - ra.vacancy;
      default:
        return rb.ratio - ra.ratio;
    }
  });

  renderCurrentPage();
}

// Render the Paginated List of Courses
function renderCurrentPage() {
  const total = filteredCourses.length;
  resultsCount.textContent = `Found ${total.toLocaleString()} course${total === 1 ? '' : 's'}`;

  if (total === 0) {
    coursesGrid.innerHTML = `
      <div class="loading-spinner">
        <p style="font-weight: 600; color: #475569; font-size: 1.1rem; margin-bottom: 0.35rem;">No courses found</p>
        <p style="font-size: 0.85rem; color: #94a3b8;">Try adjusting your search term, faculty filter, or round view.</p>
      </div>
    `;
    paginationBar.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
  const pageItems = filteredCourses.slice(startIndex, endIndex);

  coursesGrid.innerHTML = '';
  pageItems.forEach(({ code, course, curRound }) => {
    const card = createCourseCard(code, course, curRound);
    coursesGrid.appendChild(card);
  });

  // Update Pagination Controls
  if (totalPages > 1) {
    paginationBar.style.display = 'flex';
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  } else {
    paginationBar.style.display = 'none';
  }
}

// Create Course Card DOM Element
function createCourseCard(code, course, curRound) {
  const card = document.createElement('div');
  card.className = 'course-card';

  // Calculate Past Year comparison
  const pastYearComparison = getPastYearComparison(course, currentPeriodKey);

  // Badge determination
  let badgeHtml = '';
  let vacancyVal = '-';
  let demandVal = '-';
  let ratioPct = '-';
  let ratioClass = '';

  if (curRound) {
    vacancyVal = curRound.vacancy.toLocaleString();
    demandVal = curRound.demand.toLocaleString();
    const pct = Math.round(curRound.ratio * 100);
    ratioPct = `${pct}%`;

    if (curRound.ratio > 1.0) {
      badgeHtml = `<span class="badge badge-oversubscribed">${curRound.ratio.toFixed(2)}x Oversubscribed</span>`;
      ratioClass = 'val-danger';
    } else if (curRound.ratio >= 0.8) {
      badgeHtml = `<span class="badge badge-warning">${pct}% Demand</span>`;
    } else {
      badgeHtml = `<span class="badge badge-available">Seats Available (${pct}%)</span>`;
    }
  } else {
    badgeHtml = `<span class="badge badge-outline">Not offered this round</span>`;
  }

  // Past year mini comparison text
  let pyHtml = '';
  if (pastYearComparison) {
    const diffDemand = pastYearComparison.demandDiff;
    const diffPctStr = diffDemand > 0 ? `+${diffDemand} (${pastYearComparison.pctChange}%)` : `${diffDemand} (${pastYearComparison.pctChange}%)`;
    const trendClass = diffDemand > 0 ? 'trend-up' : (diffDemand < 0 ? 'trend-down' : '');
    pyHtml = `
      <div class="card-past-year">
        <span class="py-tag">vs Past Year (${pastYearComparison.label}):</span>
        <span class="py-val ${trendClass}">Demand ${diffPctStr}</span>
      </div>
    `;
  } else {
    pyHtml = `
      <div class="card-past-year">
        <span class="py-tag">Historical data:</span>
        <span class="py-val">${Object.keys(course.history).length} round(s) recorded</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="course-card-top">
      <div class="course-header-line">
        <span class="course-code">${code}</span>
        ${badgeHtml}
      </div>
      <h3 class="course-title">${course.title || 'Untitled Course'}</h3>
      <div class="course-fac-dept">${course.faculty || 'NUS'} ${course.dept ? '&bull; ' + course.dept : ''}</div>
    </div>

    <div>
      <div class="card-metrics">
        <div class="card-metric-col">
          <span class="cm-label">Vacancy</span>
          <span class="cm-val">${vacancyVal}</span>
        </div>
        <div class="card-metric-col">
          <span class="cm-label">Demand</span>
          <span class="cm-val ${ratioClass}">${demandVal}</span>
        </div>
        <div class="card-metric-col">
          <span class="cm-label">Ratio</span>
          <span class="cm-val ${ratioClass}">${ratioPct}</span>
        </div>
      </div>
      ${pyHtml}
    </div>
  `;

  card.addEventListener('click', () => openCourseModal(code));
  return card;
}

// Find past year equivalent round (e.g. AY26/27 Sem 1 Round 1 -> AY25/26 Sem 1 Round 1)
function getPastYearComparison(course, currentKey) {
  if (!currentKey) return null;
  const parts = currentKey.split('_'); // [AY2026/2027, S1, R1]
  if (parts.length < 3) return null;

  const currentAy = parts[0]; // AY2026/2027
  const sem = parts[1]; // S1
  const round = parts[2]; // R1

  // Extract years
  const match = currentAy.match(/(\d{4})\/(\d{4})/);
  if (!match) return null;

  const y1 = parseInt(match[1]) - 1;
  const y2 = parseInt(match[2]) - 1;
  const pastAyKey = `${y1}/${y2}_${sem}_${round}`;

  const curData = course.history[currentKey];
  const pastData = course.history[pastAyKey];

  if (!curData || !pastData) return null;

  const demandDiff = curData.demand - pastData.demand;
  const pctChange = pastData.demand > 0 ? Math.round((demandDiff / pastData.demand) * 100) : (curData.demand > 0 ? 100 : 0);

  return {
    pastKey: pastAyKey,
    label: `AY${String(y1).slice(2)}/${String(y2).slice(2)} ${sem} ${round}`,
    pastDemand: pastData.demand,
    pastVacancy: pastData.vacancy,
    pastRatio: pastData.ratio,
    demandDiff,
    pctChange
  };
}

// Open Detailed Course Modal
function openCourseModal(code) {
  const course = coursesData[code];
  if (!course) return;

  modalCode.textContent = code;
  modalTitle.textContent = course.title || 'Course Details';
  modalFaculty.textContent = course.faculty || 'NUS';
  modalDept.textContent = course.dept || 'General';
  nusmodsLink.href = `https://nusmods.com/courses/${encodeURIComponent(code)}`;

  const curRound = course.history[currentPeriodKey];
  const currentPeriodMeta = (metadata.periods || []).find(p => p.key === currentPeriodKey);
  classBreakdownRoundName.textContent = currentPeriodMeta ? currentPeriodMeta.label : currentPeriodKey;

  if (curRound) {
    msVacancy.textContent = curRound.vacancy.toLocaleString();
    msDemand.textContent = curRound.demand.toLocaleString();
    msRatio.textContent = `${(curRound.ratio * 100).toFixed(0)}% (${curRound.ratio.toFixed(2)}x)`;
    msQuotaExceeded.textContent = curRound.unalloc_quota.toLocaleString();
  } else {
    msVacancy.textContent = 'Not Offered';
    msDemand.textContent = '-';
    msRatio.textContent = '-';
    msQuotaExceeded.textContent = '-';
  }

  // Populate History Table
  populateHistoryTable(course);

  // Populate Class Breakdown Table
  populateClassesTable(curRound);

  // Render Historical Chart
  renderHistoricalChart(course);

  courseModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  courseModal.style.display = 'none';
  document.body.style.overflow = '';
}

// Populate History Table
function populateHistoryTable(course) {
  historyTableBody.innerHTML = '';
  const periods = metadata.periods || [];

  periods.forEach(p => {
    const h = course.history[p.key];
    if (!h) return;

    const row = document.createElement('tr');
    const ratioVal = (h.ratio * 100).toFixed(0);
    const ratioClass = h.ratio > 1.0 ? 'text-danger font-bold' : '';

    row.innerHTML = `
      <td><strong>${h.ay} Sem ${h.semester}</strong></td>
      <td>Round ${h.round}</td>
      <td>${h.vacancy.toLocaleString()}</td>
      <td><strong>${h.demand.toLocaleString()}</strong></td>
      <td class="${ratioClass}">${ratioVal}% (${h.ratio.toFixed(2)}x)</td>
      <td>${h.alloc_main.toLocaleString()}</td>
      <td class="${h.unalloc_quota > 0 ? 'text-danger font-bold' : ''}">${h.unalloc_quota.toLocaleString()}</td>
      <td>${(h.unalloc_clash + h.unalloc_others + h.unalloc_workload).toLocaleString()}</td>
    `;
    historyTableBody.appendChild(row);
  });

  if (historyTableBody.children.length === 0) {
    historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8;">No historical records found for this course.</td></tr>';
  }
}

// Populate Classes Breakdown Table
function populateClassesTable(curRound) {
  classesTableBody.innerHTML = '';
  if (!curRound || !curRound.classes || curRound.classes.length === 0) {
    classesTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">No class data available for this round.</td></tr>';
    return;
  }

  curRound.classes.forEach(c => {
    const ratio = c.vac > 0 ? (c.dem / c.vac).toFixed(2) : (c.dem > 0 ? 'Full' : '0.00');
    const isOver = c.dem > c.vac;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${c.class}</strong></td>
      <td>${c.vac.toLocaleString()}</td>
      <td><strong>${c.dem.toLocaleString()}</strong></td>
      <td class="${isOver ? 'text-danger font-bold' : ''}">${ratio}x</td>
      <td>${c.main.toLocaleString()}</td>
      <td>${c.res.toLocaleString()}</td>
      <td class="${c.quota > 0 ? 'text-danger font-bold' : ''}">${c.quota.toLocaleString()}</td>
      <td>${c.clash.toLocaleString()}</td>
      <td>${(c.wl + c.oth).toLocaleString()}</td>
    `;
    classesTableBody.appendChild(row);
  });
}

// Render Comparison Chart with Chart.js
function renderHistoricalChart(course) {
  const ctx = document.getElementById('historicalChart').getContext('2d');
  if (activeChart) {
    activeChart.destroy();
  }

  const periods = metadata.periods || [];
  const labels = [];
  const vacancyData = [];
  const demandData = [];
  const allocatedData = [];
  const quotaExceededData = [];

  periods.forEach(p => {
    const h = course.history[p.key];
    // Short label: e.g. "25/26 S1 R1"
    const shortAy = p.ay.replace(/AY/g, '').replace(/20(\d\d)/g, '$1');
    labels.push(`${shortAy} S${p.semester} R${p.round}`);
    
    if (h) {
      vacancyData.push(h.vacancy);
      demandData.push(h.demand);
      allocatedData.push(h.alloc_main);
      quotaExceededData.push(h.unalloc_quota);
    } else {
      vacancyData.push(0);
      demandData.push(0);
      allocatedData.push(0);
      quotaExceededData.push(0);
    }
  });

  activeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Demand (Applications)',
          data: demandData,
          backgroundColor: 'rgba(239, 124, 0, 0.85)',
          borderColor: '#ef7c00',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Available Vacancy',
          data: vacancyData,
          backgroundColor: 'rgba(0, 61, 124, 0.75)',
          borderColor: '#003d7c',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Allocated (Main)',
          data: allocatedData,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 11 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: 13 },
          bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 },
            precision: 0
          }
        }
      }
    }
  });
}

// Start Application on DOM Ready
document.addEventListener('DOMContentLoaded', init);

