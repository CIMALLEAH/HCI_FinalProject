/**
 * PlanEase - Main Application Script
 * Handles all app functionality, data management, and UI interactions
 */

// =========================
// Global State & Storage
// =========================
const STORAGE_KEY = 'planease_app_v1';
let AppData = {
  user: {},
  settings: {},
  alarms: [],
  events: [],
  conflicts: []
};

// Load data from external JSON file
async function loadAppData() {
  try {
    const response = await fetch('data.json');
    const data = await response.json();
    AppData = { ...AppData, ...data };
    
    // Override with localStorage if available
    loadFromLocalStorage();
    
    return AppData;
  } catch (error) {
    console.error('Failed to load app data:', error);
    loadFromLocalStorage(); // Fallback to localStorage
  }
}

// =========================
// LocalStorage Management
// =========================
function saveToLocalStorage() {
  try {
    const payload = {
      alarms: AppData.alarms || [],
      settings: AppData.settings || {},
      events: AppData.events || [],
      user: AppData.user || {}
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    
    const parsed = JSON.parse(raw);
    if (parsed.alarms && Array.isArray(parsed.alarms)) {
      AppData.alarms = parsed.alarms;
    }
    if (parsed.settings) {
      AppData.settings = Object.assign(AppData.settings || {}, parsed.settings);
    }
    if (parsed.events && Array.isArray(parsed.events)) {
      AppData.events = parsed.events;
    }
    if (parsed.user) {
      AppData.user = Object.assign(AppData.user || {}, parsed.user);
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }
}

// =========================
// Utility Functions
// =========================
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00');
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

function formatDateShort(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00');
  return d.toLocaleDateString('en-GB');
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00');
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getIconForCategory(category) {
  switch (category) {
    case 'school': return 'fa-graduation-cap';
    case 'work': return 'fa-briefcase';
    case 'personal': return 'fa-user';
    default: return 'fa-circle';
  }
}

// =========================
// Event Management
// =========================
function getTodayEvents() {
  const today = new Date().toISOString().split('T')[0];
  return AppData.events.filter(e => 
    e.kind === 'event' && (e.date === today || e.startDate === today)
  );
}

function getUpcomingTasks(days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return AppData.events.filter(e => {
    if (e.kind !== 'task' || e.completed) return false;
    const dueDate = new Date(e.dueDate || e.startDate || e.date);
    const diff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= days;
  });
}

function getCurrentEvent() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  return AppData.events.find(ev => {
    const eventDate = ev.startDate || ev.date;
    if (eventDate !== todayStr || ev.kind !== 'event') return false;
    
    const [sh, sm] = ev.startTime.split(':').map(Number);
    const [eh, em] = (ev.endTime || ev.startTime).split(':').map(Number);
    
    const start = new Date(now);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(now);
    end.setHours(eh, em, 0, 0);
    
    return now >= start && now <= end;
  });
}

function getUpcomingEvents(days = 2) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return AppData.events
    .filter(e => e.kind === 'event')
    .map(e => {
      const evDate = new Date(e.startDate || e.date);
      const diff = Math.ceil((evDate - today) / (1000 * 60 * 60 * 24));
      return { ...e, daysUntil: diff };
    })
    .filter(e => e.daysUntil >= 0 && e.daysUntil <= days)
    .sort((a, b) => new Date(a.startDate || a.date) - new Date(b.startDate || b.date));
}

function getEventsByDate(dateString) {
  return AppData.events.filter(e => 
    (e.date === dateString) || (e.startDate === dateString)
  );
}

function hasConflict(dateString) {
  const events = getEventsByDate(dateString);
  if (events.length < 2) return false;
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const e1Start = parseTime(events[i].startTime);
      const e1End = parseTime(events[i].endTime || events[i].startTime);
      const e2Start = parseTime(events[j].startTime);
      const e2End = parseTime(events[j].endTime || events[j].startTime);
      
      if (e1Start < e2End && e1End > e2Start) {
        return true;
      }
    }
  }
  return false;
}

function getCategoriesForDate(dateString) {
  const events = getEventsByDate(dateString);
  const categories = new Set(events.map(e => e.category));
  return Array.from(categories);
}

// =========================
// CRUD Operations
// =========================
function nextEventId() {
  return Math.max(0, ...AppData.events.map(e => e.id || 0)) + 1;
}

function addEvent(payload) {
  payload.id = nextEventId();
  AppData.events.push(payload);
  saveToLocalStorage();
}

function updateEvent(id, payload) {
  const idx = AppData.events.findIndex(e => e.id === id);
  if (idx !== -1) {
    AppData.events[idx] = { ...AppData.events[idx], ...payload };
    saveToLocalStorage();
  }
}

function deleteEvent(id) {
  AppData.events = AppData.events.filter(e => e.id !== id);
  saveToLocalStorage();
}

function toggleEventComplete(id) {
  const ev = AppData.events.find(e => e.id === id);
  if (ev) {
    ev.completed = !ev.completed;
    saveToLocalStorage();
  }
}

// =========================
// Authentication
// =========================
function validateLogin(email, password) {
  const validEmail = AppData.user.credentials?.email || 'dalvah@gmail.com';
  const validPassword = AppData.user.credentials?.password || '11001';
  return email === validEmail && password === validPassword;
}

function logout() {
  // Clear session-specific data if needed
  window.location.href = 'login.html';
}

// =========================
// Notification Helpers
// =========================
function updateNotificationDot() {
  const dot = document.getElementById('notificationDot');
  if (!dot) return;
  
  const hasAlerts = AppData.conflicts && AppData.conflicts.length > 0;
  dot.style.display = hasAlerts ? 'block' : 'none';
}

function toggleNotificationPanel() {
  const panel = document.getElementById('notificationPanel');
  if (panel) {
    panel.classList.toggle('active');
  }
}

// =========================
// Alarm Management
// =========================
let alarmSchedulerInterval = null;
let lastTriggered = {};
let snoozeTimeouts = {};
let alarmAudioElement = null;
let beepOsc = null;

function startAlarmScheduler() {
  if (alarmSchedulerInterval) return;
  alarmSchedulerInterval = setInterval(checkAlarmsToFire, 10000);
  checkAlarmsToFire(); // Initial check
}

function stopAlarmScheduler() {
  if (alarmSchedulerInterval) {
    clearInterval(alarmSchedulerInterval);
    alarmSchedulerInterval = null;
  }
}

function checkAlarmsToFire() {
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const minuteKey = now.toISOString().slice(0, 16);
  
  (AppData.alarms || []).forEach(a => {
    if (!a.enabled) return;
    if (a.time === hhmm) {
      const last = lastTriggered[a.id];
      if (last === minuteKey) return;
      lastTriggered[a.id] = minuteKey;
      fireAlarm(a);
    }
  });
}

function fireAlarm(alarm) {
  if (typeof showFiringOverlay === 'function') {
    showFiringOverlay(alarm);
  }
  
  if (AppData.settings.notifications?.sound) {
    playAlarmSoundLoop();
  }
  
  if (AppData.settings.notifications?.vibrate && navigator.vibrate) {
    navigator.vibrate([300, 100, 300]);
  }
}

function playAlarmSoundLoop() {
  const audio = ensureAlarmAudio();
  if (audio && audio.play) {
    audio.loop = true;
    audio.currentTime = 0;
    audio.play().catch(() => {
      playBeepLoopFallback();
    });
    return;
  }
  playBeepLoopFallback();
}

function ensureAlarmAudio() {
  if (alarmAudioElement) return alarmAudioElement;
  
  const audio = document.createElement('audio');
  audio.id = 'alarmAudio';
  audio.preload = 'auto';
  audio.src = 'assets/alarm.mp3';
  audio.addEventListener('error', () => {
    alarmAudioElement = null;
  });
  document.body.appendChild(audio);
  alarmAudioElement = audio;
  return alarmAudioElement;
}

function playBeepLoopFallback() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    beepOsc = { osc: o, ctx, gain: g };
  } catch (e) {
    console.warn('Audio fallback failed', e);
  }
}

function stopAlarmSound() {
  try {
    if (alarmAudioElement) {
      alarmAudioElement.pause();
      alarmAudioElement.currentTime = 0;
    }
  } catch (e) {}
  
  try {
    if (beepOsc && beepOsc.osc) {
      beepOsc.osc.stop();
      beepOsc.ctx.close();
      beepOsc = null;
    }
  } catch (e) {}
}

// =========================
// Calendar Helpers
// =========================
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// =========================
// Export functions to global scope
// =========================
window.PlanEase = {
  // Data
  AppData,
  loadAppData,
  saveToLocalStorage,
  loadFromLocalStorage,
  
  // Utilities
  formatDate,
  formatDateShort,
  daysUntil,
  parseTime,
  getGreeting,
  getIconForCategory,
  
  // Events
  getTodayEvents,
  getUpcomingTasks,
  getCurrentEvent,
  getUpcomingEvents,
  getEventsByDate,
  hasConflict,
  getCategoriesForDate,
  
  // CRUD
  nextEventId,
  addEvent,
  updateEvent,
  deleteEvent,
  toggleEventComplete,
  
  // Auth
  validateLogin,
  logout,
  
  // Notifications
  updateNotificationDot,
  toggleNotificationPanel,
  
  // Alarms
  startAlarmScheduler,
  stopAlarmScheduler,
  checkAlarmsToFire,
  fireAlarm,
  stopAlarmSound,
  
  // Calendar
  getFirstDayOfMonth,
  getDaysInMonth,
  getWeekNumber
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadAppData().then(() => {
    console.log('PlanEase data loaded successfully');
  });
});