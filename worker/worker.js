const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config({ path: '/home/viktor/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 20 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function processQueue() {
  while (true) {
    try {
      const { data, error } = await supabase
        .from('audit_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error("Error fetching from queue:", error);
        await sleep(5000);
        continue;
      }

      if (!data || data.length === 0) {
        await sleep(5000);
        continue;
      }

      const request = data[0];
      console.log(`[${new Date().toISOString()}] Processing request ${request.id}...`);

      // 1. Check user credits
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', request.user_id)
        .single();

      if (profileError || !profile) {
        console.error(`Error checking profile ${request.user_id}:`, profileError);
        await supabase
          .from('audit_requests')
          .update({ status: 'failed', error_message: 'Profilis nerastas.' })
          .eq('id', request.id);
        continue;
      }

      if (profile.credits <= 0) {
        console.log(`User ${request.user_id} has insufficient credits (${profile.credits}).`);
        await supabase
          .from('audit_requests')
          .update({ status: 'failed', error_message: 'Nepakanka kreditų. Papildykite savo balansą.' })
          .eq('id', request.id);
        continue;
      }

      // 2. Deduct credit and update status
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', request.user_id);

      if (deductError) {
        console.error("Error deducting credit:", deductError);
        await supabase
          .from('audit_requests')
          .update({ status: 'failed', error_message: 'Nepavyko nuskaityti kredito.' })
          .eq('id', request.id);
        continue;
      }

      await supabase
        .from('audit_requests')
        .update({ status: 'processing' })
        .eq('id', request.id);

      // 3. Write prompt file
      const promptContent = `Run a GEO audit on the following website content. Focus strictly on Generative Engine Optimization metrics (SDS, FES, CPS). Return a JSON object with keys: scores (semantic_density_score, factual_extraction_score, citation_probability_score - each 0-10), modifications (quick_wins array, strategic_items array), and schema_markup (suggested JSON-LD).

<web_content>
${request.input_text}
</web_content>`;

      const tempFilePath = '/home/viktor/.openclaw/temp_prompt.txt';
      fs.writeFileSync(tempFilePath, promptContent, 'utf-8');

      // 4. Run openclaw agent directly (CLI installed via npm)
      console.log(`[${new Date().toISOString()}] Executing openclaw agent...`);
      const cmd = `openclaw agent --agent main --message-file ${tempFilePath} --json`;
      
      try {
        const output = await runCommand(cmd);
        
        const jsonStartIndex = output.indexOf('{');
        if (jsonStartIndex === -1) {
          console.error("Command output:", output);
          throw new Error("Modelio atsakymas nebuvo rastas (nerastas '{' simbolis).");
        }
        const jsonOnly = output.substring(jsonStartIndex);
        
        let parsedOutput;
        try {
          parsedOutput = JSON.parse(jsonOnly);
        } catch (err) {
          console.error("Failed to parse JSON segment:", jsonOnly);
          throw new Error("Nepavyko nuskaityti JSON iš modelio atsakymo.");
        }

        let rawText = "";
        if (parsedOutput.payloads && parsedOutput.payloads.length > 0) {
          rawText = parsedOutput.payloads[0].text || "";
        } else if (parsedOutput.finalAssistantVisibleText) {
          rawText = parsedOutput.finalAssistantVisibleText;
        } else {
          rawText = typeof parsedOutput === 'string' ? parsedOutput : JSON.stringify(parsedOutput);
        }

        console.log(`[DEBUG] Raw Text from agent:\n${rawText}\n`);

        // Extract JSON block
        const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
        
        console.log(`[DEBUG] Extracted JSON Str:\n${jsonStr}\n`);
        
        let report;
        try {
          report = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error("Error parsing LLM JSON output:", parseErr, "Raw string:", jsonStr);
          throw new Error("Modelio atsakymas nebuvo validus JSON struktūros formatas.");
        }

        const scores = report.scores || {
          semantic_density_score: 0,
          factual_extraction_score: 0,
          citation_probability_score: 0
        };

        // Update database with success
        await supabase
          .from('audit_requests')
          .update({
            status: 'completed',
            scores: scores,
            report: report
          })
          .eq('id', request.id);

        console.log(`[${new Date().toISOString()}] Request ${request.id} completed successfully.`);

      } catch (cmdError) {
        console.error("Audit command failed:", cmdError);
        
        // Refund credit
        await supabase
          .from('profiles')
          .update({ credits: profile.credits })
          .eq('id', request.user_id);

        await supabase
          .from('audit_requests')
          .update({
            status: 'failed',
            error_message: cmdError.message || 'Sistemos klaida vykdant auditą.'
          })
          .eq('id', request.id);
      }

      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

    } catch (loopError) {
      console.error("Unexpected error in worker loop:", loopError);
    }

    await sleep(5000);
  }
}

console.log("GEO Auditor queue worker started successfully...");
processQueue();
