'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Dashboard states
  const [inputText, setInputText] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [auditList, setAuditList] = useState([]);
  const [activeReport, setActiveReport] = useState(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchAudits(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchAudits(session.user.id);
      } else {
        setProfile(null);
        setAuditList([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Poll for audit request status changes if any are pending/processing
  useEffect(() => {
    if (!user) return;
    const hasActiveAudits = auditList.some(a => a.status === 'pending' || a.status === 'processing');
    if (!hasActiveAudits) return;

    const interval = setInterval(() => {
      fetchAudits(user.id);
      fetchProfile(user.id);
    }, 4000);

    return () => clearInterval(interval);
  }, [auditList, user]);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudits = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('audit_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditList(data);
    } catch (err) {
      console.error('Error fetching audits:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
      } else {
        // Auto-confirm enabled, so sign in immediately
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          setAuthSuccess('Registracija sėkminga! Prisijunkite su savo duomenimis.');
          setAuthMode('login');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const downloadJsonLd = (data) => {
    const jsonStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'schema_org_markup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasAnyInput = inputText.trim() || targetUrl.trim() || repoUrl.trim() || uploadedFile;

  const handleRunAudit = async (e) => {
    e.preventDefault();
    if (!hasAnyInput) {
      alert('Pateikite bent vieną šaltinį: URL, tekstą, GitHub repo arba failą.');
      return;
    }

    if (profile.credits <= 0) {
      alert('Nepakanka kreditų! Papildykite balansą.');
      return;
    }

    setAuditing(true);
    try {
      // Build combined input text from all sources
      let combinedInput = '';
      if (targetUrl.trim()) {
        combinedInput += `[SVETAINĖS URL]: ${targetUrl.trim()}\n\n`;
      }
      if (repoUrl.trim()) {
        combinedInput += `[GITHUB REPO]: ${repoUrl.trim()}\n\n`;
      }
      if (inputText.trim()) {
        combinedInput += `[TURINYS]:\n${inputText.trim()}\n\n`;
      }
      if (uploadedFile) {
        const fileText = await uploadedFile.text();
        combinedInput += `[FAILAS: ${uploadedFile.name}]:\n${fileText.substring(0, 50000)}\n\n`;
      }

      const { data, error } = await supabase
        .from('audit_requests')
        .insert({
          user_id: user.id,
          source_type: 'web',
          status: 'pending',
          input_text: combinedInput,
          target_url: targetUrl.trim() || repoUrl.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      setInputText('');
      setTargetUrl('');
      setRepoUrl('');
      setUploadedFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload');
      if (fileInput) fileInput.value = '';
      // Refresh audit list immediately
      fetchAudits(user.id);
      fetchProfile(user.id);
    } catch (err) {
      alert('Klaida siunčiant užklausą: ' + err.message);
    } finally {
      setAuditing(false);
    }
  };

  const handleBuyCredits = async () => {
    // Stripe checkout simulation or redirect
    alert('Nukreipiama į Stripe apmokėjimą (Test Mode)...');
    try {
      // In production, we call Next.js API route to create Stripe checkout session
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Nepavyko sukurti Stripe mokėjimo.');
      }
    } catch (err) {
      alert('Klaida: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '4px solid rgba(99, 102, 241, 0.1)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Kraunama...</p>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // 1. Landing + Login Screen
  if (!user) {
    return (
      <div className="container animate-fade-in" style={{ padding: '80px 24px', maxWidth: '1000px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '2rem' }}>🐾</span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', tracking: '-0.03em' }}>GEO Auditor</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setAuthMode('login')}>Prisijungti</button>
        </header>

        <main style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '64px', alignItems: 'center' }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: '3.5rem', lineHeight: '1.1', marginBottom: '24px' }}>
              Optimizuokite savo turinį AI paieškos erai.
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', marginBottom: '32px', maxWidth: '500px' }}>
              Tradicinis SEO miršta. Perplexity, Gemini ir SearchGPT cituoja tik geriausiai pritaikytus brand assets. Atlikite GEO auditą ir padidinkite savo prekių ženklo matomumą.
            </p>
            
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-success">✓</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Deterministiniai balai</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-info">✓</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Gemma 4 & Gemini parama</span>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>
              {authMode === 'login' ? 'Prisijungti prie paskyros' : 'Sukurti naują paskyrą'}
            </h3>
            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label className="form-label">El. paštas</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slaptažodis</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {authError && <div style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '16px' }}>{authError}</div>}
              {authSuccess && <div style={{ color: 'var(--success)', fontSize: '0.875rem', marginBottom: '16px' }}>{authSuccess}</div>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }}>
                {authMode === 'login' ? 'Prisijungti' : 'Registruotis'}
              </button>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                {authMode === 'login' ? (
                  <>
                    Neturite paskyros?{' '}
                    <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAuthMode('signup')}>
                      Registruotis
                    </span>
                  </>
                ) : (
                  <>
                    Jau turite paskyrą?{' '}
                    <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAuthMode('login')}>
                      Prisijungti
                    </span>
                  </>
                )}
              </p>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // 2. Report View Screen
  if (activeReport) {
    const reportData = activeReport.report || {};
    const scores = activeReport.scores || {};
    const thoughtProcess = reportData.thought_process || {};

    return (
      <div className="container animate-fade-in" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
        <button className="btn btn-secondary" style={{ marginBottom: '32px' }} onClick={() => setActiveReport(null)}>
          ← Atgal į Dashboard
        </button>

        <div className="glass-panel" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '8px' }}>Ataskaita</span>
              <h2 style={{ fontSize: '2rem' }}>GEO Audito Rezultatai</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                ID: {activeReport.id} • Atlikta: {new Date(activeReport.created_at).toLocaleString()}
              </p>
            </div>
            {activeReport.target_url && (
              <span className="badge badge-success" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                {activeReport.target_url}
              </span>
            )}
          </div>

          {/* Scores Overview Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '40px' }}>
            <div className="glass-panel" style={{ textAlign: 'center', background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Semantic Density Score</h4>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)' }}>
                {scores.semantic_density_score?.toFixed(1) || '0.0'}
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 400 }}> /10</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Semantinis tankis ir nereikalingų frazių nebuvimas</p>
            </div>

            <div className="glass-panel" style={{ textAlign: 'center', background: 'rgba(6, 182, 212, 0.05)', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Factual Extraction Score</h4>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--secondary)' }}>
                {scores.factual_extraction_score?.toFixed(1) || '0.0'}
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 400 }}> /10</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Faktinių duomenų, lentelių ir skaičių matomumas</p>
            </div>

            <div className="glass-panel" style={{ textAlign: 'center', background: 'rgba(236, 72, 153, 0.05)', borderColor: 'rgba(236, 72, 153, 0.2)' }}>
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Citation Probability Score</h4>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--accent)' }}>
                {scores.citation_probability_score?.toFixed(1) || '0.0'}
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 400 }}> /10</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Šaltinių pateikimo ir citavimo tikimybė</p>
            </div>
          </div>

          {/* Recommendations and Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Rekomendacijos (Modifications)
              </h3>
              
              {reportData.modifications && reportData.modifications.quick_wins && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: 'var(--success)', marginBottom: '10px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-success">Quick Wins</span> Greiti Pataisymai
                  </h4>
                  <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                    {reportData.modifications.quick_wins.map((win, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{win}</li>
                    ))}
                  </ul>
                </div>
              )}

              {reportData.modifications && reportData.modifications.strategic_items && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: 'var(--warning)', marginBottom: '10px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-warning">Strategic</span> Ilgalaikė Strategija
                  </h4>
                  <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                    {reportData.modifications.strategic_items.map((strat, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{strat}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              {reportData.schema_markup && (
                <div className="glass-panel" style={{ background: '#070a13', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '2.5rem' }}>📄</span>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>Schema.org struktūra paruošta</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>JSON-LD failas optimizuotas citavimui paieškos varikliuose</p>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem' }} onClick={() => downloadJsonLd(reportData.schema_markup)}>
                    Atsisiųsti JSON-LD failą
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Dashboard Screen
  return (
    <div className="container animate-fade-in" style={{ padding: '40px 24px', maxWidth: '1100px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🐾</span>
          <span style={{ fontSize: '1.25rem', fontWeight: '800', tracking: '-0.02em' }}>GEO Auditor</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{profile?.email}</span>
          <button className="btn btn-secondary" onClick={handleLogout}>Atsijungti</button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '32px' }}>
        {/* Left Side: Audit Form */}
        <div>
          <div className="glass-panel" style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Naujas GEO Auditas</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Pateikite bent vieną šaltinį — URL, tekstą, GitHub repo arba failą.
            </p>
            
            <form onSubmit={handleRunAudit}>
              {/* Source 1: Website URL */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>🌐</span> Svetainės adresas
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="pvz. leonamai.lt arba https://company.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>

              {/* Source 2: Text content */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>📝</span> Tekstinis turinys / HTML kodas
                </label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '150px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  placeholder="Nukopijuokite svetainės turinį, marketingo aprašymą arba HTML kodą..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>

              {/* Source 3: GitHub repo */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>📦</span> GitHub repo (public)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="pvz. https://github.com/user/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>

              {/* Source 4: File upload */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>📎</span> Failas (ZIP, HTML, TXT)
                </label>
                <div style={{
                  position: 'relative',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: uploadedFile ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
                }}>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".zip,.html,.htm,.txt,.css,.js,.json,.xml,.md"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    onChange={(e) => setUploadedFile(e.target.files[0] || null)}
                  />
                  {uploadedFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--success)' }}>✓</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{uploadedFile.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Pasirinkite arba nutempkite failą</span>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={auditing || !hasAnyInput}>
                {auditing ? 'Siunčiama...' : 'Pradėti GEO Auditą (1 kreditas)'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Profile Status & Stripe Checkout */}
        <div>
          <div className="glass-panel" style={{ marginBottom: '32px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Jūsų Balansas</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{profile?.credits ?? 0}</span>
              <span style={{ color: 'var(--text-secondary)' }}>kreditai (-ų)</span>
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }} onClick={handleBuyCredits}>
              Papildyti balansą (+10 kreditų / $9)
            </button>
            
            <button className="btn btn-secondary" style={{ width: '100%', cursor: 'default', opacity: 0.8 }} disabled>
              Telegram paslauga išjungta
            </button>
          </div>
        </div>
      </div>

      {/* History Log */}
      <div className="glass-panel" style={{ marginTop: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Atlikti auditai</h3>
        
        {auditList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Užklausų istorija tuščia.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px' }}>Data</th>
                  <th style={{ padding: '12px' }}>URL / Turinys</th>
                  <th style={{ padding: '12px' }}>Statusas</th>
                  <th style={{ padding: '12px' }}>Balai (SDS / FES / CPS)</th>
                  <th style={{ padding: '12px' }}>Veiksmas</th>
                </tr>
              </thead>
              <tbody>
                {auditList.map((audit) => (
                  <tr key={audit.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(audit.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {audit.target_url || audit.input_text.substring(0, 40) + '...'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {audit.status === 'pending' && <span className="badge badge-warning">Laukia eilėje</span>}
                      {audit.status === 'processing' && <span className="badge badge-info" style={{ animation: 'pulse 1.5s infinite' }}>Audituojama</span>}
                      {audit.status === 'completed' && <span className="badge badge-success">Baigta</span>}
                      {audit.status === 'failed' && (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                          Klaida: {audit.error_message || 'Sistemos sutrikimas'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {audit.status === 'completed' && audit.scores ? (
                        <>
                          <span style={{ color: 'var(--primary)' }}>{audit.scores.semantic_density_score?.toFixed(1)}</span>
                          <span style={{ color: 'var(--text-muted)' }}> / </span>
                          <span style={{ color: 'var(--secondary)' }}>{audit.scores.factual_extraction_score?.toFixed(1)}</span>
                          <span style={{ color: 'var(--text-muted)' }}> / </span>
                          <span style={{ color: 'var(--accent)' }}>{audit.scores.citation_probability_score?.toFixed(1)}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {audit.status === 'completed' && (
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setActiveReport(audit)}>
                          Žiūrėti
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
