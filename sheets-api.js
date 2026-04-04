class SheetsAPI {
  constructor(config) {
    this.cfg = config;
    this.id  = config.SHEET_ID;
    this.csvBase = `https://docs.google.com/spreadsheets/d/${this.id}/gviz/tq?tqx=out:csv&sheet=`;
  }

  async readSheet(sheetName) {
    const url = this.csvBase + encodeURIComponent(sheetName);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return this._parseCSV(await res.text());
    } catch (e) {
      console.error('Erreur lecture:', sheetName, e.message);
      return [];
    }
  }

  _parseCSV(text) {
    const rows = [];
    for (let line of text.split('\n')) {
      if (!line.trim()) continue;
      const cells = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      cells.push(cur.trim());
      rows.push(cells);
    }
    return rows;
  }

  // Nettoie un pourcentage exporté par Google Sheets
  // "300,0%" ou "3,0%" ou "0,03" → retourne 0.03
  _parseCommission(val) {
    if (!val) return 0.03;
    const str = String(val).replace(',', '.').replace('%', '').trim();
    const num = parseFloat(str);
    if (isNaN(num)) return 0.03;
    // Si > 1, c'est un pourcentage affiché (ex: 3.0 = 3%) → divise par 100
    return num > 1 ? num / 100 : num;
  }

  async getCommandes() {
    const rows = await this.readSheet('📋 COMMANDES');
    const C = this.cfg.COLS;
    return rows.slice(4)
      .filter(r => r[C.CLIENT] && r[C.CLIENT].trim() !== '')
      .map(r => ({
        id:      r[C.ID]      || '',
        shopify: r[C.SHOPIFY] || '',
        date:    r[C.DATE]    || '',
        client:  r[C.CLIENT]  || '',
        tel:     r[C.TEL]     || '',
        pays:    r[C.PAYS]    || '',
        ville:   r[C.VILLE]   || '',
        produit: r[C.PRODUIT] || '',
        qte:     parseInt(r[C.QTE])     || 1,
        prix:    parseFloat(r[C.PRIX])  || 0,
        frais:   parseFloat(r[C.FRAIS]) || 0,
        closeur: r[C.CLOSEUR] || '',
        livreur: r[C.LIVREUR] || '',
        statut:  r[C.STATUT]  || 'En attente',
        motif:   r[C.MOTIF]   || '',
        source:  r[C.SOURCE]  || '',
      }));
  }

  async getConfig() {
    const rows = await this.readSheet('⚙️ CONFIGURATION');

    const produits   = [];
    const paysVilles = [];
    const livreurs   = [];
    const closeurs   = [];

    // Parcourt TOUTES les lignes une seule fois
    // Identifie chaque ligne par son ID en colonne A
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const id = r[0].trim();

      // ── PRODUIT : ID commence par PRD ──────────────────────
      if (id.startsWith('PRD') && r[1]) {
        produits.push({
          id:        id,
          nom:       r[1].trim(),
          categorie: r[2] ? r[2].trim() : '',
          prixAchat: parseFloat(String(r[3]).replace(',','.')) || 0,
          prixVente: parseFloat(String(r[4]).replace(',','.')) || 0,
        });
      }

      // ── PAYS/VILLE : ID commence par PV ────────────────────
      if (id.startsWith('PV') && r[1] && r[2]) {
        // Colonne E (index 4) = Actif
        const actif = r[4] ? r[4].trim() : 'O';
        if (actif === 'O' || actif === '') {
          paysVilles.push({
            id:    id,
            pays:  r[1].trim(),
            ville: r[2].trim(),
            code:  r[3] ? r[3].trim() : '',
          });
        }
      }

      // ── LIVREUR : ID commence par LIV ──────────────────────
      if (id.startsWith('LIV') && r[1]) {
        // Colonne H (index 7) = Actif
        const actif = r[7] ? r[7].trim() : 'O';
        if (actif === 'O' || actif === '') {
          livreurs.push({
            id:    id,
            nom:   (r[1].trim() + ' ' + (r[2] ? r[2].trim() : '')).trim(),
            tel:   r[3] ? r[3].trim() : '',
            pays:  r[4] ? r[4].trim() : '',
            ville: r[5] ? r[5].trim() : '',
            frais: parseFloat(String(r[6]).replace(',','.')) || 3.5,
          });
        }
      }

      // ── CLOSEUR : ID commence par CLO ──────────────────────
      if (id.startsWith('CLO') && r[1]) {
        // Colonne G (index 6) = Actif
        const actif = r[6] ? r[6].trim() : 'O';
        if (actif === 'O' || actif === '') {
          closeurs.push({
            id:         id,
            nom:        (r[1].trim() + ' ' + (r[2] ? r[2].trim() : '')).trim(),
            tel:        r[3] ? r[3].trim() : '',
            email:      r[4] ? r[4].trim() : '',
            commission: this._parseCommission(r[5]),
          });
        }
      }
    }

    // Pays uniques et villes par pays
    const paysUniques = [...new Set(paysVilles.map(pv => pv.pays))].filter(Boolean);
    const villesParPays = {};
    paysVilles.forEach(pv => {
      if (!villesParPays[pv.pays]) villesParPays[pv.pays] = [];
      if (!villesParPays[pv.pays].includes(pv.ville)) {
        villesParPays[pv.pays].push(pv.ville);
      }
    });

    console.log(`✅ Config: ${produits.length} produits | ${paysVilles.length} villes | ${livreurs.length} livreurs | ${closeurs.length} closeurs`);
    return { produits, paysVilles, paysUniques, villesParPays, livreurs, closeurs };
  }

  // ── ÉCRITURE via Apps Script ────────────────────────────────
  async _post(payload) {
    const url = (typeof CONFIG !== 'undefined' && CONFIG.SCRIPT_URL)
      ? CONFIG.SCRIPT_URL : localStorage.getItem('CODAFRIK_SCRIPT_URL');
    if (!url) return { success: false, reason: 'no_script' };
    try {
      const params = new URLSearchParams({ data: JSON.stringify(payload) });
      const res = await fetch(`${url}?${params}`);
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { success: true }; }
    } catch (e) { return { success: false, reason: e.message }; }
  }

  async updateStatut(cmdId, statut, motif='') {
    return this._post({ action:'UPDATE_STATUT', cmdId, statut, motif });
  }
  async assignCloseur(cmdId, closeurNom) {
    return this._post({ action:'ASSIGN_CLOSEUR', cmdId, closeurNom });
  }
  async assignLivreur(cmdId, livreurNom) {
    return this._post({ action:'ASSIGN_LIVREUR', cmdId, livreurNom });
  }
  async addCommande(data) {
    return this._post({ action:'ADD_COMMANDE', data });
  }
}
