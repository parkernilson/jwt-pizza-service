const request = require("supertest");
const app = require("../service");
const { DB } = require("../database/database");
const { randomName } = require("../utils/tests/random-name");

let testUser1;
let testUser1Password = "secret$123";
let adminUser1Password = "admin$123";

beforeAll(() => {
  jest.setTimeout(30000);
})

beforeEach(async () => {
  try {
    const testUser1Name = randomName();
    const testUser1Email = testUser1Name + "@test.com";
    const registerUser1 = await request(app).post("/api/auth").send({
      name: testUser1Name,
      email: testUser1Email,
      password: testUser1Password,
    });
    testUser1 = registerUser1.body;
    const admin1Name = randomName();
    const admin1Email = admin1Name + "@admin.com";
    await DB.addUser({
      name: admin1Name,
      email: admin1Email,
      password: adminUser1Password,
      roles: [{ role: "admin" }],
    });
  } catch (e) {
    console.log(e);
  }
});

test("Should return 401 if no token is provided", async () => {
  const res = await request(app).put(`/api/auth/${testUser1.id}`);
  expect(res.status).toBe(401);
  expect(res.body.message).toBe("unauthorized");
});

test("register", async () => {
  const newName = randomName();
  const newUser = {
    name: newName,
    email: newName + "@test.com",
    password: "a",
  };
  const registerRes = await request(app).post("/api/auth").send(newUser);
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );

  // eslint-disable-next-line no-unused-vars
  const { password, ...user } = { ...newUser, roles: [{ role: "diner" }] };
  expect(registerRes.body.user).toMatchObject(user);
});

test("login", async () => {
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: testUser1.user.email, password: testUser1Password });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );

  // eslint-disable-next-line no-unused-vars
  const { password, ...user } = { ...testUser1.user };
  expect(loginRes.body.user).toMatchObject(user);
});

test("logout", async () => {
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: testUser1.user.email, password: testUser1Password });
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${loginRes.body.token}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");
});

test("logout unauthorized", async () => {
  const logoutRes = await request(app).delete("/api/auth");
  expect(logoutRes.status).toBe(401);
  expect(logoutRes.body.message).toBe("unauthorized");
});

test("update user", async () => {
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: testUser1.user.email, password: testUser1Password });
  const newEmail = "updated@test.com";
  const updateRes = await request(app)
    .put(`/api/auth/${loginRes.body.user.id}`)
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send({ email: newEmail, password: testUser1Password });

  expect(updateRes.status).toBe(200);
  expect(updateRes.body.email).toBe(newEmail);
});

test("update user unauthorized", async () => {
  const newEmail = "updated@test.com";
  const updateRes = await request(app)
    .put(`/api/auth/${testUser1.id}`)
    .send({ email: newEmail });

  expect(updateRes.status).toBe(401);
  expect(updateRes.body.message).toBe("unauthorized");
});

test ("update user with wrong credentials", async () => {
  const otherName = randomName();
  const otherUser = { name: otherName, email: otherName + "@test.com", password: "a" };
  const registerOtherRes = await request(app).post("/api/auth").send(otherUser);
  const newEmail = "newemail@gmail.com"
  const updateRes = await request(app)
    .put(`/api/auth/${testUser1.user.id}`)
    .set("Authorization", `Bearer ${registerOtherRes.body.token}`)
    .send({ email: newEmail });
  expect(updateRes.status).toBe(403);
})

test("register user without all required credentials", async () => {
  const res = await request(app).post("/api/auth").send({ name: "name" });
  expect(res.status).toBe(400);
  expect(res.body.message).toBe("name, email, and password are required");
})
