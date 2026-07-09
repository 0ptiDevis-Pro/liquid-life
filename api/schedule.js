// Fonction Serverless Vercel Node.js - /api/schedule.js

export default async function handler(req, res) {
    // Sécurité : n'accepte que les requêtes POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    // Récupération des données envoyées par le script.js (frontend)
    const { subscriptionId, settings, weekSchedule, timezoneStr } = req.body;

    // L'identifiant OneSignal est obligatoire pour cibler l'appareil
    if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId manquant' });
    }

    const APP_ID = "e20173c0-a951-4b0c-8db4-1c9dcac7969e";
    const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!REST_API_KEY) {
        console.error("Erreur: Clé API Manquante sur Vercel");
        return res.status(500).json({ error: 'Configuration serveur incomplète.' });
    }

    // =========================================================================
    // 1. Synchronisation des Tags globaux pour les Crons automatisés
    // =========================================================================
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

        // =========================================================================
        // 2. Programmation prédictive des rappels de cours à H-30 via "send_after"
        // =========================================================================
        if (settings?.school && weekSchedule && Object.keys(weekSchedule).length > 0) {
            const userTimezone = timezoneStr || 'Europe/Paris';
            
            // Le script.js envoie les jours sous forme de numéros (0 = Dimanche, 1 = Lundi, etc.)
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
            
            // Utilisation d'Intl pour obtenir l'heure locale exacte de l'utilisateur 
            // indépendamment du fuseau horaire du serveur Vercel (qui est en UTC)
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: userTimezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });

            const parts = formatter.formatToParts(now);
            const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

            const currentLocalYear = parseInt(partMap.year);
            const currentLocalMonth = parseInt(partMap.month) - 1; // Les mois JS commencent à 0
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
            for (const [dayKey, courseData] of Object.entries(weekSchedule)) {
                // Correspondance de la clé envoyée (ex: "1") à l'index numérique du jour (ex: 1)
                const targetDayIndex = dayMapping[dayKey.toLowerCase()];
                
                // CORRECTION DU BUG ICI : On vérifie si courseData existe et s'il a une propriété start. 
                // On ne vérifie plus si c'est un Array, car c'est un Objet !
                if (targetDayIndex === undefined || !courseData || !courseData.start) continue;

                let daysAhead = targetDayIndex - currentLocalDayIndex;
                if (daysAhead < 0) {
                    daysAhead += 7; // Si le jour est déjà passé cette semaine, on vise la semaine prochaine
                }

                // Extraction de l'heure et des minutes de début (ex: "08:30" -> 8, 30)
                const [classHour, classMinute] = courseData.start.split(':').map(Number);
                
                // Construction de la date locale cible du cours
                let targetLocalAlert = new Date(currentLocalYear, currentLocalMonth, currentLocalDay + daysAhead, classHour, classMinute);
                
                // Soustraction des 30 minutes de préavis requises pour envoyer la notification à l'avance
                targetLocalAlert.setMinutes(targetLocalAlert.getMinutes() - 30);

                // Si le moment calculé (H-30) est déjà passé pour aujourd'hui, on le décale obligatoirement à la semaine suivante
                if (targetLocalAlert <= localNow) {
                    targetLocalAlert.setDate(targetLocalAlert.getDate() + 7);
                }

                // Conversion finale en horodatage UTC absolu pour OneSignal en appliquant le décalage de fuseau horaire
                const absoluteAlertTime = new Date(targetLocalAlert.getTime() + diffMs);
                const sendAfterISO = absoluteAlertTime.toISOString();

                // Création de la notification différée (Scheduled) ciblée exclusivement pour cet utilisateur
                await fetch("https://onesignal.com/api/v1/notifications", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Authorization": `Basic ${REST_API_KEY}`
                    },
                    body: JSON.stringify({
                        app_id: APP_ID,
                        include_subscription_ids: [subscriptionId],
                        headings: { fr: "⏰ Prépare-toi, les cours approchent !" },
                        contents: { fr: `Ton emploi du temps indique un début de cours à ${courseData.start}. En route ! 📚` },
                        send_after: sendAfterISO // Magie OneSignal : le serveur Vercel peut s'éteindre, OneSignal stocke l'heure et l'envoie seul.
                    })
                });
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Tags OneSignal et rappels de cours à H-30 synchronisés sur le serveur avec succès.' 
        });

    } catch (error) {
        console.error("Erreur serveur interne dans schedule.js:", error);
        return res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}
