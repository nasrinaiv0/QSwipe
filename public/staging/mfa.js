/** Staging TOTP transport contract. The provider, not the browser, grants AAL2. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9._~-]{40,8192}$/;
function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('Invalid factor or challenge.');
  return value;
}
export async function listTotp(request, token) {
  const user = await request('user', null, token, 'GET');
  if (!user || !UUID.test(user.id ?? '') || user.is_anonymous === true || user.role !== 'authenticated' || !user.email_confirmed_at) throw new Error('Invalid identity.');
  if (user.factors != null && !Array.isArray(user.factors)) throw new Error('Invalid factors.');
  return (user.factors ?? []).filter(f => f?.factor_type === 'totp' && f.status === 'verified' && UUID.test(f.id ?? ''))
    .map(f => ({ id: f.id, label: typeof f.friendly_name === 'string' ? f.friendly_name.slice(0, 80) : 'Authenticator' }));
}
export async function enrollTotp(request, token) {
  const factor = await request('factors', { factor_type:'totp', issuer:'QSwipe Staging' }, token);
  const id = uuid(factor?.id);
  const secret = factor?.totp?.secret;
  if (factor?.type !== 'totp' || typeof secret !== 'string' || !/^[A-Z2-7]{16,128}={0,6}$/i.test(secret)) throw new Error('Invalid enrollment.');
  // Deliberately ignore provider SVG and URI. Manual key is text only.
  return { id, secret };
}
export async function verifyTotp(request, token, factorId, code) {
  const id = uuid(factorId);
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('Enter a six-digit authenticator code.');
  const challenge = await request('factors/'+id+'/challenge', {}, token);
  const challengeId = uuid(challenge?.id);
  const result = await request('factors/'+id+'/verify', { challenge_id:challengeId, code }, token);
  if (typeof result?.access_token !== 'string' || !TOKEN.test(result.access_token) || result.access_token === token) throw new Error('Invalid upgraded session.');
  return result.access_token;
}
