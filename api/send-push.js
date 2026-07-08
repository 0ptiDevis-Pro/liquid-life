export default async function handler(req, res) {
  // Sécurité pour vérifier que la requête provient bien du planificateur Vercel (Crons)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("🔒 Auth échouée sur Vercel : Jeton Cron Invalide");
    return res.status(401).json({ error: "Non autorisé" });
  }

  // Récupère le paramètre dans l'URL (ex: ?type=sport)
  const { type } = req.query;
  if (!type) {
    console.warn("⚠️ Paramètre 'type' manquant dans l'appel Cron");
    return res.status(400).json({ error: "Type manquant" });
  }

  let title = "";
  let message = "";

  // Définition des textes premium selon le type de rappel planifié
  switch (type) {
    case 'sport':
      title = "💪 Mission Sport !";
      message = "Prêt à dominer ta journée ? Ta quête quotidienne t'attend sur LiquidLife ! ⚡";
      break;
    case 'motivation':
      title = "✨ Boost de Motivation";
      message = "Le succès n'est pas un accident, c'est le résultat d'une routine implacable. Reste focus ! 🔥";
      break;
    case 'goals':
      title = "🎯 Tes Objectifs";
      message = "Prends quelques minutes ce soir pour faire le point sur tes rêves et avancer concrètement.";
      break;
    case 'streak':
      title = "⚠️ Sauve ton Feu Sacré !";
      message = "Il est 20h00 ! Pense à valider ta mission quotidienne avant minuit pour conserver ta série.";
      break;
    default:
      return res.status(400).json({ error: "Type inconnu" });
  }

  try {
    // Validation de la configuration d'environnement Vercel
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      console.error("❌ Configuration OneSignal manquante dans l'environnement Vercel");
      return res.status(500).json({ error: "Configuration serveur incomplète." });
    }

    // Alignement parfait des étiquettes (Tags) avec le format enregistré côté client (notif_${type})
    const targetTagKey = `notif_${type}`;

    // Appel à l'API OneSignal pour envoyer la notification ciblée par étiquette
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        headings: { fr: title },
        contents: { fr: message },
        // Ciblage des appareils dont le tag de préférence est explicitement égal à "true"
        filters: [
          { field: "tag", key: targetTagKey, relation: "=", value: "true" }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("❌ Erreur API OneSignal :", data);
        return res.status(400).json({ success: false, data });
    }
    
    console.log(`✅ Push [${type}] envoyé avec succès via l'étiquette [${targetTagKey}] :`, data);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ Erreur serveur interne dans send-push :", error);
    return res.status(500).json({ error: error.message });
  }
}
