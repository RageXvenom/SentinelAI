// src/moderation/groq-engine.js - AI-powered moderation with Groq
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function analyzeMessageWithGroq(input) {
  const {
    message_content,
    message_history = [],
    user_account_age_days,
    server_join_age_minutes,
    attachments_present,
    links_present,
    image_uploaded,
    previous_warnings_count,
    captcha_verified,
    user_id // Added user_id for owner check
  } = input;

  // Always allow bot owner - no moderation for owner
  if (user_id === process.env.DISCORD_OWNER_ID) {
    return {
      risk_score: 0,
      risk_level: 'SAFE',
      detected_categories: [],
      recommended_action: 'ALLOW',
      reasoning: 'Bot owner - moderation bypassed'
    };
  }

  // Quick check for CAPTCHA requirement
  if (shouldRequireCaptcha(input)) {
    return {
      risk_score: 50,
      risk_level: 'SUSPICIOUS',
      detected_categories: ['NEW_USER_UNVERIFIED'],
      recommended_action: 'CAPTCHA',
      reasoning: 'New or flagged user has not completed CAPTCHA verification.'
    };
  }

  // Build context for AI
  const contextPrompt = buildAnalysisPrompt(input);

  try {
    // Call Groq API for AI analysis
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert Discord moderation AI. Analyze messages for:
- Spam (repetitive content, excessive caps, mass mentions)
- Scams (phishing links, fake giveaways, impersonation)
- Harassment (bullying, hate speech, threats)
- NSFW content
- Malicious links

Respond ONLY with valid JSON in this format:
{
  "risk_score": 0-100,
  "risk_level": "SAFE|SUSPICIOUS|DANGEROUS",
  "detected_categories": ["SPAM", "SCAM", etc],
  "recommended_action": "ALLOW|WARN|DELETE|MUTE|KICK",
  "reasoning": "Brief explanation"
}

Risk levels:
- SAFE (0-30): Allow
- SUSPICIOUS (31-65): Warn or Delete
- DANGEROUS (66-100): Mute or Kick

Be strict but fair. Consider user history and context.`
        },
        {
          role: 'user',
          content: contextPrompt
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const aiResponse = JSON.parse(completion.choices[0]?.message?.content || '{}');

    // Validate and adjust based on user history
    const finalResult = adjustForUserHistory(aiResponse, input);

    console.log(`[GROQ AI] Risk: ${finalResult.risk_score} | Action: ${finalResult.recommended_action}`);

    return finalResult;

  } catch (error) {
    console.error('Error calling Groq API:', error);
    
    // Fallback to rule-based analysis
    return fallbackAnalysis(input);
  }
}

function buildAnalysisPrompt(input) {
  const {
    message_content,
    message_history,
    user_account_age_days,
    server_join_age_minutes,
    attachments_present,
    links_present,
    image_uploaded,
    previous_warnings_count,
    captcha_verified
  } = input;

  return `Analyze this Discord message for moderation:

MESSAGE: "${message_content}"

USER CONTEXT:
- Account age: ${user_account_age_days} days
- Server join time: ${server_join_age_minutes} minutes ago
- Previous warnings: ${previous_warnings_count}
- CAPTCHA verified: ${captcha_verified ? 'Yes' : 'No'}
- Recent message history: ${message_history.join(', ') || 'None'}

MESSAGE METADATA:
- Has attachments: ${attachments_present}
- Contains links: ${links_present}
- Has images: ${image_uploaded}

Provide your moderation decision as JSON.`;
}

function adjustForUserHistory(aiResponse, input) {
  let { risk_score, recommended_action } = aiResponse;
  const { previous_warnings_count } = input;

  // Increase severity for repeat offenders
  if (previous_warnings_count > 0) {
    risk_score = Math.min(risk_score + (previous_warnings_count * 10), 100);
    
    // Escalate action for repeat offenders
    if (previous_warnings_count >= 3 && recommended_action === 'WARN') {
      recommended_action = 'MUTE';
    } else if (previous_warnings_count >= 2 && recommended_action === 'DELETE') {
      recommended_action = 'MUTE';
    } else if (previous_warnings_count >= 4 && recommended_action === 'MUTE') {
      recommended_action = 'KICK';
    }
  }

  // Re-determine risk level
  const risk_level = risk_score <= 30 ? 'SAFE' : 
                     risk_score <= 65 ? 'SUSPICIOUS' : 
                     'DANGEROUS';

  return {
    ...aiResponse,
    risk_score,
    risk_level,
    recommended_action
  };
}

function shouldRequireCaptcha(input) {
  const {
    user_account_age_days,
    server_join_age_minutes,
    previous_warnings_count,
    captcha_verified
  } = input;

  if (captcha_verified) {
    return false;
  }

  return (
    user_account_age_days < 7 ||
    server_join_age_minutes < 10 ||
    previous_warnings_count > 0
  );
}

// Fallback rule-based analysis if AI fails
function fallbackAnalysis(input) {
  const {
    message_content,
    message_history,
    user_account_age_days,
    server_join_age_minutes,
    links_present,
    previous_warnings_count,
    user_id
  } = input;

  // Skip moderation for owner
  if (user_id === process.env.DISCORD_OWNER_ID) {
    return {
      risk_score: 0,
      risk_level: 'SAFE',
      detected_categories: [],
      recommended_action: 'ALLOW',
      reasoning: 'Bot owner - moderation bypassed'
    };
  }

  const detectedCategories = [];
  let riskScore = 0;

  // Spam detection
  const spamPatterns = [
    /(.)\1{10,}/,
    /@everyone|@here/gi,
    /\b(buy|shop|discount|free|prize)\b/gi
  ];

  spamPatterns.forEach(pattern => {
    if (pattern.test(message_content)) {
      detectedCategories.push('SPAM');
      riskScore += 20;
    }
  });

  // Scam detection
  const scamPatterns = [
    /\b(free nitro|discord nitro|steam gift)\b/gi,
    /\b(verify account|click link)\b/gi,
    /bit\.ly|tinyurl/gi
  ];

  scamPatterns.forEach(pattern => {
    if (pattern.test(message_content)) {
      detectedCategories.push('SCAM');
      riskScore += 30;
    }
  });

  // Harassment detection
  const harassmentPatterns = [
    /\b(kill yourself|kys|die)\b/gi,
    /\b(idiot|stupid|dumb|loser)\b/gi
  ];

  harassmentPatterns.forEach(pattern => {
    if (pattern.test(message_content)) {
      detectedCategories.push('HARASSMENT');
      riskScore += 25;
    }
  });

  // Account age risk
  if (user_account_age_days < 7) {
    detectedCategories.push('NEW_ACCOUNT');
    riskScore += 10;
  }

  if (server_join_age_minutes < 5) {
    detectedCategories.push('IMMEDIATE_POST_JOIN');
    riskScore += 15;
  }

  // Links risk
  if (links_present) {
    detectedCategories.push('CONTAINS_LINKS');
    riskScore += 10;
  }

  // Previous warnings
  if (previous_warnings_count > 0) {
    detectedCategories.push('REPEAT_OFFENDER');
    riskScore += previous_warnings_count * 10;
  }

  riskScore = Math.min(riskScore, 100);

  const risk_level = riskScore <= 30 ? 'SAFE' : 
                     riskScore <= 65 ? 'SUSPICIOUS' : 
                     'DANGEROUS';

  const recommended_action = determineAction(riskScore, risk_level, previous_warnings_count);

  return {
    risk_score: riskScore,
    risk_level,
    detected_categories: [...new Set(detectedCategories)],
    recommended_action,
    reasoning: `Fallback analysis: ${detectedCategories.join(', ') || 'No violations detected'}`
  };
}

function determineAction(score, riskLevel, warningCount) {
  if (riskLevel === 'SAFE') return 'ALLOW';

  if (riskLevel === 'SUSPICIOUS') {
    if (warningCount === 0) return 'WARN';
    if (warningCount === 1) return 'DELETE';
    return 'MUTE';
  }

  if (riskLevel === 'DANGEROUS') {
    if (score >= 85 && warningCount >= 2) return 'KICK';
    if (score >= 70) return 'MUTE';
    return 'DELETE';
  }

  return 'WARN';
}
