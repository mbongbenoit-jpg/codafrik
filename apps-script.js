// ═══════════════════════════════════════════════════════════
//  CODAFRIK — Google Apps Script
//  À copier-coller sur script.google.com → Déployer → Web App
//  Ce script gère TOUTES les écritures dans ton Google Sheet
//  Sans Google Cloud, sans clé API, 100% gratuit
// ═══════════════════════════════════════════════════════════

// ⚠️ Remplace par ton Sheet ID avant de déployer
const SHEET_ID = "1xQWjOvPMU8QLYWzItcQGoEHQo5a9QmIG";

// Noms des feuilles (doit correspondre exactement)
const NOM_COMMANDES = "📋 COMMANDES";

// ── POINT D'ENTRÉE GET (utilisé par l'app pour éviter CORS) ─
function doGet(e) {
  try {
    const params = e.parameter;
    if (!params.data) {
      return output({ success: false, reason: "Pas de données" });
    }

    const payload = JSON.parse(params.data);
    const action  = payload.action;

    if (action === "UPDATE_STATUT")  return handleUpdateStatut(payload);
    if (action === "ASSIGN_CLOSEUR") return handleAssignCloseur(payload);
    if (action === "ASSIGN_LIVREUR") return handleAssignLivreur(payload);
    if (action === "ADD_COMMANDE")   return handleAddCommande(payload);

    return output({ success: false, reason: "Action inconnue: " + action });

  } catch (err) {
    return output({ success: false, reason: err.message });
  }
}

// ── HANDLER : Mettre à jour le statut + motif ────────────────
function handleUpdateStatut(payload) {
  const ws   = getSheet();
  const data = ws.getDataRange().getValues();

  for (let i = 4; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.cmdId).trim()) {
      ws.getRange(i + 1, 20).setValue(payload.statut); // Col T = Statut
      if (payload.motif) {
        ws.getRange(i + 1, 21).setValue(payload.motif); // Col U = Motif
      }
      // Ajoute un timestamp dans la colonne V (Marge brute - à adapter si besoin)
      SpreadsheetApp.flush();
      return output({ success: true, row: i + 1 });
    }
  }
  return output({ success: false, reason: "Commande non trouvée: " + payload.cmdId });
}

// ── HANDLER : Assigner un closeur ────────────────────────────
function handleAssignCloseur(payload) {
  const ws   = getSheet();
  const data = ws.getDataRange().getValues();

  for (let i = 4; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.cmdId).trim()) {
      ws.getRange(i + 1, 15).setValue(payload.closeurNom); // Col O = Closeur
      ws.getRange(i + 1, 20).setValue("Assignée closeur"); // Col T = Statut
      SpreadsheetApp.flush();
      return output({ success: true });
    }
  }
  return output({ success: false, reason: "Commande non trouvée" });
}

// ── HANDLER : Assigner un livreur ────────────────────────────
function handleAssignLivreur(payload) {
  const ws   = getSheet();
  const data = ws.getDataRange().getValues();

  for (let i = 4; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.cmdId).trim()) {
      ws.getRange(i + 1, 17).setValue(payload.livreurNom); // Col Q = Livreur
      ws.getRange(i + 1, 20).setValue("Assignée livreur"); // Col T = Statut
      SpreadsheetApp.flush();
      return output({ success: true });
    }
  }
  return output({ success: false, reason: "Commande non trouvée" });
}

// ── HANDLER : Ajouter une nouvelle commande ──────────────────
function handleAddCommande(payload) {
  const ws   = getSheet();
  const data = payload.data;

  // Génère un ID automatique
  const lastRow   = ws.getLastRow();
  const newIndex  = lastRow - 3; // soustraire les lignes d'en-tête
  data[0] = "CMD-" + String(newIndex).padStart(4, "0");
  data[2] = new Date().toISOString().split("T")[0]; // date du jour

  ws.appendRow(data);
  SpreadsheetApp.flush();
  return output({ success: true, id: data[0] });
}

// ── UTILITAIRES ──────────────────────────────────────────────
function getSheet() {
  return SpreadsheetApp
    .openById(SHEET_ID)
    .getSheetByName(NOM_COMMANDES);
}

function output(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
