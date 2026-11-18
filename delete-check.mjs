const BASE = process.env.BASE_URL ?? 'http://localhost:3000/api';

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const login = await call('/auth/login', {
  method: 'POST',
  body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
});
const token = login.body.accessToken;

const student = await call('/auth/register', {
  method: 'POST',
  body: {
    name: 'Delete Test',
    email: `del-${Date.now()}@example.com`,
    phone: '+100000000',
    password: 'delete-pass-1',
  },
});
const id = student.body.id;

const courses = (await call('/courses', { token })).body.filter((c) => c.isActive);
for (const course of courses.slice(0, 2)) {
  await call('/enrollments', {
    method: 'POST',
    token,
    body: { studentId: id, courseId: course.id },
  });
}

const statusesOf = async () =>
  (await call('/enrollments', { token })).body
    .filter((e) => e.studentId === id)
    .map((e) => e.status);

console.log('before delete  ->', await statusesOf());

const del = await call(`/students/${id}`, { method: 'DELETE', token });
console.log('DELETE status  ->', del.status);

console.log('after delete   ->', await statusesOf());
console.log('GET student    ->', (await call(`/students/${id}`, { token })).status);