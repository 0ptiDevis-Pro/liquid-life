// ================= ETAT DES DONNEES LOCALES ================= */
let state = {
    userName: localStorage.getItem('ll_userName') || "",
    streak: parseInt(localStorage.getItem('ll_streak')) || 0,
    lastMissionDate: localStorage.getItem('ll_lastMissionDate') || "", 
    currentMission: localStorage.getItem('ll_currentMission') || "15 pompes",
    weekSchedule: JSON.parse(localStorage.getItem('ll_weekSchedule')) || {},
    workoutGenerated: JSON.parse(localStorage.getItem('ll_workout')) || null,
    goals: JSON.parse(localStorage.getItem('ll_goals')) || [],
    qrcodes: JSON.parse(localStorage.getItem('ll_qrcodes')) || [],
    notifications: JSON.parse(localStorage.getItem('ll_notifications')) || { sport: false, school: false, motivation: false, goals: false, streak: false }
};

let pendingDelete = { type: null, index: null }; 
let currentPromptCallback = null;

const quotes = [
    "Le succès n'est pas un accident, c'est le résultat d'une routine implacable.",
    "La discipline est le pont entre tes objectifs et tes accomplissements.",
    "N'arrête pas quand tu es fatigué, arrête quand tu as fini.",
    "Ceux qui réussissent font ce que les autres n'ont pas envie de faire.",
    "La douleur est temporaire, l'abandon est définitif.",
    "Sois régulier et structuré dans ta vie pour être puissant dans tes projets.",
    "Ton futur se construit sur ce que tu imposes à ta journée."
];

// ================= INITIALISATION ET ECOUTEURS ================= */
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initUserName();
    checkAppDay();
    initNotificationsUI();
    renderAll();
});

function saveState() {
    localStorage.setItem('ll_userName', state.userName);
    localStorage.setItem('ll_streak', state.streak.toString());
    localStorage.setItem('ll_lastMissionDate', state.lastMissionDate);
    localStorage.setItem('ll_currentMission', state.currentMission);
    localStorage.setItem('ll_weekSchedule', JSON.stringify(state.weekSchedule));
    localStorage.setItem('ll_workout', JSON.stringify(state.workoutGenerated));
    localStorage.setItem('ll_goals', JSON.stringify(state.goals));
    localStorage.setItem('ll_qrcodes', JSON.stringify(state.qrcodes));
    localStorage.setItem('ll_notifications', JSON.stringify(state.notifications));
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(timeString) { 
    if(!timeString) return 0;
    const [h, m] = timeString.split(':').map(Number); return h * 60 + m; 
}

// ================= GESTION DU PRENOM & POP-UPS CUSTOMS ================= */
function initUserName() {
    if (!state.userName) { openModal('name-modal'); } 
    else { document.getElementById('welcome-text').innerText = `Hello ${state.userName} ! 👋`; }
}
function saveUserName() {
    const name = document.getElementById('user-name-input').value.trim();
    if (name) {
        state.userName = name; saveState();
        document.getElementById('welcome-text').innerText = `Hello ${state.userName} ! 👋`;
        closeModal('name-modal');
    }
}
function showCustomAlert(title, desc, isSuccess = false) {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-desc').innerText = desc;
    const iconObj = document.getElementById('alert-icon');
    if(isSuccess) {
        iconObj.innerHTML = '<i data-lucide="check-circle" style="color: #22C55E;"></i>';
        iconObj.style.background = 'rgba(34, 197, 94, 0.1)';
    } else {
        iconObj.innerHTML = '<i data-lucide="info" style="color: var(--accent-blue);"></i>';
        iconObj.style.background = 'rgba(47, 124, 255, 0.1)';
    }
    lucide.createIcons();
    openModal('alert-modal');
}
function showCustomPrompt(title, desc, callback) {
    document.getElementById('prompt-title').innerText = title;
    document.getElementById('prompt-desc').innerText = desc;
    document.getElementById('prompt-input').value = "";
    currentPromptCallback = callback;
    openModal('prompt-modal');
}
function submitCustomPrompt() {
    const val = document.getElementById('prompt-input').value;
    closeModal('prompt-modal');
    if (currentPromptCallback && val !== "") currentPromptCallback(val);
}

// ================= RESET GLOBAL ================= */
function executeFullReset() {
    const currentName = state.userName;
    state = {
        userName: currentName, streak: 0, lastMissionDate: "", currentMission: "15 pompes",
        weekSchedule: {}, workoutGenerated: null, goals: [], qrcodes: [],
        notifications: { sport: false, school: false, motivation: false, goals: false, streak: false }
    };
    saveState();
    syncAllOneSignalTags(); 
    initNotificationsUI();
    renderAll();
    closeModal('reset-confirm-modal');
    showCustomAlert("Réinitialisation", "L'application a été entièrement remise à zéro.", true);
}

// ================= ROUTINE QUOTIDIENNE ================= */
function checkAppDay() {
    const today = getTodayString();
    if (localStorage.getItem('ll_currentDay') !== today) {
        localStorage.setItem('ll_currentDay', today);
        const randomQuoteIndex = Math.floor(Math.random() * quotes.length);
        localStorage.setItem('ll_quoteIndex', randomQuoteIndex.toString());
    }
    const quoteIndex = parseInt(localStorage.getItem('ll_quoteIndex')) || 0;
    document.getElementById('motivation-quote').innerText = `"${quotes[quoteIndex]}"`;
}

function completeDailyMission() {
    const today = getTodayString();
    if (state.lastMissionDate === today) return;
    if (state.lastMissionDate) {
        const lastDate = new Date(state.lastMissionDate);
        const nowDate = new Date(today);
        const diffDays = Math.ceil(Math.abs(nowDate - lastDate) / (1000 * 60 * 60 * 24)); 
        if (diffDays === 1) state.streak += 1; else state.streak = 1;
    } else { state.streak = 1; }
    state.lastMissionDate = today; saveState(); renderAll();
}

function switchTab(tabId) {
    document.querySelectorAll('.app-page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    renderAll();
}

function renderAll() {
    const today = getTodayString();
    const isMissionDone = (state.lastMissionDate === today);

    document.getElementById('streak-count-big').innerText = state.streak;
    const missionBtn = document.getElementById('btn-complete-mission');
    document.getElementById('home-mission-text').innerText = state.currentMission;
    
    if (isMissionDone) {
        missionBtn.innerText = "Validé ! ✨"; missionBtn.style.background = "var(--glass-border)";
        missionBtn.style.color = "var(--success-green)"; missionBtn.disabled = true;
    } else {
        missionBtn.innerText = "Mission terminée"; missionBtn.style.background = "var(--accent-blue)";
        missionBtn.style.color = "white"; missionBtn.disabled = false;
    }

    updateHomeGoalSummary(); updateSchoolDisplay(); renderWorkout(); renderGoals(); renderQRCodes(); lucide.createIcons();
}

// ================= SAUVEGARDE EXPORT/IMPORT JSON ================= */
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr); a.setAttribute("download", "liquidlife_backup.json");
    document.body.appendChild(a); a.click(); a.remove();
}
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedState = JSON.parse(e.target.result);
            if(importedState) {
                state = importedState; saveState(); 
                syncAllOneSignalTags();
                initNotificationsUI(); renderAll();
                showCustomAlert("Succès", "Sauvegarde restaurée avec succès ! ✨", true);
            }
        } catch(err) { showCustomAlert("Erreur", "Fichier invalide."); }
    }
    reader.readAsText(file); event.target.value = '';
}

// ================= NOTIFICATIONS CLOUD (ONESIGNAL) ================= */

function updateNotificationAuthUI() {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    
    if (!isSecure) {
        const statusText = document.getElementById('notif-auth-status');
        const promptDiv = document.getElementById('btn-request-notif');
        if (statusText) {
            statusText.innerText = "⚠️ HTTPS Requis (Déploie sur Vercel)";
            statusText.style.color = "var(--error-red)";
        }
        if (promptDiv) promptDiv.style.display = "none";
        return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
        try {
            const hasPermission = await OneSignal.Notifications.permission;
            const statusText = document.getElementById('notif-auth-status');
            const promptBtn = document.getElementById('btn-request-notif');
            
            if (hasPermission) {
                if (statusText) {
                    statusText.innerText = "Notifications Cloud activées ✨";
                    statusText.style.color = "#22C55E"; 
                }
                if (promptBtn) promptBtn.style.display = "none";
            } else {
                if (statusText) {
                    statusText.innerText = "Non configuré ou bloqué";
                    statusText.style.color = "#F59E0B"; 
                }
                if (promptBtn) promptBtn.style.display = "block";
            }
        } catch (error) {
            console.error("⚠️ Erreur OneSignal UI:", error);
        }
    });
}

function initNotificationsUI() {
    const types = ['sport', 'school', 'motivation', 'goals', 'streak'];
    types.forEach(type => {
        const checkbox = document.getElementById(`notif-${type}`);
        if (checkbox) {
            checkbox.checked = state.notifications[type] || false;
        }
    });
    updateNotificationAuthUI();
}

// BUG 1 CORRIGÉ : On appelle directement l'API de permission pour éviter le blocage du navigateur
async function requestCloudNotificationPermission() {
    try {
        if (!window.OneSignal) {
            showCustomAlert("Erreur", "OneSignal n'est pas encore initialisé. Recharge la page.");
            return;
        }
        const permission = await window.OneSignal.Notifications.requestPermission();
        
        if (permission) {
            showCustomAlert("Succès", "Les notifications sont activées !", true);
            updateNotificationAuthUI();
            syncAllOneSignalTags();
        } else {
            showCustomAlert("Refusé", "Veuillez autoriser les notifications dans les paramètres du navigateur.");
        }
    } catch (err) {
        console.error("Erreur demande autorisation OneSignal:", err);
        showCustomAlert("Erreur", "Impossible de demander l'accès aux notifications.");
    }
}

function toggleNotificationSetting(type) {
    const checkbox = document.getElementById(`notif-${type}`);
    if (!checkbox) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
        const hasPermission = await OneSignal.Notifications.permission;
        if (!hasPermission) {
            checkbox.checked = false;
            showCustomAlert("Attention", "Active d'abord les Notifications Cloud avec le bouton ci-dessus !");
            return;
        }
        
        state.notifications[type] = checkbox.checked;
        saveState();
        
        const tagKey = `notif_${type}`;
        const tagValue = checkbox.checked ? "true" : "false";
        OneSignal.User.addTag(tagKey, tagValue);
        console.log(`📡 Tag OneSignal mis à jour : [${tagKey}] -> ${tagValue}`);

        // Si l'utilisateur active l'option Ecole, on resynchronise immédiatement l'agenda
        if (type === 'school' && checkbox.checked) {
            syncSchoolScheduleWithOneSignal();
        }
    });
}

function syncAllOneSignalTags() {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
        const tagsToSync = {
            notif_sport: state.notifications.sport ? "true" : "false",
            notif_school: state.notifications.school ? "true" : "false",
            notif_motivation: state.notifications.motivation ? "true" : "false",
            notif_goals: state.notifications.goals ? "true" : "false",
            notif_streak: state.notifications.streak ? "true" : "false"
        };
        OneSignal.User.addTags(tagsToSync);
        console.log("📡 Tags globaux synchronisés avec OneSignal :", tagsToSync);
    });
}

// BUG 2 CORRIGÉ : Calcul des H-30min côté client et envoi à l'API unique
async function syncSchoolScheduleWithOneSignal() {
    if (!state.notifications.school || Object.keys(state.weekSchedule).length === 0) return;

    try {
        if (!window.OneSignal || !window.OneSignal.User || !window.OneSignal.User.pushSubscription) return;
        const subscriptionId = window.OneSignal.User.pushSubscription.id;
        if (!subscriptionId) return;

        const scheduledClasses = [];
        const now = new Date();
        const currentDayIndex = now.getDay();

        // Calcul des alertes H-30 pour les 7 prochains jours
        for (let i = 0; i < 7; i++) {
            const checkDayIndex = (currentDayIndex + i) % 7;
            if (state.weekSchedule[checkDayIndex] && state.weekSchedule[checkDayIndex].start) {
                const [startHour, startMin] = state.weekSchedule[checkDayIndex].start.split(':').map(Number);
                let classDate = new Date();
                classDate.setDate(now.getDate() + i);
                classDate.setHours(startHour, startMin, 0, 0);
                
                // Soustraction de 30 minutes
                let alertDate = new Date(classDate.getTime() - 30 * 60000);
                
                // On n'envoie au serveur que les dates futures
                if (alertDate > now) {
                    scheduledClasses.push({
                        courseTime: state.weekSchedule[checkDayIndex].start,
                        sendAfter: alertDate.toISOString()
                    });
                }
            }
        }

        if (scheduledClasses.length > 0) {
            await fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId, scheduledClasses })
            });
            console.log("✅ Synchro H-30 envoyée au serveur.");
        }
    } catch (e) {
        console.error("❌ Échec de la synchronisation des cours H-30 :", e);
    }
}

// ================= EMPLOI DU TEMPS INTELLIGENT ================= */
const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; 
const dayNamesFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

document.querySelector('[onclick="openModal(\'week-modal\')"]').addEventListener('click', () => {
    dayMap.forEach((day, index) => {
        if(index === 0) return; 
        if(state.weekSchedule[index]) { document.getElementById(`time-${day}-start`).value = state.weekSchedule[index].start; document.getElementById(`time-${day}-end`).value = state.weekSchedule[index].end; }
    });
    if(state.weekSchedule[0]) { document.getElementById(`time-sun-start`).value = state.weekSchedule[0].start; document.getElementById(`time-sun-end`).value = state.weekSchedule[0].end; }
});

function saveWeekSchedule(e) {
    e.preventDefault(); state.weekSchedule = {};
    dayMap.forEach((day, index) => {
        const s = document.getElementById(`time-${day}-start`).value, en = document.getElementById(`time-${day}-end`).value;
        if(s && en) { state.weekSchedule[index] = { start: s, end: en }; }
    });
    saveState(); 
    closeModal('week-modal'); 
    renderAll();

    // Au moment de sauvegarder, on planifie les alertes H-30min
    syncSchoolScheduleWithOneSignal();
}

function updateSchoolDisplay() {
    const now = new Date(); const currentDay = now.getDay(); const currentMins = now.getHours() * 60 + now.getMinutes();
    let displayDay = null; let isToday = false; let statusText = ""; let timeText = ""; let progressHTML = "";

    if (state.weekSchedule[currentDay]) {
        let sMins = timeToMinutes(state.weekSchedule[currentDay].start), eMins = timeToMinutes(state.weekSchedule[currentDay].end);
        if (currentMins < sMins) { displayDay = currentDay; isToday = true; statusText = "Aujourd'hui"; timeText = `Débute à ${state.weekSchedule[currentDay].start}`; } 
        else if (currentMins >= sMins && currentMins < eMins) {
            displayDay = currentDay; isToday = true; statusText = "En cours"; timeText = `Finit à ${state.weekSchedule[currentDay].end}`;
            let percent = Math.round(((currentMins - sMins) / (eMins - sMins)) * 100);
            progressHTML = `<div class="progress-bar-linear" style="height: 6px; margin-top: 12px;"><div class="progress-fill" style="width: ${percent}%;"></div></div>`;
        }
    }
    if (displayDay === null) {
        for (let i = 1; i <= 7; i++) {
            let nextDayCheck = (currentDay + i) % 7;
            if (state.weekSchedule[nextDayCheck]) {
                displayDay = nextDayCheck; statusText = i === 1 ? "Demain" : `Prochain : ${dayNamesFr[nextDayCheck]}`;
                timeText = `De ${state.weekSchedule[nextDayCheck].start} à ${state.weekSchedule[nextDayCheck].end}`; break;
            }
        }
    }

    const homeCard = document.getElementById('home-schedule-status'); const schoolPage = document.getElementById('full-schedule-display');
    if (displayDay !== null) {
        homeCard.innerHTML = `<p style="font-weight:600; color:${isToday && statusText === 'En cours' ? 'var(--accent-blue)' : '#FFF'};">${statusText}</p><p class="subtitle">${timeText}</p>`;
        schoolPage.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><h3 style="margin-bottom:4px; font-size:1.5rem;">${statusText}</h3><p class="subtitle" style="font-size:1rem;">${timeText}</p></div><div class="card-icon ${isToday && statusText === 'En cours' ? 'blue-icon' : ''}" style="width:48px; height:48px;"><i data-lucide="clock" style="width:24px; height:24px;"></i></div></div>${progressHTML}`;
    } else {
        homeCard.innerHTML = `<p class="subtitle">Aucun horaire.</p>`; schoolPage.innerHTML = `<p class="subtitle text-center">Aucun horaire de configuré pour la semaine.</p>`;
    }
}

// ================= ROUTINES SPORTIVES ================= */
const baseExercises = ["Pompes", "Crunchs", "Dips", "Squats", "Gainage (sec)"];
function generateDailyWorkout() {
    let tempExercises = [...baseExercises], routine = [];
    for (let i = 0; i < 3; i++) {
        let ex = tempExercises.splice(Math.floor(Math.random() * tempExercises.length), 1)[0];
        routine.push({ name: ex, target: ex.includes("sec") ? 45 : 15, done: false });
    }
    state.workoutGenerated = routine; state.currentMission = `${routine[0].target} ${routine[0].name}`; saveState(); renderAll();
}
function renderWorkout() {
    const list = document.getElementById('workout-list'); list.innerHTML = "";
    if (!state.workoutGenerated) return;
    state.workoutGenerated.forEach((ex, index) => {
        const card = document.createElement('div'); card.className = "glass-card item-card"; if(ex.done) card.style.opacity = "0.5";
        card.innerHTML = `<div class="item-info"><h4 style="${ex.done ? 'text-decoration: line-through;' : ''}">${ex.name}</h4><p class="subtitle">Objectif : ${ex.target}</p></div><div class="item-actions">${!ex.done ? `<button class="btn-icon interactive-btn" style="background:var(--glass-border);" onclick="completeWorkoutExercise(${index})"><i data-lucide="check"></i></button>` : '<i data-lucide="check" style="color:var(--success-green)"></i>'}</div>`;
        list.appendChild(card);
    });
}
function completeWorkoutExercise(index) { state.workoutGenerated[index].done = true; saveState(); renderAll(); }

// ================= GESTION DES OBJECTIFS & FAVORIS ================= */
function togglePriceField(checked) { document.getElementById('price-fields').style.display = checked ? 'flex' : 'none'; }
function saveGoal(e) {
    e.preventDefault();
    state.goals.push({
        title: document.getElementById('goal-title').value, desc: document.getElementById('goal-desc').value,
        date: document.getElementById('goal-date').value, creationDate: getTodayString(),
        hasPrice: document.getElementById('goal-has-price').checked,
        currentMoney: parseFloat(document.getElementById('goal-current-money').value) || 0,
        targetMoney: parseFloat(document.getElementById('goal-target-money').value) || 0,
        isFavorite: state.goals.length === 0 
    });
    saveState(); closeModal('goal-modal'); document.getElementById('goal-form').reset(); togglePriceField(false); renderAll();
}
function calculateGoalTimePercent(goal) {
    if (!goal.date) return 0;
    const start = new Date(goal.creationDate || goal.date).getTime(), end = new Date(goal.date).setHours(0,0,0,0), now = new Date().getTime();
    if (start === end) return 0;
    return (now >= end) ? 100 : (now > start ? Math.round(((now - start) / (end - start)) * 100) : 0);
}
function calculateDaysRemaining(targetDate) {
    if (!targetDate) return 0;
    const diffTime = new Date(targetDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}
function toggleFavoriteGoal(index) {
    const wasFav = state.goals[index].isFavorite;
    state.goals.forEach(g => g.isFavorite = false); 
    if (!wasFav) state.goals[index].isFavorite = true;
    saveState(); renderAll();
}

function renderGoals() {
    const list = document.getElementById('goals-list'); list.innerHTML = "";
    if(state.goals.length === 0) return;

    state.goals.forEach((goal, index) => {
        let priceHTML = "", timeHTML = "", daysBadge = "", daysRemaining = 0;
        if (goal.date) {
            daysRemaining = calculateDaysRemaining(goal.date);
            daysBadge = `<p class="subtitle" style="font-size:0.85rem; font-weight:600; color:var(--warning-orange); margin-bottom: 8px;">⏳ Plus que ${daysRemaining} jours</p>`;
            const timePercent = calculateGoalTimePercent(goal);
            timeHTML = `<div class="progress-bar-linear" style="height: 4px; margin-top: 4px;"><div class="progress-fill" style="width: ${timePercent}%; background: ${timePercent > 80 ? 'var(--warning-orange)' : 'var(--accent-blue)'};"></div></div>`;
        }
        if (goal.hasPrice && goal.targetMoney > 0) {
            let moneyPercent = Math.min(Math.round((goal.currentMoney / goal.targetMoney) * 100), 100);
            let barColor = moneyPercent >= 80 ? "var(--success-green)" : "var(--accent-blue)";
            let coachingText = goal.currentMoney >= goal.targetMoney ? "Financement complété ! 🎉" : (goal.date ? `Mets de côté ${((goal.targetMoney - goal.currentMoney) / Math.max(1, Math.ceil(daysRemaining / 7))).toFixed(2)}€ / sem.` : "");
            priceHTML = `<p class="subtitle" style="margin-top: 12px;">Cagnotte : ${goal.currentMoney}€ / ${goal.targetMoney}€</p><div class="progress-bar-linear"><div class="progress-fill" style="width: ${moneyPercent}%; background: ${barColor};"></div></div>${coachingText ? `<p class="subtitle" style="font-size:0.8rem; margin-top:4px; color:#A1A1AA;">${coachingText}</p>` : ''}`;
        }

        const card = document.createElement('div'); card.className = "glass-card";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex: 1; padding-right: 10px;">
                    <h4 style="display:flex; align-items:center; gap:6px;">
                        ${goal.title}
                        ${goal.isFavorite ? '<i data-lucide="heart" style="width:16px;height:16px;fill:var(--error-red);color:var(--error-red);"></i>' : ''}
                    </h4>
                    <p class="subtitle" style="margin-bottom:8px;">${goal.desc || ''}</p>${daysBadge}
                </div>
                <div class="item-actions">
                    <button class="btn-icon interactive-btn ${goal.isFavorite ? 'favorite' : ''}" onclick="toggleFavoriteGoal(${index})"><i data-lucide="heart"></i></button>
                    ${goal.hasPrice ? `<button class="btn-icon interactive-btn" onclick="openGoalPrompt(${index})"><i data-lucide="plus"></i></button>` : ''}
                    <button class="btn-icon danger interactive-btn" onclick="triggerDelete('goal', ${index})"><i data-lucide="trash"></i></button>
                </div>
            </div>${timeHTML}${priceHTML}`;
        list.appendChild(card);
    });
}

function updateHomeGoalSummary() {
    const summary = document.getElementById('home-goal-summary');
    if (state.goals.length > 0) {
        let topGoal = state.goals.find(g => g.isFavorite);
        if (!topGoal) topGoal = state.goals[0];

        const timePercent = calculateGoalTimePercent(topGoal);
        let daysRemaining = calculateDaysRemaining(topGoal.date);
        let proactiveMessage = `Plus que ${daysRemaining} jours pour ${topGoal.title}.`;
        
        if (topGoal.hasPrice && topGoal.targetMoney > topGoal.currentMoney && daysRemaining > 0) {
            proactiveMessage = `Plus que ${daysRemaining} jours pour ${topGoal.title}. Mets de côté ${((topGoal.targetMoney - topGoal.currentMoney) / Math.max(1, Math.ceil(daysRemaining / 7))).toFixed(2)}€/semaine ! 🦾`;
        } else if (topGoal.hasPrice && topGoal.currentMoney >= topGoal.targetMoney) { proactiveMessage = `Objectif atteint pour ${topGoal.title} ! 🎉`; } 
        else if (!topGoal.date) { proactiveMessage = `${topGoal.title}`; }

        summary.innerHTML = `<p style="font-weight:600; color:#FFF; font-size:1rem; line-height:1.4;">${topGoal.isFavorite ? '<i data-lucide="heart" style="width:14px; height:14px; fill:var(--error-red); color:var(--error-red); display:inline-block; vertical-align:middle; margin-right:4px;"></i>' : ''} ${proactiveMessage}</p>
            ${topGoal.date ? `<div class="progress-bar-linear" style="height: 6px; margin-top: 12px;"><div class="progress-fill" style="width: ${timePercent}%; background: var(--accent-purple);"></div></div>` : ''}`;
    } else { summary.innerHTML = `<p class="subtitle">Aucun objectif fixé.</p>`; }
}
function openGoalPrompt(index) {
    showCustomPrompt("Montant épargné", "Combien as-tu mis de côté ? (€)", (val) => {
        let amt = parseFloat(val); if(!isNaN(amt) && amt > 0) { state.goals[index].currentMoney += amt; saveState(); renderAll(); }
    });
}

// ================= GESTION QR CODES ================= */
function handleQRImageUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const MAX_WIDTH = 500; const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('qr-base64-data').value = dataUrl;
            document.getElementById('qr-preview-img').src = dataUrl; document.getElementById('qr-preview-img').style.display = 'block';
            document.getElementById('qr-submit-btn').disabled = false;
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}
function saveQRCode(e) {
    e.preventDefault(); const image = document.getElementById('qr-base64-data').value;
    if (image) {
        state.qrcodes.push({ name: document.getElementById('qr-name').value, image });
        saveState(); closeModal('qr-modal'); document.getElementById('qr-form').reset();
        document.getElementById('qr-preview-img').style.display = 'none'; document.getElementById('qr-submit-btn').disabled = true; renderAll();
    }
}
function renderQRCodes() {
    const list = document.getElementById('qrcodes-list'); list.innerHTML = "";
    if(state.qrcodes.length === 0) return;
    state.qrcodes.forEach((qr, index) => {
        const card = document.createElement('div'); card.className = "qr-card"; card.onclick = () => openFullscreenQR(qr.image);
        card.innerHTML = `<div><img src="${qr.image}" alt="${qr.name}"><h4>${qr.name}</h4></div><button class="qr-del-btn" onclick="event.stopPropagation(); triggerDelete('qr', ${index})">Supprimer</button>`;
        list.appendChild(card);
    });
}
function openFullscreenQR(imageSrc) { document.getElementById('qr-fullscreen-img').src = imageSrc; openModal('qr-fullscreen-modal'); }

// ================= SUPPRESSION UNIFIEE ================= */
function triggerDelete(type, index) {
    pendingDelete = { type, index };
    document.getElementById('confirm-modal-title').innerText = type === 'goal' ? "Supprimer l'objectif ?" : "Supprimer ce code ?";
    document.getElementById('confirm-modal-desc').innerText = type === 'goal' ? "Cet objectif sera supprimé définitivement." : "Ce QR Code sera effacé de l'application.";
    openModal('confirm-modal');
}
document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (pendingDelete.type === 'goal') state.goals.splice(pendingDelete.index, 1);
    else if (pendingDelete.type === 'qr') state.qrcodes.splice(pendingDelete.index, 1);
    saveState(); renderAll(); closeModal('confirm-modal'); pendingDelete = { type: null, index: null };
});

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
