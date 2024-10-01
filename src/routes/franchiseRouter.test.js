const request = require("supertest");
const app = require("../service");
const { DB, Role } = require("../database/database");
const { createAdminUser } = require("../utils/tests/create-admin-user");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testUserId;
let adminUser;

beforeAll(() => {
  jest.setTimeout(30000);
})

beforeEach(async () => {

  try {
    // clear the database
    await DB.reset();
    testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
    const registerRes = await request(app).post("/api/auth").send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUserId = registerRes.body.user.id;
    adminUser = await createAdminUser();
    // Seed data
    const connection = await DB.getConnection();
    await DB.query(
      connection,
      `
      INSERT INTO franchise (id, name) VALUES 
        (1, 'Franchise 1'),
        (2, 'Franchise 2'),
        (3, 'Franchise 3');
      `
    );
    await DB.query(
      connection,
      `
      INSERT INTO store (id, franchiseId, name) VALUES
        (1, 1, 'Store 1'),
        (2, 2, 'Store 2'),
        (3, 3, 'Store 3');  
    `
    );
    await DB.query(
      connection,
      `
      INSERT INTO userRole (userId, role, objectId) VALUES 
        (${testUser.id}, ${Role.Franchisee}, 1),
        (${testUser.id}, ${Role.Franchisee}, 3);
      `
    );
    await connection.end();
  } catch(e) {
    console.log(e);
  }

});

test("Should get franchises of user", async () => {
  const franchisesRes = await request(app)
    .get("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(franchisesRes.body).toHaveLength(3);
}, 30000);
