// ============================================================================
// /api/send-push.js - SINGLE DAILY CRON & ONESIGNAL TIMEZONE DELIVERY
// ============================================================================

export default async function handler(req, res) {
  // 1. Sécurité : Vérification stricte du jeton Cron Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("🔒 Auth échouée : Jeton Cron Invalide");
    return res.status(401).json({ error: "Non autorisé" });
  }

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !API_KEY) {
    console.error("❌ Configuration OneSignal manquante dans l'environnement Vercel");
    return res.status(500).json({ error: "Configuration serveur incomplète." });
  }

  // 2. Définition des 4 campagnes de la journée
  const campaigns = [
    {
      tagKey: 'notif_sport',
      deliveryTime: '08:00', // OneSignal livrera à 08:00 locale
      title: '💪 Mission Sport !',
      message: 'Prêt à dominer ta journée ? Ta quête quotidienne t\'attend sur LiquidLife ! ⚡'
    },
    {
      tagKey: 'notif_motivation',
      deliveryTime: '12:00', // OneSignal livrera à 12:00 locale
      title: '✨ Boost de Motivation',
      message: 'Le succès n\'est pas un accident, c\'est le résultat d\'une routine implacable. Reste focus ! 🔥'
    },
    {
      tagKey: 'notif_goals',
      deliveryTime: '18:00', // OneSignal livrera à 18:00 locale
      title: '🎯 Tes Objectifs',
      message: 'Prends quelques minutes ce soir pour faire le point sur tes rêves et avancer concrètement.'
    },
    {
      tagKey: 'notif_streak',
      deliveryTime: '20:00', // OneSignal livrera à 20:00 locale
      title: '⚠️ Sauve ton Feu Sacré !',
      message: 'Il est 20h00 ! Pense à valider ta mission quotidienne avant minuit pour conserver ta série.'
    }
  ];

  try {
    const results = [];

    // 3. Envoi simultané des 4 requêtes à OneSignal
    const pushPromises = campaigns.map(async (campaign) => {
      const payload = {
        app_id: APP_ID,
        headings: { fr: campaign.title },
        contents: { fr: campaign.message },
        // Ciblage via les Tags mis à jour directement par le client
        filters: [
          { field: "tag", key: campaign.tagKey, relation: "=", value: "true" }
        ],
        // Paramètres magiques : Livraison Intelligente basée sur le fuseau de l'appareil
        delayed_option: "timezone",
        delivery_time_of_day: campaign.deliveryTime
      };

      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      return response.json();
    });

    const responses = await Promise.all(pushPromises);
    
    console.log(`✅ Les 4 campagnes ont été transmises à OneSignal pour livraison locale.`, responses);
    return res.status(200).json({ success: true, campaigns: responses });

  } catch (error) {
    console.error("❌ Erreur serveur interne dans send-push :", error);
    return res.status(500).json({ error: error.message });
  }
}
