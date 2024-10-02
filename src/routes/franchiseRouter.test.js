const request = require("supertest");
const app = require("../service");
const { DB, Role } = require("../database/database");
const { randomName } = require("../utils/tests/random-name");
const { randomIntId } = require("../utils/tests/random-int-id");

let testUser1;
let testUser1Password = "secret$123";
let loginResUser1;
let adminUser1Password = "admin$123";
let loginResAdmin1;
let connection;
let franchise1Id;
let franchise1Name;
let franchise2Id;
let franchise2Name;
let franchise3Id;
let franchise3Name;
let store1Id;
let store1Name;

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
    loginResUser1 = await request(app).put("/api/auth").send({
      email: testUser1Email,
      password: testUser1Password,
    });
    const admin1Name = randomName();
    const admin1Email = admin1Name + "@admin.com";
    await DB.addUser({
      name: admin1Name,
      email: admin1Email,
      password: adminUser1Password,
      roles: [{ role: "admin" }],
    });
    loginResAdmin1 = await request(app).put("/api/auth").send({
      email: admin1Email,
      password: adminUser1Password,
    });

    // Seed data
    franchise1Id = randomIntId();
    franchise1Name = randomName();
    franchise2Id = randomIntId();
    franchise2Name = randomName();
    franchise3Id = randomIntId();
    franchise3Name = randomName();
    store1Id = randomIntId();
    store1Name = randomName();
    connection = await DB.getConnection();
    await connection.query(
      `INSERT INTO franchise (id, name) VALUES 
      (${franchise1Id}, '${franchise1Name}'),
      (${franchise2Id}, '${franchise2Name}'),
      (${franchise3Id}, '${franchise3Name}')
      `
    );
    await connection.query(`
      INSERT INTO userRole (userId, role, objectId) VALUES
        (${testUser1.user.id}, '${Role.Franchisee}', ${franchise1Id}),
        (${loginResAdmin1.body.user.id}, '${Role.Admin}', ${franchise1Id})`);
    await connection.query(`
      INSERT INTO store (id, franchiseId, name) VALUES
        (${store1Id}, ${franchise2Id}, '${store1Name}')`);
  } catch (e) {
    console.log(e);
  } finally {
    await connection.end();
  }
});

beforeAll(() => {
  jest.setTimeout(30000);
});

test("Should get all franchises for normal user", async () => {
  const franchisesRes = await request(app)
    .get("/api/franchise")
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);
  expect(franchisesRes.body.length).toBeGreaterThan(2);
});

test("Should get franchises of user", async () => {
  const franchisesRes = await request(app)
    .get(`/api/franchise/${loginResUser1.body.user.id}`)
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);
  expect(franchisesRes.body).toHaveLength(1);
});

test("Should allow admin to create a franchise", async () => {
  const exampleFranchise = {
    name: randomName(),
    admins: [{ email: loginResAdmin1.body.user.email }],
  };
  const franchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`)
    .send({ ...exampleFranchise });
  expect(franchiseRes.body).toMatchObject({
    ...exampleFranchise,
  });
});

test("Should not allow normal user to create a franchise", async () => {
  const franchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${loginResUser1.body.token}`)
    .send({ name: "new franchise" });
  expect(franchiseRes.status).toBe(403);
});

test("Should allow admin to delete a franchise", async () => {
  const franchiseRes = await request(app)
    .delete("/api/franchise/1")
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`);
  expect(franchiseRes.body).toMatchObject({ message: "franchise deleted" });
});

test("Should not allow normal user to delete a franchise", async () => {
  const franchiseRes = await request(app)
    .delete("/api/franchise/1")
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);
  expect(franchiseRes.status).toBe(403);
});

test("Should allow admin to create a store", async () => {
  const storeName = randomName();
  const storeRes = await request(app)
    .post(`/api/franchise/${franchise2Id}/store`)
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`)
    .send({ name: storeName, franchiseId: franchise2Id });
  expect(storeRes.body).toMatchObject({ name: storeName });
});

test("Should not allow non-admin user to create a store", async () => {
  const otherUser = {
    name: "other user",
    email: "otherguy@gmail.com",
    password: "a",
  };
  const registerOtherRes = await request(app).post("/api/auth").send(otherUser);
  const storeRes = await request(app)
    .post("/api/franchise/1/store")
    .set("Authorization", `Bearer ${registerOtherRes.body.token}`)
    .send({ name: randomName() });
  expect(storeRes.status).toBe(403);
});

test("Should allow admin to delete a store", async () => {
  const storeRes = await request(app)
    .delete(`/api/franchise/${franchise1Id}/store/${store1Id}`)
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`);
  expect(storeRes.body).toMatchObject({ message: "store deleted" });
});

test("Should get extra information for admin when getting franchises", async () => {
  const franchisesRes = await request(app)
    .get(`/api/franchise`)
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`);
  expect(franchisesRes.body[0]).toHaveProperty("stores");
  expect(franchisesRes.body[0]).toHaveProperty("admins");
});

test("Should get an empty array when a user has no franchises", async () => {
  const otherName = randomName();
  const otherUser = {
    name: otherName,
    email: otherName + "@test.com",
    password: "a",
    roles: [{ role: Role.Diner }],
  };
  const connection = await DB.getConnection();
  try {
    const registerResOther = await request(app).post("/api/auth").send({
      name: otherUser.name,
      email: otherUser.email,
      password: otherUser.password,
    });
    const getFranchisesRes = await request(app)
      .get(`/api/franchise/${registerResOther.body.user.id}`)
      .set("Authorization", `Bearer ${registerResOther.body.token}`);
    expect(getFranchisesRes.body).toEqual([]);
  } finally {
    await connection.end();
  }
});

test("Should give 500 when creating a store for a non-existent franchise", async () => {
  const storeRes = await request(app)
    .post(`/api/franchise/999/store`)
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`)
    .send({ name: randomName() });
  expect(storeRes.status).toBe(500);
});