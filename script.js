// ================= DATA MANAGEMENT (LOCALSTORAGE) ================= */
let state = {
    streak: parseInt(localStorage.getItem('ll_streak')) || 0,
    lastActiveDay: localStorage.getItem('ll_lastDay') || "", // Le dernier jour où une mission a été validée
    dailyMissionCompleted: localStorage.getItem('ll_missionCompleted') === 'true',
    currentMission: localStorage.getItem('ll_currentMission') || "15 pompes",
    courses: JSON.parse(localStorage.getItem('ll_courses')) || [],
    workoutGenerated: JSON.parse(localStorage.getItem('ll_workout')) || null,
    goals: JSON.parse(localStorage.getItem('ll_goals')) || []
};

const quotes = [
    "Une supercar ne s'achète pas avec des rêves, mais avec une discipline de fer.",
    "Chaque répétition aujourd'hui est un billet vers la liberté financière de demain.",
    "La richesse commence par la maîtrise de soi. Continue ta quête.",
    "Tes habitudes actuelles construisent ton garage de rêve. Reste focus.",
    "Le succès n'est pas un accident, c'est le résultat d'une routine implacable."
];

// Instanciation initiale des icônes Lucide
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAppDay();
    renderAll();
    
    // Rafraîchir l'horloge scolaire toutes les minutes
    setInterval(updateSchoolStatus, 60000);
});

function saveState() {
    localStorage.setItem('ll_streak', state.streak);
    localStorage.setItem('ll_lastDay', state.lastActiveDay);
    localStorage.setItem('ll_missionCompleted', state.dailyMissionCompleted);
    localStorage.setItem('ll_currentMission', state.currentMission);
    localStorage.setItem('ll_courses', JSON.stringify(state.courses));
    localStorage.setItem('ll_workout', JSON.stringify(state.workoutGenerated));
    localStorage.setItem('ll_goals', JSON.stringify(state.goals));
}

// ================= SYSTÈME DE STREAKS ET VÉRIFICATION DU JOUR ================= */
function checkAppDay() {
    const today = new Date().toDateString();
    const storedDay = localStorage.getItem('ll_currentDay') || "";
    
    // Si c'est un nouveau jour pour l'application
    if (storedDay !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // On vérifie si la mission a été complétée hier ou aujourd'hui. 
        // Si non, on casse la série.
        if (state.lastActiveDay !== yesterday.toDateString() && state.lastActiveDay !== today) {
            state.streak = 0;
        }
        
        // Réinitialiser la mission quotidienne
        state.dailyMissionCompleted = false;
        localStorage.setItem('ll_currentDay', today);
        
        // Changer de citation
        document.getElementById('motivation-quote').innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
        saveState();
    }
}

function completeDailyMission() {
    if (state.dailyMissionCompleted) return; // Empêche de valider 2 fois le même jour
    
    const today = new Date().toDateString();
    state.dailyMissionCompleted = true;
    state.lastActiveDay = today;
    state.streak += 1; // Incrémente de +1 seulement
    
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

// ================= AFFICHAGE DES ÉLÉMENTS ================= */
function renderAll() {
    document.getElementById('streak-count').innerText = state.streak;
    
    // Accueil - Mission Sportive
    const missionBtn = document.getElementById('btn-complete-mission');
    document.getElementById('home-mission-text').innerText = state.currentMission;
    
    if (state.dailyMissionCompleted) {
        missionBtn.innerText = "Validé ! 🌟";
        missionBtn.style.background = "var(--success-gradient)";
        missionBtn.disabled = true;
    } else {
        missionBtn.innerText = "Mission terminée ✨";
        missionBtn.style.background = "var(--accent-gradient)";
        missionBtn.disabled = false;
    }

    // Progression globale du jour (mission sportive)
    let completedTasks = state.dailyMissionCompleted ? 1 : 0;
    const progressPercent = Math.round((completedTasks / 1) * 100);
    document.getElementById('day-progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('day-progress-text').innerText = `${progressPercent}% complété`;

    updateSchoolStatus();
    renderCoursesList();
    renderWorkout();
    renderGoals();
    lucide.createIcons();
}

// ================= VOLET SCOLAIRE ================= */
function updateSchoolStatus() {
    if (state.courses.length === 0) {
        document.getElementById('home-schedule-status').innerHTML = "<p class='subtitle'>Aucun cours enregistré.</p>";
        document.getElementById('school-timer').innerText = "Aucun cours aujourd'hui.";
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Trier les cours chronologiquement
    state.courses.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    let currentCourse = null;
    let nextCourse = null;

    for (let course of state.courses) {
        let start = timeToMinutes(course.start);
        let end = timeToMinutes(course.end);

        if (currentMinutes >= start && currentMinutes < end) {
            currentCourse = course;
        } else if (currentMinutes < start && !nextCourse) {
            nextCourse = course;
        }
    }

    // Affichage Accueil Rapide
    let homeHTML = "";
    if (currentCourse) {
        let timeLeft = timeToMinutes(currentCourse.end) - currentMinutes;
        homeHTML = `<p><strong>En cours : ${currentCourse.subject}</strong></p><p class="subtitle">Finit dans ${timeLeft} min (salle ${currentCourse.room || '-'})</p>`;
    } else if (nextCourse) {
        let timeBefore = timeToMinutes(nextCourse.start) - currentMinutes;
        homeHTML = `<p>Prochain cours : ${nextCourse.subject}</p><p class="subtitle">Dans ${timeBefore} min</p>`;
    } else {
        homeHTML = `<p>🎉 Journée terminée !</p>`;
    }
    document.getElementById('home-schedule-status').innerHTML = homeHTML;

    // Affichage En-tête Page Scolaire
    if (currentCourse) {
        let timeLeft = timeToMinutes(currentCourse.end) - currentMinutes;
        document.getElementById('school-timer').innerText = `Cours actuel : ${currentCourse.subject} (finit dans ${timeLeft} min)`;
    } else if (nextCourse) {
        document.getElementById('school-timer').innerText = `Prochain cours à ${nextCourse.start} (${nextCourse.subject})`;
    } else {
        document.getElementById('school-timer').innerText = "Fin des cours passée.";
    }
}

function renderCoursesList() {
    const list = document.getElementById('courses-list');
    list.innerHTML = "";
    
    if(state.courses.length === 0) {
        list.innerHTML = "<p class='subtitle' style='text-align:center;'>Clique sur '+' ou importe ton fichier .ics</p>";
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    state.courses.forEach((course, index) => {
        let start = timeToMinutes(course.start);
        let end = timeToMinutes(course.end);
        let statusClass = "";

        if (currentMinutes >= start && currentMinutes < end) statusClass = "current";
        
        const card = document.createElement('div');
        card.className = `glass-card item-card course-card ${statusClass}`;
        card.innerHTML = `
            <div class="item-info">
                <h4>${course.subject}</h4>
                <p><i data-lucide="clock" style="width:12px;height:12px;display:inline;"></i> ${course.start} - ${course.end} ${course.room ? ' | Salle ' + course.room : ''}</p>
            </div>
            <div class="item-actions">
                <button class="btn-icon danger" onclick="deleteCourse(${index})"><i data-lucide="trash"></i></button>
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
    saveState();
    closeModal('course-modal');
    document.getElementById('course-form').reset();
    renderAll();
}

function deleteCourse(index) {
    state.courses.splice(index, 1);
    saveState();
    renderAll();
}

function timeToMinutes(timeString) {
    const [h, m] = timeString.split(':').map(Number);
    return h * 60 + m;
}

// Fonction préparée pour l'import ICS
function importEDT(input) {
    const file = input.files[0];
    if (file) {
        // Dans le futur, ajouter la librairie ical.js pour extraire les données ici
        console.log("Fichier importé :", file.name);
        alert("Fichier " + file.name + " détecté !\n(Note : L'intégration automatique des données .ics nécessitera une librairie externe comme ical.js pour fonctionner complètement).");
    }
}

// ================= VOLET SPORT ================= */
const baseExercises = ["Pompes", "Crunchs", "Dips", "Squats", "Gainage (sec)", "Élastiques haut du corps"];

function generateDailyWorkout() {
    let routine = [];
    let tempExercises = [...baseExercises];
    
    for (let i = 0; i < 3; i++) {
        let randIdx = Math.floor(Math.random() * tempExercises.length);
        let ex = tempExercises.splice(randIdx, 1)[0];
        let reps = ex.includes("sec") ? 45 : 15;
        routine.push({ name: ex, target: reps, done: false });
    }
    
    state.workoutGenerated = routine;
    state.currentMission = `${routine[0].target} ${routine[0].name}`;
    state.dailyMissionCompleted = false;
    
    saveState();
    renderAll();
}

function renderWorkout() {
    const list = document.getElementById('workout-list');
    list.innerHTML = "";

    if (!state.workoutGenerated) {
        list.innerHTML = "<p class='subtitle' style='text-align:center;'>Génère ta quête du jour pour commencer !</p>";
        return;
    }

    state.workoutGenerated.forEach((ex, index) => {
        const card = document.createElement('div');
        card.className = "glass-card item-card";
        if(ex.done) card.style.opacity = "0.6";
        
        card.innerHTML = `
            <div class="item-info">
                <h4 style="${ex.done ? 'text-decoration: line-through;' : ''}">${ex.name}</h4>
                <p>Objectif : ${ex.target}</p>
            </div>
            <div class="item-actions">
                ${!ex.done ? `<button class="btn-icon success" onclick="completeWorkoutExercise(${index})"><i data-lucide="check"></i></button>` : '<span>✓</span>'}
            </div>
        `;
        list.appendChild(card);
    });
}

function completeWorkoutExercise(index) {
    state.workoutGenerated[index].done = true;
    saveState();
    renderAll();
}

// ================= VOLET OBJECTIFS ================= */
function togglePriceField(checked) {
    document.getElementById('price-fields').style.display = checked ? 'flex' : 'none';
}

function saveGoal(e) {
    e.preventDefault();
    const title = document.getElementById('goal-title').value;
    const desc = document.getElementById('goal-desc').value;
    const date = document.getElementById('goal-date').value;
    const hasPrice = document.getElementById('goal-has-price').checked;
    
    let currentMoney = parseFloat(document.getElementById('goal-current-money').value) || 0;
    let targetMoney = parseFloat(document.getElementById('goal-target-money').value) || 0;

    state.goals.push({ title, desc, date, hasPrice, currentMoney, targetMoney, progress: 0 });
    saveState();
    closeModal('goal-modal');
    document.getElementById('goal-form').reset();
    togglePriceField(false);
    renderAll();
}

function renderGoals() {
    const list = document.getElementById('goals-list');
    list.innerHTML = "";

    if(state.goals.length === 0) {
        list.innerHTML = "<p class='subtitle' style='text-align:center;'>Ajoute des projets à long terme.</p>";
        return;
    }

    state.goals.forEach((goal, index) => {
        let percent = 0;
        let priceStatusHTML = "";

        if (goal.hasPrice && goal.targetMoney > 0) {
            percent = Math.min(Math.round((goal.currentMoney / goal.targetMoney) * 100), 100);
            priceStatusHTML = `<p class="subtitle">${goal.currentMoney}€ / ${goal.targetMoney}€ (${percent}%)</p>`;
        }

        const card = document.createElement('div');
        card.className = "glass-card";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h4 style="font-size:1.15rem; font-weight:700;">${goal.title}</h4>
                    <p class="subtitle" style="margin-bottom:6px;">${goal.desc || ''}</p>
                    ${goal.date ? `<p class="subtitle" style="font-size:0.75rem;"><i data-lucide="calendar" style="width:10px;height:10px;display:inline;"></i> Cible : ${goal.date}</p>` : ''}
                    ${priceStatusHTML}
                </div>
                <div class="item-actions">
                    ${goal.hasPrice ? `<button class="btn-icon" onclick="addMoneyToGoal(${index})"><i data-lucide="plus"></i></button>` : ''}
                    <button class="btn-icon danger" onclick="deleteGoal(${index})"><i data-lucide="trash"></i></button>
                </div>
            </div>
            ${goal.hasPrice ? `
                <div class="progress-bar-linear">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
            ` : ''}
        `;
        list.appendChild(card);
    });
}

function addMoneyToGoal(index) {
    let amt = prompt("Combien d'argent as-tu économisé pour cet objectif ? (€)");
    if(amt && !isNaN(amt)) {
        state.goals[index].currentMoney += parseFloat(amt);
        saveState();
        renderAll();
    }
}

function deleteGoal(index) {
    state.goals.splice(index, 1);
    saveState();
    renderAll();
}

// ================= FENÊTRES MODALES (OUVERTURE/FERMETURE) ================= */
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
