// ═══════════════════════════════════════════════════════════
//  CODAFRIK — Configuration (SANS clé API, SANS Google Cloud)
//  Ton Sheet ID est déjà rempli ci-dessous — ne change rien !
// ═══════════════════════════════════════════════════════════

const CONFIG = {

  // ✅ Ton Sheet ID — déjà configuré !
  SHEET_ID: "1xQWjOvPMU8QLYWzItcQGoEHQo5a9QmIG",

  // ✅ Pas besoin de clé API — on lit via l'URL publique CSV
  API_KEY: null,

  // Noms exacts de tes feuilles (vérifie que c'est identique dans ton Sheet)
  SHEETS: {
    COMMANDES:     "📋 COMMANDES",
    CONFIGURATION: "⚙️ CONFIGURATION",
  },

  // Colonnes de la feuille COMMANDES (index 0 = colonne A)
  COLS: {
    ID:         0,   // A - N° Commande
    SHOPIFY:    1,   // B - N° Shopify
    DATE:       2,   // C - Date Commande
    CLIENT:     3,   // D - Nom Client
    TEL:        4,   // E - Téléphone
    PAYS:       5,   // F - Pays
    VILLE:      6,   // G - Ville
    PRODUIT:    7,   // H - Produit
    QTE:        8,   // I - Quantité
    PRIX:       10,  // K - Prix Vente Unit.
    PRIX_ACHAT: 11,  // L - Prix Achat Unit.
    FRAIS:      12,  // M - Frais Livraison
    CLOSEUR:    14,  // O - Closeur
    LIVREUR:    16,  // Q - Livreur
    STATUT:     19,  // T - Statut Commande
    MOTIF:      20,  // U - Motif Annulation/Refus
    SOURCE:     23,  // X - Source Trafic
  },

  // Colonnes config CLOSEURS (feuille CONFIGURATION, lignes 88-104)
  COLS_CLOSEURS: {
    ID:         0,   // A
    NOM:        1,   // B
    PRENOM:     2,   // C
    TEL:        3,   // D
    COMMISSION: 5,   // F
    ACTIF:      6,   // G
  },

  // Colonnes config LIVREURS (feuille CONFIGURATION, lignes 63-84)
  COLS_LIVREURS: {
    ID:     0,  // A
    NOM:    1,  // B
    PRENOM: 2,  // C
    TEL:    3,  // D
    PAYS:   4,  // E
    VILLE:  5,  // F
    FRAIS:  6,  // G
    ACTIF:  7,  // H
  },

  // Colonnes config PRODUITS (feuille CONFIGURATION, lignes 6-30)
  COLS_PRODUITS: {
    ID:         0,  // A
    NOM:        1,  // B
    PRIX_ACHAT: 3,  // D
    PRIX_VENTE: 4,  // E
  },

  // Rafraîchissement auto (millisecondes) — 30 secondes
  REFRESH_INTERVAL: 30000,

  // URL de ton Google Apps Script (à coller après déploiement)
  // Laisse vide pour l'instant, tu le rempliras à l'étape Apps Script
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzpP6yDDo4mFhwIIFr18xyX_yigqgP2B3Mro8MBLmVOqxpzsj4641VIU5GqZU8ZWocA/exec",
};
