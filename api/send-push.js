// ============================================================================
// /api/send-push.js - API UNIQUE (CRON GLOBAL + SYNCHRO H-30 FRONTEND)
// ============================================================================

export default async function handler(req, res) {
  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !API_KEY) {
    console.error("❌ Configuration OneSignal manquante dans l'environnement Vercel");
    return res.status(500).json({ error: "Configuration serveur incomplète." });
  }

  // =========================================================================
  // MODE 1 : REQUÊTE FRONTEND (POST) -> PLANIFICATION H-30 MIN (SCHOOL)
  // =========================================================================
  if (req.method === 'POST') {
    const { subscriptionId, scheduledClasses } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: "subscriptionId manquant." });
    }

    try {
      const results = [];
      if (scheduledClasses && scheduledClasses.length > 0) {
        for (const course of scheduledClasses) {
          const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": `Basic ${API_KEY}`
            },
            body: JSON.stringify({
              app_id: APP_ID,
              include_subscription_ids: [subscriptionId],
              // BUG CORRIGÉ : OneSignal EXIGE la clé "en" en fallback par défaut, sinon il rejette l'appel.
              headings: { en: "📚 Début des cours bientôt !", fr: "📚 Début des cours bientôt !" },
              contents: { en: `Tes cours commencent dans 30 minutes (à ${course.courseTime}). Prépare-toi ! ⚡`, fr: `Tes cours commencent dans 30 minutes (à ${course.courseTime}). Prépare-toi ! ⚡` },
              send_after: course.sendAfter // Heure ISO exacte calculée par le client
            })
          });
          const data = await response.json();
          results.push(data);
        }
      }
      console.log(`✅ ${results.length} notifications de cours (H-30) planifiées pour ${subscriptionId}`);
      return res.status(200).json({ success: true, details: results });
    } catch (error) {
      console.error("❌ Erreur lors de la planification H-30 :", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // =========================================================================
  // MODE 2 : CRON VERCEL (GET) -> CAMPAGNES GLOBALES QUOTIDIENNES
  // =========================================================================
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("🔒 Auth échouée : Jeton Cron Invalide");
    return res.status(401).json({ error: "Non autorisé" });
  }

  // BUG CORRIGÉ : Le paramètre delivery_time_of_day exige un format spécifique (AM/PM)
  const campaigns = [
    { tagKey: 'notif_sport', deliveryTime: '9:00AM', title: '💪 Mission Sport !', message: 'Prêt à dominer ta journée ? Ta quête quotidienne t\'attend sur LiquidLife ! ⚡' },
    { tagKey: 'notif_motivation', deliveryTime: '1:00PM', title: '✨ Boost de Motivation', message: 'Le succès n\'est pas un accident, c\'est le résultat d\'une routine implacable. Reste focus ! 🔥' },
    { tagKey: 'notif_goals', deliveryTime: '7:00PM', title: '🎯 Tes Objectifs', message: 'Prends quelques minutes ce soir pour faire le point sur tes rêves et avancer concrètement.' },
    { tagKey: 'notif_streak', deliveryTime: '8:00PM', title: '⚠️ Sauve ton Feu Sacré !', message: 'Il est 20h00 ! Pense à valider ta mission quotidienne avant minuit pour conserver ta série.' }
  ];

  try {
    const pushPromises = campaigns.map(async (campaign) => {
      const payload = {
        app_id: APP_ID,
        // Toujours doubler la langue avec "en"
        headings: { en: campaign.title, fr: campaign.title },
        contents: { en: campaign.message, fr: campaign.message },
        filters: [{ field: "tag", key: campaign.tagKey, relation: "=", value: "true" }],
        delayed_option: "timezone",
        delivery_time_of_day: campaign.deliveryTime
      };

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Authorization": `Basic ${API_KEY}` },
        body: JSON.stringify(payload)
      });
      return response.json();
    });

    const responses = await Promise.all(pushPromises);
    console.log(`✅ Campagnes globales transmises à OneSignal (Timezone Delivery).`);
    return res.status(200).json({ success: true, campaigns: responses });

  } catch (error) {
    console.error("❌ Erreur serveur CRON :", error);
    return res.status(500).json({ error: error.message });
  }
}
