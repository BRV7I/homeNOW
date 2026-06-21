// ============================================================
//  Data layer — tutta la comunicazione con Supabase passa da qui.
//  Espone window.Data con metodi async usati da app.js.
//  Se in futuro cambi backend, basta riscrivere questo file.
// ============================================================
(function () {
  const C = window.CONFIG || {};
  const configured =
    C.SUPABASE_URL && C.SUPABASE_ANON_KEY &&
    C.SUPABASE_URL.indexOf("INCOLLA") === -1 &&
    C.SUPABASE_ANON_KEY.indexOf("INCOLLA") === -1;

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  }

  const BUCKET = C.BUCKET || "casa-files";
  const PROPERTY_ID = C.PROPERTY_ID;

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }
  function safeName(n) {
    return (n || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-60);
  }

  window.Data = {
    isConfigured: () => configured,

    // dati della casa (fallback statico se la riga non esiste)
    async getProperty() {
      const fallback = {
        address: "Viale Marco Fulvio Nobiliore 50",
        title: "Monolocale, 32 m²",
        sub: "Roma, zona Tuscolano (00178)",
        estimate: 110000, estimate_min: 98000, estimate_max: 122000
      };
      if (!sb) return fallback;
      try {
        const { data, error } = await sb.from("properties")
          .select("*").eq("id", PROPERTY_ID).maybeSingle();
        if (error || !data) return fallback;
        return {
          address: data.address || fallback.address,
          title: data.title || fallback.title,
          sub: data.sub || fallback.sub,
          estimate: data.estimate ?? fallback.estimate,
          estimate_min: data.estimate_min ?? fallback.estimate_min,
          estimate_max: data.estimate_max ?? fallback.estimate_max
        };
      } catch (e) { return fallback; }
    },

    // documenti dell'agenzia
    async listDocuments() {
      if (!sb) return [];
      const { data, error } = await sb.from("documents")
        .select("*").eq("property_id", PROPERTY_ID)
        .order("sort", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    // richiesta di contatto dai pulsanti "Contattaci"
    async addLead(kind, contact) {
      if (!sb) return null;
      const { data, error } = await sb.from("leads")
        .insert({ property_id: PROPERTY_ID, kind, contact: contact || null })
        .select().single();
      if (error) throw error;
      return data;
    },

    // log di uno sblocco (fire-and-forget)
    async logAccess(event) {
      if (!sb) return;
      try {
        await sb.from("access_log").insert({
          property_id: PROPERTY_ID, event: event || "unlock",
          ua: (navigator.userAgent || "").slice(0, 300)
        });
      } catch (e) { /* non bloccante */ }
    },

    // elementi caricati dal proprietario
    async listItems() {
      if (!sb) return [];
      const { data, error } = await sb.from("items")
        .select("*").eq("property_id", PROPERTY_ID)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    // crea un elemento (con eventuale file)
    async addItem({ type, title, file }) {
      if (!sb) throw new Error("Supabase non configurato");
      let file_path = null, mime = null;
      if (file) {
        file_path = PROPERTY_ID + "/" + uid() + "-" + safeName(file.name);
        mime = file.type || "application/octet-stream";
        const up = await sb.storage.from(BUCKET).upload(file_path, file, {
          cacheControl: "3600", upsert: false, contentType: mime
        });
        if (up.error) throw up.error;
      }
      const row = {
        property_id: PROPERTY_ID, type,
        title: title || type,
        file_name: file ? file.name : null,
        file_path, mime
      };
      const { data, error } = await sb.from("items").insert(row).select().single();
      if (error) throw error;
      return data;
    },

    // URL firmato temporaneo per visualizzare/scaricare un file privato
    async signedUrl(path, seconds = 120) {
      if (!sb || !path) return null;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, seconds);
      if (error) throw error;
      return data.signedUrl;
    },

    // elimina elemento + file (chiamato solo su conferma utente)
    async deleteItem(item) {
      if (!sb) throw new Error("Supabase non configurato");
      if (item.file_path) {
        await sb.storage.from(BUCKET).remove([item.file_path]);
      }
      const { error } = await sb.from("items").delete().eq("id", item.id);
      if (error) throw error;
    }
  };
})();
