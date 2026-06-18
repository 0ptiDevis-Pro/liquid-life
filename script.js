// ================= ETAT DES DONNEES LOCALES ================= */
let state = {
    streak: parseInt(localStorage.getItem('ll_streak')) || 0,
    lastMissionDate: localStorage.getItem('ll_lastMissionDate') || "", 
    currentMission: localStorage.getItem('ll_currentMission') || "15 pompes",
    courses: JSON.parse(localStorage.getItem('ll_courses')) || [],
    workoutGenerated: JSON.parse(localStorage.getItem('ll_workout')) || null,
    goals: JSON.parse(localStorage.getItem('ll_goals')) || [],
    qrcodes: JSON.parse(localStorage.getItem('ll_qrcodes')) || []
};

// Variable globale pour la gestion dynamique des suppressions
let pendingDelete = { type: null, index: null }; 

// ================= ALGORITHME BANQUE DE CITATIONS (RESET MINUIT) ================= */
const quotes = [
    "Le succès n'est pas un accident, c'est le résultat d'une routine implacable.",
    "La discipline est le pont entre tes objectifs et tes accomplissements.",
    "N'arrête pas quand tu es fatigué, arrête quand tu as fini.",
    "Ceux qui réussissent font ce que les autres n'ont pas envie de faire.",
    "La douleur est temporaire, l'abandon est définitif.",
    "Sois régulier et structuré dans ta vie pour être puissant dans tes projets.",
    "Ton futur se construit sur ce que tu imposes à ta journée."
];

document.addEventListener('DOMContentLoaded', () => {
    if (window['pdfjs-dist/build/pdf']) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
    lucide.createIcons();
    checkAppDay();
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
    localStorage.setItem('ll_qrcodes', JSON.stringify(state.qrcodes));
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function checkAppDay() {
    const today = getTodayString();
    if (localStorage.getItem('ll_currentDay') !== today) {
        localStorage.setItem('ll_currentDay', today);
        // Sélectionne une citation aléatoire fixe pour toute la journée
        const randomQuoteIndex = Math.floor(Math.random() * quotes.length);
        localStorage.setItem('ll_quoteIndex', randomQuoteIndex);
    }
    const quoteIndex = localStorage.getItem('ll_quoteIndex') || 0;
    document.getElementById('motivation-quote').innerText = `"${quotes[quoteIndex]}"`;
}

// ================= STREAK CONSECUTIFS ================= */
function completeDailyMission() {
    const today = getTodayString();
    if (state.lastMissionDate === today) return;

    if (state.lastMissionDate) {
        const lastDate = new Date(state.lastMissionDate);
        const nowDate = new Date(today);
        const diffDays = Math.ceil(Math.abs(nowDate - lastDate) / (1000 * 60 * 60 * 24)); 
        if (diffDays === 1) state.streak += 1; else state.streak = 1;
    } else {
        state.streak = 1;
    }
    state.lastMissionDate = today;
    saveState(); renderAll();
}

function switchTab(tabId) {
    document.querySelectorAll('.app-page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    renderAll();
}

// ================= RENDU VISUEL UNIFIE ================= */
function renderAll() {
    const today = getTodayString();
    const isMissionDone = (state.lastMissionDate === today);

    document.getElementById('streak-count-big').innerText = state.streak;
    
    const missionBtn = document.getElementById('btn-complete-mission');
    document.getElementById('home-mission-text').innerText = state.currentMission;
    
    if (isMissionDone) {
        missionBtn.innerText = "Validé ! ✨";
        missionBtn.style.background = "var(--glass-border)";
        missionBtn.style.color = "var(--success-green)";
        missionBtn.disabled = true;
    } else {
        missionBtn.innerText = "Mission terminée";
        missionBtn.style.background = "var(--accent-blue)";
        missionBtn.style.color = "white";
        missionBtn.disabled = false;
    }

    updateHomeGoalSummary();
    updateSchoolStatus();
    renderCoursesList();
    renderWorkout();
    renderGoals();
    renderQRCodes();
    lucide.createIcons();
}

// ================= ALGORITHME D'EXTRACTION INTELLIGENT DE PDF ED ================= */
const subjectColors = {
    "maths": "#2F7CFF", "mathématiques": "#2F7CFF", "français": "#8B5CF6", "francais": "#8B5CF6",
    "histoire": "#F59E0B", "svt": "#22C55E", "physique": "#06B6D4", "anglais": "#EC4899", "espagnol": "#10B981"
};
function getSubjectColor(subject) { return subjectColors[subject.toLowerCase().trim()] || "#A1A1AA"; }

async function importAndParsePDF(input) {
    const file = input.files[0];
    if (!file || file.type !== "application/pdf") return;
    document.getElementById('pdf-loading-text').style.display = 'block';

    try {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let extractedTokens = [];

            // Étape 1 : Parcourir les chaînes brutes du document
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                textContent.items.forEach(item => {
                    if (item.str.trim()) extractedTokens.push(item.str.trim());
                });
            }
            
            // Étape 2 : Filtrer et structurer intelligemment selon ton PDF
            let newCourses = [];
            
            extractedTokens.forEach(token => {
                // Ignore les congés fermetures globaux
                if (token.toUpperCase().includes("CONGÉS") || token.toUpperCase().includes("CONGES")) return;
                
                // Repère la signature d'un cours (Exemple: "08:55 PARCOURS E" ou "10:40 FRANCAIS")
                let timeMatch = token.match(/^(\d{2}[:h]\d{2})(?:\s+(.+))?$/i);
                if (timeMatch) {
                    let startHour = timeMatch[1].replace('h', ':');
                    let rawSubject = timeMatch[2] ? timeMatch[2].trim() : "";
                    
                    if (rawSubject && rawSubject.length > 2) {
                        // Calcule l'heure de fin par défaut (+1h de cours standard)
                        let [h, m] = startHour.split(':').map(Number);
                        let endH = String((h + 1) % 24).padStart(2, '0');
                        let endHour = `${endH}:${String(m).padStart(2, '0')}`;
                        
                        newCourses.push({
                            subject: rawSubject,
                            start: startHour,
                            end: endHour,
                            room: ""
                        });
                    }
                }
            });

            if (newCourses.length > 0) {
                // Nettoie l'ancien planning pour le nouveau synchronisé
                state.courses = newCourses;
                saveState();
                alert(`🎯 Synchronisation réussie : ${newCourses.length} cours ont été configurés intelligemment !`);
            } else {
                alert("Format introuvable. Rentre les horaires manuellement via le bouton prévu.");
            }
            document.getElementById('pdf-loading-text').style.display = 'none';
            renderAll();
        };
        fileReader.readAsArrayBuffer(file);
    } catch (error) {
        alert("Erreur critique de traitement.");
        document.getElementById('pdf-loading-text').style.display = 'none';
    }
}

function updateSchoolStatus() {
    if (state.courses.length === 0) {
        document.getElementById('home-schedule-status').innerHTML = "<p class='subtitle'>Agenda vide</p>";
        document.getElementById('school-timer').innerText = "Rien de prévu";
        return;
    }
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    state.courses.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    let currentCourse = null; let nextCourse = null;
    for (let course of state.courses) {
        let start = timeToMinutes(course.start), end = timeToMinutes(course.end);
        if (currentMinutes >= start && currentMinutes < end) currentCourse = course;
        else if (currentMinutes < start && !nextCourse) nextCourse = course;
    }
    let homeHTML = "";
    if (currentCourse) {
        homeHTML = `<p><strong style="color:${getSubjectColor(currentCourse.subject)}">En cours : ${currentCourse.subject}</strong></p><p class="subtitle">Finit dans ${timeToMinutes(currentCourse.end) - currentMinutes} min</p>`;
    } else if (nextCourse) {
        homeHTML = `<p>Prochain : ${nextCourse.subject}</p><p class="subtitle">À ${nextCourse.start}</p>`;
    } else { homeHTML = `<p>🎉 Journée terminée !</p>`; }
    document.getElementById('home-schedule-status').innerHTML = homeHTML;
}

function renderCoursesList() {
    const list = document.getElementById('courses-list');
    list.innerHTML = "";
    if(state.courses.length === 0) return;

    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    state.courses.forEach((course, index) => {
        let statusClass = (currentMinutes >= timeToMinutes(course.start) && currentMinutes < timeToMinutes(course.end)) ? "current" : "";
        const card = document.createElement('div');
        card.className = `glass-card item-card course-card ${statusClass}`;
        card.innerHTML = `
            <div class="item-info" style="display:flex; align-items:center; gap: 10px;">
                <div style="width:12px; height:12px; border-radius:50%; background:${getSubjectColor(course.subject)};"></div>
                <div><h4>${course.subject}</h4><p class="subtitle">${course.start} - ${course.end}</p></div>
            </div>
            <div class="item-actions"><button class="btn-icon danger interactive-btn" onclick="deleteCourse(${index})"><i data-lucide="trash"></i></button></div>
        `;
        list.appendChild(card);
    });
}
function saveCourse(e) {
    e.preventDefault();
    state.courses.push({
        subject: document.getElementById('course-subject').value,
        start: document.getElementById('course-start').value,
        end: document.getElementById('course-end').value,
        room: document.getElementById('course-room').value
    });
    saveState(); closeModal('course-modal'); document.getElementById('course-form').reset(); renderAll();
}
function deleteCourse(index) { state.courses.splice(index, 1); saveState(); renderAll(); }
function timeToMinutes(timeString) { const [h, m] = timeString.split(':').map(Number); return h * 60 + m; }

// ================= CONFIGURATION ROUTINES SPORTIVES ================= */
const baseExercises = ["Pompes", "Crunchs", "Dips", "Squats", "Gainage (sec)"];
function generateDailyWorkout() {
    let tempExercises = [...baseExercises], routine = [];
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
            <div class="item-info"><h4 style="${ex.done ? 'text-decoration: line-through;' : ''}">${ex.name}</h4><p class="subtitle">Objectif : ${ex.target}</p></div>
            <div class="item-actions">
                ${!ex.done ? `<button class="btn-icon interactive-btn" style="background:var(--glass-border);" onclick="completeWorkoutExercise(${index})"><i data-lucide="check"></i></button>` : '<i data-lucide="check" style="color:var(--success-green)"></i>'}
            </div>
        `;
        list.appendChild(card);
    });
}
function completeWorkoutExercise(index) { state.workoutGenerated[index].done = true; saveState(); renderAll(); }

// ================= GESTION DES OBJECTIFS & CRÉATION PROGRESSION DATE ================= */
function togglePriceField(checked) { document.getElementById('price-fields').style.display = checked ? 'flex' : 'none'; }
function saveGoal(e) {
    e.preventDefault();
    state.goals.push({
        title: document.getElementById('goal-title').value,
        desc: document.getElementById('goal-desc').value,
        date: document.getElementById('goal-date').value,
        creationDate: getTodayString(),
        hasPrice: document.getElementById('goal-has-price').checked,
        currentMoney: parseFloat(document.getElementById('goal-current-money').value) || 0,
        targetMoney: parseFloat(document.getElementById('goal-target-money').value) || 0
    });
    saveState(); closeModal('goal-modal'); document.getElementById('goal-form').reset(); togglePriceField(false); renderAll();
}

function calculateGoalTimePercent(goal) {
    if (!goal.date) return 0;
    const start = new Date(goal.creationDate || goal.date).getTime();
    const end = new Date(goal.date).getTime();
    const now = new Date().getTime();
    if (start === end) return 0;
    return (now >= end) ? 100 : (now > start ? Math.round(((now - start) / (end - start)) * 100) : 0);
}

function renderGoals() {
    const list = document.getElementById('goals-list');
    list.innerHTML = "";
    if(state.goals.length === 0) return;

    state.goals.forEach((goal, index) => {
        let priceHTML = "", timeHTML = "";
        if (goal.hasPrice && goal.targetMoney > 0) {
            let moneyPercent = Math.min(Math.round((goal.currentMoney / goal.targetMoney) * 100), 100);
            priceHTML = `<p class="subtitle" style="margin-top: 8px;">Cagnotte : ${goal.currentMoney}€ / ${goal.targetMoney}€</p>
                <div class="progress-bar-linear"><div class="progress-fill" style="width: ${moneyPercent}%; background: var(--accent-purple);"></div></div>`;
        }
        if (goal.date) {
            const timePercent = calculateGoalTimePercent(goal);
            timeHTML = `<p class="subtitle" style="font-size:0.75rem; margin-top:8px;"><i data-lucide="clock" style="width:10px;height:10px;display:inline;"></i> Progression Temps</p>
                <div class="progress-bar-linear" style="height: 4px; margin-top: 4px;"><div class="progress-fill" style="width: ${timePercent}%; background: var(--accent-blue);"></div></div>`;
        }

        const card = document.createElement('div');
        card.className = "glass-card";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex: 1; padding-right: 10px;"><h4>${goal.title}</h4><p class="subtitle">${goal.desc || ''}</p></div>
                <div class="item-actions">
                    ${goal.hasPrice ? `<button class="btn-icon interactive-btn" onclick="addMoneyToGoal(${index})"><i data-lucide="plus"></i></button>` : ''}
                    <button class="btn-icon danger interactive-btn" onclick="triggerDelete('goal', ${index})"><i data-lucide="trash"></i></button>
                </div>
            </div>
            ${timeHTML}${priceHTML}
        `;
        list.appendChild(card);
    });
}

function updateHomeGoalSummary() {
    const summary = document.getElementById('home-goal-summary');
    if (state.goals.length > 0) {
        const topGoal = state.goals[0];
        const timePercent = calculateGoalTimePercent(topGoal);
        summary.innerHTML = `
            <p style="font-weight:600; color:#FFF;">${topGoal.title}</p>
            <p class="subtitle" style="font-size:0.8rem;">Echéance: ${topGoal.date}</p>
            <div class="progress-bar-linear" style="height: 6px; margin-top: 8px;">
                <div class="progress-fill" style="width: ${timePercent}%; background: var(--accent-purple);"></div>
            </div>
        `;
    } else {
        summary.innerHTML = `<p class="subtitle">Aucun objectif fixé.</p>`;
    }
}

function addMoneyToGoal(index) {
    let amt = prompt("Montant à ajouter (€) :");
    if(amt && !isNaN(amt)) { state.goals[index].currentMoney += parseFloat(amt); saveState(); renderAll(); }
}

// ================= CONFIGURATION COMPRESSION ET AJOUT QR CODES ================= */
function handleQRImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500; const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('qr-base64-data').value = dataUrl;
            document.getElementById('qr-preview-img').src = dataUrl;
            document.getElementById('qr-preview-img').style.display = 'block';
            document.getElementById('qr-submit-btn').disabled = false;
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function saveQRCode(e) {
    e.preventDefault();
    const image = document.getElementById('qr-base64-data').value;
    if (image) {
        state.qrcodes.push({ name: document.getElementById('qr-name').value, image });
        saveState(); closeModal('qr-modal'); document.getElementById('qr-form').reset();
        document.getElementById('qr-preview-img').style.display = 'none'; document.getElementById('qr-submit-btn').disabled = true; renderAll();
    }
}

function renderQRCodes() {
    const list = document.getElementById('qrcodes-list');
    list.innerHTML = "";
    if(state.qrcodes.length === 0) return;
    state.qrcodes.forEach((qr, index) => {
        const card = document.createElement('div');
        card.className = "qr-card";
        card.onclick = () => openFullscreenQR(qr.image);
        card.innerHTML = `
            <div>
                <img src="${qr.image}" alt="${qr.name}">
                <h4>${qr.name}</h4>
            </div>
            <button class="qr-del-btn" onclick="event.stopPropagation(); triggerDelete('qr', ${index})">Supprimer</button>
        `;
        list.appendChild(card);
    });
}
function openFullscreenQR(imageSrc) { document.getElementById('qr-fullscreen-img').src = imageSrc; openModal('qr-fullscreen-modal'); }

// ================= INTERFACE UNIFIEE POUR MODALE DE SUPPRESSION PREMIUM ================= */
function triggerDelete(type, index) {
    pendingDelete = { type, index };
    const title = type === 'goal' ? "Supprimer l'objectif ?" : "Supprimer ce code ?";
    const desc = type === 'goal' ? "Cet objectif sera supprimé définitivement." : "Ce QR Code sera effacé de l'application.";
    
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-desc').innerText = desc;
    openModal('confirm-modal');
}

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (pendingDelete.type === 'goal') state.goals.splice(pendingDelete.index, 1);
    else if (pendingDelete.type === 'qr') state.qrcodes.splice(pendingDelete.index, 1);
    
    saveState(); renderAll(); closeModal('confirm-modal');
    pendingDelete = { type: null, index: null };
});

// ================= UTILITAIRES DES FENÊTRES MODALES ================= */
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
