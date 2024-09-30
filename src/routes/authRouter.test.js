const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testUserId;

beforeEach(async () => {
  // clear the database
  await DB.reset()

  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
})

test('register', async () => {
  const registerRes = await request(app).post('/api/auth').send(testUser);
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  // eslint-disable-next-line no-unused-vars
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(registerRes.body.user).toMatchObject(user);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  // eslint-disable-next-line no-unused-vars
  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
});

test('logout', async () => {
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
});

test('logout unauthorized', async () => {
  const logoutRes = await request(app).delete('/api/auth');
  expect(logoutRes.status).toBe(401);
  expect(logoutRes.body.message).toBe('unauthorized');
});

test('update user', async () => {
  const newEmail = 'updated@test.com';
  const updateRes = await request(app)
    .put(`/api/auth/${testUserId}`)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({ email: newEmail, password: testUser.password });

  expect(updateRes.status).toBe(200);
  expect(updateRes.body.email).toBe(newEmail);
});

test('update user unauthorized', async () => {
  const newEmail = 'updated@test.com';
  const updateRes = await request(app)
    .put(`/api/auth/${testUser.id}`)
    .send({ email: newEmail });

  expect(updateRes.status).toBe(401);
  expect(updateRes.body.message).toBe('unauthorized');
});

