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
const searchShortcutHint = document.querySelector('.search-shortcut-hint');
const periodSelect = document.getElementById('period-select');
const facultySelect = document.getElementById('faculty-select');
const gradingSelect = document.getElementById('grading-select');
const semFilterSelect = document.getElementById('sem-filter-select');
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
const modalSemOffered = document.getElementById('modal-sem-offered');
const modalCredits = document.getElementById('modal-credits');
const modalSu = document.getElementById('modal-su');
const modalCscu = document.getElementById('modal-cscu');
const nusmodsLink = document.getElementById('nusmods-link');
const msVacancy = document.getElementById('ms-vacancy');
const msDemand = document.getElementById('ms-demand');
const msRatio = document.getElementById('ms-ratio');
const msQuotaExceeded = document.getElementById('ms-quota-exceeded');
const historyTableBody = document.getElementById('history-table-body');
const classesTableBody = document.getElementById('classes-table-body');
const classBreakdownRoundName = document.getElementById('class-breakdown-round-name');

// Chart Mode Controls
const btnViewS1 = document.getElementById('btn-view-s1');
const btnViewS2 = document.getElementById('btn-view-s2');
const btnViewTimeline = document.getElementById('btn-view-timeline');
const chartSectionSub = document.getElementById('chart-section-sub');
const yoyInsightBox = document.getElementById('yoy-insight-box');
let currentChartMode = 's1';
let currentModalCourse = null;

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
    const hasVal = Boolean(searchInput.value);
    clearSearchBtn.style.display = hasVal ? 'block' : 'none';
    if (searchShortcutHint) {
      searchShortcutHint.style.display = hasVal ? 'none' : 'block';
    }
    currentPage = 1;
    applyFiltersAndRender();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    if (searchShortcutHint) {
      searchShortcutHint.style.display = 'block';
    }
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

  gradingSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  if (semFilterSelect) {
    semFilterSelect.addEventListener('change', () => {
      currentPage = 1;
      applyFiltersAndRender();
    });
  }

  if (btnViewS1) {
    btnViewS1.addEventListener('click', () => {
      currentChartMode = 's1';
      btnViewS1.classList.add('active');
      if (btnViewS2) btnViewS2.classList.remove('active');
      if (btnViewTimeline) btnViewTimeline.classList.remove('active');
      if (currentModalCourse) renderHistoricalChart(currentModalCourse);
    });
  }

  if (btnViewS2) {
    btnViewS2.addEventListener('click', () => {
      currentChartMode = 's2';
      btnViewS2.classList.add('active');
      if (btnViewS1) btnViewS1.classList.remove('active');
      if (btnViewTimeline) btnViewTimeline.classList.remove('active');
      if (currentModalCourse) renderHistoricalChart(currentModalCourse);
    });
  }

  if (btnViewTimeline) {
    btnViewTimeline.addEventListener('click', () => {
      currentChartMode = 'timeline';
      btnViewTimeline.classList.add('active');
      if (btnViewS1) btnViewS1.classList.remove('active');
      if (btnViewS2) btnViewS2.classList.remove('active');
      if (currentModalCourse) renderHistoricalChart(currentModalCourse);
    });
  }

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
  const selectedGrading = gradingSelect ? gradingSelect.value : 'ALL';
  const selectedSem = semFilterSelect ? semFilterSelect.value : 'ALL';
  const oversubscribedOnly = oversubscribedToggle.checked;
  const sortMode = sortSelect.value;

  const currentPeriodMeta = (metadata.periods || []).find(p => p.key === currentPeriodKey);
  const periodLabel = currentPeriodMeta ? currentPeriodMeta.label : currentPeriodKey;

  // Filter courses
  filteredCourses = [];
  let filteredRoundCoursesOffered = 0;
  let filteredTotalVac = 0;
  let filteredTotalDem = 0;
  let filteredOversubscribed = 0;
  let filteredMaxRatioCourse = null;
  let filteredMaxRatio = -1;

  for (const [code, course] of Object.entries(coursesData)) {
    const curRound = course.history[currentPeriodKey];

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

    // Match Grading Basis
    if (selectedGrading === 'SU' && !course.su) continue;
    if (selectedGrading === 'CSCU' && !course.cscu) continue;
    if (selectedGrading === 'GRADED' && course.cscu) continue;

    // Match Semester Offering
    if (selectedSem !== 'ALL') {
      if (course.sem_offered !== selectedSem) continue;
    }

    // Match Oversubscribed Only
    if (oversubscribedOnly) {
      if (!curRound || !curRound.oversubscribed) continue;
    }

    // Accumulate metrics for courses matching this search/filter in the active round
    if (curRound) {
      filteredRoundCoursesOffered++;
      filteredTotalVac += curRound.vacancy;
      filteredTotalDem += curRound.demand;
      if (curRound.oversubscribed) {
        filteredOversubscribed++;
      }
      if (curRound.vacancy > 0 && curRound.demand > 0 && curRound.ratio > filteredMaxRatio) {
        filteredMaxRatio = curRound.ratio;
        filteredMaxRatioCourse = {
          code,
          ratio: curRound.ratio,
          title: course.title,
          demand: curRound.demand,
          vacancy: curRound.vacancy
        };
      }
    }

    filteredCourses.push({
      code,
      course,
      curRound
    });
  }

  // Update Overview Dashboard Stats based on active search & filters
  statTotalCourses.textContent = filteredRoundCoursesOffered.toLocaleString();
  
  // Dynamic subtitle for filter context
  if (query) {
    statPeriodName.textContent = `Matching "${query}" in ${periodLabel}`;
  } else if (selectedFaculty !== 'ALL') {
    statPeriodName.textContent = `${selectedFaculty} in ${periodLabel}`;
  } else {
    statPeriodName.textContent = periodLabel;
  }

  statOversubscribedCount.textContent = filteredOversubscribed.toLocaleString();
  statOversubscribedPct.textContent = filteredRoundCoursesOffered > 0
    ? `${((filteredOversubscribed / filteredRoundCoursesOffered) * 100).toFixed(1)}% of search`
    : '0% of search';
    
  statTotalDemand.textContent = filteredTotalDem.toLocaleString();
  statTotalVacancy.textContent = `vs ${filteredTotalVac.toLocaleString()} Vacancies`;

  if (filteredMaxRatioCourse) {
    statMostPopular.textContent = filteredMaxRatioCourse.code;
    statMostPopularRatio.textContent = `${(filteredMaxRatioCourse.ratio * 100).toFixed(0)}% (${filteredMaxRatioCourse.ratio.toFixed(2)}x) • ${filteredMaxRatioCourse.demand} apps / ${filteredMaxRatioCourse.vacancy} seats`;
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
        // If either has 0 vacancies, sink below genuine ratios
        if (ra.vacancy === 0 && rb.vacancy === 0) return rb.demand - ra.demand;
        if (ra.vacancy === 0) return 1;
        if (rb.vacancy === 0) return -1;
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

    if (curRound.vacancy === 0) {
      if (curRound.demand > 0) {
        badgeHtml = `<span class="badge badge-oversubscribed">0 Seats (+${curRound.demand} Shortfall)</span>`;
        ratioPct = `+${curRound.demand} Shortfall`;
        ratioClass = 'val-danger';
      } else {
        badgeHtml = `<span class="badge badge-outline">0 Vacancy</span>`;
        ratioPct = '-';
      }
    } else {
      const pct = Math.round(curRound.ratio * 100);
      const shortfall = curRound.demand - curRound.vacancy;

      if (curRound.ratio > 1.0) {
        badgeHtml = `<span class="badge badge-oversubscribed">${curRound.ratio.toFixed(2)}x (+${shortfall} Shortfall)</span>`;
        ratioPct = `${curRound.ratio.toFixed(2)}x (+${shortfall})`;
        ratioClass = 'val-danger';
      } else if (curRound.ratio >= 0.8) {
        badgeHtml = `<span class="badge badge-warning">${pct}% Demand</span>`;
        ratioPct = `${pct}%`;
      } else {
        badgeHtml = `<span class="badge badge-available">Seats Available (${pct}%)</span>`;
        ratioPct = `${pct}%`;
      }
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

  let semBadge = '';
  if (course.sem_offered === 'sem1') {
    semBadge = '<span class="badge badge-sem1" title="Offered in Semester 1 Only">Sem 1 Only</span>';
  } else if (course.sem_offered === 'sem2') {
    semBadge = '<span class="badge badge-sem2" title="Offered in Semester 2 Only">Sem 2 Only</span>';
  } else if (course.sem_offered === 'both') {
    semBadge = '<span class="badge badge-both" title="Offered in Both Semesters">Sem 1 & 2</span>';
  }

  card.innerHTML = `
    <div class="course-card-top">
      <div class="course-header-line">
        <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
          <span class="course-code">${code}</span>
          ${semBadge}
          ${course.su ? '<span class="badge badge-su" title="S/U Option Available">S/U</span>' : ''}
          ${course.cscu ? '<span class="badge badge-cscu" title="CS/CU (Completed Satisfactory/Unsatisfactory)">CS/CU</span>' : ''}
        </div>
        ${badgeHtml}
      </div>
      <h3 class="course-title">${course.title || 'Untitled Course'}</h3>
      <div class="course-fac-dept">${course.faculty || 'NUS'}${course.dept ? ' &bull; ' + course.dept : ''}${course.credits ? ' &bull; ' + course.credits + ' Units' : ''}</div>
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
          <span class="cm-label">Competition</span>
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
  currentModalCourse = course;

  modalCode.textContent = code;
  modalTitle.textContent = course.title || 'Course Details';
  modalFaculty.textContent = course.faculty || 'NUS';
  modalDept.textContent = course.dept || 'General';

  if (course.credits) {
    modalCredits.textContent = `${course.credits} Units`;
    modalCredits.style.display = 'inline-flex';
  } else {
    modalCredits.style.display = 'none';
  }
  modalSu.style.display = course.su ? 'inline-flex' : 'none';
  modalCscu.style.display = course.cscu ? 'inline-flex' : 'none';
  nusmodsLink.href = `https://nusmods.com/courses/${encodeURIComponent(code)}`;

  // Semester offering badge in modal
  if (modalSemOffered) {
    if (course.sem_offered === 'sem1') {
      modalSemOffered.className = 'badge badge-sem1';
      modalSemOffered.textContent = 'Offered: Sem 1 Only';
    } else if (course.sem_offered === 'sem2') {
      modalSemOffered.className = 'badge badge-sem2';
      modalSemOffered.textContent = 'Offered: Sem 2 Only';
    } else {
      modalSemOffered.className = 'badge badge-both';
      modalSemOffered.textContent = 'Offered: Sem 1 & Sem 2';
    }
  }

  // Configure chart toggle buttons & active mode based on semester offering
  if (btnViewS1 && btnViewS2 && btnViewTimeline) {
    if (course.sem_offered === 'sem1') {
      btnViewS1.style.display = 'inline-block';
      btnViewS2.style.display = 'none'; // Hide Sem 2 since not offered
      btnViewTimeline.style.display = 'inline-block';
      currentChartMode = 's1';
      btnViewS1.classList.add('active');
      btnViewS2.classList.remove('active');
      btnViewTimeline.classList.remove('active');
    } else if (course.sem_offered === 'sem2') {
      btnViewS1.style.display = 'none'; // Hide Sem 1 since not offered
      btnViewS2.style.display = 'inline-block';
      btnViewTimeline.style.display = 'inline-block';
      currentChartMode = 's2';
      btnViewS2.classList.add('active');
      btnViewS1.classList.remove('active');
      btnViewTimeline.classList.remove('active');
    } else {
      btnViewS1.style.display = 'inline-block';
      btnViewS2.style.display = 'inline-block';
      btnViewTimeline.style.display = 'inline-block';
      // Default to the semester of the current selected round
      currentChartMode = currentPeriodKey.includes('_S2_') ? 's2' : 's1';
      if (currentChartMode === 's1') {
        btnViewS1.classList.add('active');
        btnViewS2.classList.remove('active');
      } else {
        btnViewS2.classList.add('active');
        btnViewS1.classList.remove('active');
      }
      btnViewTimeline.classList.remove('active');
    }
  }

  const curRound = course.history[currentPeriodKey];
  const currentPeriodMeta = (metadata.periods || []).find(p => p.key === currentPeriodKey);
  classBreakdownRoundName.textContent = currentPeriodMeta ? currentPeriodMeta.label : currentPeriodKey;

  if (curRound) {
    msVacancy.textContent = curRound.vacancy.toLocaleString();
    msDemand.textContent = curRound.demand.toLocaleString();
    if (curRound.vacancy === 0) {
      msRatio.textContent = curRound.demand > 0 ? `+${curRound.demand} Shortfall (0 Seats)` : '0 Seats';
    } else {
      const shortfall = curRound.demand - curRound.vacancy;
      if (curRound.ratio > 1.0) {
        msRatio.textContent = `${(curRound.ratio * 100).toFixed(0)}% (${curRound.ratio.toFixed(2)}x • +${shortfall} shortfall)`;
      } else {
        msRatio.textContent = `${(curRound.ratio * 100).toFixed(0)}% (${curRound.ratio.toFixed(2)}x)`;
      }
    }
    msQuotaExceeded.textContent = curRound.unalloc_quota.toLocaleString();
  } else {
    msVacancy.textContent = 'Not Offered';
    msDemand.textContent = '-';
    msRatio.textContent = '-';
    msQuotaExceeded.textContent = '-';
  }

  // Populate History Table (filters out non-offered semesters)
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
    // If course is Sem 1 only, hide Sem 2 rows completely
    if (course.sem_offered === 'sem1' && p.semester === 2) return;
    // If course is Sem 2 only, hide Sem 1 rows completely
    if (course.sem_offered === 'sem2' && p.semester === 1) return;

    const h = course.history[p.key];
    // Skip empty rounds with 0 vacancy and 0 demand
    if (!h || (h.vacancy === 0 && h.demand === 0)) return;

    let ratioDisplay = '-';
    let ratioClass = '';

    if (h.vacancy === 0) {
      if (h.demand > 0) {
        ratioDisplay = `+${h.demand} Shortfall (0 Seats)`;
        ratioClass = 'text-danger font-bold';
      }
    } else {
      const pct = (h.ratio * 100).toFixed(0);
      const shortfall = h.demand - h.vacancy;
      if (h.ratio > 1.0) {
        ratioDisplay = `${pct}% (${h.ratio.toFixed(2)}x • +${shortfall})`;
        ratioClass = 'text-danger font-bold';
      } else {
        ratioDisplay = `${pct}% (${h.ratio.toFixed(2)}x)`;
      }
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${h.ay} Sem ${h.semester}</strong></td>
      <td>Round ${h.round}</td>
      <td>${h.vacancy.toLocaleString()}</td>
      <td><strong>${h.demand.toLocaleString()}</strong></td>
      <td class="${ratioClass}">${ratioDisplay}</td>
      <td>${h.alloc_main.toLocaleString()}</td>
      <td class="${h.unalloc_quota > 0 ? 'text-danger font-bold' : ''}">${h.unalloc_quota.toLocaleString()}</td>
      <td>${(h.unalloc_clash + h.unalloc_others + h.unalloc_workload).toLocaleString()}</td>
    `;
    historyTableBody.appendChild(row);
  });

  if (historyTableBody.children.length === 0) {
    historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8;">No active registration records found for this course.</td></tr>';
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
    let ratio = '-';
    let isOver = false;

    if (c.vac > 0) {
      const shortfall = c.dem - c.vac;
      isOver = c.dem > c.vac;
      ratio = isOver ? `${(c.dem / c.vac).toFixed(2)}x (+${shortfall})` : `${(c.dem / c.vac).toFixed(2)}x`;
    } else if (c.dem > 0) {
      ratio = `+${c.dem} Shortfall`;
      isOver = true;
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${c.class}</strong></td>
      <td>${c.vac.toLocaleString()}</td>
      <td><strong>${c.dem.toLocaleString()}</strong></td>
      <td class="${isOver ? 'text-danger font-bold' : ''}">${ratio}</td>
      <td>${c.main.toLocaleString()}</td>
      <td>${c.res.toLocaleString()}</td>
      <td class="${c.quota > 0 ? 'text-danger font-bold' : ''}">${c.quota.toLocaleString()}</td>
      <td>${c.clash.toLocaleString()}</td>
      <td>${(c.wl + c.oth).toLocaleString()}</td>
    `;
    classesTableBody.appendChild(row);
  });
}

// Generate verbal & numerical YoY Insight
function updateYoYInsight(course, semNum) {
  if (!yoyInsightBox) return;

  const pastKey = `2025/2026_S${semNum}_R1`;
  const currKey = `2026/2027_S${semNum}_R1`;

  const past = course.history[pastKey];
  const curr = course.history[currKey];

  if (!curr && !past) {
    yoyInsightBox.innerHTML = `
      <div class="yoy-insight-title">ℹ️ Round 1 Status (Semester ${semNum})</div>
      <div>No Round 1 registration activity recorded for Semester ${semNum}.</div>
    `;
    return;
  }

  if (curr && !past) {
    const isOver = curr.vacancy === 0 ? curr.demand > 0 : curr.demand > curr.vacancy;
    const shortfall = curr.demand - curr.vacancy;
    const compText = curr.vacancy === 0
      ? `0 Seats (+${curr.demand} Shortfall)`
      : `${(curr.ratio * 100).toFixed(0)}% (${curr.ratio.toFixed(2)}x ${isOver ? '• +' + shortfall + ' Shortfall' : ''})`;

    yoyInsightBox.innerHTML = `
      <div class="yoy-insight-title">💡 Round 1 Status (AY26/27 Sem ${semNum})</div>
      <div class="yoy-insight-metrics">
        <div class="yoy-metric-item">Demand: <strong>${curr.demand} applications</strong></div>
        <div class="yoy-metric-item">Available Seats: <strong>${curr.vacancy}</strong></div>
        <div class="yoy-metric-item">Competition: <strong class="${isOver ? 'text-danger' : ''}">${compText}</strong></div>
      </div>
      <div class="yoy-verdict">ℹ️ <strong>Newly Offered in Round 1:</strong> Not offered in Round 1 during AY25/26. ${isOver ? `<strong>+${shortfall} students</strong> were unallocated due to quota limits.` : 'All applicants secured seats.'}</div>
    `;
    return;
  }

  if (!curr && past) {
    yoyInsightBox.innerHTML = `
      <div class="yoy-insight-title">📌 Past Round 1 Status (AY25/26 Sem ${semNum})</div>
      <div class="yoy-insight-metrics">
        <div class="yoy-metric-item">Past Demand: <strong>${past.demand}</strong></div>
        <div class="yoy-metric-item">Past Seats: <strong>${past.vacancy}</strong></div>
        <div class="yoy-metric-item">Past Competition: <strong>${past.vacancy === 0 ? '0 Seats (+ ' + past.demand + ' Shortfall)' : past.ratio.toFixed(2) + 'x'}</strong></div>
      </div>
      <div class="yoy-verdict"><em>No applications recorded for Round 1 in AY26/27 yet.</em></div>
    `;
    return;
  }

  // Both exist!
  const demDiff = curr.demand - past.demand;
  const demPct = past.demand > 0 ? ((demDiff / past.demand) * 100).toFixed(1) : (curr.demand > 0 ? '+100' : '0');
  const demSign = demDiff > 0 ? `+${demDiff}` : `${demDiff}`;

  const vacDiff = curr.vacancy - past.vacancy;
  const vacPct = past.vacancy > 0 ? ((vacDiff / past.vacancy) * 100).toFixed(1) : (curr.vacancy > 0 ? '+100' : '0');
  const vacSign = vacDiff > 0 ? `+${vacDiff}` : `${vacDiff}`;

  const currShortfall = curr.demand - curr.vacancy;
  const pastShortfall = past.demand - past.vacancy;

  let trendVerdict = '';
  if (curr.vacancy === 0 && past.vacancy === 0) {
    trendVerdict = `⚠️ <strong>0 Seats in both years:</strong> Unmet demand shifted by <strong>${demSign}</strong> (${curr.demand} vs ${past.demand} applicants).`;
  } else if (curr.vacancy === 0) {
    trendVerdict = `⚠️ <strong>Seats Closed (0 Vacancy):</strong> Resulted in <strong>+${curr.demand} unmet shortfall</strong> (100% quota rejection).`;
  } else if (past.vacancy === 0) {
    trendVerdict = `🎉 <strong>Seats Opened:</strong> Capacity expanded from 0 to <strong>${curr.vacancy} seats</strong> with ${curr.demand} applicants!`;
  } else {
    const ratioDiff = curr.ratio - past.ratio;
    if (curr.ratio > past.ratio + 0.1) {
      trendVerdict = `⚠️ <strong>Higher Competition:</strong> Competition rose by <strong>+${ratioDiff.toFixed(2)}x</strong> over last year (+${currShortfall} shortfall vs ${pastShortfall > 0 ? '+' + pastShortfall : '0'}). Demand changed by <strong>${demSign} (${demPct}%)</strong> vs seats <strong>${vacSign} (${vacPct}%)</strong>.`;
    } else if (curr.ratio < past.ratio - 0.1) {
      trendVerdict = `📉 <strong>Easier to Secure:</strong> Competition dropped by <strong>${Math.abs(ratioDiff).toFixed(2)}x</strong> compared to last year. Available seats changed by <strong>${vacSign} (${vacPct}%)</strong> while demand shifted by <strong>${demSign} (${demPct}%)</strong>.`;
    } else {
      trendVerdict = `⚖️ <strong>Stable Competition:</strong> Competition remained very close to last year (${curr.ratio.toFixed(2)}x vs ${past.ratio.toFixed(2)}x).`;
    }
  }

  yoyInsightBox.innerHTML = `
    <div class="yoy-insight-title">
      <span>💡 Round 1 Year-over-Year Insight (Semester ${semNum})</span>
    </div>
    <div class="yoy-insight-metrics">
      <div class="yoy-metric-item">Past Year (AY25/26): <strong>${past.demand} Demand</strong> / ${past.vacancy} Seats (${past.vacancy === 0 ? '0 Seats' : past.ratio.toFixed(2) + 'x'})</div>
      <div class="yoy-metric-item">Current Year (AY26/27): <strong>${curr.demand} Demand</strong> / ${curr.vacancy} Seats (${curr.vacancy === 0 ? '0 Seats' : curr.ratio.toFixed(2) + 'x'})</div>
    </div>
    <div class="yoy-verdict">${trendVerdict}</div>
  `;
}

// Render Comparison Chart with Chart.js
function renderHistoricalChart(course) {
  const ctx = document.getElementById('historicalChart').getContext('2d');
  if (activeChart) {
    activeChart.destroy();
  }

  const chartSectionTitle = document.getElementById('chart-section-title');

  if (currentChartMode === 's1' || currentChartMode === 's2') {
    const semNum = currentChartMode === 's2' ? 2 : 1;

    if (chartSectionTitle) chartSectionTitle.textContent = `Semester ${semNum} Year-over-Year Comparison`;
    if (chartSectionSub) {
      chartSectionSub.textContent = course.sem_offered === 'both'
        ? `Comparing Demand (Applications) vs Vacancy (Seats) between AY25/26 Sem ${semNum} and AY26/27 Sem ${semNum}`
        : `Comparing AY25/26 vs AY26/27 (Sem ${semNum === 1 ? 2 : 1} hidden as module is not offered in that semester)`;
    }

    // Update the insight summary box
    updateYoYInsight(course, semNum);

    const labels = ['Round 1', 'Round 2', 'Round 3'];
    const pastDem = [];
    const pastVac = [];
    const currDem = [];
    const currVac = [];

    [1, 2, 3].forEach(r => {
      const pastH = course.history[`2025/2026_S${semNum}_R${r}`];
      const currH = course.history[`2026/2027_S${semNum}_R${r}`];

      pastDem.push(pastH ? pastH.demand : 0);
      pastVac.push(pastH ? pastH.vacancy : 0);
      currDem.push(currH ? currH.demand : 0);
      currVac.push(currH ? currH.vacancy : 0);
    });

    activeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: `AY25/26 S${semNum} Demand`,
            data: pastDem,
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderColor: '#d97706',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: `AY25/26 S${semNum} Vacancy`,
            data: pastVac,
            backgroundColor: 'rgba(148, 163, 184, 0.75)',
            borderColor: '#64748b',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: `AY26/27 S${semNum} Demand`,
            data: currDem,
            backgroundColor: 'rgba(239, 124, 0, 0.95)',
            borderColor: '#c2410c',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: `AY26/27 S${semNum} Vacancy`,
            data: currVac,
            backgroundColor: 'rgba(0, 61, 124, 0.95)',
            borderColor: '#002752',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
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
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: 13 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 }, precision: 0 }
          }
        }
      }
    });

  } else {
    // Timeline mode: only include active rounds where course actually had demand or vacancy
    if (chartSectionTitle) chartSectionTitle.textContent = 'Active Registration Timeline';
    if (chartSectionSub) chartSectionSub.textContent = 'Demand (Applications) vs Vacancy (Seats) across active rounds';

    if (yoyInsightBox) {
      yoyInsightBox.innerHTML = `
        <div class="yoy-insight-title">ℹ️ Timeline View</div>
        <div>Showing active rounds chronologically. Rounds where the course was not offered are omitted.</div>
      `;
    }

    const activePeriods = (metadata.periods || []).filter(p => {
      // If Sem 1 only, hide Sem 2
      if (course.sem_offered === 'sem1' && p.semester === 2) return false;
      // If Sem 2 only, hide Sem 1
      if (course.sem_offered === 'sem2' && p.semester === 1) return false;

      const h = course.history[p.key];
      return h && (h.vacancy > 0 || h.demand > 0);
    });

    const labels = [];
    const vacancyData = [];
    const demandData = [];

    activePeriods.forEach(p => {
      const h = course.history[p.key];
      const shortAy = p.ay.replace(/AY/g, '').replace(/20(\d\d)/g, '$1');
      labels.push(`${shortAy} S${p.semester} R${p.round}`);
      vacancyData.push(h.vacancy);
      demandData.push(h.demand);
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
            label: 'Available Vacancy (Seats)',
            data: vacancyData,
            backgroundColor: 'rgba(0, 61, 124, 0.85)',
            borderColor: '#003d7c',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 11 },
              usePointStyle: true,
              boxWidth: 8
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 }, precision: 0 }
          }
        }
      }
    });
  }
}

// Start Application on DOM Ready
document.addEventListener('DOMContentLoaded', init);

