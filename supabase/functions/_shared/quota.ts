// _shared/quota.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

export interface QuotaStatus {
  allowed: boolean
  tokensUsed: number
  monthlyLimit: number
  remainingTokens: number
  plan: string
  resetDate: string
}

const FRIENDLY_LIMIT_MESSAGE =
  "You've reached your monthly AI limit. Your quota will reset automatically, or you can upgrade your plan."

/**
 * Call ONCE at the top of every AI-calling edge function, right after
 * authenticating the user, before any provider call. Also performs
 * the monthly reset transparently — callers never handle resets
 * themselves.
 */
export async function checkUserQuota(userId: string): Promise<QuotaStatus> {
  const { data, error } = await supabase.rpc('get_or_reset_ai_quota', { p_user_id: userId })
  if (error || !data) {
    // Fail OPEN: a quota-system outage should degrade to "unmetered
    // for this request", never lock every user out of Curry because
    // one RPC call hiccuped.
    console.error('checkUserQuota: RPC failed, failing open:', error)
    return { allowed: true, tokensUsed: 0, monthlyLimit: Infinity, remainingTokens: Infinity, plan: 'free', resetDate: new Date().toISOString() }
  }
  const remaining = Math.max(0, data.monthly_token_limit - data.tokens_used)
  return {
    allowed: data.tokens_used < data.monthly_token_limit,
    tokensUsed: data.tokens_used,
    monthlyLimit: data.monthly_token_limit,
    remainingTokens: remaining,
    plan: data.plan,
    resetDate: data.reset_date,
  }
}

/**
 * Call ONCE per request, after ALL provider calls for that request
 * are done, with the SUM of tokens used. One write per request — not
 * one per internal AI call — matters for handlers like `daily_insight`
 * that make 3+ AI calls in a single request.
 */
export async function incrementUsage(userId: string, totalTokens: number): Promise<void> {
  if (!totalTokens || totalTokens <= 0) return
  const { error } = await supabase.rpc('increment_ai_usage', { p_user_id: userId, p_tokens: Math.round(totalTokens) })
  if (error) console.error('incrementUsage failed:', error) // never throw — a usage-logging failure must not fail the user's real response
}

export async function getRemainingTokens(userId: string): Promise<number> {
  return (await checkUserQuota(userId)).remainingTokens
}

export function quotaExceededResponse(status: QuotaStatus, cors: Record<string, string>) {
  return new Response(JSON.stringify({
    ok: false,
    error: FRIENDLY_LIMIT_MESSAGE,
    quotaExceeded: true,
    tokens_used: status.tokensUsed,
    monthly_limit: status.monthlyLimit,
    remaining_tokens: 0,
    plan: status.plan,
  }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
}
