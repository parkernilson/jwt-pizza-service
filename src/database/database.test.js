const request = require("supertest");
const app = require("../service");
const { DB, Role } = require("../database/database");
const { randomName } = require("../utils/tests/random-name");
const { randomIntId } = require("../utils/tests/random-int-id");
const { StatusCodeError } = require("../endpointHelper");

let testUser1;
let testUser1Password = "secret$123";
let loginResUser1;
let adminUser1Password = "admin$123";
let connection;
let franchise1Id;
let franchise1Name;
let franchise2Id;
let franchise2Name;
let franchise3Id;
let franchise3Name;
let store1Id;
let store1Name;
let dinerOrder1Id;
let orderItem1Id;
let menuItem1Id;
let menuItem2Id;
let menuItem3Id;

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

    // Seed data
    franchise1Id = randomIntId();
    franchise1Name = randomName();
    franchise2Id = randomIntId();
    franchise2Name = randomName();
    franchise3Id = randomIntId();
    franchise3Name = randomName();
    store1Id = randomIntId();
    store1Name = randomName();
    dinerOrder1Id = randomIntId();
    orderItem1Id = randomIntId();
    menuItem1Id = randomIntId();
    menuItem2Id = randomIntId();
    menuItem3Id = randomIntId();
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
        (${testUser1.user.id}, '${Role.Franchisee}', ${franchise1Id})`);
    await connection.query(`
      INSERT INTO store (id, franchiseId, name) VALUES
        (${store1Id}, ${franchise2Id}, '${store1Name}')`);
    await connection.query(`
      INSERT INTO dinerOrder (id, dinerId, franchiseId, storeId, date) VALUES
      (${dinerOrder1Id}, ${loginResUser1.body.user.id}, ${franchise1Id}, ${store1Id}, NOW())`);
    await connection.query(`
      INSERT INTO orderItem (id, orderId, menuId, description, price) VALUES
      (${orderItem1Id}, ${dinerOrder1Id}, ${menuItem1Id}, 'veggie', 0.05)`);
    await connection.query(`
      INSERT INTO menu (id, title, image, price, description) VALUES
      (${menuItem1Id}, 'veggie', 'image', 0.05, 'veggie'),
      (${menuItem2Id}, 'meat', 'image', 0.05, 'meat'),
      (${menuItem3Id}, 'vegan', 'image', 0.05, 'vegan')`);
  } catch (e) {
    console.log(e);
  } finally {
    await connection.end();
  }
});

beforeAll(() => {
  global.fetch = jest.fn();
  jest.setTimeout(30000);
});

afterAll(async () => {
  jest.clearAllMocks();
});

test("addUser should be able to add a franchisee user", async () => {
    const newName = randomName();
    const newUser = {
        name: newName,
        email: newName + "@test.com",
        password: "a",
    };
    const connection = await DB.getConnection();
    try {
        const res = await DB.addUser({
            name: newName,
            email: newUser.email,
            password: newUser.password,
            roles: [{ role: "franchisee", object: franchise2Name }],
        });
        expect(res).toMatchObject({
            name: newName,
            email: newUser.email,
            roles: [{ role: "franchisee" }],
        });
    } finally {
        await connection.end();
    }
});

test("Should give 404 when user is not found", async () => {
    const connection = await DB.getConnection();
    try {
        await DB.getUser("noemail@email.com", "nopassword");
    } catch(e) {
        expect(e instanceof StatusCodeError).toBe(true);
        expect(e.statusCode).toBe(404);
    } finally {
        await connection.end();
    }
});

test("Should give 404 when a franchise is created with an admin that does not exist", async () => {
    const connection = await DB.getConnection();
    try {
        await DB.createFranchise({
            name: "newfranchise",
            admins: [
                { email: "doesnotexist@mail.com" }
            ]
        })
    } catch(e) {
        expect(e instanceof StatusCodeError).toBe(true);
        expect(e.statusCode).toBe(404);
    } finally {
        await connection.end();
    }
})