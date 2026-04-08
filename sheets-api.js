// ═══════════════════════════════════════════════════════════
//  CODAFRIK — Connecteur Google Sheets SANS clé API
//  Lecture via URL publique CSV (gratuit, sans Google Cloud)
//  Écriture via Google Apps Script Web App (gratuit)
// ═══════════════════════════════════════════════════════════

class SheetsAPI {

  constructor(config) {
    this.cfg = config;
    this.id  = config.SHEET_ID;
    // URL de base pour lire le Sheet en CSV public (0 $ - sans clé)
    this.csvBase = `https://docs.google.com/spreadsheets/d/${this.id}/gviz/tq?tqx=out:csv&sheet=`;
  }

  // ── LECTURE CSV (pas besoin de clé API) ──────────────────

  // Télécharge une feuille complète en CSV et retourne un tableau 2D
  async readSheet(sheetName) {
    const url = this.csvBase + encodeURIComponent(sheetName);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return this._parseCSV(text);
    } catch (e) {
      console.error('Erreur lecture Sheet:', sheetName, e.message);
      return [];
    }
  }

  // Parse CSV en tableau 2D (gère les guillemets et virgules dans les cellules)
  _parseCSV(text) {
    const rows = [];
    const lines = text.split('\n');
    for (let line of lines) {
      if (!line.trim()) continue;
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      rows.push(cells);
    }
    return rows;
  }

  // ── COMMANDES ────────────────────────────────────────────

  async getCommandes() {
    const rows = await this.readSheet(this.cfg.SHEETS.COMMANDES);
    const C = this.cfg.COLS;

    // Ignore les 4 premières lignes (titres + en-têtes)
    return rows.slice(4)
      .filter(r => r[C.CLIENT] && r[C.CLIENT] !== '')
      .map(r => ({
        id:      r[C.ID]      || '',
        shopify: r[C.SHOPIFY] || '',
        date:    r[C.DATE]    || '',
        client:  r[C.CLIENT]  || '',
        tel:     r[C.TEL]     || '',
        pays:    r[C.PAYS]    || '',
        ville:   r[C.VILLE]   || '',
        produit: r[C.PRODUIT] || '',
        qte:     parseInt(r[C.QTE])        || 1,
        prix:    parseFloat(r[C.PRIX])     || 0,
        frais:   parseFloat(r[C.FRAIS])    || 0,
        closeur: r[C.CLOSEUR] || '',
        livreur: r[C.LIVREUR] || '',
        statut:  r[C.STATUT]  || 'En attente',
        motif:   r[C.MOTIF]   || '',
        source:  r[C.SOURCE]  || '',
      }));
  }

  // ── CONFIGURATION (closeurs, livreurs, produits) ─────────

  async getConfig() {
    const rows = await this.readSheet(this.cfg.SHEETS.CONFIGURATION);
    const CL = this.cfg.COLS_CLOSEURS;
    const LV = this.cfg.COLS_LIVREURS;
    const PR = this.cfg.COLS_PRODUITS;

    // Produits : lignes 6-30 → index 5-29
    const produits = rows.slice(5, 30)
      .filter(r => r[PR.ID] && r[PR.NOM])
      .map(r => ({
        id:        r[PR.ID],
        nom:       r[PR.NOM],
        prixAchat: parseFloat(r[PR.PRIX_ACHAT]) || 0,
        prixVente: parseFloat(r[PR.PRIX_VENTE]) || 0,
      }));

    // Livreurs : lignes 63-84 → index 62-83
    const livreurs = rows.slice(62, 84)
      .filter(r => r[LV.ID] && r[LV.ACTIF] === 'O')
      .map(r => ({
        id:    r[LV.ID],
        nom:   (r[LV.NOM] + ' ' + (r[LV.PRENOM]||'')).trim(),
        tel:   r[LV.TEL]   || '',
        pays:  r[LV.PAYS]  || '',
        ville: r[LV.VILLE] || '',
        frais: parseFloat(r[LV.FRAIS]) || 3.5,
      }));

    // Closeurs : lignes 88-104 → index 87-103
    const closeurs = rows.slice(87, 104)
      .filter(r => r[CL.ID] && r[CL.ACTIF] === 'O')
      .map(r => ({
        id:         r[CL.ID],
        nom:        (r[CL.NOM] + ' ' + (r[CL.PRENOM]||'')).trim(),
        tel:        r[CL.TEL] || '',
        commission: parseFloat(r[CL.COMMISSION]) || 0.03,
      }));

    return { produits, livreurs, closeurs };
  }

  // ── ÉCRITURE via Apps Script ──────────────────────────────
  // Le Apps Script est un simple script Google — pas besoin de Google Cloud

  async _post(payload) {
    const url = this.cfg.SCRIPT_URL || localStorage.getItem('CODAFRIK_SCRIPT_URL');
    if (!url) {
      console.warn('SCRIPT_URL non configurée — mode lecture seule');
      return { success: false, reason: 'no_script' };
    }
    try {
      // Apps Script ne supporte pas les headers custom → on envoie en GET avec params
      const params = new URLSearchParams({ data: JSON.stringify(payload) });
      const res = await fetch(`${url}?${params}`, { method: 'GET' });
      const text = await res.text();
      try { return JSON.parse(text); }
      catch { return { success: true }; }
    } catch (e) {
      console.error('Erreur Apps Script:', e.message);
      return { success: false, reason: e.message };
    }
  }

  async updateStatut(cmdId, statut, motif = '') {
    return this._post({ action: 'UPDATE_STATUT', cmdId, statut, motif });
  }

  async assignCloseur(cmdId, closeurNom) {
    return this._post({ action: 'ASSIGN_CLOSEUR', cmdId, closeurNom });
  }

  async assignLivreur(cmdId, livreurNom) {
    return this._post({ action: 'ASSIGN_LIVREUR', cmdId, livreurNom });
  }

  async addCommande(data) {
    return this._post({ action: 'ADD_COMMANDE', data });
  }
}
