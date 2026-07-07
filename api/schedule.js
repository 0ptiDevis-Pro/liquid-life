// Fonction Serverless Vercel Node.js
// ⚠️ CE FICHIER EST OBSOLÈTE ET DOIT ÊTRE SUPPRIMÉ DANS VOTRE REPOSITORY ⚠️
// Explication : Dans OneSignal v16, l'envoi des "Tags" (pour dire si l'utilisateur veut le sport, les objectifs, etc) 
// doit se faire directement depuis le navigateur du client via "OneSignal.User.addTag()" (comme je l'ai configuré dans le nouveau script.js).
// Demander à un serveur de faire cela est redondant, plus lent, et source d'erreurs (désynchronisation du SubscriptionId).

export default function handler(req, res) {
    console.warn("⚠️ Avertissement : Le fichier /api/schedule.js est déprécié. La logique de Tags est maintenant directement pilotée côté client dans script.js pour une fiabilité à 100%. Supprimez ce fichier de votre projet GitHub.");
    
    return res.status(410).json({ 
        error: 'Cette API est obsolète.', 
        message: 'L\'ajout des tags OneSignal se fait désormais directement côté Client (Navigateur) via OneSignal.User.addTag(). Veuillez supprimer le fichier api/schedule.js pour nettoyer votre base de code.' 
    });
}
