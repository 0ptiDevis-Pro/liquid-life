// ================= DATA STATE ================= */
let state = {
    streak: parseInt(localStorage.getItem('ll_streak')) || 0,
    lastMissionDate: localStorage.getItem('ll_lastMissionDate') || "", // Format YYYY-MM-DD
    currentMission: localStorage.getItem('ll_currentMission') || "15 pompes",
    courses: JSON.parse(localStorage.getItem('ll_courses')) || [],
    workoutGenerated: JSON.parse(localStorage.getItem('ll_workout')) || null,
    goals: JSON.parse(localStorage.getItem('ll_goals')) || [],
    pdfData: localStorage.getItem('ll_pdfData') || null
};

let goalToDeleteIndex = null; // Stocke l'index pour la modale de suppression

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAppDay();
    loadPDF();
    renderAll();
    setInterval(updateSchoolStatus, 60000);
});

function saveState() {
    localStorage.setItem('ll_streak', state.streak);
    localStorage.setItem('ll_lastMissionDate', state.lastMissionDate);
    localStorage.setItem('ll_currentMission', state.currentMission);
    localStorage.setItem('ll_courses', JSON.stringify(state.courses));
    localStorage.setItem('ll_workout', JSON.stringify(state.workoutGenerated));
    localStorage.setItem('ll_goals', JSON.stringify(state.goals));
}

// ================= STREAK LOGIC (Strict & Infaillible) ================= */
function getTodayString() {
    // Renvoie la date locale au format YYYY-MM-DD
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function checkAppDay() {
    // Rotation quotidienne de la citation (Optionnel)
    const today = getTodayString();
    if (localStorage.getItem('ll_currentDay') !== today) {
        localStorage.setItem('ll_currentDay', today);
    }
}

function completeDailyMission() {
    const today = getTodayString();
    
    // Si la mission a déjà été faite aujourd'hui, on bloque.
    if (state.lastMissionDate === today) {
        return;
    }

    if (state.lastMissionDate) {
        // Calculer la différence en jours
        const lastDate = new Date(state.lastMissionDate);
        const nowDate = new Date(today);
        const diffTime = Math.abs(nowDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays === 1) {
            // Jour consécutif
            state.streak += 1;
        } else {
            // Série brisée
            state.streak = 1;
        }
    } else {
        // Première fois
        state.streak = 1;
    }

    state.lastMissionDate = today;
    saveState();
    renderAll();
}

// ================= GESTION DES ONGLETS ================= */
function switchTab(tabId) {
    document.querySelectorAll('.app-page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    renderAll();
}

// ================= RENDU GLOBAL ================= */
function renderAll() {
    const today = getTodayString();
    const isMissionDone = (state.lastMissionDate === today);

    document.getElementById('streak-count').innerText = state.streak;
    
    // Accueil - Mission Sport
    const missionBtn = document.getElementById('btn-complete-mission');
    document.getElementById('home-mission-text').innerText = state.currentMission;
    
    if (isMissionDone) {
        missionBtn.innerText = "Validé ! ✨";
        missionBtn.style.background = "#22C55E";
        missionBtn.style.color = "white";
        missionBtn.disabled = true;
        document.getElementById('day-progress-fill').style.width = "100%";
        document.getElementById('day-progress-fill').classList.add('sport-fill');
        document.getElementById('day-progress-text').innerText = "100% complété";
    } else {
        missionBtn.innerText = "Mission terminée";
        missionBtn.style.background = "rgba(255,255,255,0.2)";
        missionBtn.disabled = false;
        document.getElementById('day-progress-fill').style.width = "0%";
        document.getElementById('day-progress-text').innerText = "0% complété";
    }

    updateHomeGoalSummary();
    updateSchoolStatus();
    renderCoursesList();
    renderWorkout();
    renderGoals();
    lucide.createIcons();
}

// ================= SCOLAIRE (Couleurs Matières + PDF) ================= */
const subjectColors = {
    "maths": "#2F7CFF", "mathématiques": "#2F7CFF",
    "français": "#8B5CF6", "francais": "#8B5CF6",
    "histoire": "#F59E0B", "geo": "#F59E0B", "histoire-géo": "#F59E0B",
    "svt": "#22C55E", "biologie": "#22C55E",
    "physique": "#06B6D4", "chimie": "#06B6D4",
    "anglais": "#EC4899", "espagnol": "#EC4899", "langues": "#EC4899"
};

function getSubjectColor(subject) {
    const key = subject.toLowerCase().trim();
    return subjectColors[key] || "#B4B4B4"; // Gris par défaut
}

function importPDF(input) {
    const file = input.files[0];
    if (file && file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const base64 = e.target.result;
                localStorage.setItem('ll_pdfData', base64);
                state.pdfData = base64;
                loadPDF();
            } catch (err) {
                alert("Le fichier PDF est trop lourd pour être sauvegardé localement. Utilise un fichier plus compressé.");
            }
        };
        reader.readAsDataURL(file);
    }
}

function loadPDF() {
    const container = document.getElementById('pdf-container');
    const viewer = document.getElementById('pdf-viewer');
    if (state.pdfData) {
        viewer.src = state.pdfData;
        container.style.display = "block";
    }
}

function updateSchoolStatus() {
    if (state.courses.length === 0) {
        document.getElementById('home-schedule-status').innerHTML = "<p class='subtitle'>Aucun cours enregistré.</p>";
        document.getElementById('school-timer').innerText = "Agenda vide";
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    state.courses.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    let currentCourse = null;
    let nextCourse = null;

    for (let course of state.courses) {
        let start = timeToMinutes(course.start);
        let end = timeToMinutes(course.end);
        if (currentMinutes >= start && currentMinutes < end) currentCourse = course;
        else if (currentMinutes < start && !nextCourse) nextCourse = course;
    }

    let homeHTML = "";
    if (currentCourse) {
        let color = getSubjectColor(currentCourse.subject);
        homeHTML = `<p><strong style="color:${color}">En cours : ${currentCourse.subject}</strong></p><p class="subtitle">Finit dans ${timeToMinutes(currentCourse.end) - currentMinutes} min</p>`;
    } else if (nextCourse) {
        homeHTML = `<p>Prochain : ${nextCourse.subject}</p><p class="subtitle">À ${nextCourse.start}</p>`;
    } else {
        homeHTML = `<p>🎉 Journée terminée !</p>`;
    }
    document.getElementById('home-schedule-status').innerHTML = homeHTML;
}

function renderCoursesList() {
    const list = document.getElementById('courses-list');
    list.innerHTML = "";
    
    if(state.courses.length === 0) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    state.courses.forEach((course, index) => {
        let start = timeToMinutes(course.start);
        let end = timeToMinutes(course.end);
        let statusClass = (currentMinutes >= start && currentMinutes < end) ? "current" : "";
        let dotColor = getSubjectColor(course.subject);
        
        const card = document.createElement('div');
        card.className = `glass-card item-card course-card ${statusClass}`;
        card.innerHTML = `
            <div class="item-info" style="display:flex; align-items:center; gap: 10px;">
                <div style="width:12px; height:12px; border-radius:50%; background:${dotColor};"></div>
                <div>
                    <h4>${course.subject}</h4>
                    <p>${course.start} - ${course.end} ${course.room ? '| ' + course.room : ''}</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon danger interactive-btn" onclick="deleteCourse(${index})"><i data-lucide="trash"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

function saveCourse(e) {
    e.preventDefault();
    const subject = document.getElementById('course-subject').value;
    const start = document.getElementById('course-start').value;
    const end = document.getElementById('course-end').value;
    const room = document.getElementById('course-room').value;

    state.courses.push({ subject, start, end, room });
    saveState(); closeModal('course-modal'); document.getElementById('course-form').reset(); renderAll();
}

function deleteCourse(index) {
    state.courses.splice(index, 1);
    saveState(); renderAll();
}

function timeToMinutes(timeString) {
    const [h, m] = timeString.split(':').map(Number);
    return h * 60 + m;
}

// ================= SPORT ================= */
const baseExercises = ["Pompes", "Crunchs", "Dips", "Squats", "Gainage (sec)"];
function generateDailyWorkout() {
    let routine = [];
    let tempExercises = [...baseExercises];
    for (let i = 0; i < 3; i++) {
        let ex = tempExercises.splice(Math.floor(Math.random() * tempExercises.length), 1)[0];
        routine.push({ name: ex, target: ex.includes("sec") ? 45 : 15, done: false });
    }
    state.workoutGenerated = routine;
    state.currentMission = `${routine[0].target} ${routine[0].name}`;
    saveState(); renderAll();
}

function renderWorkout() {
    const list = document.getElementById('workout-list');
    list.innerHTML = "";
    if (!state.workoutGenerated) return;

    state.workoutGenerated.forEach((ex, index) => {
        const card = document.createElement('div');
        card.className = "glass-card item-card";
        if(ex.done) card.style.opacity = "0.5";
        
        card.innerHTML = `
            <div class="item-info">
                <h4 style="${ex.done ? 'text-decoration: line-through;' : ''}">${ex.name}</h4>
                <p>Objectif : ${ex.target}</p>
            </div>
            <div class="item-actions">
                ${!ex.done ? `<button class="btn-icon success interactive-btn" onclick="completeWorkoutExercise(${index})"><i data-lucide="check"></i></button>` : '<i data-lucide="check" style="color:#22C55E"></i>'}
            </div>
        `;
        list.appendChild(card);
    });
}
function completeWorkoutExercise(index) {
    state.workoutGenerated[index].done = true;
    saveState(); renderAll();
}

// ================= OBJECTIFS ================= */
function togglePriceField(checked) {
    document.getElementById('price-fields').style.display = checked ? 'flex' : 'none';
}

function saveGoal(e) {
    e.preventDefault();
    const title = document.getElementById('goal-title').value;
    const desc = document.getElementById('goal-desc').value;
    const date = document.getElementById('goal-date').value;
    const creationDate = getTodayString();
    const hasPrice = document.getElementById('goal-has-price').checked;
    
    let currentMoney = parseFloat(document.getElementById('goal-current-money').value) || 0;
    let targetMoney = parseFloat(document.getElementById('goal-target-money').value) || 0;

    state.goals.push({ title, desc, date, creationDate, hasPrice, currentMoney, targetMoney });
    saveState(); closeModal('goal-modal'); document.getElementById('goal-form').reset(); togglePriceField(false); renderAll();
}

function renderGoals() {
    const list = document.getElementById('goals-list');
    list.innerHTML = "";
    if(state.goals.length === 0) return;

    state.goals.forEach((goal, index) => {
        let moneyPercent = 0; let priceHTML = ""; let timeHTML = "";
        let barColor = "var(--accent-blue)";

        if (goal.hasPrice && goal.targetMoney > 0) {
            moneyPercent = Math.min(Math.round((goal.currentMoney / goal.targetMoney) * 100), 100);
            if (moneyPercent >= 80) barColor = "var(--success-green)"; // Presque atteint
            
            priceHTML = `
                <p class="subtitle" style="margin-top: 8px;">Cagnotte : ${goal.currentMoney}€ / ${goal.targetMoney}€</p>
                <div class="progress-bar-linear"><div class="progress-fill" style="width: ${moneyPercent}%; background: ${barColor};"></div></div>
            `;
        }

        if (goal.date) {
            const start = new Date(goal.creationDate || goal.date).getTime();
            const end = new Date(goal.date).getTime();
            const now = new Date().getTime();
            let timePercent = (now >= end) ? 100 : (now > start ? Math.round(((now - start) / (end - start)) * 100) : 0);
            
            let timeColor = "var(--accent-blue)";
            if (timePercent > 80) timeColor = "var(--warning-orange)"; // Urgent

            timeHTML = `
                <p class="subtitle" style="font-size:0.75rem; margin-top:8px;"><i data-lucide="clock" style="width:10px;height:10px;display:inline;"></i> Cible : ${goal.date}</p>
                <div class="progress-bar-linear" style="height: 4px; margin-top: 4px;"><div class="progress-fill" style="width: ${timePercent}%; background: ${timeColor};"></div></div>
            `;
        }

        const card = document.createElement('div');
        card.className = "glass-card";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex: 1; padding-right: 10px;">
                    <h4>${goal.title}</h4><p class="subtitle">${goal.desc || ''}</p>
                </div>
                <div class="item-actions">
                    ${goal.hasPrice ? `<button class="btn-icon interactive-btn" onclick="addMoneyToGoal(${index})"><i data-lucide="plus"></i></button>` : ''}
                    <button class="btn-icon danger interactive-btn" onclick="triggerDeleteGoal(${index})"><i data-lucide="trash"></i></button>
                </div>
            </div>
            ${timeHTML}
            ${priceHTML}
        `;
        list.appendChild(card);
    });
}

function updateHomeGoalSummary() {
    const summary = document.getElementById('home-goal-summary');
    if (state.goals.length > 0) {
        const topGoal = state.goals[0];
        summary.innerHTML = `<p style="font-weight:600; color:var(--accent-purple);">${topGoal.title}</p><p class="subtitle" style="font-size:0.8rem;">Cible: ${topGoal.date || 'Non définie'}</p>`;
    } else {
        summary.innerHTML = `<p class="subtitle">Aucun objectif fixé.</p>`;
    }
}

function addMoneyToGoal(index) {
    let amt = prompt("Combien d'argent as-tu économisé ? (€)");
    if(amt && !isNaN(amt)) {
        state.goals[index].currentMoney += parseFloat(amt);
        saveState(); renderAll();
    }
}

// Fonction pour déclencher la modale de suppression
function triggerDeleteGoal(index) {
    goalToDeleteIndex = index;
    openModal('confirm-modal');
}

// Bouton de confirmation dans la modale
document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (goalToDeleteIndex !== null) {
        state.goals.splice(goalToDeleteIndex, 1);
        saveState();
        renderAll();
        closeModal('confirm-modal');
        goalToDeleteIndex = null;
    }
});

// ================= MODALS ================= */
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
