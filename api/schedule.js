// Fonction Serverless Vercel Node.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    const { subscriptionId, settings, schedule, timezoneStr } = req.body;

    if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId manquant' });
    }

    // Récupérer vos clés API sécurisées depuis l'environnement Vercel
    const APP_ID = "e20173c0-a951-4b0c-8db4-1c9dcac7969e"; // Public
    const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY; // Secret

    if (!REST_API_KEY) {
        console.error("Erreur: Clé API Manquante sur Vercel");
        return res.status(500).json({ error: 'Configuration serveur incomplète.' });
    }

    // Pour implémenter efficacement les alertes avec OneSignal sans surcharger le serveur avec des boucles,
    // l'approche professionnelle consiste à injecter des "Tags" (Étiquettes) dynamiques sur l'utilisateur
    // en fonction de ses paramètres (sport: true, etc.)
    
    // On met à jour le profil de l'utilisateur sur OneSignal avec les "Tags" (Préférences locales)
    // Les alertes récurrentes pourront être ensuite pilotées via les "Journeys" de OneSignal en fonction de ces tags.
    const tagsPayload = {
        app_id: APP_ID,
        tags: {
            notif_sport: settings.sport ? 'true' : 'false',
            notif_school: settings.school ? 'true' : 'false',
            notif_goals: settings.goals ? 'true' : 'false',
            notif_streak: settings.streak ? 'true' : 'false',
            notif_motivation: settings.motivation ? 'true' : 'false',
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

        if (updateTagsResponse.ok) {
            return res.status(200).json({ success: true, message: 'Tags synchronisés sur OneSignal avec succès.' });
        } else {
            const err = await updateTagsResponse.json();
            console.error("Erreur OneSignal:", err);
            return res.status(400).json({ error: 'Échec de synchronisation OneSignal' });
        }
    } catch (error) {
        console.error("Erreur serveur interne:", error);
        return res.status(500).json({ error: 'Erreur Serveur' });
    }
}
