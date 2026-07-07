export default async function handler(req, res) {
  // Sécurité pour vérifier que la requête provient bien du planificateur Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  // Récupère le paramètre dans l'URL (ex: ?type=sport)
  const { type } = req.query;
  if (!type) return res.status(400).json({ error: "Type manquant" });

  let title = "";
  let message = "";

  // Définition des textes selon l'heure/le type de rappel
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
    // Appel sécurisé à l'API de OneSignal
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
        // On cible uniquement les appareils dont le tag de préférence est égal à "true"
        filters: [
          { field: "tag", key: type, relation: "=", value: "true" }
        ]
      })
    });

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
