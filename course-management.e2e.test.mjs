/**
 * Course Management Backend — black-box e2e tests
 * Part 2: authentication and authorization (Session 05 assignment)
 *
 * Runs against any running implementation (TypeORM or Sequelize, PostgreSQL or MySQL,
 * numeric or UUID ids). Uses only Node.js built-ins.
 *
 *   1. Start the API (e.g. npm run start:dev). Make sure one admin exists (seed it).
 *   2. Run:
 *        BASE_URL=http://localhost:3000/api \
 *        ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=admin-pass-1 \
 *        node --test course-management.e2e.test.mjs
 *
 *   Optional: JWT_SECRET=<the access-token secret> also tests an expired access token.
 *
 * Requirements: Node.js 20 or newer. The database does not need to be empty:
 * every test creates its own records with unique emails.
 *
 * Two kinds of checks:
 *   - Required: behaviour stated in the specification. Must pass.
 *   - Policy:   the specification leaves the choice open. Several answers are accepted,
 *               but a 500 never is. The chosen behaviour is printed.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { before, describe, it } from 'node:test';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

const ADMIN_PERMISSIONS = [
  'course:create',
  'course:read',
  'course:update',
  'course:delete',
  'student:create',
  'student:list',
  'student:read',
  'student:update',
  'student:delete',
  'admin:create',
  'admin:read',
  'admin:update',
  'admin:delete',
  'enrollment:create',
  'enrollment:list',
  'enrollment:read',
  'enrollment:update',
  'enrollment:delete',
];
const STUDENT_PERMISSIONS = [
  'course:read',
  'student:read',
  'student:update',
  'enrollment:create',
  'enrollment:read',
  'enrollment:update',
];

// ---------- helpers ----------

async function api(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

function expectStatus(res, ...codes) {
  assert.ok(
    codes.includes(res.status),
    `expected status ${codes.join(' or ')}, got ${res.status}: ${JSON.stringify(res.body)}`,
  );
}

/** Fails if a password or refresh token appears anywhere in a response body. */
function assertNoSecrets(value, where = 'response') {
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((item, i) => walk(item, `${path}[${i}]`));
    if (v && typeof v === 'object') {
      for (const [key, inner] of Object.entries(v)) {
        assert.ok(
          !/^(password|passwordHash|refreshToken|hashedRefreshToken)$/i.test(key),
          `${where} must not include "${key}" (at ${path}.${key})`,
        );
        walk(inner, `${path}.${key}`);
      }
    }
  };
  walk(value, where);
}

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const num = (value) => Number(value); // numeric columns may come back as strings
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const missingId = (sample) =>
  typeof sample === 'number' || /^\d+$/.test(String(sample))
    ? 999999999
    : '00000000-0000-4000-8000-000000000000';
// enrollment rows may expose studentId or a nested student object
const idOf = (row, name) => row?.[`${name}Id`] ?? row?.[name]?.id;
const sameId = (a, b) => String(a) === String(b);

function decodeJwt(token) {
  assert.equal(typeof token, 'string', 'token is a string');
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'token is a JWT (three parts)');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

function signHs256(payload, secret) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}

let adminToken; // access token of the seeded admin, used for setup

async function login(email, password) {
  const res = await api('POST', '/auth/login', { email, password });
  expectStatus(res, 200);
  return res.body;
}

/** Registers a student through the public endpoint and logs them in. */
async function newStudent(overrides = {}) {
  const password = 'student-pass-1';
  const body = {
    name: 'Sara Mohammad',
    email: `sara.${unique()}@example.com`,
    phone: '+33123456789',
    password,
    ...overrides,
  };
  const res = await api('POST', '/auth/register', body);
  expectStatus(res, 201);
  const session = await login(body.email, password);
  return { ...res.body, password, token: session.accessToken, session };
}

/** Creates an admin with the seeded admin's token and logs them in. */
async function newAdmin() {
  const password = 'admin-pass-1';
  const email = `ahmad.${unique()}@example.com`;
  const res = await api('POST', '/admins', { name: 'Ahmad Ali', email, password }, adminToken);
  expectStatus(res, 201);
  const session = await login(email, password);
  return { ...res.body, password, token: session.accessToken, session };
}

async function createCourse(overrides = {}) {
  const res = await api(
    'POST',
    '/courses',
    {
      title: 'NestJS Basics',
      description: 'Learn NestJS',
      price: 100,
      discountType: 'PERCENTAGE',
      discountValue: 20,
      isActive: true,
      ...overrides,
    },
    adminToken,
  );
  expectStatus(res, 201);
  return res.body;
}

/** Admin enrollment: any student, any course. */
const enroll = (studentId, courseId) =>
  api('POST', '/enrollments', { studentId, courseId }, adminToken);

before(async () => {
  assert.ok(
    ADMIN_EMAIL && ADMIN_PASSWORD,
    'Set ADMIN_EMAIL and ADMIN_PASSWORD to an admin that already exists (seed one first).',
  );
  const res = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(
    res.status,
    200,
    `could not log in as ${ADMIN_EMAIL} at ${BASE_URL}/auth/login: ${res.status} ${JSON.stringify(res.body)}`,
  );
  adminToken = res.body.accessToken;
});

// =====================================================================
// 1. Authentication
// =====================================================================

describe('Register', () => {
  it('creates a student with 201 and never returns the password', async () => {
    const email = `sara.${unique()}@example.com`;
    const res = await api('POST', '/auth/register', {
      name: 'Sara Mohammad',
      email,
      phone: '+33123456789',
      password: 'sara-pass-1',
    });
    expectStatus(res, 201);
    assert.ok(res.body.id !== undefined, 'response has an id');
    assert.equal(res.body.name, 'Sara Mohammad');
    assert.equal(res.body.email, email);
    assert.equal(res.body.phone, '+33123456789');
    assertNoSecrets(res.body, 'register response');
  });

  it('rejects a short password, a missing phone, and an invalid email with 400', async () => {
    const base = {
      name: 'Sara',
      email: `s.${unique()}@example.com`,
      phone: '+33123456789',
      password: 'long-enough',
    };
    expectStatus(await api('POST', '/auth/register', { ...base, password: '1234567' }), 400);
    const { phone: _, ...noPhone } = base;
    expectStatus(await api('POST', '/auth/register', noPhone), 400);
    expectStatus(await api('POST', '/auth/register', { ...base, email: 'nope' }), 400);
  });

  it('always assigns the student role, even when the body asks for admin', async (t) => {
    const email = `sneaky.${unique()}@example.com`;
    const res = await api('POST', '/auth/register', {
      name: 'Sneaky',
      email,
      phone: '+49 151 23456789',
      password: 'sneaky-pass-1',
      role: 'admin',
      permissions: ['admin:create'],
    });
    expectStatus(res, 400, 201);
    t.diagnostic(`register with role in the body → ${res.status}`);
    if (res.status === 201) {
      const session = await login(email, 'sneaky-pass-1');
      assert.equal(session.user.role, 'student', 'the role from the body is ignored');
      assert.deepEqual([...session.user.permissions].sort(), [...STUDENT_PERMISSIONS].sort());
    }
  });

  it('rejects a duplicate email with 409, across students and admins', async () => {
    const student = await newStudent();
    const again = await api('POST', '/auth/register', {
      name: 'Copy',
      email: student.email,
      phone: '123-456-7890',
      password: 'copy-pass-1',
    });
    expectStatus(again, 409);

    const adminEmail = await api('POST', '/auth/register', {
      name: 'Copy',
      email: ADMIN_EMAIL,
      phone: '123-456-7890',
      password: 'copy-pass-1',
    });
    expectStatus(adminEmail, 409);
  });
});

describe('Login', () => {
  it('logs in a student: 200, both tokens, role, and the student permissions', async () => {
    const student = await newStudent();
    const body = student.session;
    assert.equal(typeof body.accessToken, 'string', 'accessToken');
    assert.equal(typeof body.refreshToken, 'string', 'refreshToken');
    assert.ok(sameId(body.user.id, student.id), 'user.id is the student id');
    assert.equal(body.user.email, student.email);
    assert.equal(body.user.role, 'student');
    assert.deepEqual([...body.user.permissions].sort(), [...STUDENT_PERMISSIONS].sort());
    assertNoSecrets(body.user, 'login user');
  });

  it('logs in an admin with the admin role and all 18 permissions', async () => {
    const session = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert.equal(session.user.role, 'admin');
    assert.deepEqual([...session.user.permissions].sort(), [...ADMIN_PERMISSIONS].sort());
    assertNoSecrets(session.user, 'login user');
  });

  it('answers a wrong password and an unknown email with the same 401', async () => {
    const student = await newStudent();
    const wrongPassword = await api('POST', '/auth/login', {
      email: student.email,
      password: 'wrong-pass-1',
    });
    const unknownEmail = await api('POST', '/auth/login', {
      email: `nobody.${unique()}@example.com`,
      password: 'wrong-pass-1',
    });
    expectStatus(wrongPassword, 401);
    expectStatus(unknownEmail, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body, 'both bodies are identical');
    assert.ok(
      JSON.stringify(wrongPassword.body).includes('Invalid email or password'),
      'message is "Invalid email or password"',
    );
  });

  it('puts sub, email, role, and permissions in the access token, and no secrets', async () => {
    const student = await newStudent();
    const payload = decodeJwt(student.session.accessToken);
    assert.ok(sameId(payload.sub, student.id), 'sub is the user id');
    assert.equal(payload.email, student.email);
    assert.equal(payload.role, 'student');
    assert.deepEqual([...payload.permissions].sort(), [...STUDENT_PERMISSIONS].sort());
    assertNoSecrets(payload, 'access token payload');
  });

  it('access token lasts 15 minutes and refresh token 7 days', async () => {
    const student = await newStudent();
    const now = Math.floor(Date.now() / 1000);
    const lifetime = (token) => {
      const p = decodeJwt(token);
      assert.ok(p.exp, 'token has exp');
      return p.exp - (p.iat ?? now);
    };
    const access = lifetime(student.session.accessToken);
    const refresh = lifetime(student.session.refreshToken);
    assert.ok(Math.abs(access - 15 * 60) <= 60, `access token lifetime is 15 min (got ${access}s)`);
    assert.ok(
      Math.abs(refresh - 7 * 24 * 3600) <= 60,
      `refresh token lifetime is 7 days (got ${refresh}s)`,
    );
  });
});

describe('Access token guard', () => {
  it('rejects requests without a valid access token with 401', async () => {
    expectStatus(await api('GET', '/courses'), 401);
    expectStatus(await api('GET', '/courses', undefined, 'not-a-jwt'), 401);

    const token = (await newStudent()).token;
    const [h, p, s] = token.split('.');
    const mid = Math.floor(s.length / 2);
    const tampered = `${h}.${p}.${s.slice(0, mid)}${s[mid] === 'A' ? 'B' : 'A'}${s.slice(mid + 1)}`;
    expectStatus(await api('GET', '/courses', undefined, tampered), 401);

    const wrongSecret = signHs256(decodeJwt(token), 'not-the-real-secret');
    expectStatus(await api('GET', '/courses', undefined, wrongSecret), 401);
  });

  it('rejects an expired access token with 401 (needs JWT_SECRET)', async (t) => {
    if (!JWT_SECRET) {
      t.skip('set JWT_SECRET to run this test');
      return;
    }
    const payload = decodeJwt((await newStudent()).token);
    const now = Math.floor(Date.now() / 1000);
    const expired = signHs256({ ...payload, iat: now - 3600, exp: now - 60 }, JWT_SECRET);
    expectStatus(await api('GET', '/courses', undefined, expired), 401);
  });

  it('accepts a valid access token', async () => {
    const student = await newStudent();
    expectStatus(await api('GET', '/courses', undefined, student.token), 200);
  });
});

describe('Refresh and logout', () => {
  it('returns a new access token only, and the new token works', async () => {
    const student = await newStudent();
    const res = await api('POST', '/auth/refresh', { refreshToken: student.session.refreshToken });
    expectStatus(res, 200);
    assert.equal(typeof res.body.accessToken, 'string', 'accessToken');
    assert.equal(res.body.refreshToken, undefined, 'no new refresh token');
    expectStatus(await api('GET', '/courses', undefined, res.body.accessToken), 200);
  });

  it('rejects an invalid refresh token with 401', async () => {
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: 'not-a-jwt' }), 401);
    const student = await newStudent();
    const forged = signHs256(decodeJwt(student.session.refreshToken), 'not-the-real-secret');
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: forged }), 401);
  });

  it('a new login replaces the stored refresh token', async () => {
    const student = await newStudent();
    const first = student.session.refreshToken;
    await sleep(1100); // tokens signed in the same second could be identical
    const second = (await login(student.email, student.password)).refreshToken;

    expectStatus(await api('POST', '/auth/refresh', { refreshToken: first }), 401);
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: second }), 200);
  });

  it('logout returns 204 and the refresh token stops working', async () => {
    const student = await newStudent();
    expectStatus(await api('POST', '/auth/logout', undefined, student.token), 204);
    expectStatus(
      await api('POST', '/auth/refresh', { refreshToken: student.session.refreshToken }),
      401,
    );
  });

  it('logout needs an access token', async () => {
    expectStatus(await api('POST', '/auth/logout'), 401);
  });
});

// =====================================================================
// 2. Permissions: a student token on admin-only routes
// =====================================================================

describe('Permissions', () => {
  it('returns 403 when a student calls a route without the permission', async () => {
    const student = await newStudent();
    const course = await createCourse();
    const other = await newStudent();
    const enrollment = await enroll(other.id, course.id);
    expectStatus(enrollment, 201);
    const eid = enrollment.body.id;

    const calls = [
      [
        'POST',
        '/courses',
        { title: 'X', price: 10, discountType: 'NONE', discountValue: 0, isActive: true },
      ],
      ['PATCH', `/courses/${course.id}`, { price: 1 }],
      ['DELETE', `/courses/${course.id}`],
      ['GET', `/courses/${course.id}/enrollments`],
      ['GET', '/students'],
      [
        'POST',
        '/students',
        {
          name: 'X',
          email: `x.${unique()}@example.com`,
          phone: '+123-456-7890',
          password: 'x-pass-123',
        },
      ],
      ['DELETE', `/students/${other.id}`],
      ['GET', '/admins'],
      ['GET', `/admins/${missingId(student.id)}`],
      [
        'POST',
        '/admins',
        { name: 'X', email: `x.${unique()}@example.com`, password: 'x-pass-123' },
      ],
      ['PATCH', `/admins/${missingId(student.id)}`, { name: 'X' }],
      ['DELETE', `/admins/${missingId(student.id)}`],
      ['GET', '/enrollments'],
      ['DELETE', `/enrollments/${eid}`],
    ];
    for (const [method, path, body] of calls) {
      const res = await api(method, path, body, student.token);
      assert.equal(
        res.status,
        403,
        `${method} ${path} as a student: expected 403, got ${res.status}`,
      );
    }

    // nothing changed
    const stillThere = await api('GET', `/courses/${course.id}`, undefined, adminToken);
    expectStatus(stillThere, 200);
    assert.equal(num(stillThere.body.price), 100);
  });

  it('lets a student read courses, with finalPrice', async () => {
    const student = await newStudent();
    const course = await createCourse();
    const list = await api('GET', '/courses', undefined, student.token);
    expectStatus(list, 200);
    assert.ok(
      list.body.some((c) => sameId(c.id, course.id)),
      'the course is in the list',
    );
    const one = await api('GET', `/courses/${course.id}`, undefined, student.token);
    expectStatus(one, 200);
    assert.equal(num(one.body.finalPrice), 80);
  });
});

// =====================================================================
// 3. Ownership
// =====================================================================

describe('Ownership: students', () => {
  it('a student reads their own profile and gets 403 for any other id', async () => {
    const me = await newStudent();
    const other = await newStudent();

    const mine = await api('GET', `/students/${me.id}`, undefined, me.token);
    expectStatus(mine, 200);
    assert.equal(mine.body.email, me.email);
    assertNoSecrets(mine.body, 'GET /students/:id');

    expectStatus(await api('GET', `/students/${other.id}`, undefined, me.token), 403);
    expectStatus(await api('GET', `/students/${missingId(me.id)}`, undefined, me.token), 403);
  });

  it('a student reads only their own enrollments list', async () => {
    const me = await newStudent();
    const other = await newStudent();
    expectStatus(await api('GET', `/students/${me.id}/enrollments`, undefined, me.token), 200);
    expectStatus(await api('GET', `/students/${other.id}/enrollments`, undefined, me.token), 403);
  });

  it('a student updates only their own name and phone', async () => {
    const me = await newStudent();
    const other = await newStudent();

    const res = await api(
      'PATCH',
      `/students/${me.id}`,
      { name: 'Sara Ali', phone: '+123-456-7890' },
      me.token,
    );
    expectStatus(res, 200);
    assert.equal(res.body.name, 'Sara Ali');
    assert.equal(res.body.phone, '+123-456-7890');
    assert.equal(res.body.email, me.email, 'email unchanged');
    assertNoSecrets(res.body, 'PATCH /students/:id');

    for (const extra of [
      { email: `new.${unique()}@example.com` },
      { password: 'new-pass-123' },
      { role: 'admin' },
      { permissions: ['admin:create'] },
    ]) {
      const bad = await api('PATCH', `/students/${me.id}`, extra, me.token);
      assert.equal(
        bad.status,
        400,
        `student PATCH with ${Object.keys(extra)[0]}: expected 400, got ${bad.status}`,
      );
    }

    expectStatus(await api('PATCH', `/students/${other.id}`, { name: 'Hacked' }, me.token), 403);
    const untouched = await api('GET', `/students/${other.id}`, undefined, adminToken);
    assert.equal(untouched.body.name, 'Sara Mohammad', 'the other student was not changed');
  });

  it('an admin updates a student name, email, and phone, but not the password', async () => {
    const student = await newStudent();
    const email = `changed.${unique()}@example.com`;
    const res = await api(
      'PATCH',
      `/students/${student.id}`,
      { name: 'By Admin', email, phone: '+49 151 23456789' },
      adminToken,
    );
    expectStatus(res, 200);
    assert.equal(res.body.email, email);
    expectStatus(
      await api('PATCH', `/students/${student.id}`, { password: 'new-pass-123' }, adminToken),
      400,
    );
  });
});

describe('Ownership: enrollments', () => {
  it('a student enrolls themselves with only courseId', async () => {
    const me = await newStudent();
    const course = await createCourse();
    const res = await api('POST', '/enrollments', { courseId: course.id }, me.token);
    expectStatus(res, 201);
    assert.ok(sameId(idOf(res.body, 'student'), me.id), 'enrolled the student from the token');
    assert.equal(num(res.body.priceAtEnrollment), 80);
    assert.equal(res.body.status, 'ACTIVE');

    expectStatus(await api('POST', '/enrollments', { courseId: course.id }, me.token), 409);
  });

  it('a student cannot enroll another student', async (t) => {
    const me = await newStudent();
    const other = await newStudent();
    const course = await createCourse();
    const res = await api(
      'POST',
      '/enrollments',
      { studentId: other.id, courseId: course.id },
      me.token,
    );
    expectStatus(res, 403, 400);
    t.diagnostic(`student sends another studentId → ${res.status}`);
    const theirs = await api('GET', `/students/${other.id}/enrollments`, undefined, adminToken);
    assert.equal(theirs.body.length, 0, 'the other student was not enrolled');
  });

  it('a student keeps the old rules: inactive course 400, unknown course 404', async () => {
    const me = await newStudent();
    const inactive = await createCourse({ isActive: false });
    expectStatus(await api('POST', '/enrollments', { courseId: inactive.id }, me.token), 400);
    expectStatus(
      await api('POST', '/enrollments', { courseId: missingId(inactive.id) }, me.token),
      404,
    );
  });

  it('a student reads their own enrollment and gets 403 for others, even missing ids', async () => {
    const me = await newStudent();
    const other = await newStudent();
    const course = await createCourse();
    const mine = await api('POST', '/enrollments', { courseId: course.id }, me.token);
    const theirs = await api('POST', '/enrollments', { courseId: course.id }, other.token);

    expectStatus(await api('GET', `/enrollments/${mine.body.id}`, undefined, me.token), 200);
    expectStatus(await api('GET', `/enrollments/${theirs.body.id}`, undefined, me.token), 403);
    expectStatus(
      await api('GET', `/enrollments/${missingId(mine.body.id)}`, undefined, me.token),
      403,
    );
    expectStatus(
      await api('GET', `/enrollments/${missingId(mine.body.id)}`, undefined, adminToken),
      404,
    );
  });

  it('a student may only cancel their own enrollment', async (t) => {
    const me = await newStudent();
    const other = await newStudent();
    const course = await createCourse();
    const mine = await api('POST', '/enrollments', { courseId: course.id }, me.token);
    const theirs = await api('POST', '/enrollments', { courseId: course.id }, other.token);

    const completed = await api(
      'PATCH',
      `/enrollments/${mine.body.id}`,
      { status: 'COMPLETED' },
      me.token,
    );
    expectStatus(completed, 403, 400);
    t.diagnostic(`student sets own enrollment to COMPLETED → ${completed.status}`);

    expectStatus(
      await api('PATCH', `/enrollments/${theirs.body.id}`, { status: 'CANCELLED' }, me.token),
      403,
    );

    const cancelled = await api(
      'PATCH',
      `/enrollments/${mine.body.id}`,
      { status: 'CANCELLED' },
      me.token,
    );
    expectStatus(cancelled, 200);
    assert.equal(cancelled.body.status, 'CANCELLED');

    const check = await api('GET', `/enrollments/${theirs.body.id}`, undefined, adminToken);
    assert.equal(check.body.status, 'ACTIVE', 'the other enrollment is still ACTIVE');
  });
});

describe('Admins', () => {
  it('creates an admin with a password; the response has no secrets and the admin can log in', async () => {
    const email = `ahmad.${unique()}@example.com`;
    const created = await api(
      'POST',
      '/admins',
      { name: 'Ahmad Ali', email, password: 'ahmad-pass-1' },
      adminToken,
    );
    expectStatus(created, 201);
    assert.equal(created.body.email, email);
    assertNoSecrets(created.body, 'POST /admins');

    const session = await login(email, 'ahmad-pass-1');
    assert.equal(session.user.role, 'admin');
  });

  it('requires a password of at least 8 characters, and a unique email', async () => {
    const email = `ahmad.${unique()}@example.com`;
    expectStatus(await api('POST', '/admins', { name: 'A', email }, adminToken), 400);
    expectStatus(
      await api('POST', '/admins', { name: 'A', email, password: '1234567' }, adminToken),
      400,
    );
    expectStatus(
      await api(
        'POST',
        '/admins',
        { name: 'A', email: 'nope', password: 'long-enough' },
        adminToken,
      ),
      400,
    );

    const student = await newStudent();
    expectStatus(
      await api(
        'POST',
        '/admins',
        { name: 'A', email: student.email, password: 'long-enough' },
        adminToken,
      ),
      409,
    );
  });

  it('reads, updates name and email, lists, and deletes another admin', async () => {
    const target = await newAdmin();
    const one = await api('GET', `/admins/${target.id}`, undefined, adminToken);
    expectStatus(one, 200);
    assertNoSecrets(one.body, 'GET /admins/:id');

    const updated = await api('PATCH', `/admins/${target.id}`, { name: 'Ahmad' }, adminToken);
    expectStatus(updated, 200);
    assert.equal(updated.body.name, 'Ahmad');
    assert.equal(updated.body.email, target.email, 'PATCH keeps fields that were not sent');

    expectStatus(
      await api('PATCH', `/admins/${target.id}`, { password: 'new-pass-123' }, adminToken),
      400,
    );

    const list = await api('GET', '/admins', undefined, adminToken);
    expectStatus(list, 200);
    assert.ok(
      list.body.some((a) => sameId(a.id, target.id)),
      'the admin is in the list',
    );
    assertNoSecrets(list.body, 'GET /admins');

    expectStatus(await api('DELETE', `/admins/${target.id}`, undefined, adminToken), 204);
    expectStatus(await api('GET', `/admins/${target.id}`, undefined, adminToken), 404);
  });

  it('an admin cannot delete their own account (403)', async () => {
    const admin = await newAdmin();
    expectStatus(await api('DELETE', `/admins/${admin.id}`, undefined, admin.token), 403);
    expectStatus(await api('GET', `/admins/${admin.id}`, undefined, adminToken), 200);
  });

  it('returns 404 to an admin for an unknown admin id', async () => {
    const admin = await newAdmin();
    expectStatus(await api('GET', `/admins/${missingId(admin.id)}`, undefined, adminToken), 404);
  });
});

// =====================================================================
// 4. Previous rules, now behind the admin token
// =====================================================================

describe('Students (admin)', () => {
  it('creates a student with a password; the student can log in', async () => {
    const email = `sara.${unique()}@example.com`;
    const res = await api(
      'POST',
      '/students',
      { name: 'Sara', email, phone: '+49 151 23456789', password: 'sara-pass-1' },
      adminToken,
    );
    expectStatus(res, 201);
    assertNoSecrets(res.body, 'POST /students');
    const session = await login(email, 'sara-pass-1');
    assert.equal(session.user.role, 'student');
  });

  it('rejects a student without password or phone with 400', async () => {
    const email = `sara.${unique()}@example.com`;
    expectStatus(
      await api('POST', '/students', { name: 'S', email, phone: '+49 151 23456789' }, adminToken),
      400,
    );
    expectStatus(
      await api('POST', '/students', { name: 'S', email, password: 'long-enough' }, adminToken),
      400,
    );
  });

  it('lists students without secrets, deletes one with 204, and returns 404 after', async () => {
    const student = await newStudent();
    const list = await api('GET', '/students', undefined, adminToken);
    expectStatus(list, 200);
    assert.ok(list.body.some((s) => sameId(s.id, student.id)));
    assertNoSecrets(list.body, 'GET /students');

    expectStatus(await api('DELETE', `/students/${student.id}`, undefined, adminToken), 204);
    expectStatus(await api('GET', `/students/${student.id}`, undefined, adminToken), 404);
  });
});

describe('Courses (admin)', () => {
  it('creates a course and returns the calculated finalPrice', async () => {
    const course = await createCourse();
    assert.equal(num(course.price), 100);
    assert.equal(course.discountType, 'PERCENTAGE');
    assert.equal(num(course.finalPrice), 80);
    assert.equal(course.isActive, true);
  });

  it('calculates finalPrice for NONE and FIXED discounts', async () => {
    const none = await createCourse({ price: 50, discountType: 'NONE', discountValue: 0 });
    assert.equal(num(none.finalPrice), 50);
    const fixed = await createCourse({ price: 100, discountType: 'FIXED', discountValue: 30 });
    assert.equal(num(fixed.finalPrice), 70);
  });

  it('updates only the supplied fields and recalculates finalPrice', async () => {
    const course = await createCourse();
    const res = await api(
      'PATCH',
      `/courses/${course.id}`,
      { price: 120, discountType: 'FIXED', discountValue: 20 },
      adminToken,
    );
    expectStatus(res, 200);
    assert.equal(num(res.body.finalPrice), 100);
    assert.equal(res.body.title, 'NestJS Basics', 'title was not sent, so it is unchanged');
  });

  it('rejects invalid prices and discounts with 400', async () => {
    const base = { title: 'Bad', isActive: true };
    for (const body of [
      { price: -1, discountType: 'NONE', discountValue: 0 },
      { price: 100, discountType: 'PERCENTAGE', discountValue: 150 },
      { price: 50, discountType: 'FIXED', discountValue: 80 },
      { price: 100, discountType: 'FIXED', discountValue: -5 },
      { price: 100, discountType: 'HALF_PRICE', discountValue: 0 },
    ]) {
      const res = await api('POST', '/courses', { ...base, ...body }, adminToken);
      assert.equal(res.status, 400, `${JSON.stringify(body)}: expected 400, got ${res.status}`);
    }
  });

  it('validates PATCH against the stored values (price below a fixed discount)', async () => {
    const course = await createCourse({ price: 100, discountType: 'FIXED', discountValue: 40 });
    expectStatus(await api('PATCH', `/courses/${course.id}`, { price: 30 }, adminToken), 400);
  });

  it('returns 404 for an unknown course and deletes a course without enrollments', async () => {
    const course = await createCourse();
    expectStatus(await api('GET', `/courses/${missingId(course.id)}`, undefined, adminToken), 404);
    expectStatus(await api('DELETE', `/courses/${course.id}`, undefined, adminToken), 204);
  });
});

describe('Enrollments (admin)', () => {
  it('enrolls a student with the discounted price and returns 201', async () => {
    const student = await newStudent();
    const course = await createCourse();
    const res = await enroll(student.id, course.id);
    expectStatus(res, 201);
    assert.ok(sameId(idOf(res.body, 'student'), student.id));
    assert.ok(sameId(idOf(res.body, 'course'), course.id));
    assert.equal(num(res.body.priceAtEnrollment), 80);
    assert.equal(res.body.status, 'ACTIVE');
    assert.ok(!Number.isNaN(Date.parse(res.body.enrolledAt)), 'enrolledAt is a valid date');
  });

  it('rejects a duplicate active enrollment (409) and an inactive course (400)', async () => {
    const student = await newStudent();
    const course = await createCourse();
    expectStatus(await enroll(student.id, course.id), 201);
    expectStatus(await enroll(student.id, course.id), 409);

    const inactive = await createCourse({ isActive: false });
    expectStatus(await enroll(student.id, inactive.id), 400);
  });

  it('returns 404 for an unknown student or course, 400 for an empty body', async () => {
    const student = await newStudent();
    const course = await createCourse();
    expectStatus(await enroll(missingId(student.id), course.id), 404);
    expectStatus(await enroll(student.id, missingId(course.id)), 404);
    expectStatus(await api('POST', '/enrollments', {}, adminToken), 400);
  });

  it('keeps priceAtEnrollment when the course price changes later', async () => {
    const student = await newStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);
    expectStatus(await api('PATCH', `/courses/${course.id}`, { price: 500 }, adminToken), 200);
    const after = await api('GET', `/enrollments/${created.body.id}`, undefined, adminToken);
    expectStatus(after, 200);
    assert.equal(num(after.body.priceAtEnrollment), 80);
  });

  it('lists enrollments globally, per student, and per course', async () => {
    const student = await newStudent();
    const course = await createCourse({ title: 'Course for listing' });
    const created = await enroll(student.id, course.id);

    const all = await api('GET', '/enrollments', undefined, adminToken);
    expectStatus(all, 200);
    assert.ok(all.body.some((e) => sameId(e.id, created.body.id)));

    const byStudent = await api(
      'GET',
      `/students/${student.id}/enrollments`,
      undefined,
      student.token,
    );
    expectStatus(byStudent, 200);
    assert.equal(byStudent.body.length, 1);
    assert.ok(byStudent.body[0].course?.title, 'includes course details');
    assertNoSecrets(byStudent.body, 'GET /students/:id/enrollments');

    const byCourse = await api('GET', `/courses/${course.id}/enrollments`, undefined, adminToken);
    expectStatus(byCourse, 200);
    assert.equal(byCourse.body.length, 1);
    assert.ok(byCourse.body[0].student?.email, 'includes student details');
    assertNoSecrets(byCourse.body, 'GET /courses/:id/enrollments');
  });

  it('admin changes the status; an unknown status is 400', async () => {
    const student = await newStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);
    const done = await api(
      'PATCH',
      `/enrollments/${created.body.id}`,
      { status: 'COMPLETED' },
      adminToken,
    );
    expectStatus(done, 200);
    assert.equal(done.body.status, 'COMPLETED');
    expectStatus(
      await api('PATCH', `/enrollments/${created.body.id}`, { status: 'PAUSED' }, adminToken),
      400,
    );
  });

  it('deletes an enrollment with 204, then 404', async () => {
    const student = await newStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);
    expectStatus(
      await api('DELETE', `/enrollments/${created.body.id}`, undefined, adminToken),
      204,
    );
    expectStatus(await api('GET', `/enrollments/${created.body.id}`, undefined, adminToken), 404);
  });
});

describe('Policies and robustness', () => {
  it('[policy] re-enrollment after cancellation: 201 or 409', async (t) => {
    const student = await newStudent();
    const course = await createCourse();
    const first = await api('POST', '/enrollments', { courseId: course.id }, student.token);
    await api('PATCH', `/enrollments/${first.body.id}`, { status: 'CANCELLED' }, student.token);
    const again = await api('POST', '/enrollments', { courseId: course.id }, student.token);
    expectStatus(again, 201, 409);
    t.diagnostic(`re-enroll after cancellation → ${again.status}`);
  });

  it('[policy] deleting a course that has enrollments: 409 or 204', async (t) => {
    const student = await newStudent();
    const course = await createCourse();
    expectStatus(await enroll(student.id, course.id), 201);
    const res = await api('DELETE', `/courses/${course.id}`, undefined, adminToken);
    expectStatus(res, 409, 204);
    t.diagnostic(`delete course with enrollments → ${res.status}`);
  });

  it('[policy] deleting a student who has enrollments: 409 or 204', async (t) => {
    const student = await newStudent();
    const course = await createCourse();
    expectStatus(await enroll(student.id, course.id), 201);
    const res = await api('DELETE', `/students/${student.id}`, undefined, adminToken);
    expectStatus(res, 409, 204);
    t.diagnostic(`delete student with enrollments → ${res.status}`);
  });

  it('never answers 500 for a malformed id', async () => {
    for (const path of ['/admins/abc', '/students/abc', '/courses/abc', '/enrollments/abc']) {
      expectStatus(await api('GET', path, undefined, adminToken), 400, 404);
    }
  });
});
