// ==========================================
// AttenTrack Core Application Script
// ==========================================

// Global Application State
let subjects = [];
let timetable = [];
let settings = { targetThreshold: 75, semester: "Semester 1" };
let attendanceLog = {}; // Format: { "slotId_dateString": "present" | "absent" | "cancelled" }
let currentSelectedDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

// Firebase Cloud Sync Configuration & State
let firebaseApp = null;
let db = null;
let auth = null;
let currentUser = null; // Stores currently logged-in user profile (Firebase User or Mock Guest User)
let isRealFirebase = false; // Flag to indicate if real cloud sync is connected


// DOM Elements Cache
const elements = {
  // Navigation & Shell
  tabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  viewport: document.getElementById('app-viewport'),
  currentDateDisplay: document.getElementById('current-date-display'),
  fab: document.getElementById('app-fab'),
  headerAddBtn: document.getElementById('header-add-subject-btn'),
  toastContainer: document.getElementById('toast-container'),

  // Dashboard Tab
  overallPct: document.getElementById('overall-percentage'),
  overallFill: document.getElementById('overall-progress-fill'),
  overallStatusText: document.getElementById('overall-status-text'),
  overallRing: document.getElementById('overall-progress-ring'),
  overallRingLabel: document.getElementById('overall-ring-label'),
  daySelector: document.getElementById('day-selector'),
  timetableClasses: document.getElementById('timetable-classes'),

  // Analytics Tab
  statTotalHeld: document.getElementById('stat-total-held'),
  statTotalAttended: document.getElementById('stat-total-attended'),
  analyticsSubjectsList: document.getElementById('analytics-subjects-list'),

  // Simulator Tab
  simSubjectSelect: document.getElementById('sim-subject-select'),
  simAttendSlider: document.getElementById('sim-attend-slider'),
  simAttendVal: document.getElementById('sim-attend-val'),
  simSkipSlider: document.getElementById('sim-skip-slider'),
  simSkipVal: document.getElementById('sim-skip-val'),
  simProjectedPct: document.getElementById('sim-projected-pct'),
  simVerdictBadge: document.getElementById('sim-verdict-badge'),
  simVerdictText: document.getElementById('sim-verdict-text'),
  simComparisonDetails: document.getElementById('sim-comparison-details'),

  // Settings Tab
  settingsThresholdSlider: document.getElementById('settings-threshold-slider'),
  settingsThresholdLabel: document.getElementById('settings-threshold-label'),
  settingsEditTimetableBtn: document.getElementById('settings-edit-timetable'),
  settingsResetBtn: document.getElementById('settings-reset-data'),
  settingsSemesterSelect: document.getElementById('settings-semester-select'),
  settingsUploadTimetable: document.getElementById('settings-upload-timetable'),

  // Modals - Subject
  modalSubject: document.getElementById('modal-subject'),
  subjectForm: document.getElementById('subject-form'),
  subjectFormId: document.getElementById('subject-form-id'),
  subjectFormName: document.getElementById('subject-form-name'),
  subjectFormRoom: document.getElementById('subject-form-room'),
  subjectFormAttended: document.getElementById('subject-form-attended'),
  subjectFormTotal: document.getElementById('subject-form-total'),
  subjectModalTitle: document.getElementById('subject-modal-title'),
  subjectDeleteBtn: document.getElementById('subject-delete-btn'),

  // Modals - Timetable
  modalTimetable: document.getElementById('modal-timetable'),
  timetableForm: document.getElementById('timetable-form'),
  slotSubjectSelect: document.getElementById('slot-subject-select'),
  slotDaySelect: document.getElementById('slot-day-select'),
  slotTimeInput: document.getElementById('slot-time-input'),
  timetableEditList: document.getElementById('timetable-edit-list'),

  // Modals - Timetable Import Review
  timetableFileInput: document.getElementById('timetable-file-input'),
  modalImportReview: document.getElementById('modal-import-review'),
  importLoadingContainer: document.getElementById('import-loading-container'),
  importLoadingStatus: document.getElementById('import-loading-status'),
  importOcrProgressFill: document.getElementById('import-ocr-progress-fill'),
  importReviewContainer: document.getElementById('import-review-container'),
  importReviewList: document.getElementById('import-review-list'),
  importConfirmBtn: document.getElementById('import-confirm-btn'),

  // Firebase Authentication & Database Configuration
  loginScreen: document.getElementById('login-screen'),
  loginGoogleBtn: document.getElementById('login-google-btn'),
  loginGuestBtn: document.getElementById('login-guest-btn'),
  loginSyncStatus: document.getElementById('login-sync-status'),
  settingsAccountCard: document.getElementById('settings-account-card'),
  accountAvatar: document.getElementById('account-avatar'),
  accountName: document.getElementById('account-name'),
  accountEmail: document.getElementById('account-email'),
  accountActionBtn: document.getElementById('account-action-btn'),
  settingsDbConfigBtn: document.getElementById('settings-db-config-btn'),
  modalFirebaseConfig: document.getElementById('modal-firebase-config'),
  firebaseConfigForm: document.getElementById('firebase-config-form'),
  configJson: document.getElementById('config-json'),
  headerAvatar: document.getElementById('header-avatar'),

  // Onboarding Wizard Widgets
  onboardingWizard: document.getElementById('onboarding-wizard'),
  wizardSemester: document.getElementById('wizard-semester'),
  wizardThreshold: document.getElementById('wizard-threshold'),
  wizardThresholdVal: document.getElementById('wizard-threshold-val'),
  wizardSubjectName: document.getElementById('wizard-subject-name'),
  wizardAddSubjectBtn: document.getElementById('wizard-add-subject-btn'),
  wizardSubjectsList: document.getElementById('wizard-subjects-list'),
  wizardSlotSubject: document.getElementById('wizard-slot-subject'),
  wizardSlotDay: document.getElementById('wizard-slot-day'),
  wizardSlotTime: document.getElementById('wizard-slot-time'),
  wizardSlotRoom: document.getElementById('wizard-slot-room'),
  wizardAddSlotBtn: document.getElementById('wizard-add-slot-btn'),
  wizardSlotsList: document.getElementById('wizard-slots-list')
};

// ==========================================
// 1. Initial Dummy Data Configuration
// ==========================================
const dummySubjects = [];
const dummyTimetable = [];

// ==========================================
// 2. Data Access & LocalStorage Handlers
// ==========================================
function loadAppState() {
  try {
    const storedSubjects = localStorage.getItem('attentrack_subjects');
    const storedTimetable = localStorage.getItem('attentrack_timetable');
    const storedSettings = localStorage.getItem('attentrack_settings');
    const storedLog = localStorage.getItem('attentrack_log');

    if (storedSubjects) {
      subjects = JSON.parse(storedSubjects);
    } else {
      subjects = [...dummySubjects];
      localStorage.setItem('attentrack_subjects', JSON.stringify(subjects));
    }

    if (storedTimetable) {
      timetable = JSON.parse(storedTimetable);
    } else {
      timetable = [...dummyTimetable];
      localStorage.setItem('attentrack_timetable', JSON.stringify(timetable));
    }

    if (storedSettings) {
      settings = JSON.parse(storedSettings);
      if (!settings.semester) {
        settings.semester = "Semester 1";
      }
    } else {
      settings = { targetThreshold: 75, semester: "Semester 1" };
      localStorage.setItem('attentrack_settings', JSON.stringify(settings));
    }

    if (storedLog) {
      attendanceLog = JSON.parse(storedLog);
    } else {
      attendanceLog = {};
      localStorage.setItem('attentrack_log', JSON.stringify(attendanceLog));
    }
  } catch (error) {
    showToast('Failed to load storage. Using dummy data.', 'error');
    subjects = [...dummySubjects];
    timetable = [...dummyTimetable];
    settings = { targetThreshold: 75, semester: "Semester 1" };
    attendanceLog = {};
  }
}

function saveAppState() {
  try {
    localStorage.setItem('attentrack_subjects', JSON.stringify(subjects));
    localStorage.setItem('attentrack_timetable', JSON.stringify(timetable));
    localStorage.setItem('attentrack_settings', JSON.stringify(settings));
    localStorage.setItem('attentrack_log', JSON.stringify(attendanceLog));
  } catch (error) {
    showToast('Failed to write changes to local storage.', 'error');
  }
}

function resetAllData() {
  localStorage.removeItem('attentrack_subjects');
  localStorage.removeItem('attentrack_timetable');
  localStorage.removeItem('attentrack_settings');
  localStorage.removeItem('attentrack_log');
  loadAppState();
  
  // Set default sliders and UI options
  elements.settingsThresholdSlider.value = settings.targetThreshold;
  elements.settingsThresholdLabel.textContent = `${settings.targetThreshold}%`;
  elements.settingsSemesterSelect.value = settings.semester;
  
  // Select today
  currentSelectedDay = new Date().getDay();
  updateDaySelectorUI();

  renderAll();
  showToast('App data has been successfully reset.', 'success');
}

// ==========================================
// 3. Mathematical & Color Helper Utilities
// ==========================================
function getSubjectPercentage(subject) {
  if (subject.total === 0) return 100.0;
  return parseFloat(((subject.attended / subject.total) * 100).toFixed(1));
}

function getOverallStats() {
  let totalAttended = 0;
  let totalHeld = 0;
  
  subjects.forEach(sub => {
    totalAttended += sub.attended;
    totalHeld += sub.total;
  });

  const percentage = totalHeld === 0 ? 100.0 : parseFloat(((totalAttended / totalHeld) * 100).toFixed(1));
  return { percentage, totalAttended, totalHeld };
}

/**
 * Computes safety details: bunks left or classes needed to hit target threshold
 */
function getSafetyMetrics(attended, total, threshold = settings.targetThreshold) {
  const target = threshold / 100;
  const currentPct = total === 0 ? 1.0 : attended / total;

  if (currentPct >= target) {
    // We are at or above target. How many classes can we skip consecutively?
    // Solve: attended / (total + B) >= target
    // B <= (attended - target * total) / target
    // Use floor because we can't skip a fraction of a class
    let bunks = 0;
    if (target > 0) {
      bunks = Math.floor((attended - target * total) / target);
    }
    return {
      status: 'safe',
      value: Math.max(0, bunks),
      message: bunks === 0 ? 'Bunk threshold reached.' : `${bunks} bunks available.`
    };
  } else {
    // We are below target. How many consecutive classes must we attend to recover?
    // Solve: (attended + C) / (total + C) >= target
    // C >= (target * total - attended) / (1 - target)
    // Use ceil because we must attend whole classes
    let classesNeeded = 0;
    if (target < 1) {
      classesNeeded = Math.ceil((target * total - attended) / (1 - target));
    } else {
      // If target is 100% and we missed a class, we can never reach 100% mathematically.
      classesNeeded = Infinity;
    }
    return {
      status: 'critical',
      value: classesNeeded,
      message: classesNeeded === Infinity ? 'Cannot reach 100% target.' : `Must attend next ${classesNeeded} classes.`
    };
  }
}

/**
 * Returns colors and glows for a specific attendance percentage
 */
function getPercentageStyles(percentage, threshold = settings.targetThreshold) {
  if (percentage >= threshold) {
    return {
      color: 'var(--color-safe)',
      glow: 'var(--color-safe-glow)',
      class: 'safe'
    };
  } else if (percentage >= threshold - 5) {
    // Within 5% below target is borderline (e.g. 70-74% if target is 75%)
    return {
      color: 'var(--color-warning)',
      glow: 'var(--color-warning-glow)',
      class: 'warning'
    };
  } else {
    return {
      color: 'var(--color-critical)',
      glow: 'var(--color-critical-glow)',
      class: 'critical'
    };
  }
}

function updateRingProgress(svgCircleElement, percentage, color) {
  if (!svgCircleElement) return;
  
  // Read radius
  const r = parseFloat(svgCircleElement.getAttribute('r'));
  const circumference = 2 * Math.PI * r;
  
  // Set stroke attributes
  svgCircleElement.style.strokeDasharray = `${circumference} ${circumference}`;
  
  // Adjust offset
  const pct = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (pct / 100) * circumference;
  svgCircleElement.style.strokeDashoffset = offset;
  svgCircleElement.style.stroke = color;
}

function getDateString(date) {
  return date.toISOString().split('T')[0];
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  let cleanStr = timeStr.trim().toUpperCase();
  const ampmMatch = cleanStr.match(/(AM|PM)$/);
  let isPM = false;
  let isAM = false;
  if (ampmMatch) {
    const ampm = ampmMatch[1];
    isPM = ampm === 'PM';
    isAM = ampm === 'AM';
    cleanStr = cleanStr.replace(ampm, '').trim();
  }
  
  const parts = cleanStr.split(/[:.]/);
  let hours = parseInt(parts[0], 10) || 0;
  let minutes = parseInt(parts[1], 10) || 0;
  
  if (isPM && hours < 12) {
    hours += 12;
  }
  if (isAM && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

function isSlotTimePassed(slotTimeStr) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = parseTimeToMinutes(slotTimeStr);
  return nowMinutes >= slotMinutes;
}


// ==========================================
// 4. UI Rendering Engines
// ==========================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-triangle';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  lucide.createIcons();
  
  // Toast automatically destroys itself after 3 seconds (sync with CSS animation)
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderAll() {
  renderDashboard();
  renderAnalytics();
  renderSimulator();
  renderSettingsDropdowns();
}

/**
 * Tab 1: Render Timetable Dashboard
 */
function renderDashboard() {
  const overall = getOverallStats();
  elements.overallPct.textContent = `${overall.percentage}%`;
  elements.overallFill.style.width = `${overall.percentage}%`;
  
  const overallStyle = getPercentageStyles(overall.percentage);
  elements.overallPct.style.color = overallStyle.color;
  elements.overallFill.style.background = `linear-gradient(90deg, var(--color-primary), ${overallStyle.color})`;
  
  // Overall progress ring update
  updateRingProgress(elements.overallRing, overall.percentage, overallStyle.color);
  elements.overallRingLabel.textContent = `${Math.round(overall.percentage)}%`;
  elements.overallRingLabel.style.color = overallStyle.color;

  // Status message
  if (overall.percentage >= settings.targetThreshold) {
    elements.overallStatusText.textContent = `Excellent! You are above your ${settings.targetThreshold}% target.`;
    elements.overallStatusText.style.color = 'var(--color-safe)';
  } else {
    const classesNeed = getSafetyMetrics(overall.totalAttended, overall.totalHeld).value;
    elements.overallStatusText.textContent = `Below target. Attend the next ${classesNeed} lectures to recover overall.`;
    elements.overallStatusText.style.color = 'var(--color-critical)';
  }

  // Render Schedule Cards
  elements.timetableClasses.innerHTML = '';
  
  if (subjects.length === 0) {
    elements.timetableClasses.innerHTML = `
      <div class="empty-state glass" style="padding: 30px 20px; gap: 14px;">
        <i data-lucide="graduation-cap" style="width: 48px; height: 48px; color: var(--color-primary);"></i>
        <h3>Welcome to AttenTrack!</h3>
        <p style="font-size:12px; color: var(--text-secondary); line-height: 1.5;">To get started, please add your subjects and timetables manually, or upload a timetable PDF/Image.</p>
        <div style="display:flex; gap: 10px; width:100%; max-width: 280px; margin-top: 6px;">
          <button class="btn btn-primary" onclick="openAddSubjectModal()" style="font-size:11px; padding: 10px; flex: 1;">+ Add Subject</button>
          <button class="btn btn-secondary" onclick="elements.timetableFileInput.click()" style="font-size:11px; padding: 10px; flex: 1;"><i data-lucide="upload-cloud" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px;"></i>Upload File</button>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const daySlots = timetable
    .filter(slot => slot.day === currentSelectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (daySlots.length === 0) {
    elements.timetableClasses.innerHTML = `
      <div class="empty-state glass">
        <i data-lucide="coffee" style="width: 48px; height: 48px;"></i>
        <h3>No classes scheduled today</h3>
        <p style="font-size:12px;">Enjoy your day off or configure slots in Settings.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const todayStr = getDateString(new Date());

  daySlots.forEach(slot => {
    const subject = subjects.find(sub => sub.id === slot.subjectId);
    if (!subject) return;

    const subPct = getSubjectPercentage(subject);
    const subStyle = getPercentageStyles(subPct);
    const safety = getSafetyMetrics(subject.attended, subject.total);

    // Check if logged in attendanceLog
    const logKey = `${slot.id}_${todayStr}`;
    const loggedStatus = attendanceLog[logKey] || null;

    // Check if slot time has already passed today and has not been logged yet
    const isToday = currentSelectedDay === new Date().getDay();
    const isPassed = isSlotTimePassed(slot.time);
    const isPendingPrompt = isToday && isPassed && (loggedStatus === null);

    const card = document.createElement('div');
    card.className = 'class-card glass';

    if (isPendingPrompt) {
      // Pulsing alert styles for prompt
      card.style.setProperty('--card-accent', 'var(--color-warning)');
      card.style.setProperty('--status-color', 'var(--color-warning)');
      card.style.setProperty('--status-glow', 'var(--color-warning-glow)');
      card.style.animation = 'pulseGlow 2.5s infinite alternate ease-in-out';

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap: 6px; font-size:11px; font-weight:700; color: var(--color-warning); margin-bottom: 8px;">
          <i data-lucide="alert-circle" style="width: 14px; height: 14px;"></i> Action Needed: Lecture time passed
        </div>
        <div class="class-meta" style="margin-bottom: 8px;">
          <div class="class-info">
            <h3 style="font-size:15px; font-weight:700;">Did you attend ${subject.name}?</h3>
            <div class="class-details">
              <span><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${slot.time}</span>
              <span><i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${slot.room || subject.room || 'No Room'}</span>
            </div>
          </div>
        </div>
        <div class="class-actions">
          <button class="action-btn present" onclick="toggleAttendance('${slot.id}', 'present')">
            <i data-lucide="user-check"></i> Present
          </button>
          <button class="action-btn absent" onclick="toggleAttendance('${slot.id}', 'absent')">
            <i data-lucide="user-x"></i> Absent
          </button>
          <button class="action-btn cancelled" onclick="toggleAttendance('${slot.id}', 'cancelled')">
            <i data-lucide="slash"></i> Cancelled
          </button>
        </div>
      `;
    } else {
      // Standard Class card layout
      card.style.setProperty('--card-accent', subStyle.color);
      card.style.setProperty('--status-color', subStyle.color);
      card.style.setProperty('--status-glow', subStyle.glow);

      let safetyStr = '';
      if (safety.status === 'safe') {
        safetyStr = `<span style="color: var(--color-safe);"><i data-lucide="shield-check" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${safety.value} bunks left</span>`;
      } else {
        safetyStr = `<span style="color: var(--color-critical);"><i data-lucide="alert-circle" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>Must attend next ${safety.value}</span>`;
      }

      card.innerHTML = `
        <div class="class-meta">
          <div class="class-info">
            <h3>${subject.name}</h3>
            <div class="class-details">
              <span><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${slot.time}</span>
              <span><i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${slot.room || subject.room || 'No Room'}</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap: 4px;">
            <div class="class-attendance-badge">
              ${subPct}%
            </div>
            <div style="font-size: 10px; font-weight: 500;">
              ${safetyStr}
            </div>
          </div>
        </div>
        <div class="class-actions">
          <button class="action-btn present ${loggedStatus === 'present' ? 'active-log-present' : ''}" 
                  onclick="toggleAttendance('${slot.id}', 'present')">
            <i data-lucide="user-check"></i> Present
          </button>
          <button class="action-btn absent ${loggedStatus === 'absent' ? 'active-log-absent' : ''}" 
                  onclick="toggleAttendance('${slot.id}', 'absent')">
            <i data-lucide="user-x"></i> Absent
          </button>
          <button class="action-btn cancelled ${loggedStatus === 'cancelled' ? 'active-log-cancelled' : ''}" 
                  onclick="toggleAttendance('${slot.id}', 'cancelled')">
            <i data-lucide="slash"></i> Cancelled
          </button>
        </div>
      `;
    }

    elements.timetableClasses.appendChild(card);
  });

  lucide.createIcons();
}

/**
 * Tab 2: Render Analytics & Subjects
 */
function renderAnalytics() {
  const overall = getOverallStats();
  elements.statTotalHeld.textContent = overall.totalHeld;
  elements.statTotalAttended.textContent = overall.totalAttended;

  elements.analyticsSubjectsList.innerHTML = '';

  if (subjects.length === 0) {
    elements.analyticsSubjectsList.innerHTML = `
      <div class="empty-state glass" style="padding: 30px 20px; gap: 12px;">
        <i data-lucide="book-open" style="width: 48px; height: 48px; color: var(--color-primary);"></i>
        <h3>No Subjects Registered</h3>
        <p style="font-size:12px; color: var(--text-secondary);">Register your subjects to start tracking attendance averages.</p>
        <button class="btn btn-primary" onclick="openAddSubjectModal()" style="font-size:11px; padding: 10px 18px; margin: 4px auto 0 auto; max-width: 160px;">+ Add Subject</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  subjects.forEach(subject => {
    const subPct = getSubjectPercentage(subject);
    const style = getPercentageStyles(subPct);
    const safety = getSafetyMetrics(subject.attended, subject.total);

    const item = document.createElement('div');
    item.className = 'subject-item glass';
    item.style.cursor = 'pointer';
    item.onclick = () => openEditSubjectModal(subject.id);

    let infoString = '';
    if (safety.status === 'safe') {
      infoString = `${subject.attended}/${subject.total} held • ${safety.value} bunks left`;
    } else {
      infoString = `${subject.attended}/${subject.total} held • Attends needed: ${safety.value}`;
    }

    item.innerHTML = `
      <div class="subject-info">
        <h4>${subject.name}</h4>
        <p>${infoString}</p>
        <p style="font-size: 10px; color: var(--text-muted); display:flex; align-items:center; gap: 4px;">
          <i data-lucide="map-pin" style="width: 10px; height: 10px;"></i> ${subject.room || 'No classroom'}
        </p>
      </div>
      <div class="subject-status-ring-container">
        <svg class="progress-ring" width="56" height="56">
          <circle class="progress-ring-circle-bg" cx="28" cy="28" r="22" />
          <circle class="progress-ring-circle" id="ring-${subject.id}" cx="28" cy="28" r="22" />
        </svg>
        <div class="ring-percentage-label">${subPct}%</div>
      </div>
    `;

    elements.analyticsSubjectsList.appendChild(item);

    // Animate progress circle
    setTimeout(() => {
      const circle = document.getElementById(`ring-${subject.id}`);
      updateRingProgress(circle, subPct, style.color);
    }, 50);
  });

  lucide.createIcons();
}

/**
 * Tab 3: Render What-If Simulator Workspace
 */
function renderSimulator() {
  const select = elements.simSubjectSelect;
  const currentSelection = select.value;

  // Build subject choices
  select.innerHTML = '';
  
  if (subjects.length === 0) {
    select.innerHTML = '<option value="">No subjects available</option>';
    elements.simProjectedPct.textContent = '0.0';
    elements.simVerdictBadge.style.display = 'none';
    elements.simComparisonDetails.textContent = 'Please add subjects in the Analytics tab first.';
    return;
  }

  subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = sub.name;
    if (sub.id === currentSelection) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  // Calculate results based on sliders
  const activeSubjectId = select.value || subjects[0].id;
  const subject = subjects.find(sub => sub.id === activeSubjectId);
  
  if (!subject) return;

  const simulatedPresents = parseInt(elements.simAttendSlider.value);
  const simulatedAbsents = parseInt(elements.simSkipSlider.value);

  // Update slider numerical labels
  elements.simAttendVal.textContent = simulatedPresents;
  elements.simSkipVal.textContent = simulatedAbsents;

  const currentPct = getSubjectPercentage(subject);

  // Calculator Equation:
  // newAttended = currentAttended + simulatedPresents
  // newTotal = currentTotal + simulatedPresents + simulatedAbsents
  const newAttended = subject.attended + simulatedPresents;
  const newTotal = subject.total + simulatedPresents + simulatedAbsents;
  
  const projectedPct = newTotal === 0 ? 100.0 : parseFloat(((newAttended / newTotal) * 100).toFixed(1));
  elements.simProjectedPct.textContent = projectedPct.toFixed(1);

  // Styling of Projected percent
  const projectedStyle = getPercentageStyles(projectedPct);
  elements.simProjectedPct.style.color = projectedStyle.color;

  // Set up Verdict badge
  elements.simVerdictBadge.style.display = 'flex';
  elements.simVerdictBadge.style.background = projectedStyle.glow;
  elements.simVerdictBadge.style.borderColor = projectedStyle.color;
  elements.simVerdictBadge.style.color = projectedStyle.color;
  
  const icon = elements.simVerdictBadge.querySelector('i');
  
  if (projectedPct >= settings.targetThreshold) {
    elements.simVerdictText.textContent = 'Safe';
    if (icon) icon.setAttribute('data-lucide', 'check-circle-2');
  } else if (projectedPct >= settings.targetThreshold - 5) {
    elements.simVerdictText.textContent = 'Borderline';
    if (icon) icon.setAttribute('data-lucide', 'info');
  } else {
    elements.simVerdictText.textContent = 'Critical';
    if (icon) icon.setAttribute('data-lucide', 'alert-triangle');
  }

  // Safety explanation wording
  const diff = projectedPct - currentPct;
  const diffSign = diff >= 0 ? '+' : '';
  const diffStr = `${diffSign}${diff.toFixed(1)}%`;
  
  // Calculate new bunks status
  const simulatedSafety = getSafetyMetrics(newAttended, newTotal);
  
  let explanation = `Currently: ${currentPct}%. Simulated change: <strong>${diffStr}</strong>.<br>`;
  if (simulatedSafety.status === 'safe') {
    explanation += `Under this scenario, you will have <strong>${simulatedSafety.value} bunks</strong> left.`;
  } else {
    explanation += `Under this scenario, you will fall below threshold. You would need to attend <strong>${simulatedSafety.value} consecutive lectures</strong> to recover.`;
  }

  elements.simComparisonDetails.innerHTML = explanation;
  lucide.createIcons();
}

/**
 * Dropdowns populator for settings forms
 */
function renderSettingsDropdowns() {
  const select = elements.slotSubjectSelect;
  select.innerHTML = '';
  
  if (subjects.length === 0) {
    select.innerHTML = '<option value="">No subjects added</option>';
    return;
  }

  subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = sub.name;
    select.appendChild(opt);
  });
}

// ==========================================
// 5. App Interactions & Logic Handlers
// ==========================================

/**
 * Toggle attendance logger from timetable class card
 */
function toggleAttendance(slotId, status) {
  const slot = timetable.find(s => s.id === slotId);
  if (!slot) return;

  const subject = subjects.find(sub => sub.id === slot.subjectId);
  if (!subject) return;

  const todayStr = getDateString(new Date());
  const logKey = `${slotId}_${todayStr}`;
  const prevStatus = attendanceLog[logKey] || null;

  // 1. Undo the previous registered action on the subject
  if (prevStatus === 'present') {
    subject.attended = Math.max(0, subject.attended - 1);
    subject.total = Math.max(0, subject.total - 1);
  } else if (prevStatus === 'absent') {
    subject.total = Math.max(0, subject.total - 1);
  }
  // Cancelled status had no effect on counters, so no undo action required.

  // 2. Register the new status
  if (prevStatus === status) {
    // If double tapping the active button, toggle it off to None (null)
    delete attendanceLog[logKey];
    showToast(`Cleared logging for ${subject.name}.`, 'info');
  } else {
    // Apply new status
    attendanceLog[logKey] = status;
    if (status === 'present') {
      subject.attended += 1;
      subject.total += 1;
      showToast(`Logged PRESENT for ${subject.name}!`, 'success');
    } else if (status === 'absent') {
      subject.total += 1;
      showToast(`Logged ABSENT for ${subject.name}.`, 'error');
    } else if (status === 'cancelled') {
      showToast(`${subject.name} lecture marked as cancelled.`, 'info');
    }
  }

  // 3. Save state & refresh viewport
  saveAppState();
  renderAll();
}

// Modal Toggle Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('active');
}

// Add New Subject Modal opener
function openAddSubjectModal() {
  elements.subjectFormId.value = '';
  elements.subjectFormName.value = '';
  elements.subjectFormRoom.value = '';
  elements.subjectFormAttended.value = '0';
  elements.subjectFormTotal.value = '0';
  elements.subjectModalTitle.textContent = 'Add New Subject';
  elements.subjectDeleteBtn.style.display = 'none';
  
  openModal('modal-subject');
}

// Edit Existing Subject Modal Opener
function openEditSubjectModal(subjectId) {
  const subject = subjects.find(sub => sub.id === subjectId);
  if (!subject) return;

  elements.subjectFormId.value = subject.id;
  elements.subjectFormName.value = subject.name;
  elements.subjectFormRoom.value = subject.room || '';
  elements.subjectFormAttended.value = subject.attended;
  elements.subjectFormTotal.value = subject.total;
  elements.subjectModalTitle.textContent = 'Edit Subject Details';
  elements.subjectDeleteBtn.style.display = 'block';

  openModal('modal-subject');
}

// Render Manage Timetable slots list inside the slot manager modal
function renderTimetableEditList() {
  const list = elements.timetableEditList;
  list.innerHTML = '';

  if (timetable.length === 0) {
    list.innerHTML = '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding: 12px 0;">No class slots. Add below.</div>';
    return;
  }

  // Sort by day, then by time
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sortedTimetable = [...timetable].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.time.localeCompare(b.time);
  });

  sortedTimetable.forEach(slot => {
    const subject = subjects.find(sub => sub.id === slot.subjectId);
    if (!subject) return;

    const item = document.createElement('div');
    item.className = 'timetable-edit-item';
    item.innerHTML = `
      <div>
        <strong style="font-size:12px;">${subject.name}</strong>
        <p style="font-size:10px; color:var(--text-secondary);">${dayNames[slot.day]} • ${slot.time} • ${slot.room || 'No Room'}</p>
      </div>
      <button class="delete-mini-btn" onclick="deleteTimetableSlot('${slot.id}')" title="Delete slot">
        <i data-lucide="trash" style="width:14px; height:14px;"></i>
      </button>
    `;
    list.appendChild(item);
  });

  lucide.createIcons();
}

function deleteTimetableSlot(slotId) {
  timetable = timetable.filter(s => s.id !== slotId);
  
  // Clean up logged attendance statuses related to this slot ID
  Object.keys(attendanceLog).forEach(key => {
    if (key.startsWith(`${slotId}_`)) {
      delete attendanceLog[key];
    }
  });

  saveAppState();
  renderTimetableEditList();
  renderDashboard();
  showToast('Class slot removed from schedule.', 'info');
}

// Day Selector Pill Updates
function updateDaySelectorUI() {
  const pills = elements.daySelector.querySelectorAll('.day-pill');
  pills.forEach(pill => {
    if (parseInt(pill.getAttribute('data-target') || pill.getAttribute('data-day')) === currentSelectedDay) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

// ==========================================
// 6. Form Submissions & Click Event Handlers
// ==========================================

// Subject Form (Add or Edit)
elements.subjectForm.onsubmit = function(e) {
  e.preventDefault();
  
  const id = elements.subjectFormId.value;
  const name = elements.subjectFormName.value.trim();
  const room = elements.subjectFormRoom.value.trim();
  const attended = parseInt(elements.subjectFormAttended.value);
  const total = parseInt(elements.subjectFormTotal.value);

  if (attended > total) {
    showToast('Attended classes cannot exceed total classes.', 'error');
    return;
  }

  if (id) {
    // Modify existing subject
    const index = subjects.findIndex(sub => sub.id === id);
    if (index !== -1) {
      subjects[index] = { ...subjects[index], name, room, attended, total };
      showToast(`Subject "${name}" updated successfully.`, 'success');
    }
  } else {
    // Add new subject
    const newId = `sub-${Date.now()}`;
    subjects.push({ id: newId, name, room, attended, total });
    showToast(`Subject "${name}" added to list.`, 'success');
  }

  saveAppState();
  closeModal('modal-subject');
  renderAll();
};

// Delete Subject button inside modal
elements.subjectDeleteBtn.onclick = function() {
  const id = elements.subjectFormId.value;
  if (!id) return;

  const subject = subjects.find(sub => sub.id === id);
  if (!subject) return;

  if (confirm(`Are you sure you want to delete ${subject.name}? This will also remove all its timetable entries.`)) {
    // Remove subject
    subjects = subjects.filter(sub => sub.id !== id);
    // Remove slots associated with this subject
    timetable = timetable.filter(slot => slot.subjectId !== id);
    
    saveAppState();
    closeModal('modal-subject');
    renderAll();
    showToast(`Deleted "${subject.name}" and associated schedule.`, 'info');
  }
};

// Timetable Add Slot Form
elements.timetableForm.onsubmit = function(e) {
  e.preventDefault();

  const subjectId = elements.slotSubjectSelect.value;
  const day = parseInt(elements.slotDaySelect.value);
  const time = elements.slotTimeInput.value.trim();
  
  if (!subjectId) {
    showToast('Please create a subject first before scheduling.', 'error');
    return;
  }

  const subject = subjects.find(s => s.id === subjectId);
  const newSlot = {
    id: `slot-${Date.now()}`,
    subjectId,
    day,
    time,
    room: subject ? subject.room : ''
  };

  timetable.push(newSlot);
  saveAppState();
  
  // Clean Form input
  elements.slotTimeInput.value = '';
  
  renderTimetableEditList();
  renderDashboard();
  showToast('New class scheduled successfully.', 'success');
};

// ==========================================
// 7. Navigation & Core Events Wiring
// ==========================================

// Tab Switching Mechanics
elements.tabs.forEach(tab => {
  tab.onclick = function() {
    const targetTab = this.getAttribute('data-target');
    
    // Set tabs visually active
    elements.tabs.forEach(t => t.classList.remove('active'));
    this.classList.add('active');

    // Switch visible tab panel
    elements.tabContents.forEach(content => {
      if (content.id === `tab-${targetTab}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Reset viewport scroll position
    elements.viewport.scrollTop = 0;

    // Repopulate dynamic views if required
    if (targetTab === 'analytics') {
      renderAnalytics();
    } else if (targetTab === 'simulator') {
      renderSimulator();
    }
  };
});

// Day Selector clicks
elements.daySelector.addEventListener('click', (e) => {
  const pill = e.target.closest('.day-pill');
  if (!pill) return;

  currentSelectedDay = parseInt(pill.getAttribute('data-day'));
  updateDaySelectorUI();
  renderDashboard();
});

// What-If Simulator Inputs
elements.simSubjectSelect.onchange = renderSimulator;
elements.simAttendSlider.oninput = renderSimulator;
elements.simSkipSlider.oninput = renderSimulator;

// Settings Threshold Slider
elements.settingsThresholdSlider.oninput = function() {
  const val = this.value;
  settings.targetThreshold = parseInt(val);
  elements.settingsThresholdLabel.textContent = `${val}%`;
  saveAppState();
  renderAll();
};

// Manage Timetable trigger inside settings
elements.settingsEditTimetableBtn.onclick = function() {
  renderSettingsDropdowns();
  renderTimetableEditList();
  openModal('modal-timetable');
};

// Reset Application trigger
elements.settingsResetBtn.onclick = function() {
  if (confirm('Are you sure you want to reset all data to default values? This action is irreversible.')) {
    resetAllData();
  }
};

// Semester Configurator Trigger
elements.settingsSemesterSelect.onchange = function() {
  settings.semester = this.value;
  saveAppState();
  updateHeaderDateDisplay();
  showToast(`Active term changed to ${settings.semester}.`, 'success');
};

// FAB & Header Button Routing
elements.fab.onclick = function() {
  const activeTab = document.querySelector('.nav-tab.active').getAttribute('data-target');
  if (activeTab === 'dashboard') {
    renderSettingsDropdowns();
    renderTimetableEditList();
    openModal('modal-timetable');
  } else {
    openAddSubjectModal();
  }
};

elements.headerAddBtn.onclick = openAddSubjectModal;

// ==========================================
// 8. OCR & Timetable Parsing Methods
// ==========================================

// Trigger file uploader from Settings list
elements.settingsUploadTimetable.onclick = function() {
  elements.timetableFileInput.click();
};

// Handle chosen file (PDF or Image)
elements.timetableFileInput.onchange = async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Reset file input value so same file can be uploaded again
  elements.timetableFileInput.value = '';

  openModal('modal-import-review');
  
  // Initialize loading layout
  elements.importLoadingContainer.style.display = 'flex';
  elements.importReviewContainer.style.display = 'none';
  elements.importOcrProgressFill.style.width = '0%';
  elements.importLoadingStatus.textContent = 'Initializing parser...';

  try {
    let extractedText = '';
    if (file.type === 'application/pdf') {
      extractedText = await extractTextFromPDF(file);
    } else if (file.type.startsWith('image/')) {
      extractedText = await extractTextFromImage(file);
    } else {
      throw new Error('Unsupported file type. Please upload a PDF or an Image.');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text content could be extracted from this file.');
    }

    elements.importLoadingStatus.textContent = 'Analyzing timetable structure...';
    const parsedSlots = parseTimetableText(extractedText);

    if (parsedSlots.length === 0) {
      throw new Error('Could not identify any class schedules. Please verify timetable format.');
    }

    // Render review items
    renderImportReviewList(parsedSlots);

    // Swap loader with editor view
    elements.importLoadingContainer.style.display = 'none';
    elements.importReviewContainer.style.display = 'flex';
    showToast(`Detected ${parsedSlots.length} class slots!`, 'success');
  } catch (err) {
    closeModal('modal-import-review');
    showToast(err.message || 'Failed to parse timetable.', 'error');
  }
};

// Text extraction for digital PDFs
async function extractTextFromPDF(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  
  const numPages = pdf.numPages;
  for (let i = 1; i <= numPages; i++) {
    elements.importLoadingStatus.textContent = `Extracting PDF text (page ${i}/${numPages})...`;
    elements.importOcrProgressFill.style.width = `${(i / numPages) * 100}%`;
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    text += pageText + '\n';
  }
  return text;
}

// Text extraction for images (OCR via Tesseract.js)
async function extractTextFromImage(file) {
  return new Promise((resolve, reject) => {
    Tesseract.recognize(
      file,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            elements.importLoadingStatus.textContent = `OCR Scanning: ${pct}%...`;
            elements.importOcrProgressFill.style.width = `${pct}%`;
          }
        }
      }
    ).then(({ data: { text } }) => {
      resolve(text);
    }).catch(err => {
      reject(err);
    });
  });
}

// Heuristic algorithm to parse timetable fields
function parseTimetableText(rawText) {
  const lines = rawText.split(/[\r\n]+/);
  const detectedSlots = [];
  
  const dayMap = {
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0,
    'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0
  };

  let activeDay = 1; // Default to Monday

  const subjectKeywords = [
    'math', 'mathematics', 'algebra', 'calculus', 'physics', 'chemistry', 'biology',
    'computer', 'programming', 'coding', 'database', 'networks', 'software', 'english',
    'literature', 'history', 'civics', 'geography', 'economics', 'accounting', 'science',
    'engineering', 'graphics', 'design', 'lab', 'mechanics', 'electronics', 'circuits',
    'ai', 'artificial', 'data', 'structures', 'algorithms'
  ];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length < 5) return;

    // Check if line sets a new activeDay
    const words = trimmed.toLowerCase().split(/[^a-z]+/);
    for (const word of words) {
      if (dayMap[word] !== undefined) {
        activeDay = dayMap[word];
        break;
      }
    }

    // Scan for time slots (e.g. 09:00 AM, 12:30 PM, or 24h format like 14:00)
    const timeRegex12 = /\b([0]?[1-9]|1[0-2])[:.]([0-5]\d)\s*(AM|PM)\b/gi;
    const timeRegex24 = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g;

    let times = [];
    let match;

    while ((match = timeRegex12.exec(trimmed)) !== null) {
      times.push({ text: match[0], index: match.index });
    }

    if (times.length === 0) {
      while ((match = timeRegex24.exec(trimmed)) !== null) {
        // Exclude numerical rooms/halls (e.g., "LH-201" shouldn't match "2:01")
        const preceding = trimmed.substring(Math.max(0, match.index - 4), match.index);
        if (/room|hall|lh|lab/i.test(preceding)) continue;

        times.push({ text: match[0], index: match.index });
      }
    }

    if (times.length === 0) return;

    // Build slot card estimates
    times.forEach(tInfo => {
      const timeStr = tInfo.text;
      
      const roomRegex = /\b(room\s*\d+|lab\s*[a-z0-9]+|lh\s*[-]?\s*\d+|hall\s*[a-z0-9]+)\b/i;
      const roomMatch = trimmed.match(roomRegex);
      const roomStr = roomMatch ? roomMatch[0] : '';

      // Extract subject name
      let cleanLine = trimmed
        .replace(timeStr, '')
        .replace(roomStr, '')
        .replace(/[^a-zA-Z\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const lineWords = cleanLine.split(' ');
      let guessedSubject = '';
      
      const academicWords = lineWords.filter(w => {
        const lw = w.toLowerCase();
        return lw.length > 2 && (subjectKeywords.includes(lw) || subjects.some(s => s.name.toLowerCase().includes(lw)));
      });

      if (academicWords.length > 0) {
        guessedSubject = academicWords.join(' ');
      } else {
        const capWords = lineWords.filter(w => w.length > 2 && w[0] === w[0].toUpperCase());
        if (capWords.length > 0) {
          guessedSubject = capWords.slice(0, 3).join(' ');
        } else {
          guessedSubject = lineWords.slice(0, 2).join(' ') || 'Lecture';
        }
      }

      // Filter out days
      const daysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      guessedSubject = guessedSubject.split(' ')
        .filter(w => !daysList.includes(w.toLowerCase()))
        .join(' ')
        .trim();

      if (guessedSubject.length === 0) guessedSubject = 'Lecture';

      detectedSlots.push({
        subjectName: guessedSubject,
        day: activeDay,
        time: timeStr.toUpperCase(),
        room: roomStr || 'Room TBD'
      });
    });
  });

  return detectedSlots;
}

// Global buffer for review items
let tempParsedSlots = [];

// Render parsed items in review modal
function renderImportReviewList(slots) {
  tempParsedSlots = slots;
  const list = elements.importReviewList;
  list.innerHTML = '';

  slots.forEach((slot, index) => {
    const item = document.createElement('div');
    item.className = 'review-item';
    item.id = `review-item-${index}`;

    item.innerHTML = `
      <div class="review-item-header">
        <input type="checkbox" checked id="checkbox-${index}" onchange="toggleReviewItem(${index})">
        <input type="text" class="glass-input review-name-input" id="subject-name-${index}" value="${slot.subjectName}" placeholder="Subject Name" style="padding: 8px; font-size: 13px;">
      </div>
      <div class="review-item-fields">
        <select id="day-${index}">
          <option value="1" ${slot.day === 1 ? 'selected' : ''}>Mon</option>
          <option value="2" ${slot.day === 2 ? 'selected' : ''}>Tue</option>
          <option value="3" ${slot.day === 3 ? 'selected' : ''}>Wed</option>
          <option value="4" ${slot.day === 4 ? 'selected' : ''}>Thu</option>
          <option value="5" ${slot.day === 5 ? 'selected' : ''}>Fri</option>
          <option value="6" ${slot.day === 6 ? 'selected' : ''}>Sat</option>
          <option value="0" ${slot.day === 0 ? 'selected' : ''}>Sun</option>
        </select>
        <input type="text" id="time-${index}" value="${slot.time}" placeholder="Time slot">
        <input type="text" id="room-${index}" value="${slot.room}" placeholder="Room/Hall">
      </div>
    `;
    list.appendChild(item);
  });
}

// Toggle enabled status of review card
function toggleReviewItem(index) {
  const item = document.getElementById(`review-item-${index}`);
  const checkbox = document.getElementById(`checkbox-${index}`);
  if (checkbox.checked) {
    item.classList.remove('disabled');
  } else {
    item.classList.add('disabled');
  }
}
window.toggleReviewItem = toggleReviewItem;

// Confirm import click
elements.importConfirmBtn.onclick = function() {
  const isWizardOpen = elements.onboardingWizard.style.display === 'flex';
  let importCount = 0;
  
  tempParsedSlots.forEach((slot, index) => {
    const isChecked = document.getElementById(`checkbox-${index}`).checked;
    if (!isChecked) return;

    const subjectName = document.getElementById(`subject-name-${index}`).value.trim();
    const day = parseInt(document.getElementById(`day-${index}`).value);
    const time = document.getElementById(`time-${index}`).value.trim();
    const room = document.getElementById(`room-${index}`).value.trim();

    if (!subjectName || !time) return;

    if (isWizardOpen) {
      // Add to wizardSubjects if not exists
      let subject = wizardSubjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
      if (!subject) {
        const newSubId = `sub-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        subject = {
          id: newSubId,
          name: subjectName,
          room: room || 'Room TBD',
          attended: 0,
          total: 0
        };
        wizardSubjects.push(subject);
      }
      
      // Add to wizardTimetable
      wizardTimetable.push({
        id: `slot-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        subjectId: subject.id,
        day: day,
        time: time,
        room: room || subject.room
      });
    } else {
      // Add to subjects if not exists
      let subject = subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
      if (!subject) {
        const newSubId = `sub-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        subject = {
          id: newSubId,
          name: subjectName,
          room: room || 'Room TBD',
          attended: 0,
          total: 0
        };
        subjects.push(subject);
      }
      
      // Add to timetable
      timetable.push({
        id: `slot-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        subjectId: subject.id,
        day: day,
        time: time,
        room: room || subject.room
      });
    }

    importCount++;
  });

  if (importCount > 0) {
    closeModal('modal-import-review');
    if (isWizardOpen) {
      goToWizardStep(3);
      showToast(`Successfully imported ${importCount} classes into Setup Wizard!`, 'success');
    } else {
      saveAppState();
      renderAll();
      showToast(`Successfully imported ${importCount} classes!`, 'success');
    }
  } else {
    showToast('No class slots were checked for import.', 'error');
  }
};

// ==========================================
// 9. Firebase Authentication & Cloud Sync
// ==========================================

function setupFirebase() {
  const storedConfig = localStorage.getItem('attentrack_firebase_config');
  let config = null;

  if (storedConfig) {
    try {
      config = JSON.parse(storedConfig);
    } catch (e) {
      console.warn("Stored Firebase credentials contain invalid JSON.");
    }
  }

  // Active Firebase Mode if keys are present
  if (config && config.apiKey && config.projectId) {
    try {
      if (firebase.apps.length === 0) {
        firebaseApp = firebase.initializeApp(config);
      } else {
        firebaseApp = firebase.app();
      }
      db = firebaseApp.firestore();
      auth = firebaseApp.auth();
      isRealFirebase = true;
      
      elements.loginSyncStatus.textContent = "Cloud synchronization: Active (Real Firebase Mode)";
      elements.loginSyncStatus.style.color = "var(--color-safe)";

      // Attach auth listener
      auth.onAuthStateChanged(user => {
        if (user) {
          handleUserLogin(user);
        } else {
          handleUserLogout();
        }
      });
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      showToast("Firebase connection error. Reverting to local Guest mode.", "error");
      isRealFirebase = false;
      fallbackToLocalAuth();
    }
  } else {
    // Revert to Guest Mode (Offline localStorage)
    isRealFirebase = false;
    elements.loginSyncStatus.textContent = "Cloud synchronization: Offline (Local storage active)";
    elements.loginSyncStatus.style.color = "var(--text-muted)";
    fallbackToLocalAuth();
  }
}

function fallbackToLocalAuth() {
  const localSession = localStorage.getItem('attentrack_local_session');
  if (localSession) {
    try {
      const user = JSON.parse(localSession);
      handleUserLogin(user);
    } catch (e) {
      handleUserLogout();
    }
  } else {
    handleUserLogout();
  }
}

async function handleUserLogin(user) {
  currentUser = user;

  // Slide out login screen overlay
  elements.loginScreen.style.opacity = '0';
  setTimeout(() => {
    elements.loginScreen.style.display = 'none';
  }, 400);

  // Update Settings Profile Card
  elements.accountName.textContent = user.displayName || 'Google Student';
  elements.accountEmail.textContent = user.email || 'Cloud Sync Active';
  elements.accountActionBtn.innerHTML = '<i data-lucide="log-out" style="width:12px;height:12px;"></i> Sign Out';
  elements.accountActionBtn.onclick = handleSignOutBtnClick;

  // Render User Avatars
  const avatarUrl = user.photoURL;
  if (avatarUrl) {
    elements.accountAvatar.innerHTML = `<img src="${avatarUrl}" alt="User Avatar">`;
    elements.headerAvatar.innerHTML = `<img src="${avatarUrl}" alt="User Avatar">`;
  } else {
    const initial = (user.displayName || 'G')[0].toUpperCase();
    elements.accountAvatar.innerHTML = `<div style="font-weight:700; color:white;">${initial}</div>`;
    elements.headerAvatar.innerHTML = `<div style="font-weight:700; color:white; font-size:12px;">${initial}</div>`;
  }

  showToast(`Welcome back, ${user.displayName || 'Student'}!`, 'success');

  // Trigger data load & synchronization
  if (isRealFirebase && user.uid) {
    showToast('Syncing cloud profile...', 'info');
    await syncFirestoreData(user.uid);
  } else {
    loadAppState();
    
    // Select default sliders values from state
    elements.settingsThresholdSlider.value = settings.targetThreshold;
    elements.settingsThresholdLabel.textContent = `${settings.targetThreshold}%`;
    elements.settingsSemesterSelect.value = settings.semester || "Semester 1";
    updateHeaderDateDisplay();
    
    if (subjects.length === 0) {
      startOnboardingWizard();
    } else {
      renderAll();
    }
  }
}

function handleUserLogout() {
  currentUser = null;

  // Slide in login screen overlay
  elements.loginScreen.style.display = 'flex';
  setTimeout(() => {
    elements.loginScreen.style.opacity = '1';
  }, 50);

  // Revert Settings Profile to default Guest
  elements.accountName.textContent = 'Guest Student';
  elements.accountEmail.textContent = 'Offline Guest Mode';
  elements.accountActionBtn.innerHTML = '<i data-lucide="log-in" style="width:12px;height:12px;"></i> Sign In';
  elements.accountActionBtn.onclick = handleSignInBtnClick;
  elements.accountAvatar.innerHTML = '<i data-lucide="user" style="color: var(--text-secondary); width: 20px; height: 20px;"></i>';
  elements.headerAvatar.innerHTML = '<i data-lucide="user" style="width: 16px; height: 16px; color: var(--text-secondary);"></i>';

  lucide.createIcons();
}

function handleSignInBtnClick() {
  elements.loginScreen.style.display = 'flex';
  setTimeout(() => {
    elements.loginScreen.style.opacity = '1';
  }, 50);
}

function handleSignOutBtnClick() {
  if (confirm('Are you sure you want to sign out? Your cloud data will remain saved, but this device session will clear.')) {
    if (isRealFirebase && auth) {
      auth.signOut();
    } else {
      localStorage.removeItem('attentrack_local_session');
      handleUserLogout();
      // Wipe state data back to dummy
      subjects = [...dummySubjects];
      timetable = [...dummyTimetable];
      settings = { targetThreshold: 75, semester: "Semester 1" };
      attendanceLog = {};
      saveAppState();
      renderAll();
      showToast('Signed out of guest session.', 'info');
    }
  }
}

async function syncFirestoreData(uid) {
  try {
    const userDocRef = db.collection('users').doc(uid);
    const doc = await userDocRef.get();

    if (doc.exists) {
      // Load cloud data
      const cloudData = doc.data();
      if (cloudData.subjects) subjects = cloudData.subjects;
      if (cloudData.timetable) timetable = cloudData.timetable;
      if (cloudData.settings) settings = cloudData.settings;
      if (cloudData.attendanceLog) attendanceLog = cloudData.attendanceLog;

      // Sync local storage as backup
      localStorage.setItem('attentrack_subjects', JSON.stringify(subjects));
      localStorage.setItem('attentrack_timetable', JSON.stringify(timetable));
      localStorage.setItem('attentrack_settings', JSON.stringify(settings));
      localStorage.setItem('attentrack_log', JSON.stringify(attendanceLog));
      
      showToast('Timetables loaded from cloud!', 'success');
    } else {
      // Document is empty: seed it with current local dataset
      showToast('No cloud backups found. Saving local dataset to cloud...', 'info');
      await userDocRef.set({
        subjects,
        timetable,
        settings,
        attendanceLog,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Cloud database initialized!', 'success');
    }

    // Bind UI inputs from loaded settings
    elements.settingsThresholdSlider.value = settings.targetThreshold;
    elements.settingsThresholdLabel.textContent = `${settings.targetThreshold}%`;
    elements.settingsSemesterSelect.value = settings.semester || "Semester 1";
    updateHeaderDateDisplay();
    
    if (subjects.length === 0) {
      startOnboardingWizard();
    } else {
      renderAll();
    }
  } catch (error) {
    console.error("Firestore sync failed:", error);
    showToast("Cloud synchronization failed. Loading offline copy.", "error");
    loadAppState();
    if (subjects.length === 0) {
      startOnboardingWizard();
    } else {
      renderAll();
    }
  }
}

// ==========================================
// 10. Login & Configuration Click Triggers
// ==========================================

// Google Sign-In Action
elements.loginGoogleBtn.onclick = function() {
  if (isRealFirebase && auth) {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
      console.error("Google login failed:", error);
      showToast(`Google Sign-In failed: ${error.message}`, 'error');
    });
  } else {
    // Offline simulation (Mock Google user profile)
    const mockUser = {
      uid: 'mock-google-user',
      displayName: 'Kanishka Chaudhary',
      email: 'kanishka@university.edu',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
    };
    localStorage.setItem('attentrack_local_session', JSON.stringify(mockUser));
    handleUserLogin(mockUser);
    showToast('Signed in with Mock Google profile (Demo Mode).', 'success');
  }
};

// Guest Mode Action
elements.loginGuestBtn.onclick = function() {
  const mockUser = {
    uid: 'guest-offline',
    displayName: 'Guest Student',
    email: 'Offline Mode',
    photoURL: ''
  };
  localStorage.setItem('attentrack_local_session', JSON.stringify(mockUser));
  handleUserLogin(mockUser);
};

// DB Config Modal Toggle
elements.settingsDbConfigBtn.onclick = function() {
  const storedConfig = localStorage.getItem('attentrack_firebase_config') || '';
  elements.configJson.value = storedConfig;
  openModal('modal-firebase-config');
};

// Database Config JSON Form Submit
elements.firebaseConfigForm.onsubmit = function(e) {
  e.preventDefault();
  const jsonInput = elements.configJson.value.trim();

  if (jsonInput === '') {
    localStorage.removeItem('attentrack_firebase_config');
    showToast('Credentials cleared. Reverting to Guest mode...', 'info');
    closeModal('modal-firebase-config');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    return;
  }

  try {
    const parsed = JSON.parse(jsonInput);
    if (!parsed.apiKey || !parsed.projectId) {
      throw new Error('Config missing "apiKey" or "projectId" keys.');
    }
    
    localStorage.setItem('attentrack_firebase_config', jsonInput);
    showToast('Credentials saved successfully. Reloading to connect...', 'success');
    closeModal('modal-firebase-config');
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  } catch (error) {
    showToast(`Failed configuration parse: ${error.message}`, 'error');
  }
};

// Header profile click triggers settings tab navigation
elements.headerAvatar.onclick = function() {
  const settingsTab = document.querySelector('.nav-tab[data-target="settings"]');
  if (settingsTab) settingsTab.click();
};

// ==========================================
// 10.5. Onboarding Wizard State & Controllers
// ==========================================

let wizardSubjects = [];
let wizardTimetable = [];

function startOnboardingWizard() {
  wizardSubjects = [];
  wizardTimetable = [];
  
  // Reset inputs
  elements.wizardSubjectName.value = '';
  elements.wizardSlotTime.value = '';
  elements.wizardSlotRoom.value = '';
  elements.wizardSemester.value = 'Semester 1';
  elements.wizardThreshold.value = 75;
  elements.wizardThresholdVal.textContent = '75%';
  
  elements.onboardingWizard.style.display = 'flex';
  elements.onboardingWizard.style.opacity = '1';
  goToWizardStep(1);
}

function goToWizardStep(step) {
  // Hide all step panels
  document.getElementById('wizard-step-1').style.display = 'none';
  document.getElementById('wizard-step-2').style.display = 'none';
  document.getElementById('wizard-step-3').style.display = 'none';
  
  if (step === 1) {
    document.getElementById('wizard-step-1').style.display = 'flex';
    document.getElementById('wizard-step-title').textContent = 'Setup: Semester & Target';
    document.getElementById('wizard-step-indicator').textContent = 'Step 1 of 3';
  } else if (step === 2) {
    document.getElementById('wizard-step-2').style.display = 'flex';
    document.getElementById('wizard-step-title').textContent = 'Setup: Add Subjects';
    document.getElementById('wizard-step-indicator').textContent = 'Step 2 of 3';
    renderWizardSubjects();
  } else if (step === 3) {
    if (wizardSubjects.length === 0) {
      showToast('Please add at least one subject first.', 'error');
      document.getElementById('wizard-step-2').style.display = 'flex';
      return;
    }
    document.getElementById('wizard-step-3').style.display = 'flex';
    document.getElementById('wizard-step-title').textContent = 'Setup: Add Timetable';
    document.getElementById('wizard-step-indicator').textContent = 'Step 3 of 3';
    
    // Populate subject select dropdown
    const dropdown = elements.wizardSlotSubject;
    dropdown.innerHTML = '';
    wizardSubjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.name;
      dropdown.appendChild(opt);
    });
    
    renderWizardSlots();
  }
}

function renderWizardSubjects() {
  const list = elements.wizardSubjectsList;
  list.innerHTML = '';
  if (wizardSubjects.length === 0) {
    list.innerHTML = '<p style="font-size:11px; color: var(--text-muted); text-align:center; padding: 10px 0;">No subjects added yet.</p>';
    return;
  }
  
  wizardSubjects.forEach((sub, index) => {
    const item = document.createElement('div');
    item.className = 'timetable-edit-item';
    item.style.padding = '8px 12px';
    item.innerHTML = `
      <span style="font-size:13px; font-weight:600; color:white;">${sub.name}</span>
      <button class="delete-mini-btn" onclick="deleteWizardSubject(${index})" title="Delete Subject">
        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
      </button>
    `;
    list.appendChild(item);
  });
  lucide.createIcons();
}

function deleteWizardSubject(index) {
  const sub = wizardSubjects[index];
  if (!sub) return;
  // Remove associated slots
  wizardTimetable = wizardTimetable.filter(slot => slot.subjectId !== sub.id);
  // Remove subject
  wizardSubjects.splice(index, 1);
  renderWizardSubjects();
  renderWizardSlots();
}

function renderWizardSlots() {
  const list = elements.wizardSlotsList;
  list.innerHTML = '';
  if (wizardTimetable.length === 0) {
    list.innerHTML = '<p style="font-size:11px; color: var(--text-muted); text-align:center; padding: 10px 0;">No slots scheduled yet.</p>';
    return;
  }
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  wizardTimetable.forEach((slot, index) => {
    const subject = wizardSubjects.find(s => s.id === slot.subjectId);
    const subName = subject ? subject.name : 'Unknown';
    const item = document.createElement('div');
    item.className = 'timetable-edit-item';
    item.style.padding = '8px 12px';
    item.innerHTML = `
      <div>
        <strong style="font-size:12px;">${subName}</strong>
        <p style="font-size:10px; color:var(--text-secondary); margin-top:2px;">${dayNames[slot.day]} • ${slot.time} ${slot.room ? '• ' + slot.room : ''}</p>
      </div>
      <button class="delete-mini-btn" onclick="deleteWizardSlot(${index})" title="Delete Slot">
        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
      </button>
    `;
    list.appendChild(item);
  });
  lucide.createIcons();
}

function deleteWizardSlot(index) {
  wizardTimetable.splice(index, 1);
  renderWizardSlots();
}

function completeOnboarding() {
  if (wizardSubjects.length === 0) {
    showToast('Please add at least one subject to complete setup.', 'error');
    return;
  }
  
  subjects = [...wizardSubjects];
  timetable = [...wizardTimetable];
  settings.semester = elements.wizardSemester.value;
  settings.targetThreshold = parseInt(elements.wizardThreshold.value);
  attendanceLog = {}; // Reset logs
  
  // Update sliders
  elements.settingsThresholdSlider.value = settings.targetThreshold;
  elements.settingsThresholdLabel.textContent = `${settings.targetThreshold}%`;
  elements.settingsSemesterSelect.value = settings.semester;
  updateHeaderDateDisplay();
  
  saveAppState();
  
  if (isRealFirebase && currentUser && currentUser.uid) {
    db.collection('users').doc(currentUser.uid).set({
      subjects,
      timetable,
      settings,
      attendanceLog,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      showToast('Profile saved to cloud!', 'success');
    }).catch(error => {
      console.error("Failed to save profile to Firestore:", error);
      showToast('Failed to save setup to cloud database.', 'error');
    });
  }
  
  elements.onboardingWizard.style.opacity = '0';
  setTimeout(() => {
    elements.onboardingWizard.style.display = 'none';
    elements.onboardingWizard.style.opacity = '1';
  }, 400);
  
  renderAll();
  showToast('Setup complete! Welcome to AttenTrack.', 'success');
}

// Bind Wizard Buttons and Inputs
elements.wizardAddSubjectBtn.onclick = function() {
  const name = elements.wizardSubjectName.value.trim();
  if (!name) {
    showToast('Please enter a subject name.', 'error');
    return;
  }
  if (wizardSubjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    showToast('Subject already added.', 'error');
    return;
  }
  
  const subId = `sub-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  wizardSubjects.push({
    id: subId,
    name: name,
    room: '',
    attended: 0,
    total: 0
  });
  elements.wizardSubjectName.value = '';
  renderWizardSubjects();
};

elements.wizardAddSlotBtn.onclick = function() {
  const subjectId = elements.wizardSlotSubject.value;
  const day = parseInt(elements.wizardSlotDay.value);
  const time = elements.wizardSlotTime.value.trim();
  const room = elements.wizardSlotRoom.value.trim();
  
  if (!subjectId) {
    showToast('Please select a subject.', 'error');
    return;
  }
  if (!time) {
    showToast('Please enter a class time.', 'error');
    return;
  }
  
  const subject = wizardSubjects.find(s => s.id === subjectId);
  const newSlot = {
    id: `slot-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    subjectId,
    day,
    time,
    room: room || (subject ? subject.room : '')
  };
  wizardTimetable.push(newSlot);
  elements.wizardSlotTime.value = '';
  elements.wizardSlotRoom.value = '';
  renderWizardSlots();
};

elements.wizardThreshold.oninput = function() {
  elements.wizardThresholdVal.textContent = `${this.value}%`;
};

// Expose functions to window scope for inline HTML callbacks
window.goToWizardStep = goToWizardStep;
window.deleteWizardSubject = deleteWizardSubject;
window.deleteWizardSlot = deleteWizardSlot;
window.completeOnboarding = completeOnboarding;
window.startOnboardingWizard = startOnboardingWizard;


// ==========================================
// 11. Initialization Lifecycle
// ==========================================

function updateHeaderDateDisplay() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const today = new Date();
  const dateStr = `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`;
  
  elements.currentDateDisplay.textContent = `${settings.semester || 'Semester 1'} • ${dateStr}`;
}

// Check and shift the active schedule day index automatically at midnight
function startMidnightCheck() {
  setInterval(() => {
    const today = new Date();
    
    // Update the visual date string
    updateHeaderDateDisplay();
    
    // Check if the current system weekday index has rolled over
    const systemDay = today.getDay();
    if (currentSelectedDay !== systemDay) {
      // Automatically shift active dashboard day to match the new day
      currentSelectedDay = systemDay;
      updateDaySelectorUI();
    }
    
    // Always call renderDashboard to show warning prompts dynamically when class hours pass
    renderDashboard();
  }, 60000); // Poll once every 60 seconds
}

function initApp() {
  setupFirebase();
  startMidnightCheck();
  lucide.createIcons();
}

// Start application
window.onload = initApp;
