// Fonction Serverless Vercel Node.js - /api/schedule.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    const { subscriptionId, settings, weekSchedule, timezoneStr } = req.body;

    if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId manquant' });
    }

    const APP_ID = "e20173c0-a951-4b0c-8db4-1c9dcac7969e";
    const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!REST_API_KEY) {
        console.error("Erreur: Clé API Manquante sur Vercel");
        return res.status(500).json({ error: 'Configuration serveur incomplète.' });
    }

    // 1. Synchronisation des Tags globaux pour les Crons automatisés
    const tagsPayload = {
        app_id: APP_ID,
        tags: {
            notif_sport: settings?.sport ? 'true' : 'false',
            notif_school: settings?.school ? 'true' : 'false',
            notif_goals: settings?.goals ? 'true' : 'false',
            notif_streak: settings?.streak ? 'true' : 'false',
            notif_motivation: settings?.motivation ? 'true' : 'false',
        }
    };

    try {
        const updateTagsResponse = await fetch(`https://api.onesignal.com/apps/${APP_ID}/users/by/subscriptions/${subscriptionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${REST_API_KEY}`
            },
            body: JSON.stringify(tagsPayload)
        });

        if (!updateTagsResponse.ok) {
            const err = await updateTagsResponse.json();
            console.error("Erreur de mise à jour des Tags OneSignal:", err);
        }

        // 2. Programmation prédictive des rappels de cours à H-30 via le paramètre "send_after" de OneSignal
        if (settings?.school && weekSchedule && Object.keys(weekSchedule).length > 0) {
            const userTimezone = timezoneStr || 'Europe/Paris';
            const dayMapping = {
                'dimanche': 0, 'sunday': 0, '0': 0,
                'lundi': 1, 'monday': 1, '1': 1,
                'mardi': 2, 'tuesday': 2, '2': 2,
                'mercredi': 3, 'wednesday': 3, '3': 3,
                'jeudi': 4, 'thursday': 4, '4': 4,
                'vendredi': 5, 'friday': 5, '5': 5,
                'samedi': 6, 'saturday': 6, '6': 6
            };

            const now = new Date();
            // Utilisation d'Intl pour obtenir l'heure locale exacte de l'utilisateur indépendamment de l'heure du serveur Vercel
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: userTimezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });

            const parts = formatter.formatToParts(now);
            const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

            const currentLocalYear = parseInt(partMap.year);
            const currentLocalMonth = parseInt(partMap.month) - 1;
            const currentLocalDay = parseInt(partMap.day);
            const currentLocalHour = parseInt(partMap.hour);
            const currentLocalMinute = parseInt(partMap.minute);

            const localNow = new Date(currentLocalYear, currentLocalMonth, currentLocalDay, currentLocalHour, currentLocalMinute);
            const currentLocalDayIndex = localNow.getDay();

            // Calcul du décalage absolu du fuseau de l'utilisateur
            const tempStr = now.toLocaleString('en-US', { timeZone: userTimezone });
            const tempDate = new Date(tempStr);
            const diffMs = now.getTime() - tempDate.getTime();

            // Itération complète sur l'emploi du temps transmis
            for (const [dayKey, courses] of Object.entries(weekSchedule)) {
                const targetDayIndex = dayMapping[dayKey.toLowerCase()];
                if (targetDayIndex === undefined || !Array.isArray(courses)) continue;

                for (const course of courses) {
                    if (!course.name || !course.start) continue;

                    let daysAhead = targetDayIndex - currentLocalDayIndex;
                    if (daysAhead < 0) {
                        daysAhead += 7; // Report à la semaine prochaine
                    }

                    const [classHour, classMinute] = course.start.split(':').map(Number);
                    let targetLocalAlert = new Date(currentLocalYear, currentLocalMonth, currentLocalDay + daysAhead, classHour, classMinute);
                    
                    // Soustraction des 30 minutes de préavis requises
                    targetLocalAlert.setMinutes(targetLocalAlert.getMinutes() - 30);

                    // Si le moment calculé est déjà passé pour aujourd'hui, on le décale à la semaine d'après
                    if (targetLocalAlert <= localNow) {
                        targetLocalAlert.setDate(targetLocalAlert.getDate() + 7);
                    }

                    // Conversion finale en horodatage UTC absolu pour OneSignal
                    const absoluteAlertTime = new Date(targetLocalAlert.getTime() + diffMs);
                    const sendAfterISO = absoluteAlertTime.toISOString();

                    // Création de la notification différée ciblée exclusivement pour cet utilisateur
                    await fetch("https://onesignal.com/api/v1/notifications", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json; charset=utf-8",
                            "Authorization": `Basic ${REST_API_KEY}`
                        },
                        body: JSON.stringify({
                            app_id: APP_ID,
                            include_subscription_ids: [subscriptionId],
                            headings: { fr: "⏰ Cours dans 30 min !" },
                            contents: { fr: `Ton cours de ${course.name} commence à ${course.start}. Prépare tes affaires ! 📚` },
                            send_after: sendAfterISO
                        })
                    });
                }
            }
        }

        return res.status(200).json({ success: true, message: 'Tags et rappels de cours à H-30 synchronisés sur le serveur avec succès.' });

    } catch (error) {
        console.error("Erreur serveur interne dans schedule.js:", error);
        return res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}
