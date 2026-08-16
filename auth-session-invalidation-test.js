require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {
  firestore
} = require('./config/firebaseAdmin');

const yhuUsersSupabaseRepo =
  require('./backend/repositories/yhuUsersSupabaseRepo');

const uid =
  'regression_auth_session_20260813';

const email =
  'auth-session-regression@example.invalid';

const username =
  'authsessionregression20260813';

const oldPassword =
  'RegressionOld#2026';

const newPassword =
  'RegressionNew#2026';

const userRef =
  firestore.collection('users').doc(uid);

const sensitiveKeys = new Set([
  'password',
  'passwordhash',
  'password_hash',
  '_passwordhash',
  '_pwhash',
  'verificationcode',
  'verification_code',
  'passwordresetcode',
  'password_reset_code',
  'resettoken',
  'reset_token',
  'authtoken',
  'auth_token',
  'sessiontoken',
  'session_token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'jwt',
  'jwttoken',
  'jwt_token',
  'otp',
  'otpcode',
  'otp_code'
]);

function normalizeKey(key = '') {
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function findSensitiveKeys(value, path = '') {
  const found = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(
        ...findSensitiveKeys(
          item,
          `${path}[${index}]`
        )
      );
    });

    return found;
  }

  if (!value || typeof value !== 'object') {
    return found;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath =
      path
        ? `${path}.${key}`
        : key;

    if (
      sensitiveKeys.has(
        normalizeKey(key)
      )
    ) {
      found.push(nextPath);
    }

    found.push(
      ...findSensitiveKeys(
        child,
        nextPath
      )
    );
  }

  return found;
}

async function request(
  path,
  {
    method = 'GET',
    token = '',
    body
  } = {}
) {
  const headers = {};

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] =
      'application/json';
  }

  const response =
    await fetch(
      `http://localhost:3000${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body)
      }
    );

  const raw =
    await response.text();

  let data = null;

  try {
    data =
      raw
        ? JSON.parse(raw)
        : null;
  } catch (_) {
    data = raw;
  }

  return {
    status: response.status,
    body: data
  };
}

async function cleanup() {
  await userRef
    .delete()
    .catch(() => null);

  await yhuUsersSupabaseRepo
    .deleteByUidAndEmail({
      uid,
      email
    })
    .catch(() => null);
}

(async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not configured.'
    );
  }

  const existing =
    await userRef.get();

  if (existing.exists) {
    throw new Error(
      'Regression user already exists.'
    );
  }

  const oldHash =
    await bcrypt.hash(
      oldPassword,
      10
    );

  await userRef.set({
    email,
    emailLower: email,
    username,
    fullName:
      'Auth Session Regression',
    displayName:
      'Auth Session Regression',

    password:
      oldHash,

    isVerified:
      true,

    accountStatus:
      'active',

    authSessionVersion:
      0,

    passwordResetCode:
      'SHOULD_BE_CLEARED',

    passwordResetExpiresAt:
      new Date(
        Date.now() +
        600000
      ).toISOString(),

    passwordResetVerifiedAt:
      new Date().toISOString(),

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  });

  const oldToken =
    jwt.sign(
      {
        id: uid,
        uid,
        firebaseUid: uid,
        email,
        username,
        name:
          'Auth Session Regression',
        authSessionVersion: 0
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '10m'
      }
    );

  /*
   * 1. Change password using the valid v0 session.
   */
  const change =
    await request(
      '/api/academy/account/password',
      {
        method: 'PATCH',
        token: oldToken,
        body: {
          currentPassword:
            oldPassword,
          newPassword:
            newPassword,
          confirmPassword:
            newPassword
        }
      }
    );

  const changedSnap =
    await userRef.get();

  const changedUser =
    changedSnap.data() || {};

  const newPasswordMatches =
    await bcrypt.compare(
      newPassword,
      changedUser.password || ''
    );

  const oldPasswordStillMatches =
    await bcrypt.compare(
      oldPassword,
      changedUser.password || ''
    );

  console.log(
    'PASSWORD CHANGE PASS:',
    {
      http200:
        change.status === 200,

      success:
        change.body?.success === true,

      logoutRequired:
        change.body?.logoutRequired ===
        true,

      sessionVersionIncremented:
        changedUser.authSessionVersion ===
        1,

      newPasswordStored:
        newPasswordMatches === true,

      oldPasswordRejected:
        oldPasswordStillMatches ===
        false,

      passwordChangedAtPresent:
        Boolean(
          changedUser.passwordChangedAt
        ),

      resetCodeCleared:
        changedUser.passwordResetCode ===
        null,

      resetExpiryCleared:
        changedUser
          .passwordResetExpiresAt ===
        null,

      resetVerificationCleared:
        changedUser
          .passwordResetVerifiedAt ===
        null
    }
  );

  /*
   * 2. Reuse the pre-change JWT.
   *
   * Middleware should reject this BEFORE
   * the controller executes.
   */
  const oldTokenReuse =
    await request(
      '/api/academy/account/password',
      {
        method: 'PATCH',
        token: oldToken,
        body: {
          currentPassword:
            oldPassword,
          newPassword:
            'AnythingValid#2026',
          confirmPassword:
            'AnythingValid#2026'
        }
      }
    );

  console.log(
    'OLD SESSION PASS:',
    {
      http401:
        oldTokenReuse.status === 401,

      sessionInvalidated:
        oldTokenReuse.body
          ?.sessionInvalidated === true,

      passwordChanged:
        oldTokenReuse.body
          ?.passwordChanged === true
    }
  );

  /*
   * 3. Old password must no longer login.
   */
  const oldLogin =
    await request(
      '/api/login',
      {
        method: 'POST',
        body: {
          identifier: email,
          password: oldPassword
        }
      }
    );

  console.log(
    'OLD PASSWORD LOGIN PASS:',
    {
      rejected:
        oldLogin.status !== 200 &&
        oldLogin.body?.success !== true
    }
  );

  /*
   * 4. New password should login and receive
   *    authSessionVersion 1.
   */
  const newLogin =
    await request(
      '/api/login',
      {
        method: 'POST',
        body: {
          identifier: email,
          password: newPassword
        }
      }
    );

  let newTokenPayload = null;

  if (
    newLogin.body?.token &&
    typeof newLogin.body.token === 'string'
  ) {
    newTokenPayload =
      jwt.verify(
        newLogin.body.token,
        process.env.JWT_SECRET
      );
  }

  console.log(
    'NEW PASSWORD LOGIN PASS:',
    {
      http200:
        newLogin.status === 200,

      success:
        newLogin.body?.success === true,

      sourceFirebase:
        newLogin.body?.source ===
        'firebase',

      tokenReturned:
        Boolean(newLogin.body?.token),

      tokenSessionVersion:
        newTokenPayload
          ?.authSessionVersion === 1
    }
  );

  /*
   * 5. yhu_users mirror must exist but must
   *    contain no credential material.
   */
  const mirror =
    await yhuUsersSupabaseRepo
      .getByUid(uid);

  const sensitiveMirrorKeys = [
    ...findSensitiveKeys(
      mirror?.raw_data || {},
      'raw_data'
    ),
    ...findSensitiveKeys(
      mirror?.data || {},
      'data'
    )
  ];

  console.log(
    'SAFE MIRROR PASS:',
    {
      mirrorFound:
        Boolean(mirror),

      sensitiveKeyCount:
        sensitiveMirrorKeys.length,

      noSensitiveCredentials:
        sensitiveMirrorKeys.length === 0
    }
  );

  if (sensitiveMirrorKeys.length) {
    console.log(
      'UNEXPECTED SENSITIVE PATHS:',
      sensitiveMirrorKeys
    );
  }

  await cleanup();

  const afterCleanup =
    await userRef.get();

  const mirrorAfterCleanup =
    await yhuUsersSupabaseRepo
      .getByUid(uid);

  console.log(
    'CLEANUP PASS:',
    {
      firestoreDeleted:
        afterCleanup.exists === false,

      mirrorDeleted:
        !mirrorAfterCleanup
    }
  );
})().catch(async (error) => {
  console.error(error);

  try {
    await cleanup();

    console.error(
      'CLEANUP AFTER ERROR: DONE'
    );
  } catch (cleanupError) {
    console.error(
      'CLEANUP ERROR:',
      cleanupError
    );
  }

  process.exit(1);
});
