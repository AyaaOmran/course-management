
/**
 * Course Management Backend — black-box e2e tests
 *
 * Runs against any running implementation of the assignment (TypeORM or Sequelize,
 * PostgreSQL or MySQL, numeric or UUID ids). Uses only Node.js built-ins.
 *
 *   1. Start the student's API (e.g. npm run start:dev).
 *   2. Run:  BASE_URL=http://localhost:3000/api node --test course-management.e2e.test.mjs
 *
 * Requirements: Node.js 20 or newer. The database does not need to be empty:
 * every test creates its own records with unique emails.
 *
 * Two kinds of checks:
 *   - Required: behaviour stated in the specification. Must pass.
 *   - Policy:   the specification says "consider" or "if required". Several answers
 *               are accepted, but a 500 never is. The chosen behaviour is printed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

// ---------- helpers ----------

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
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

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const num = (value) => Number(value); // numeric columns may come back as strings
const missingId = (sample) =>
  typeof sample === 'number' || /^\d+$/.test(String(sample))
    ? 999999999
    : '00000000-0000-4000-8000-000000000000';
// enrollment rows may expose studentId or a nested student object
const idOf = (row, name) => row?.[`${name}Id`] ?? row?.[name]?.id;
const sameId = (a, b) => String(a) === String(b);

async function createStudent(overrides = {}) {
  const res = await api('POST', '/students', {
    name: 'Sara Mohammad',
    email: `sara.${unique()}@example.com`,
    phone: '+33123456789',
    ...overrides,
  });
  expectStatus(res, 201);
  return res.body;
}

async function createCourse(overrides = {}) {
  const res = await api('POST', '/courses', {
    title: 'NestJS Basics',
    description: 'Learn NestJS',
    price: 100,
    discountType: 'PERCENTAGE',
    discountValue: 20,
    isActive: true,
    ...overrides,
  });
  expectStatus(res, 201);
  return res.body;
}

async function enroll(studentId, courseId) {
  return api('POST', '/enrollments', { studentId, courseId });
}

// ---------- admins ----------

describe('Admins', () => {
  it('creates, reads, updates, lists, and deletes an admin', async () => {
    const email = `ahmad.${unique()}@example.com`;
    const created = await api('POST', '/admins', { name: 'Ahmad Ali', email });
    expectStatus(created, 201);
    assert.equal(created.body.name, 'Ahmad Ali');
    assert.equal(created.body.email, email);
    assert.ok(created.body.id !== undefined, 'response has an id');
    const id = created.body.id;

    const one = await api('GET', `/admins/${id}`);
    expectStatus(one, 200);
    assert.equal(one.body.email, email);

    const updated = await api('PATCH', `/admins/${id}`, { name: 'Ahmad' });
    expectStatus(updated, 200);
    assert.equal(updated.body.name, 'Ahmad');
    assert.equal(updated.body.email, email, 'PATCH keeps fields that were not sent');

    const list = await api('GET', '/admins');
    expectStatus(list, 200);
    assert.ok(Array.isArray(list.body), 'GET /admins returns an array');
    assert.ok(list.body.some((a) => sameId(a.id, id)), 'the new admin is in the list');

    expectStatus(await api('DELETE', `/admins/${id}`), 204);
    expectStatus(await api('GET', `/admins/${id}`), 404);
  });

  it('rejects an invalid email with 400', async () => {
    expectStatus(await api('POST', '/admins', { name: 'Ahmad', email: 'not-an-email' }), 400);
  });

  it('returns 404 for an unknown admin', async () => {
    const created = await api('POST', '/admins', {
      name: 'Tmp',
      email: `tmp.${unique()}@example.com`,
    });
    expectStatus(await api('GET', `/admins/${missingId(created.body.id)}`), 404);
  });
});

// ---------- students ----------

describe('Students', () => {
  it('creates, reads, updates, and lists a student', async () => {
    const student = await createStudent();
    assert.equal(student.name, 'Sara Mohammad');
    assert.equal(student.phone, '+33123456789');

    const one = await api('GET', `/students/${student.id}`);
    expectStatus(one, 200);
    assert.equal(one.body.email, student.email);

    const updated = await api('PATCH', `/students/${student.id}`, { name: 'Sara Ali' });
    expectStatus(updated, 200);
    assert.equal(updated.body.name, 'Sara Ali');
    assert.equal(updated.body.email, student.email, 'PATCH keeps fields that were not sent');

    const list = await api('GET', '/students');
    expectStatus(list, 200);
    assert.ok(list.body.some((s) => sameId(s.id, student.id)));
  });

  it('deletes a student without enrollments with 204', async () => {
    const student = await createStudent();
    expectStatus(await api('DELETE', `/students/${student.id}`), 204);
    expectStatus(await api('GET', `/students/${student.id}`), 404);
  });

  it('rejects an invalid email with 400', async () => {
    expectStatus(await api('POST', '/students', { name: 'Sara', email: 'nope' }), 400);
  });

  it('returns 404 for an unknown student', async () => {
    const student = await createStudent();
    expectStatus(await api('GET', `/students/${missingId(student.id)}`), 404);
  });

  it('[policy] duplicate email: 409, or allowed with 201', async (t) => {
    const student = await createStudent();
    const res = await api('POST', '/students', { name: 'Copy', email: student.email, phone: '+963912345678', });
    expectStatus(res, 409, 201);
    t.diagnostic(`duplicate student email → ${res.status}`);
  });
});

// ---------- courses ----------

describe('Courses', () => {
  it('creates a course and returns the calculated finalPrice', async () => {
    const course = await createCourse();
    assert.equal(course.title, 'NestJS Basics');
    assert.equal(num(course.price), 100);
    assert.equal(course.discountType, 'PERCENTAGE');
    assert.equal(num(course.discountValue), 20);
    assert.equal(num(course.finalPrice), 80);
    assert.equal(course.isActive, true);
  });

  it('includes finalPrice in GET /courses and GET /courses/:id', async () => {
    const course = await createCourse();

    const list = await api('GET', '/courses');
    expectStatus(list, 200);
    const fromList = list.body.find((c) => sameId(c.id, course.id));
    assert.ok(fromList, 'the new course is in the list');
    assert.equal(num(fromList.finalPrice), 80);
    assert.ok(list.body.every((c) => c.finalPrice !== undefined), 'every course has finalPrice');

    const one = await api('GET', `/courses/${course.id}`);
    expectStatus(one, 200);
    assert.equal(num(one.body.finalPrice), 80);
  });

  it('calculates finalPrice for NONE and FIXED discounts', async () => {
    const none = await createCourse({ price: 50, discountType: 'NONE', discountValue: 0 });
    assert.equal(num(none.finalPrice), 50);

    const fixed = await createCourse({ price: 100, discountType: 'FIXED', discountValue: 30 });
    assert.equal(num(fixed.finalPrice), 70);
  });

  it('updates only the supplied fields and recalculates finalPrice', async () => {
    const course = await createCourse();
    const res = await api('PATCH', `/courses/${course.id}`, {
      price: 120,
      discountType: 'FIXED',
      discountValue: 20,
    });
    expectStatus(res, 200);
    assert.equal(num(res.body.price), 120);
    assert.equal(res.body.discountType, 'FIXED');
    assert.equal(num(res.body.finalPrice), 100);
    assert.equal(res.body.title, 'NestJS Basics', 'title was not sent, so it is unchanged');
  });

  it('rejects a negative price with 400', async () => {
    const res = await api('POST', '/courses', {
      title: 'Bad',
      price: -1,
      discountType: 'NONE',
      discountValue: 0,
      isActive: true,
    });
    expectStatus(res, 400);
  });

  it('rejects a percentage discount above 100 with 400', async () => {
    const res = await api('POST', '/courses', {
      title: 'Bad',
      price: 100,
      discountType: 'PERCENTAGE',
      discountValue: 150,
      isActive: true,
    });
    expectStatus(res, 400);
  });

  it('rejects a fixed discount larger than the price with 400', async () => {
    const res = await api('POST', '/courses', {
      title: 'Bad',
      price: 50,
      discountType: 'FIXED',
      discountValue: 80,
      isActive: true,
    });
    expectStatus(res, 400);
  });

  it('rejects a negative discount with 400', async () => {
    const res = await api('POST', '/courses', {
      title: 'Bad',
      price: 100,
      discountType: 'FIXED',
      discountValue: -5,
      isActive: true,
    });
    expectStatus(res, 400);
  });

  it('rejects an unknown discountType with 400', async () => {
    const res = await api('POST', '/courses', {
      title: 'Bad',
      price: 100,
      discountType: 'HALF_PRICE',
      discountValue: 0,
      isActive: true,
    });
    expectStatus(res, 400);
  });

  it('validates PATCH against the stored values (lowering the price below a fixed discount)', async () => {
    const course = await createCourse({ price: 100, discountType: 'FIXED', discountValue: 40 });
    const res = await api('PATCH', `/courses/${course.id}`, { price: 30 });
    expectStatus(res, 400);
  });

  it('returns 404 for an unknown course', async () => {
    const course = await createCourse();
    expectStatus(await api('GET', `/courses/${missingId(course.id)}`), 404);
  });

  it('deletes a course without enrollments with 204', async () => {
    const course = await createCourse();
    expectStatus(await api('DELETE', `/courses/${course.id}`), 204);
  });
});

// ---------- enrollments ----------

describe('Enrollments', () => {
  it('enrolls a student with the discounted price and returns 201', async () => {
    const student = await createStudent();
    const course = await createCourse();

    const res = await enroll(student.id, course.id);
    expectStatus(res, 201);
    assert.ok(sameId(idOf(res.body, 'student'), student.id), 'studentId matches');
    assert.ok(sameId(idOf(res.body, 'course'), course.id), 'courseId matches');
    assert.equal(num(res.body.priceAtEnrollment), 80);
    assert.equal(res.body.status, 'ACTIVE');
    assert.ok(!Number.isNaN(Date.parse(res.body.enrolledAt)), 'enrolledAt is a valid date');
  });

  it('rejects a duplicate active enrollment with 409', async () => {
    const student = await createStudent();
    const course = await createCourse();
    expectStatus(await enroll(student.id, course.id), 201);

    expectStatus(await enroll(student.id, course.id), 409);
  });

  it('does not allow enrollment in an inactive course', async () => {
    const student = await createStudent();
    const course = await createCourse({ isActive: false });

    const res = await enroll(student.id, course.id);
    expectStatus(res, 400, 409);
  });

  it('returns 404 for an unknown student or course', async () => {
    const student = await createStudent();
    const course = await createCourse();

    expectStatus(await enroll(missingId(student.id), course.id), 404);
    expectStatus(await enroll(student.id, missingId(course.id)), 404);
  });

  it('rejects a body without studentId or courseId with 400', async () => {
    expectStatus(await api('POST', '/enrollments', {}), 400);
  });

  it('keeps priceAtEnrollment when the course price changes later', async () => {
    const student = await createStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);
    expectStatus(created, 201);

    expectStatus(await api('PATCH', `/courses/${course.id}`, { price: 500 }), 200);

    const after = await api('GET', `/enrollments/${created.body.id}`);
    expectStatus(after, 200);
    assert.equal(num(after.body.priceAtEnrollment), 80);
  });

  it('lists enrollments globally, per student, and per course', async () => {
    const student = await createStudent();
    const course = await createCourse({ title: 'Course for listing' });
    const created = await enroll(student.id, course.id);
    expectStatus(created, 201);

    const all = await api('GET', '/enrollments');
    expectStatus(all, 200);
    assert.ok(all.body.some((e) => sameId(e.id, created.body.id)), 'in GET /enrollments');

    const one = await api('GET', `/enrollments/${created.body.id}`);
    expectStatus(one, 200);
    assert.equal(one.body.status, 'ACTIVE');

    const byStudent = await api('GET', `/students/${student.id}/enrollments`);
    expectStatus(byStudent, 200);
    assert.equal(byStudent.body.length, 1, 'the student has exactly one enrollment');
    assert.ok(sameId(idOf(byStudent.body[0], 'course'), course.id));
    assert.equal(num(byStudent.body[0].priceAtEnrollment), 80);
    assert.ok(byStudent.body[0].course?.title, 'includes course details');

    const byCourse = await api('GET', `/courses/${course.id}/enrollments`);
    expectStatus(byCourse, 200);
    assert.equal(byCourse.body.length, 1, 'the course has exactly one enrollment');
    assert.ok(sameId(idOf(byCourse.body[0], 'student'), student.id));
    assert.ok(byCourse.body[0].student?.email, 'includes student details');
  });

  it('cancels an enrollment with PATCH and rejects an unknown status', async () => {
    const student = await createStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);

    const cancelled = await api('PATCH', `/enrollments/${created.body.id}`, {
      status: 'CANCELLED',
    });
    expectStatus(cancelled, 200);
    assert.equal(cancelled.body.status, 'CANCELLED');

    expectStatus(
      await api('PATCH', `/enrollments/${created.body.id}`, { status: 'PAUSED' }),
      400,
    );
  });

  it('deletes an enrollment with 204', async () => {
    const student = await createStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);

    expectStatus(await api('DELETE', `/enrollments/${created.body.id}`), 204);
    expectStatus(await api('GET', `/enrollments/${created.body.id}`), 404);
  });

  it('returns 404 for an unknown enrollment', async () => {
    const student = await createStudent();
    const course = await createCourse();
    const created = await enroll(student.id, course.id);
    expectStatus(await api('GET', `/enrollments/${missingId(created.body.id)}`), 404);
  });

  it('[policy] re-enrollment after cancellation: 201 or 409', async (t) => {
    const student = await createStudent();
    const course = await createCourse();
    const first = await enroll(student.id, course.id);
    await api('PATCH', `/enrollments/${first.body.id}`, { status: 'CANCELLED' });

    const again = await enroll(student.id, course.id);
    expectStatus(again, 201, 409);
    t.diagnostic(`re-enroll after cancellation → ${again.status}`);
  });
});

// ---------- deletion policies and robustness ----------

describe('Policies and robustness', () => {
  it('[policy] deleting a course that has enrollments: 409, or 204 (soft delete)', async (t) => {
    const student = await createStudent();
    const course = await createCourse();
    expectStatus(await enroll(student.id, course.id), 201);

    const res = await api('DELETE', `/courses/${course.id}`);
    expectStatus(res, 409, 204);
    t.diagnostic(`delete course with enrollments → ${res.status}`);
  });

  it('[policy] deleting a student who has enrollments: 409 or 204', async (t) => {
    const student = await createStudent();
    const course = await createCourse();
    expectStatus(await enroll(student.id, course.id), 201);

    const res = await api('DELETE', `/students/${student.id}`);
    expectStatus(res, 409, 204);
    t.diagnostic(`delete student with enrollments → ${res.status}`);
  });

  it('never answers 500 for a malformed id', async () => {
    for (const path of ['/admins/abc', '/students/abc', '/courses/abc', '/enrollments/abc']) {
      const res = await api('GET', path);
      expectStatus(res, 400, 404);
    }
  });
});
