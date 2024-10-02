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
      (${dinerOrder1Id}, ${loginResUser1.body.user.id}, ${franchise1Id}, ${store1Id}, NOW())`)
    await connection.query(`
      INSERT INTO orderItem (id, orderId, menuId, description, price) VALUES
      (${orderItem1Id}, ${dinerOrder1Id}, ${menuItem1Id}, 'veggie', 0.05)`)
    await connection.query(`
      INSERT INTO menu (id, title, image, price, description) VALUES
      (${menuItem1Id}, 'veggie', 'image', 0.05, 'veggie'),
      (${menuItem2Id}, 'meat', 'image', 0.05, 'meat'),
      (${menuItem3Id}, 'vegan', 'image', 0.05, 'vegan')`)
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
})

test("Should get the menu", () => {
  return request(app)
    .get("/api/order/menu")
    .expect(200)
    .then((res) => {
      expect(res.body.length > 0).toBe(true);
    });
})

test("Should add an item to the menu", async () => {
  const newItemName = randomName();
  const newItem = {
    title: newItemName,
    description: `new item ${newItemName}`,
    image: "image",
    price: 0.05
  }
  await request(app)
    .put("/api/order/menu")
    .send(newItem)
    .set("Authorization", `Bearer ${loginResAdmin1.body.token}`);
  const connection = await DB.getConnection();
  try {
    const menuItem = await connection.query(`SELECT * FROM menu WHERE title = '${newItemName}'`);
    expect(menuItem[0][0]).toMatchObject(newItem)
  } finally {
    await connection.end();
  }
});

test("Should not let a diner add an item to the menu", async () => {
  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .send({ title: "new item", description: "new item", image: "image", price: 0.05 })
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);
  expect(addMenuItemRes.status).toBe(403);
});

test("Should get the orders for the authenticated user", async () => {
  const getOrdersRes = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);
  expect(getOrdersRes.body.orders.map(o => o.id)).toContain(dinerOrder1Id);
});

test("Should create a order for the authenticated user", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ jwt: "fake-jwt-here", reportUrl: "reportUrl" })
  });

  const newOrder = {
    franchiseId: franchise1Id,
    storeId: store1Id,
    items: [{ menuId: menuItem2Id, description: "meat", price: 0.05 }]
  }

  const createOrderRes = await request(app)
    .post("/api/order")
    .send(newOrder)
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);
  expect(createOrderRes.body.order).toMatchObject(newOrder);
});

test("When the order fails should give 500 error", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    json: jest.fn().mockResolvedValue({ reportUrl: "reportUrl" })
  });
  const newOrder = {
    franchiseId: franchise1Id,
    storeId: store1Id,
    items: [{ menuId: menuItem2Id, description: "meat", price: 0.05 }]
  }
  const createOrderRes = await request(app)
    .post("/api/order")
    .send(newOrder)
    .set("Authorization", `Bearer ${loginResUser1.body.token}`);

  expect(createOrderRes.status).toBe(500);
})