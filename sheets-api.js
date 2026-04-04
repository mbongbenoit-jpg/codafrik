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
      const text = await res.text();
      return this._parseCSV(text);
    } catch (e) {
      console.error('Erreur lecture:', sheetName, e.message);
      return [];
    }
  }

  _parseCSV(text) {
    const rows = [];
    const lines = text.split('\n');
    for (let line of lines) {
      if (!line.trim()) continue;
      const cells = [];
      let current = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim()); current = '';
        } else { current += ch; }
      }
      cells.push(current.trim());
      rows.push(cells);
    }
    return rows;
  }

  async getCommandes() {
    const rows = await this.readSheet('📋 COMMANDES');
    const C = this.cfg.COLS;
    return rows.slice(4)
      .filter(r => r[C.CLIENT] && r[C.CLIENT] !== '')
      .map(r => ({
        id: r[C.ID]||'', shopify: r[C.SHOPIFY]||'', date: r[C.DATE]||'',
        client: r[C.CLIENT]||'', tel: r[C.TEL]||'', pays: r[C.PAYS]||'',
        ville: r[C.VILLE]||'', produit: r[C.PRODUIT]||'',
        qte: parseInt(r[C.QTE])||1, prix: parseFloat(r[C.PRIX])||0,
        frais: parseFloat(r[C.FRAIS])||0, closeur: r[C.CLOSEUR]||'',
        livreur: r[C.LIVREUR]||'', statut: r[C.STATUT]||'En attente',
        motif: r[C.MOTIF]||'', source: r[C.SOURCE]||'',
      }));
  }

  async getConfig() {
    const rows = await this.readSheet('⚙️ CONFIGURATION');

    // PRODUITS lignes 6-30 → index 5-29
    const produits = [];
    for (let i = 5; i <= 29; i++) {
      const r = rows[i];
      if (!r || !r[0] || !r[1] || r[0]==='ID Produit') continue;
      if (!parseFloat(r[4]) && !r[1]) continue;
      produits.push({ id:r[0], nom:r[1], categorie:r[2]||'', prixAchat:parseFloat(r[3])||0, prixVente:parseFloat(r[4])||0 });
    }

    // PAYS & VILLES lignes 33-60 → index 32-59
    const paysVilles = [];
    for (let i = 32; i <= 59; i++) {
      const r = rows[i];
      if (!r || !r[1] || !r[2] || r[1]==='Pays') continue;
      if (r[4] && r[4]!=='O') continue;
      paysVilles.push({ id:r[0]||'', pays:r[1], ville:r[2], code:r[3]||'' });
    }
    const paysUniques = [...new Set(paysVilles.map(pv=>pv.pays))].filter(Boolean);
    const villesParPays = {};
    paysVilles.forEach(pv => {
      if (!villesParPays[pv.pays]) villesParPays[pv.pays] = [];
      if (pv.ville && !villesParPays[pv.pays].includes(pv.ville)) villesParPays[pv.pays].push(pv.ville);
    });

    // LIVREURS lignes 63-84 → index 62-83
    const livreurs = [];
    for (let i = 62; i <= 83; i++) {
      const r = rows[i];
      if (!r || !r[0] || !r[1] || r[0]==='ID Livreur') continue;
      if (r[7] && r[7]!=='O') continue;
      livreurs.push({ id:r[0], nom:(r[1]+' '+(r[2]||'')).trim(), tel:r[3]||'', pays:r[4]||'', ville:r[5]||'', frais:parseFloat(r[6])||3.5 });
    }

    // CLOSEURS lignes 88-104 → index 87-103
    const closeurs = [];
    for (let i = 87; i <= 103; i++) {
      const r = rows[i];
      if (!r || !r[0] || !r[1] || r[0]==='ID Closeur') continue;
      if (r[6] && r[6]!=='O') continue;
      closeurs.push({ id:r[0], nom:(r[1]+' '+(r[2]||'')).trim(), tel:r[3]||'', email:r[4]||'', commission:parseFloat(r[5])||0.03 });
    }

    return { produits, paysVilles, paysUniques, villesParPays, livreurs, closeurs };
  }

  async _post(payload) {
    const url = (typeof CONFIG!=='undefined' && CONFIG.SCRIPT_URL)
      ? CONFIG.SCRIPT_URL : localStorage.getItem('CODAFRIK_SCRIPT_URL');
    if (!url) return { success: false, reason: 'no_script' };
    try {
      const params = new URLSearchParams({ data: JSON.stringify(payload) });
      const res = await fetch(`${url}?${params}`);
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { success: true }; }
    } catch (e) { return { success: false, reason: e.message }; }
  }

  async updateStatut(cmdId, statut, motif='') { return this._post({ action:'UPDATE_STATUT', cmdId, statut, motif }); }
  async assignCloseur(cmdId, closeurNom)       { return this._post({ action:'ASSIGN_CLOSEUR', cmdId, closeurNom }); }
  async assignLivreur(cmdId, livreurNom)       { return this._post({ action:'ASSIGN_LIVREUR', cmdId, livreurNom }); }
  async addCommande(data)                       { return this._post({ action:'ADD_COMMANDE', data }); }
}
