const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/viktor/.env' });

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TELEGRAM_TOKEN || !supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing TELEGRAM_BOT_TOKEN, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
let offset = 0;

async function sendMessage(chatId, text, parseMode = 'HTML') {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
    });
  } catch (err) {
    console.error('Error sending message:', err);
  }
}

async function handleCommand(chatId, text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  if (command === '/start') {
    await sendMessage(chatId, 
      `🐾 <b>GEO Auditor Bot</b>\n\n` +
      `Šis botas leidžia atlikti GEO (Generative Engine Optimization) auditą tiesiogiai iš Telegram.\n\n` +
      `<b>Komandos:</b>\n` +
      `• /pair &lt;jūsų_supabase_id&gt; — Susieti Telegram su web paskyra\n` +
      `• /credits — Patikrinti kreditų likutį\n` +
      `• /audit &lt;svetainės tekstas&gt; — Pradėti GEO auditą\n` +
      `• /history — Paskutiniai 5 auditai\n` +
      `• /help — Pagalba`
    );
    return;
  }

  if (command === '/help') {
    await sendMessage(chatId,
      `📋 <b>Pagalba</b>\n\n` +
      `1. Pirmiausia savo web dashboarde nukopijuokite Supabase User ID\n` +
      `2. Susieti paskyrą: <code>/pair jūsų_id</code>\n` +
      `3. Siųsti auditą: <code>/audit [svetainės tekstas arba HTML]</code>\n` +
      `4. Kreditai naudojami iš bendro balanso su web svetaine`
    );
    return;
  }

  if (command === '/pair') {
    const userId = parts[1];
    if (!userId) {
      await sendMessage(chatId, '❌ Nurodykite savo User ID: <code>/pair jūsų_id</code>');
      return;
    }

    // Check if user exists in profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      await sendMessage(chatId, '❌ Vartotojas su tokiu ID nerastas. Patikrinkite ID.');
      return;
    }

    // Update profile with telegram_chat_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ telegram_chat_id: String(chatId) })
      .eq('id', userId);

    if (updateError) {
      await sendMessage(chatId, '❌ Klaida susiejant: ' + updateError.message);
      return;
    }

    await sendMessage(chatId,
      `✅ <b>Sėkmingai susieta!</b>\n\n` +
      `Telegram susietas su paskyra: <code>${profile.email}</code>\n` +
      `Dabar galite naudoti /audit ir /credits komandas.`
    );
    return;
  }

  // For all other commands, find user by telegram_chat_id
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .single();

  if (profileError || !userProfile) {
    await sendMessage(chatId,
      '⚠️ Jūsų Telegram dar nesusietas su GEO Auditor paskyra.\n\n' +
      'Naudokite: <code>/pair jūsų_supabase_id</code>'
    );
    return;
  }

  if (command === '/credits') {
    await sendMessage(chatId,
      `💰 <b>Kreditų balansas</b>\n\n` +
      `Likutis: <b>${userProfile.credits}</b> kreditai(-ų)\n` +
      `Paskyra: ${userProfile.email}\n\n` +
      `Papildyti: https://geo-auditor-web-rust.vercel.app`
    );
    return;
  }

  if (command === '/history') {
    const { data: audits } = await supabase
      .from('audit_requests')
      .select('id, status, created_at, target_url, scores')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!audits || audits.length === 0) {
      await sendMessage(chatId, '📭 Dar neatlikėte jokių auditų.');
      return;
    }

    let msg = '📊 <b>Paskutiniai auditai:</b>\n\n';
    audits.forEach((a, i) => {
      const date = new Date(a.created_at).toLocaleString();
      const target = a.target_url || 'Tekstas';
      let scoreStr = '—';
      if (a.scores) {
        scoreStr = `SDS:${a.scores.semantic_density_score?.toFixed(1)} FES:${a.scores.factual_extraction_score?.toFixed(1)} CPS:${a.scores.citation_probability_score?.toFixed(1)}`;
      }
      const statusEmoji = a.status === 'completed' ? '✅' : a.status === 'processing' ? '⏳' : a.status === 'pending' ? '🕐' : '❌';
      msg += `${i + 1}. ${statusEmoji} ${target}\n   ${date} | ${scoreStr}\n\n`;
    });

    await sendMessage(chatId, msg);
    return;
  }

  if (command === '/audit') {
    const inputText = text.substring('/audit '.length).trim();
    if (!inputText || inputText.length < 20) {
      await sendMessage(chatId, '❌ Pateikite bent 20 simbolių teksto auditui:\n<code>/audit [svetainės tekstas]</code>');
      return;
    }

    if (userProfile.credits <= 0) {
      await sendMessage(chatId,
        '❌ <b>Nepakanka kreditų!</b>\n\n' +
        'Papildykite balansą: https://geo-auditor-web-rust.vercel.app'
      );
      return;
    }

    // Create audit request
    const { data: audit, error: auditError } = await supabase
      .from('audit_requests')
      .insert({
        user_id: userProfile.id,
        source_type: 'telegram',
        status: 'pending',
        input_text: inputText,
        target_url: null
      })
      .select()
      .single();

    if (auditError) {
      await sendMessage(chatId, '❌ Klaida kuriant užklausą: ' + auditError.message);
      return;
    }

    await sendMessage(chatId,
      `✅ <b>Audito užklausa priimta!</b>\n\n` +
      `ID: <code>${audit.id}</code>\n` +
      `Statusas: 🕐 Laukia eilėje\n\n` +
      `Gausite pranešimą kai auditas bus baigtas.`
    );

    // Start polling for completion
    pollAuditResult(chatId, audit.id);
    return;
  }

  // Unknown command - treat as audit text
  if (text.length >= 20) {
    await sendMessage(chatId,
      '💡 Atrodo, kad norite atlikti auditą. Naudokite:\n<code>/audit ' + text.substring(0, 30) + '...</code>'
    );
  } else {
    await sendMessage(chatId, '❓ Nežinoma komanda. Naudokite /help');
  }
}

async function pollAuditResult(chatId, auditId) {
  let attempts = 0;
  const maxAttempts = 60; // 5 min max (5s * 60)

  const interval = setInterval(async () => {
    attempts++;
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      await sendMessage(chatId, `⏰ Auditas <code>${auditId}</code> vis dar vykdomas. Patikrinkite vėliau per /history`);
      return;
    }

    const { data: audit } = await supabase
      .from('audit_requests')
      .select('status, scores, error_message')
      .eq('id', auditId)
      .single();

    if (!audit) return;

    if (audit.status === 'completed') {
      clearInterval(interval);
      const s = audit.scores || {};
      await sendMessage(chatId,
        `✅ <b>Auditas baigtas!</b>\n\n` +
        `📊 <b>Rezultatai:</b>\n` +
        `• Semantic Density Score: <b>${s.semantic_density_score?.toFixed(1) || '—'}</b>/10\n` +
        `• Factual Extraction Score: <b>${s.factual_extraction_score?.toFixed(1) || '—'}</b>/10\n` +
        `• Citation Probability Score: <b>${s.citation_probability_score?.toFixed(1) || '—'}</b>/10\n\n` +
        `Pilna ataskaita: https://geo-auditor-web-rust.vercel.app`
      );
    } else if (audit.status === 'failed') {
      clearInterval(interval);
      await sendMessage(chatId,
        `❌ <b>Auditas nepavyko</b>\n\nKlaida: ${audit.error_message || 'Nežinoma klaida'}`
      );
    }
  }, 5000);
}

async function pollUpdates() {
  while (true) {
    try {
      const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            console.log(`[${new Date().toISOString()}] Message from ${chatId}: ${text.substring(0, 50)}`);
            handleCommand(chatId, text).catch(err => console.error('Handler error:', err));
          }
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

console.log('GEO Auditor Telegram bot started...');
pollUpdates();
