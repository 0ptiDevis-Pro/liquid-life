// ============================================================================
// /api/sync-notifications.js - PLANIFICATION GLISSANTE SUR 7 JOURS (ONESIGNAL)
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Méthode non autorisée. Utilisez POST." });
  }

  const { subscriptionId, oldNotificationIds, settings, schedule, timezone } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ error: "subscriptionId manquant." });
  }

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !API_KEY) {
    console.error("❌ Erreur: Clés d'API OneSignal manquantes dans Vercel.");
    return res.status(500).json({ error: "Configuration serveur incomplète." });
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Basic ${API_KEY}`
  };

  try {
    // =========================================================================
    // ÉTAPE 1 : NETTOYAGE (DELETE) DES ANCIENNES NOTIFICATIONS PLANIFIÉES
    // =========================================================================
    if (Array.isArray(oldNotificationIds) && oldNotificationIds.length > 0) {
      const deletePromises = oldNotificationIds.map(id => 
        fetch(`https://onesignal.com/api/v1/notifications/${id}?app_id=${APP_ID}`, { 
            method: 'DELETE', 
            headers 
        }).catch(err => console.error(`Erreur suppression Notif ${id}:`, err))
      );
      // On attend que toutes les suppressions soient terminées pour éviter les doublons
      await Promise.allSettled(deletePromises);
    }

    // =========================================================================
    // ÉTAPE 2 : CALCUL DES DATES EXACTES POUR LES 7 PROCHAINS JOURS
    // =========================================================================
    const newScheduledIds = [];
    const nowUtc = new Date();
    const userTimezone = timezone || 'Europe/Paris';

    // Helper mathématique redoutable pour convertir une heure locale ciblée en véritable UTC
    function getTargetUtcDate(offsetDays, localHour, localMinute) {
      // On crée une date UTC forcée avec les chiffres de l'heure locale souhaitée
      const baseUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() + offsetDays, localHour, localMinute));
      
      // On regarde quelle heure il est dans le fuseau ciblé à cet instant UTC précis
      const tzDateStr = baseUtc.toLocaleString("en-US", { timeZone: userTimezone });
      const tzDate = new Date(tzDateStr);
      
      // On calcule le décalage réel en millisecondes
      const offsetMs = tzDate.getTime() - baseUtc.getTime();
      
      // On soustrait ce décalage pour obtenir la véritable heure UTC qui correspondra à l'heure locale
      return new Date(baseUtc.getTime() - offsetMs);
    }

    const notificationsToCreate = [];

    // Boucle sur le jour actuel (0) et les 6 suivants (1 à 6)
    for (let i = 0; i < 7; i++) {
        // Obtenir l'index du jour local (0 = Dimanche, 1 = Lundi, etc.) pour caler l'emploi du temps
        const targetMiddayUtc = getTargetUtcDate(i, 12, 0);
        const localDateStr = targetMiddayUtc.toLocaleString("en-US", { timeZone: userTimezone });
        const localDate = new Date(localDateStr);
        const localDayIndex = localDate.getDay();

        // 1. Quête de Sport (09:00)
        if (settings?.sport) {
            const sendAt = getTargetUtcDate(i, 9, 0);
            if (sendAt > nowUtc) {
                notificationsToCreate.push({ title: "💪 Mission Sport !", msg: "Prêt à dominer ta journée ? Ta quête quotidienne t'attend sur LiquidLife ! ⚡", time: sendAt });
            }
        }

        // 2. Motivation (13:00)
        if (settings?.motivation) {
            const sendAt = getTargetUtcDate(i, 13, 0);
            if (sendAt > nowUtc) {
                notificationsToCreate.push({ title: "✨ Boost de Motivation", msg: "Le succès n'est pas un accident, c'est le résultat d'une routine implacable. Reste focus ! 🔥", time: sendAt });
            }
        }

        // 3. Objectifs (19:00)
        if (settings?.goals) {
            const sendAt = getTargetUtcDate(i, 19, 0);
            if (sendAt > nowUtc) {
                notificationsToCreate.push({ title: "🎯 Tes Objectifs", msg: "Prends quelques minutes ce soir pour faire le point sur tes rêves et avancer concrètement.", time: sendAt });
            }
        }

        // 4. Feu Sacré (20:00)
        if (settings?.streak) {
            const sendAt = getTargetUtcDate(i, 20, 0);
            if (sendAt > nowUtc) {
                notificationsToCreate.push({ title: "⚠️ Sauve ton Feu Sacré !", msg: "Il est 20h00 ! Pense à valider ta mission quotidienne avant minuit pour conserver ta série.", time: sendAt });
            }
        }

        // 5. Début des Cours (H-30 min Dynamique)
        if (settings?.school && schedule && schedule[localDayIndex]) {
            const course = schedule[localDayIndex];
            if (course && course.start) {
                const [h, m] = course.start.split(':').map(Number);
                const sendAt = getTargetUtcDate(i, h, m);
                
                // Soustraction exacte de 30 minutes (1800000 millisecondes)
                sendAt.setMinutes(sendAt.getMinutes() - 30);
                
                if (sendAt > nowUtc) {
                    notificationsToCreate.push({ title: "📚 Début des cours bientôt !", msg: `Tes cours commencent dans 30 minutes (à ${course.start}). Prépare-toi à exceller ! ⚡`, time: sendAt });
                }
            }
        }
    }

    // =========================================================================
    // ÉTAPE 3 : EXPÉDITION AU MOTEUR DE PLANIFICATION ONESIGNAL
    // =========================================================================
    for (const notif of notificationsToCreate) {
        try {
            const res = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    app_id: APP_ID,
                    include_subscription_ids: [subscriptionId],
                    headings: { fr: notif.title },
                    contents: { fr: notif.msg },
                    // On envoie le format ISO strict (UTC) parfaitement interprété par OneSignal
                    send_after: notif.time.toISOString() 
                })
            });
            
            const data = await res.json();
            if (data.id) {
                newScheduledIds.push(data.id); // On capture l'ID pour le prochain nettoyage
            }
        } catch (e) {
            console.error("Erreur création notif OneSignal:", e);
        }
    }

    console.log(`✅ Planification 7-Jours réussie : ${newScheduledIds.length} alertes créées.`);
    return res.status(200).json({ success: true, scheduledIds: newScheduledIds });

  } catch (error) {
    console.error("❌ Erreur serveur API sync-notifications :", error);
    return res.status(500).json({ error: error.message });
  }
}
