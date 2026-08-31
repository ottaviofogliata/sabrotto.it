const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_SIZE = 10;
const MAX_UPLOADS_PER_HOUR = 30;
const PENDING_TTL_SECONDS = 2 * 60 * 60;
const GUEST_TTL_SECONDS = 36 * 60 * 60;
const GALLERY_TTL_SECONDS = 7 * 24 * 60 * 60;
const GUEST_COOKIE = 'sb_photo_guest';
const GALLERY_COOKIE = 'sb_photo_gallery';
const JPEG_MIME = 'image/jpeg';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let googleTokenCache = null;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function apiError(status, message) {
  return json({ statusCode: status, statusMessage: message }, status);
}

async function readJson(request, maxBytes = 16 * 1024) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new ApiError(413, 'Request too large');
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON');
  }
}

function parseCookies(request) {
  const result = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) result[name] = value;
  }
  return result;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sha256Bytes(value) {
  const source = typeof value === 'string' ? textEncoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', source));
}

async function sha256Hex(value) {
  const bytes = await sha256Bytes(value);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(value)));
}

async function createSignedSession(role, sessionId, expiresAt, secret) {
  const payload = `${role}:${sessionId}:${expiresAt}`;
  const payloadToken = bytesToBase64Url(textEncoder.encode(payload));
  const signature = bytesToBase64Url(await hmac(payloadToken, secret));
  return `${payloadToken}.${signature}`;
}

async function verifySignedSession(token, role, secret, now = Math.floor(Date.now() / 1000)) {
  if (!token || !secret) return null;
  const [payloadToken, suppliedSignature, extra] = token.split('.');
  if (!payloadToken || !suppliedSignature || extra) return null;

  const expectedSignature = bytesToBase64Url(await hmac(payloadToken, secret));
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  let payload;
  try {
    payload = textDecoder.decode(base64UrlToBytes(payloadToken));
  } catch {
    return null;
  }

  const [payloadRole, sessionId, expiresAtText, remainder] = payload.split(':');
  const expiresAt = Number(expiresAtText);
  if (payloadRole !== role || !sessionId || remainder || !Number.isInteger(expiresAt) || expiresAt <= now) {
    return null;
  }
  return { role, sessionId, expiresAt };
}

function sessionCookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function requireEnvironment(env, names) {
  for (const name of names) {
    if (!env[name]) throw new ApiError(503, 'Photo service not configured');
  }
}

function enforceAllowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  const configured = String(env.PHOTO_ALLOWED_ORIGINS || requestOrigin)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowed = configured.some(value => {
    if (value === origin) return true;
    if (!value.startsWith('https://*.')) return false;
    try {
      const candidate = new URL(origin);
      const hostnameSuffix = value.slice('https://*.'.length).toLowerCase();
      return candidate.protocol === 'https:'
        && candidate.port === ''
        && candidate.hostname.toLowerCase().endsWith(`.${hostnameSuffix}`);
    } catch {
      return false;
    }
  });
  if (!allowed) throw new ApiError(403, 'Invalid origin');
}

function getFetcher(env) {
  return typeof env.__fetch === 'function' ? env.__fetch : fetch;
}

async function verifyTurnstile(request, env, token) {
  requireEnvironment(env, ['TURNSTILE_SECRET_KEY']);
  if (!token || typeof token !== 'string' || token.length > 4096) {
    throw new ApiError(400, 'Missing anti-bot verification');
  }

  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (remoteIp) form.set('remoteip', remoteIp);

  const response = await getFetcher(env)('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new ApiError(502, 'Anti-bot verification unavailable');
  const result = await response.json();
  if (!result.success) throw new ApiError(403, 'Anti-bot verification failed');
}

async function exchangeAccess(request, env, role) {
  enforceAllowedOrigin(request, env);
  requireEnvironment(env, ['PHOTO_SESSION_SIGNING_SECRET']);
  const body = await readJson(request);
  const accessKey = typeof body.accessKey === 'string' ? body.accessKey : '';
  const hashName = role === 'guest' ? 'PHOTO_GUEST_KEY_HASH' : 'PHOTO_GALLERY_KEY_HASH';
  requireEnvironment(env, [hashName]);

  const suppliedHash = await sha256Hex(accessKey);
  if (!constantTimeEqual(suppliedHash, String(env[hashName]).toLowerCase())) {
    throw new ApiError(403, 'Invalid private link');
  }
  if (role === 'guest') await verifyTurnstile(request, env, body.turnstileToken);

  const ttl = role === 'guest' ? GUEST_TTL_SECONDS : GALLERY_TTL_SECONDS;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const sessionId = crypto.randomUUID();
  const signed = await createSignedSession(role, sessionId, expiresAt, env.PHOTO_SESSION_SIGNING_SECRET);
  const cookieName = role === 'guest' ? GUEST_COOKIE : GALLERY_COOKIE;

  return json(
    { authorized: true, role, expiresAt },
    200,
    { 'set-cookie': sessionCookie(cookieName, signed, ttl) },
  );
}

async function getSession(request, env, role) {
  requireEnvironment(env, ['PHOTO_SESSION_SIGNING_SECRET']);
  const cookieName = role === 'guest' ? GUEST_COOKIE : GALLERY_COOKIE;
  return verifySignedSession(
    parseCookies(request)[cookieName],
    role,
    env.PHOTO_SESSION_SIGNING_SECRET,
  );
}

async function requireSession(request, env, role) {
  const session = await getSession(request, env, role);
  if (!session) throw new ApiError(401, 'Private link required');
  return session;
}

function safeOriginalName(value) {
  return String(value || 'foto.jpg')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f/\\]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'foto.jpg';
}

function validateUploadMetadata(body) {
  const metadata = {
    originalName: safeOriginalName(body && body.originalName),
    mimeType: body && body.mimeType,
    byteSize: Number(body && body.byteSize),
    width: Number(body && body.width),
    height: Number(body && body.height),
  };
  const valid = [
    metadata.mimeType === JPEG_MIME,
    Number.isInteger(metadata.byteSize) && metadata.byteSize > 0 && metadata.byteSize <= MAX_UPLOAD_BYTES,
    Number.isInteger(metadata.width) && metadata.width > 0 && metadata.width <= 20000,
    Number.isInteger(metadata.height) && metadata.height > 0 && metadata.height <= 20000,
  ];
  if (valid.some(value => !value)) throw new ApiError(400, 'Invalid photo metadata');
  return metadata;
}

async function getGoogleAccessToken(env) {
  requireEnvironment(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']);
  const now = Math.floor(Date.now() / 1000);
  if (googleTokenCache && googleTokenCache.cacheKey === env.GOOGLE_CLIENT_ID && googleTokenCache.expiresAt > now + 60) {
    return googleTokenCache.token;
  }

  const response = await getFetcher(env)('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new ApiError(502, 'Google Drive authorization failed');
  const token = await response.json();
  if (!token.access_token) throw new ApiError(502, 'Google Drive authorization failed');

  googleTokenCache = {
    cacheKey: env.GOOGLE_CLIENT_ID,
    token: token.access_token,
    expiresAt: now + Math.max(60, Number(token.expires_in) || 3600),
  };
  return token.access_token;
}

async function googleRequest(env, url, options = {}) {
  const accessToken = await getGoogleAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${accessToken}`);
  return getFetcher(env)(url, { ...options, headers });
}

async function generateDriveFileId(env) {
  const response = await googleRequest(
    env,
    'https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',
  );
  if (!response.ok) throw new ApiError(502, 'Could not reserve Google Drive file');
  const body = await response.json();
  if (!body.ids || !body.ids[0]) throw new ApiError(502, 'Could not reserve Google Drive file');
  return body.ids[0];
}

async function initiateDriveUpload(env, driveFileId, storedName, byteSize) {
  requireEnvironment(env, ['GOOGLE_DRIVE_FOLDER_ID']);
  const response = await googleRequest(
    env,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents,imageMediaMetadata',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': JPEG_MIME,
        'x-upload-content-length': String(byteSize),
      },
      body: JSON.stringify({
        id: driveFileId,
        name: storedName,
        mimeType: JPEG_MIME,
        parents: [env.GOOGLE_DRIVE_FOLDER_ID],
      }),
    },
  );
  const uploadUrl = response.headers.get('location');
  if (!response.ok || !uploadUrl) throw new ApiError(502, 'Could not start Google Drive upload');
  return uploadUrl;
}

async function createUpload(request, env) {
  enforceAllowedOrigin(request, env);
  requireEnvironment(env, ['PHOTO_DB', 'GOOGLE_DRIVE_FOLDER_ID']);
  const session = await requireSession(request, env, 'guest');
  const metadata = validateUploadMetadata(await readJson(request));
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const usage = await env.PHOTO_DB.prepare(`
    SELECT COUNT(*) AS count
    FROM photo_uploads
    WHERE guest_session_id = ?1 AND created_at >= ?2
  `).bind(session.sessionId, hourAgo).first();
  if (Number(usage && usage.count || 0) >= MAX_UPLOADS_PER_HOUR) {
    throw new ApiError(429, 'Hourly photo limit reached');
  }

  const now = Math.floor(Date.now() / 1000);
  await env.PHOTO_DB.prepare(`
    DELETE FROM photo_uploads
    WHERE status = 'pending' AND expires_at < ?1
  `).bind(now).run();

  const photoId = crypto.randomUUID();
  const completionToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
  const completionTokenHash = await sha256Hex(completionToken);
  const driveFileId = await generateDriveFileId(env);
  const datePrefix = new Date().toISOString().replace(/[:.]/g, '-');
  const storedName = `${datePrefix}-${photoId}.jpg`;
  const uploadUrl = await initiateDriveUpload(env, driveFileId, storedName, metadata.byteSize);
  const createdAt = new Date().toISOString();
  const expiresAt = now + PENDING_TTL_SECONDS;

  await env.PHOTO_DB.prepare(`
    INSERT INTO photo_uploads (
      id, drive_file_id, completion_token_hash, guest_session_id,
      original_name, stored_name, mime_type, byte_size, width, height,
      status, created_at, expires_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending', ?11, ?12)
  `).bind(
    photoId,
    driveFileId,
    completionTokenHash,
    session.sessionId,
    metadata.originalName,
    storedName,
    JPEG_MIME,
    metadata.byteSize,
    metadata.width,
    metadata.height,
    createdAt,
    expiresAt,
  ).run();

  return json({ photoId, uploadUrl, completionToken, expiresAt }, 201);
}

async function readDriveMetadata(env, driveFileId) {
  const fields = encodeURIComponent('id,name,mimeType,size,parents,imageMediaMetadata,trashed');
  const response = await googleRequest(
    env,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=${fields}`,
  );
  if (!response.ok) throw new ApiError(502, 'Could not verify Google Drive photo');
  return response.json();
}

function isJpegPrefix(bytes) {
  return Boolean(bytes && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);
}

async function verifyDriveJpeg(env, driveFileId) {
  const response = await googleRequest(
    env,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`,
    { headers: { range: 'bytes=0-2' } },
  );
  if (!response.ok || !response.body) return false;
  const reader = response.body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  return isJpegPrefix(value);
}

async function listDriveFolderFileIds(env) {
  requireEnvironment(env, ['GOOGLE_DRIVE_FOLDER_ID']);
  const fileIds = new Set();
  let pageToken = '';

  do {
    const search = new URLSearchParams({
      q: `'${env.GOOGLE_DRIVE_FOLDER_ID.replace(/'/g, "\\'")}' in parents and trashed = false`,
      spaces: 'drive',
      pageSize: '1000',
      fields: 'nextPageToken,files(id)',
    });
    if (pageToken) search.set('pageToken', pageToken);

    const response = await googleRequest(
      env,
      `https://www.googleapis.com/drive/v3/files?${search}`,
    );
    if (!response.ok) throw new ApiError(502, 'Could not refresh Google Drive folder');
    const body = await response.json();
    for (const file of body.files || []) {
      if (file && typeof file.id === 'string') fileIds.add(file.id);
    }
    pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
  } while (pageToken);

  return fileIds;
}

async function completeUpload(request, env, photoId) {
  enforceAllowedOrigin(request, env);
  requireEnvironment(env, ['PHOTO_DB', 'GOOGLE_DRIVE_FOLDER_ID']);
  const session = await requireSession(request, env, 'guest');
  const body = await readJson(request);
  const completionToken = typeof body.completionToken === 'string' ? body.completionToken : '';

  const row = await env.PHOTO_DB.prepare(`
    SELECT * FROM photo_uploads
    WHERE id = ?1 AND guest_session_id = ?2
    LIMIT 1
  `).bind(photoId, session.sessionId).first();
  if (!row) throw new ApiError(404, 'Photo upload not found');
  if (row.status === 'ready') return json({ ready: true, photoId });
  if (row.status !== 'pending' || row.expires_at < Math.floor(Date.now() / 1000)) {
    throw new ApiError(410, 'Photo upload expired');
  }

  const suppliedHash = await sha256Hex(completionToken);
  if (!constantTimeEqual(suppliedHash, row.completion_token_hash)) {
    throw new ApiError(403, 'Invalid completion token');
  }

  const drive = await readDriveMetadata(env, row.drive_file_id);
  const width = Number(drive.imageMediaMetadata && drive.imageMediaMetadata.width);
  const height = Number(drive.imageMediaMetadata && drive.imageMediaMetadata.height);
  const valid = [
    drive.id === row.drive_file_id,
    drive.name === row.stored_name,
    drive.mimeType === JPEG_MIME,
    drive.trashed !== true,
    Array.isArray(drive.parents) && drive.parents.includes(env.GOOGLE_DRIVE_FOLDER_ID),
    Number(drive.size) === Number(row.byte_size),
    Number(drive.size) > 0 && Number(drive.size) <= MAX_UPLOAD_BYTES,
    Number.isInteger(width) && width > 0 && width <= 20000,
    Number.isInteger(height) && height > 0 && height <= 20000,
  ];
  if (valid.some(value => !value) || !(await verifyDriveJpeg(env, row.drive_file_id))) {
    throw new ApiError(400, 'Uploaded file is not a valid photo');
  }

  const completedAt = new Date().toISOString();
  await env.PHOTO_DB.prepare(`
    UPDATE photo_uploads
    SET status = 'ready', width = ?2, height = ?3, completed_at = ?4
    WHERE id = ?1
  `).bind(photoId, width, height, completedAt).run();

  return json({ ready: true, photoId, width, height, completedAt });
}

async function listGallery(request, env) {
  requireEnvironment(env, ['PHOTO_DB', 'GOOGLE_DRIVE_FOLDER_ID']);
  await requireSession(request, env, 'gallery');
  const result = await env.PHOTO_DB.prepare(`
    SELECT id, drive_file_id, width, height, completed_at
    FROM photo_uploads
    WHERE status = 'ready'
    ORDER BY completed_at ASC, id ASC
  `).all();
  let readyRows = result.results || [];

  // The slideshow polls this endpoint every 20 seconds. Reconcile the small
  // private folder here so a file deleted in Drive disappears from rotation
  // even if its image response is still present in Cloudflare's cache.
  try {
    const driveFileIds = await listDriveFolderFileIds(env);
    const reconciliationCutoff = Date.now() - 2 * 60 * 1000;
    const missingRows = readyRows.filter(row => (
      !driveFileIds.has(row.drive_file_id)
      && new Date(row.completed_at).getTime() <= reconciliationCutoff
    ));
    for (const row of missingRows) {
      await env.PHOTO_DB.prepare(`
        UPDATE photo_uploads SET status = 'missing' WHERE id = ?1
      `).bind(row.id).run();
    }
    if (missingRows.length) {
      const missingIds = new Set(missingRows.map(row => row.id));
      readyRows = readyRows.filter(row => !missingIds.has(row.id));
    }
  } catch (error) {
    // A transient Drive failure must not stop a projection already in progress.
    console.warn('Could not reconcile Drive folder', error);
  }

  const photos = readyRows.map(row => ({
    id: row.id,
    imageUrl: `/api/photos/${row.id}/image`,
    width: row.width,
    height: row.height,
    createdAt: row.completed_at,
  }));
  return json({ photos, count: photos.length });
}

async function servePhoto(request, env, context, photoId) {
  requireEnvironment(env, ['PHOTO_DB']);
  await requireSession(request, env, 'gallery');
  const row = await env.PHOTO_DB.prepare(`
    SELECT drive_file_id FROM photo_uploads
    WHERE id = ?1 AND status = 'ready'
    LIMIT 1
  `).bind(photoId).first();
  if (!row) throw new ApiError(404, 'Photo not found');

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(new URL(request.url).origin + new URL(request.url).pathname, { method: 'GET' });
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const driveResponse = await googleRequest(
    env,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}?alt=media`,
  );
  if (driveResponse.status === 404 || driveResponse.status === 410) {
    await env.PHOTO_DB.prepare(`
      UPDATE photo_uploads SET status = 'missing' WHERE id = ?1
    `).bind(photoId).run();
    throw new ApiError(404, 'Photo not found');
  }
  if (!driveResponse.ok || !driveResponse.body) throw new ApiError(502, 'Photo unavailable');

  const response = new Response(driveResponse.body, {
    status: 200,
    headers: {
      'content-type': JPEG_MIME,
      'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
    },
  });
  if (cache && context.waitUntil) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  try {
    if (path === '/api/photos/access/guest' && request.method === 'POST') {
      return await exchangeAccess(request, env, 'guest');
    }
    if (path === '/api/photos/access/gallery' && request.method === 'POST') {
      return await exchangeAccess(request, env, 'gallery');
    }
    if (path === '/api/photos/session' && request.method === 'GET') {
      const role = url.searchParams.get('role');
      if (role !== 'guest' && role !== 'gallery') throw new ApiError(400, 'Invalid role');
      const session = await getSession(request, env, role);
      return json({ authorized: Boolean(session), role, expiresAt: session && session.expiresAt });
    }
    if (path === '/api/photos/uploads' && request.method === 'POST') {
      return await createUpload(request, env);
    }
    const completion = path.match(/^\/api\/photos\/uploads\/([0-9a-f-]+)\/complete$/i);
    if (completion && request.method === 'POST') {
      return await completeUpload(request, env, completion[1]);
    }
    if (path === '/api/photos/gallery' && request.method === 'GET') {
      return await listGallery(request, env);
    }
    const image = path.match(/^\/api\/photos\/([0-9a-f-]+)\/image$/i);
    if (image && request.method === 'GET') {
      return await servePhoto(request, env, context, image[1]);
    }
    if (path.startsWith('/api/photos/')) return apiError(405, 'Method not allowed');
    return apiError(404, 'Not found');
  } catch (error) {
    if (error instanceof ApiError) return apiError(error.status, error.message);
    console.error('Photo API error', error);
    return apiError(500, 'Photo service error');
  }
}

export const __test = {
  MAX_BATCH_SIZE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOADS_PER_HOUR,
  createSignedSession,
  isJpegPrefix,
  safeOriginalName,
  sha256Hex,
  validateUploadMetadata,
  verifySignedSession,
};
