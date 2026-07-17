// ============================================================================
// /api/weather.js - PROXY SÉCURISÉ OPEN-METEO & LOGIQUE VESTIMENTAIRE
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Méthode non autorisée. Utilisez GET." });
  }

  try {
    // Appel à l'API gratuite Open-Meteo (Nantes/Saint-Herblain par défaut)
    const url = "https://api.open-meteo.com/v1/forecast?latitude=47.22&longitude=-1.55&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=Europe%2FParis";
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des données météo.");
    }
    
    const data = await response.json();
    
    // Extraction des données du jour J (index 0)
    const maxTemp = data.daily.temperature_2m_max[0];
    const minTemp = data.daily.temperature_2m_min[0];
    const code = data.daily.weather_code[0];
    
    // Formatage des heures (ex: "2026-07-09T06:20" -> "06:20")
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    };
    const sunrise = formatTime(data.daily.sunrise[0]);
    const sunset = formatTime(data.daily.sunset[0]);

    // Calcul de la moyenne
    const avgTemp = Math.round((maxTemp + minTemp) / 2);

    // 1. Détermination du type de météo (Pixel Art)
    let weatherType = 'soleil';
    let isSun = false; let isRain = false; let isHeavyRain = false; let isSnow = false; let isStorm = false;

    if (code === 0 || code === 1) { weatherType = 'soleil'; isSun = true; }
    else if (code === 2 || code === 3) { weatherType = 'nuage'; }
    else if (code === 45 || code === 48) { weatherType = 'brouillard'; }
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) { 
        weatherType = 'pluie'; isRain = true; 
        if (code === 65 || code === 82) isHeavyRain = true;
    }
    else if ([71, 73, 75].includes(code)) { weatherType = 'neige'; isSnow = true; }
    else if ([95, 96, 99].includes(code)) { weatherType = 'orage'; isStorm = true; }

    // 2. Logique de recommandation vestimentaire (Base)
    let tenue = "";
    if (maxTemp < -5) tenue = "Manteau épais + bonnet + gants + écharpe + pantalon + chaussures fermées";
    else if (maxTemp < 0) tenue = "Manteau + bonnet + gants + pantalon";
    else if (maxTemp < 5) tenue = "Blouson chaud + pull + pantalon";
    else if (maxTemp < 10) tenue = "Blouson + pull + pantalon";
    else if (maxTemp < 15) tenue = "Pantalon + sweat ou pull léger";
    else if (maxTemp < 18) tenue = "Pantalon + sweat léger ou t-shirt";
    else if (maxTemp < 22) tenue = "T-shirt + pantalon ou short";
    else if (maxTemp < 26) tenue = "Short + t-shirt";
    else if (maxTemp < 30) tenue = "Short + t-shirt léger + lunettes de soleil";
    else if (maxTemp < 35) tenue = "Tenue très légère + casquette + lunettes + hydratation";
    else tenue = "Vêtements très légers + casquette + lunettes + éviter les efforts prolongés";

    // 3. Ajustements météo (Addons)
    let addons = [];
    if (isSun && maxTemp > 18) addons.push("😎 Lunettes de soleil");
    if (isSun && maxTemp > 22) { addons.push("🧢 Casquette"); addons.push("🧴 Crème solaire"); }
    
    if (isRain) { addons.push("☂️ Parapluie"); addons.push("🧥 Veste imperméable"); }
    if (isHeavyRain) addons.push("👟 Chaussures imperméables");
    
    if (isSnow) addons.push("🧤 Bonnet, gants, écharpe et chaussures montantes");
    if (isStorm) { addons.push("☂️ Parapluie"); addons.push("🧥 Veste imperméable"); }

    // On déduplique les addons au cas où
    addons = [...new Set(addons)];

    // Renvoyer les données formatées au client
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache Vercel 1h
    return res.status(200).json({
      avgTemp,
      maxTemp,
      minTemp,
      sunrise,
      sunset,
      weatherType,
      tenue,
      addons
    });

  } catch (error) {
    console.error("❌ Erreur API Météo:", error);
    return res.status(500).json({ error: "Erreur serveur météo" });
  }
}
