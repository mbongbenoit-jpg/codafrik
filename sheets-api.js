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

  // Trouve la ligne d'un titre de section (ex: "CATALOGUE PRODUITS")
  // Retourne l'index de la ligne d'en-tête (ligne suivante après le titre)
  _findSection(rows, keyword) {
    for (let i = 0; i < rows.length; i++) {
      const cell = (rows[i][0] || '') + (rows[i][1] || '') + (rows[i][2] || '');
      if (cell.toUpperCase().includes(keyword.toUpperCase())) {
        return i; // index de la ligne titre
      }
    }
    return -1;
  }

  // Extrait les lignes de données d'une section
  // Cherche le titre → saute l'en-tête → lit jusqu'à la prochaine section vide
  _extractSection(rows, keyword) {
    const titleIdx = this._findSection(rows, keyword);
    if (titleIdx === -1) return [];

    // La ligne d'en-tête est juste après le titre
    const headerIdx = titleIdx + 1;
    const data = [];

    // Lit les lignes de données jusqu'à une ligne complètement vide
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      // Arrêt si ligne vide ou nouvelle section détectée
      if (!r || r.every(c => !c || !c.trim())) break;
      // Arrêt si c'est un titre de section (cellule A contient un emoji ou mot-clé connu)
      const firstCell = r[0] || '';
      if (firstCell.includes('PAYS') || firstCell.includes('LIVREUR') ||
          firstCell.includes('CLOSEUR') || firstCell.includes('CATALOGUE') ||
          firstCell.includes('PRODUIT') && data.length > 0 && !firstCell.startsWith('PRD')) break;
      data.push(r);
    }
    return data;
  }

  async getCommandes() {
    const rows = await this.readSheet('📋 COMMANDES');
    const C = this.cfg.COLS;
    return rows.slice(4)
      .filter(r => r[C.CLIENT] && r[C.CLIENT].trim() !== '')
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

    // ── PRODUITS : cherche "CATALOGUE PRODUITS" ──────────────
    const produits = [];
    const prodTitleIdx = this._findSection(rows, 'CATALOGUE PRODUIT');
    if (prodTitleIdx !== -1) {
      // en-tête sur prodTitleIdx+1, données à partir de prodTitleIdx+2
      for (let i = prodTitleIdx + 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0] || !r[0].trim()) break;
        if (!r[0].startsWith('PRD')) break; // plus de produits
        if (!r[1]) continue;
        produits.push({
          id:        r[0].trim(),
          nom:       r[1].trim(),
          categorie: r[2] ? r[2].trim() : '',
          prixAchat: parseFloat(r[3]) || 0,
          prixVente: parseFloat(r[4]) || 0,
        });
      }
    }

    // ── PAYS & VILLES : cherche "PAYS & VILLES" ──────────────
    const paysVilles = [];
    const paysTitleIdx = this._findSection(rows, 'PAYS');
    if (paysTitleIdx !== -1) {
      for (let i = paysTitleIdx + 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0] || !r[0].trim()) break;
        if (!r[0].startsWith('PV')) break;
        if (!r[1] || !r[2]) continue;
        // Colonne E = Actif (index 4)
        if (r[4] && r[4].trim() !== 'O') continue;
        paysVilles.push({
          id:    r[0].trim(),
          pays:  r[1].trim(),
          ville: r[2].trim(),
          code:  r[3] ? r[3].trim() : '',
        });
      }
    }

    const paysUniques = [...new Set(paysVilles.map(pv => pv.pays))].filter(Boolean);
    const villesParPays = {};
    paysVilles.forEach(pv => {
      if (!villesParPays[pv.pays]) villesParPays[pv.pays] = [];
      if (!villesParPays[pv.pays].includes(pv.ville)) villesParPays[pv.pays].push(pv.ville);
    });

    // ── LIVREURS : cherche "LIVREURS" ────────────────────────
    const livreurs = [];
    const livTitleIdx = this._findSection(rows, 'LIVREUR');
    if (livTitleIdx !== -1) {
      for (let i = livTitleIdx + 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0] || !r[0].trim()) break;
        if (!r[0].startsWith('LIV')) break;
        if (!r[1]) continue;
        // Colonne H = Actif (index 7)
        if (r[7] && r[7].trim() !== 'O') continue;
        livreurs.push({
          id:    r[0].trim(),
          nom:   (r[1].trim() + ' ' + (r[2] ? r[2].trim() : '')).trim(),
          tel:   r[3] ? r[3].trim() : '',
          pays:  r[4] ? r[4].trim() : '',
          ville: r[5] ? r[5].trim() : '',
          frais: parseFloat(r[6]) || 3.5,
        });
      }
    }

    // ── CLOSEURS : cherche "CLOSEUR" ─────────────────────────
    const closeurs = [];
    const cloTitleIdx = this._findSection(rows, 'CLOSEUR');
    if (cloTitleIdx !== -1) {
      for (let i = cloTitleIdx + 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0] || !r[0].trim()) break;
        if (!r[0].startsWith('CLO')) break;
        if (!r[1]) continue;
        // Colonne G = Actif (index 6)
        if (r[6] && r[6].trim() !== 'O') continue;
        closeurs.push({
          id:         r[0].trim(),
          nom:        (r[1].trim() + ' ' + (r[2] ? r[2].trim() : '')).trim(),
          tel:        r[3] ? r[3].trim() : '',
          email:      r[4] ? r[4].trim() : '',
          commission: parseFloat(r[5]) || 0.03,
        });
      }
    }

    console.log(`Config chargée: ${produits.length} produits, ${paysVilles.length} villes, ${livreurs.length} livreurs, ${closeurs.length} closeurs`);
    return { produits, paysVilles, paysUniques, villesParPays, livreurs, closeurs };
  }

  // ── ÉCRITURE via Apps Script ──────────────────────────────
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

  async updateStatut(cmdId, statut, motif='') { return this._post({ action:'UPDATE_STATUT', cmdId, statut, motif }); }
  async assignCloseur(cmdId, closeurNom)       { return this._post({ action:'ASSIGN_CLOSEUR', cmdId, closeurNom }); }
  async assignLivreur(cmdId, livreurNom)       { return this._post({ action:'ASSIGN_LIVREUR', cmdId, livreurNom }); }
  async addCommande(data)                       { return this._post({ action:'ADD_COMMANDE', data }); }
}
