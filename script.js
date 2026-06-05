// =====================================================
//  ZenBreath — Logique principale
// =====================================================

// --- Enregistrement du Service Worker (PWA) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// =====================================================
//  CONFIGURATION
// =====================================================

// Définition des rythmes : [inspir, rétention, expir] en secondes
const RHYTHMS = {
  '4-4':   { phases: [4, 0, 4],   label: 'Débutant 4–4' },
  '5-5':   { phases: [5, 0, 5],   label: 'Cardiaque 5–5' },
  '4-6':   { phases: [4, 0, 6],   label: 'Relaxation 4–6' },
  '4-7-8': { phases: [4, 7, 8],   label: 'Apaisement 4–7–8' },
};

// Noms lisibles des phases
const PHASE_NAMES = ['Inspirez', 'Retenez', 'Expirez'];

// Vidéos de fond — Pixabay CDN (libres de droits, cross-origin autorisé)
const VIDEOS = {
  plage:    'https://cdn.pixabay.com/video/2023/04/26/160561-821392610_large.mp4',
  foret:    'https://cdn.pixabay.com/video/2021/08/04/83880-585600454_large.mp4',
  montagne: 'https://cdn.pixabay.com/video/2022/03/21/111508-691222995_large.mp4',
};

// Sons d'ambiance — chemin corrigé selon la structure GitHub
const SOUNDS = {
  vagues:           'assets/assets/sounds/vagues.mp3',
  oiseaux:          'assets/assets/sounds/oiseaux.mp3',
  'foret-ambiance': 'assets/assets/sounds/foret-ambiance.mp3',
  musique:          'assets/assets/sounds/musique.mp3',
};

// =====================================================
//  ÉTAT DE L'APPLICATION
// =====================================================

let state = {
  landscape: 'plage',
  sound:     'vagues',
  duration:  5,        // en minutes
  rhythm:    '4-4',
  volume:    0.6,
};

// Variables de session (remises à zéro à chaque session)
let sessionTimer  = null;   // setInterval principal
let phaseTimer    = null;   // setInterval pour le compte à rebours de phase
let sessionStart  = null;
let totalSeconds  = 0;
let elapsedSeconds = 0;
let currentPhaseIndex = 0;
let currentPhaseRemaining = 0;
let cycles        = 0;
let isRunning     = false;

// =====================================================
//  SÉLECTION DES ÉLÉMENTS DOM
// =====================================================

const views = {
  home:     document.getElementById('view-home'),
  session:  document.getElementById('view-session'),
  complete: document.getElementById('view-complete'),
  history:  document.getElementById('view-history'),
};

// Accueil
const bgVideo         = document.getElementById('bg-video');
const durationSlider  = document.getElementById('duration-slider');
const durationDisplay = document.getElementById('duration-display');
const volumeSlider    = document.getElementById('volume-slider');
const btnStart        = document.getElementById('btn-start');
const btnHistory      = document.getElementById('btn-history');

// Session
const sessionBgVideo     = document.getElementById('session-bg-video');
const btnQuit            = document.getElementById('btn-quit');
const timerProgress      = document.getElementById('timer-progress');
const timerLabel         = document.getElementById('timer-label');
const breathCircle       = document.getElementById('breath-circle');
const breathPhaseLabel   = document.getElementById('breath-phase-label');
const breathCountdown    = document.getElementById('breath-countdown');
const cyclesCount        = document.getElementById('cycles-count');
const sessionRhythmLabel = document.getElementById('session-rhythm-label');

// Fin de session
const completeBgVideo  = document.getElementById('complete-bg-video');
const completeMessage  = document.getElementById('complete-message');
const statDuration     = document.getElementById('stat-duration');
const statCycles       = document.getElementById('stat-cycles');
const statRhythm       = document.getElementById('stat-rhythm');
const btnReplay        = document.getElementById('btn-replay');
const btnShare         = document.getElementById('btn-share');
const btnGoHome        = document.getElementById('btn-go-home');

// Historique
const btnBackHome       = document.getElementById('btn-back-home');
const gstatSessions     = document.getElementById('gstat-total-sessions');
const gstatMinutes      = document.getElementById('gstat-total-minutes');
const gstatWeek         = document.getElementById('gstat-week-sessions');
const gstatFavRhythm    = document.getElementById('gstat-fav-rhythm');
const sessionsList      = document.getElementById('sessions-list');
const notifTimeInput    = document.getElementById('notif-time');
const btnNotif          = document.getElementById('btn-notif');
const notifStatus       = document.getElementById('notif-status');

// Audio
const ambientAudio = document.getElementById('ambient-audio');
const endAudio     = document.getElementById('end-audio');

// =====================================================
//  NAVIGATION ENTRE LES VUES
// =====================================================

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  const target = views[name];
  target.style.display = 'flex';
  // Légère pause pour déclencher la transition CSS
  requestAnimationFrame(() => target.classList.add('active'));
}

// =====================================================
//  GESTION DES THÈMES / PAYSAGES
// =====================================================

function applyTheme(landscape) {
  document.body.className = `theme-${landscape}`;
}

function setVideo(videoEl, landscape) {
  videoEl.src = VIDEOS[landscape];
  videoEl.load();
  videoEl.play().catch(() => {}); // autoplay peut être bloqué sur certains navigateurs
}

// =====================================================
//  GROUPES DE BOUTONS (sélection unique)
// =====================================================

function initButtonGroup(groupId, onChange) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.btn-option').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  });
}

// =====================================================
//  INITIALISATION DE L'ACCUEIL
// =====================================================

function initHome() {
  // Paysage
  initButtonGroup('landscape-group', (value) => {
    state.landscape = value;
    applyTheme(value);
    setVideo(bgVideo, value);
  });

  // Son
  initButtonGroup('sound-group', (value) => {
    state.sound = value;
  });

  // Rythme
  initButtonGroup('rhythm-group', (value) => {
    state.rhythm = value;
  });

  // Durée
  durationSlider.addEventListener('input', () => {
    state.duration = parseInt(durationSlider.value);
    durationDisplay.textContent = `${state.duration} min`;
  });

  // Volume
  volumeSlider.addEventListener('input', () => {
    state.volume = parseInt(volumeSlider.value) / 100;
    ambientAudio.volume = state.volume;
  });

  // Bouton démarrer
  btnStart.addEventListener('click', startSession);

  // Bouton historique
  btnHistory.addEventListener('click', () => {
    renderHistory();
    showView('history');
  });
}

// =====================================================
//  MOTEUR DE SESSION
// =====================================================

function startSession() {
  // Réinitialisation
  cycles = 0;
  elapsedSeconds = 0;
  currentPhaseIndex = 0;
  totalSeconds = state.duration * 60;
  sessionStart = Date.now();
  isRunning = true;

  // Prépare la vue session
  setVideo(sessionBgVideo, state.landscape);
  sessionRhythmLabel.textContent = RHYTHMS[state.rhythm].label;
  updateTimerUI();
  updateCyclesUI();

  // Lance l'audio
  ambientAudio.src = SOUNDS[state.sound];
  ambientAudio.volume = state.volume;
  ambientAudio.play().catch(() => {});

  showView('session');

  // Lance le minuteur global (toutes les secondes)
  sessionTimer = setInterval(tickSession, 1000);

  // Lance la première phase
  startPhase(0);
}

// Tick principal : gère le temps restant global
function tickSession() {
  elapsedSeconds++;
  updateTimerUI();

  if (elapsedSeconds >= totalSeconds) {
    endSession();
  }
}

// Met à jour la barre de temps et le label mm:ss
function updateTimerUI() {
  const remaining = Math.max(0, totalSeconds - elapsedSeconds);
  const pct = (elapsedSeconds / totalSeconds) * 100;

  timerProgress.style.width = `${pct}%`;

  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  timerLabel.textContent = `${m}:${s}`;
}

// Démarre une phase de respiration (0 = inspir, 1 = rétention, 2 = expir)
function startPhase(phaseIndex) {
  if (!isRunning) return;

  const phaseDurations = RHYTHMS[state.rhythm].phases;

  // Ignore les phases à 0 secondes (ex: pas de rétention pour 4-4)
  if (phaseDurations[phaseIndex] === 0) {
    const next = (phaseIndex + 1) % 3;
    if (next === 0) cycles++;
    startPhase(next);
    return;
  }

  currentPhaseIndex = phaseIndex;
  currentPhaseRemaining = phaseDurations[phaseIndex];

  // Texte de la phase
  breathPhaseLabel.textContent = PHASE_NAMES[phaseIndex];
  breathCountdown.textContent = currentPhaseRemaining;

  // Animation du cercle
  breathCircle.className = 'breath-circle';
  void breathCircle.offsetWidth; // force reflow pour réinitialiser l'animation
  const animClass = phaseIndex === 0 ? 'phase-in' : phaseIndex === 1 ? 'phase-hold' : 'phase-out';
  breathCircle.classList.add(animClass);
  breathCircle.style.animationDuration = `${currentPhaseRemaining}s`;

  // Compte à rebours de phase
  clearInterval(phaseTimer);
  phaseTimer = setInterval(() => {
    if (!isRunning) return;
    currentPhaseRemaining--;
    breathCountdown.textContent = Math.max(0, currentPhaseRemaining);

    if (currentPhaseRemaining <= 0) {
      clearInterval(phaseTimer);
      const next = (phaseIndex + 1) % 3;
      // Un cycle est complété quand on passe de l'expir (2) à l'inspir (0)
      if (next === 0) {
        cycles++;
        updateCyclesUI();
      }
      startPhase(next);
    }
  }, 1000);
}

function updateCyclesUI() {
  cyclesCount.textContent = cycles === 1 ? '1 cycle complété' : `${cycles} cycles complétés`;
}

// Arrête proprement la session
function stopSession() {
  isRunning = false;
  clearInterval(sessionTimer);
  clearInterval(phaseTimer);
  ambientAudio.pause();
}

// Fin normale de session
function endSession() {
  stopSession();

  // Joue le son de fin si disponible
  endAudio.play().catch(() => {});

  // Calcule la durée réelle
  const actualSeconds = Math.round((Date.now() - sessionStart) / 1000);
  const actualMinutes = Math.floor(actualSeconds / 60);

  // Sauvegarde en localStorage
  saveSession({
    date:     new Date().toISOString(),
    duration: actualMinutes,
    rhythm:   state.rhythm,
    landscape: state.landscape,
    cycles:   cycles,
  });

  // Affiche l'écran de félicitations
  showComplete(actualMinutes);
}

// =====================================================
//  VUE FIN DE SESSION
// =====================================================

function showComplete(minutes) {
  setVideo(completeBgVideo, state.landscape);

  const messages = [
    'Vous avez pris soin de vous. C\'est le plus beau cadeau.',
    'Chaque respiration consciente est un pas vers la sérénité.',
    'Votre corps et votre esprit vous remercient.',
    'La paix intérieure commence avec une seule respiration.',
  ];
  completeMessage.textContent = messages[Math.floor(Math.random() * messages.length)];

  statDuration.textContent = `${minutes} min`;
  statCycles.textContent   = cycles;
  statRhythm.textContent   = RHYTHMS[state.rhythm].label.split(' ')[1] || RHYTHMS[state.rhythm].label;

  showView('complete');
}

btnReplay.addEventListener('click', () => startSession());

btnGoHome.addEventListener('click', () => {
  setVideo(bgVideo, state.landscape);
  showView('home');
});

btnQuit.addEventListener('click', () => {
  stopSession();
  setVideo(bgVideo, state.landscape);
  showView('home');
});

// =====================================================
//  PARTAGE SOCIAL
// =====================================================

btnShare.addEventListener('click', () => {
  const rhythm = RHYTHMS[state.rhythm].label;
  const text = `Je viens de faire une session de cohérence cardiaque de ${state.duration} min avec ZenBreath ! 🌬️✨ Rythme : ${rhythm}. Essayez-le pour réduire le stress naturellement.`;
  const url  = window.location.href;

  // Utilise l'API de partage native si disponible (mobile)
  if (navigator.share) {
    navigator.share({ title: 'ZenBreath', text, url }).catch(() => {});
  } else {
    // Fallback : copie dans le presse-papier
    const fullText = `${text}\n${url}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).then(() => {
        showShareFeedback('✅ Lien copié dans le presse-papier !');
      });
    } else {
      // Fallback ultime : ouvre Twitter Web Intent
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, '_blank');
    }
  }
});

function showShareFeedback(msg) {
  const prev = btnShare.textContent;
  btnShare.textContent = msg;
  setTimeout(() => { btnShare.textContent = prev; }, 2500);
}

// =====================================================
//  STOCKAGE LOCAL (localStorage)
// =====================================================

const STORAGE_KEY = 'zenbreath_sessions';

function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSession(session) {
  const sessions = getSessions();
  sessions.unshift(session); // Ajoute en tête de liste
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// =====================================================
//  VUE HISTORIQUE & STATS
// =====================================================

function renderHistory() {
  const sessions = getSessions();

  // --- Stats globales ---
  const totalSessions = sessions.length;
  const totalMinutes  = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  // Sessions cette semaine
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekSessions = sessions.filter(s => new Date(s.date).getTime() > oneWeekAgo).length;

  // Rythme favori
  const rhythmCount = {};
  sessions.forEach(s => { rhythmCount[s.rhythm] = (rhythmCount[s.rhythm] || 0) + 1; });
  const favRhythm = Object.entries(rhythmCount).sort((a, b) => b[1] - a[1])[0];

  gstatSessions.textContent  = totalSessions;
  gstatMinutes.textContent   = totalMinutes;
  gstatWeek.textContent      = weekSessions;
  gstatFavRhythm.textContent = favRhythm ? RHYTHMS[favRhythm[0]]?.label.split(' ')[1] || '–' : '–';

  // --- Liste des sessions ---
  if (sessions.length === 0) {
    sessionsList.innerHTML = '<p class="empty-state">Aucune session pour l\'instant.<br/>Lancez votre première respiration ! 🌬️</p>';
    return;
  }

  sessionsList.innerHTML = sessions.map(s => {
    const date    = new Date(s.date);
    const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const icons   = { plage: '🏖️', foret: '🌿', montagne: '🏔️' };
    return `
      <div class="session-entry">
        <div class="session-entry-left">
          <span class="session-entry-date">${dateStr} à ${timeStr}</span>
          <span class="session-entry-detail">${icons[s.landscape] || '🌍'} ${s.duration} min — ${RHYTHMS[s.rhythm]?.label || s.rhythm}</span>
        </div>
        <div class="session-entry-right">${s.cycles} cycles</div>
      </div>
    `;
  }).join('');
}

btnBackHome.addEventListener('click', () => showView('home'));

// =====================================================
//  NOTIFICATIONS LOCALES
// =====================================================

btnNotif.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    notifStatus.textContent = '⚠️ Les notifications ne sont pas supportées par votre navigateur.';
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    const time = notifTimeInput.value || '08:00';
    localStorage.setItem('zenbreath_notif_time', time);

    // Affiche une notification de confirmation immédiate
    new Notification('ZenBreath 🌬️', {
      body: `Rappel quotidien activé à ${time}. À tout à l'heure !`,
      icon: 'assets/icon-192.png',
    });

    notifStatus.textContent = `✅ Rappel activé à ${time} (gardez l'onglet ouvert pour les rappels).`;
    scheduleLocalNotification(time);
  } else {
    notifStatus.textContent = '❌ Permission refusée. Activez les notifications dans les réglages de votre navigateur.';
  }
});

// Planifie un rappel local (délai jusqu'à la prochaine occurrence de l'heure choisie)
function scheduleLocalNotification(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);

  // Si l'heure est déjà passée aujourd'hui, planifie pour demain
  if (next <= now) next.setDate(next.getDate() + 1);

  const delay = next.getTime() - now.getTime();

  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('ZenBreath 🌬️', {
        body: 'C\'est l\'heure de votre session de cohérence cardiaque. Prenez soin de vous !',
        icon: 'assets/icon-192.png',
      });
    }
    // Re-planifie pour le lendemain
    scheduleLocalNotification(timeStr);
  }, delay);
}

// Restaure le rappel si déjà configuré
function restoreNotification() {
  const savedTime = localStorage.getItem('zenbreath_notif_time');
  if (savedTime && Notification.permission === 'granted') {
    notifTimeInput.value = savedTime;
    notifStatus.textContent = `✅ Rappel actif à ${savedTime}.`;
    scheduleLocalNotification(savedTime);
  }
}

// =====================================================
//  DÉMARRAGE
// =====================================================

function init() {
  // Applique le thème et la vidéo de départ
  applyTheme(state.landscape);
  setVideo(bgVideo, state.landscape);

  // Initialise tous les contrôles
  initHome();

  // Restaure le rappel notification si configuré
  restoreNotification();

  // Affiche la vue d'accueil
  showView('home');
}

init();
