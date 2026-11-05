-- =====================================================================
-- SQL Training Curriculum - Database Setup Script
-- Schema: ShopCorp E-Commerce Database
-- Tables: categories, employees, customers, products, orders, order_items
-- Compatible with: PostgreSQL, MySQL, SQL Server, SQLite (minor tweaks noted)
-- =====================================================================

-- Drop tables if they already exist (order matters due to FK constraints)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS categories;

-- =====================================================================
-- TABLE: categories
-- =====================================================================
CREATE TABLE categories (
    category_id     INT PRIMARY KEY,
    category_name   VARCHAR(50) NOT NULL,
    description     VARCHAR(255)
);

-- =====================================================================
-- TABLE: employees (self-referencing manager_id)
-- =====================================================================
CREATE TABLE employees (
    employee_id     INT PRIMARY KEY,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    email           VARCHAR(100) UNIQUE,
    job_title       VARCHAR(50),
    department      VARCHAR(50),
    hire_date       DATE,
    salary          DECIMAL(10,2),
    manager_id      INT,
    FOREIGN KEY (manager_id) REFERENCES employees(employee_id)
);

-- =====================================================================
-- TABLE: customers
-- =====================================================================
CREATE TABLE customers (
    customer_id     INT PRIMARY KEY,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    email           VARCHAR(100) UNIQUE,
    phone           VARCHAR(20),
    city            VARCHAR(50),
    state           VARCHAR(50),
    country         VARCHAR(50),
    signup_date     DATE
);

-- =====================================================================
-- TABLE: products
-- =====================================================================
CREATE TABLE products (
    product_id      INT PRIMARY KEY,
    product_name    VARCHAR(100) NOT NULL,
    category_id     INT,
    unit_price      DECIMAL(10,2) NOT NULL,
    stock_quantity  INT DEFAULT 0,
    discontinued    INT DEFAULT 0,   -- 0 = active, 1 = discontinued
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- =====================================================================
-- TABLE: orders
-- =====================================================================
CREATE TABLE orders (
    order_id        INT PRIMARY KEY,
    customer_id     INT NOT NULL,
    employee_id     INT,
    order_date      DATE NOT NULL,
    ship_date       DATE,
    status          VARCHAR(20) DEFAULT 'Pending',
    shipping_cost   DECIMAL(8,2) DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- =====================================================================
-- TABLE: order_items
-- =====================================================================
CREATE TABLE order_items (
    order_item_id   INT PRIMARY KEY,
    order_id        INT NOT NULL,
    product_id      INT NOT NULL,
    quantity        INT NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    discount        DECIMAL(4,2) DEFAULT 0,   -- stored as a fraction, e.g. 0.10 = 10% off
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- =====================================================================
-- DATA: categories
-- =====================================================================
INSERT INTO categories (category_id, category_name, description) VALUES (1, 'Electronics', 'Gadgets, devices, and accessories');
INSERT INTO categories (category_id, category_name, description) VALUES (2, 'Apparel', 'Clothing and fashion items');
INSERT INTO categories (category_id, category_name, description) VALUES (3, 'Home & Kitchen', 'Household and kitchen essentials');
INSERT INTO categories (category_id, category_name, description) VALUES (4, 'Books', 'Printed and digital reading material');
INSERT INTO categories (category_id, category_name, description) VALUES (5, 'Sports & Outdoors', 'Fitness and outdoor equipment');
INSERT INTO categories (category_id, category_name, description) VALUES (6, 'Beauty & Personal Care', 'Cosmetics and grooming products');

-- =====================================================================
-- DATA: employees
-- =====================================================================
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (1, 'Laura', 'Bennett', 'laura.bennett@shopcorp.com', 'VP of Sales', 'Management', '2018-01-15', 145000.0, NULL);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (2, 'Marcus', 'Chen', 'marcus.chen@shopcorp.com', 'Sales Manager', 'Sales', '2019-03-01', 98000.0, 1);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (3, 'Priya', 'Nair', 'priya.nair@shopcorp.com', 'Support Manager', 'Support', '2019-06-10', 92000.0, 1);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (4, 'Diego', 'Alvarez', 'diego.alvarez@shopcorp.com', 'Sales Representative', 'Sales', '2020-02-20', 58000.0, 2);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (5, 'Emma', 'Wright', 'emma.wright@shopcorp.com', 'Sales Representative', 'Sales', '2020-08-05', 56000.0, 2);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (6, 'Kenji', 'Sato', 'kenji.sato@shopcorp.com', 'Sales Representative', 'Sales', '2021-04-12', 99500.0, 2);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (7, 'Olivia', 'Murphy', 'olivia.murphy@shopcorp.com', 'Support Specialist', 'Support', '2021-09-01', 48000.0, 3);
INSERT INTO employees (employee_id, first_name, last_name, email, job_title, department, hire_date, salary, manager_id) VALUES (8, 'Samuel', 'Osei', 'samuel.osei@shopcorp.com', 'Support Specialist', 'Support', '2022-01-18', 47000.0, 3);

-- =====================================================================
-- DATA: customers
-- =====================================================================
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (1, 'Alice', 'Johnson', 'alice.johnson@mail.com', '555-0101', 'Austin', 'TX', 'USA', '2023-01-10');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (2, 'Brian', 'Kim', 'brian.kim@mail.com', '555-0102', 'Seattle', 'WA', 'USA', '2023-01-22');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (3, 'Carla', 'Mendes', 'carla.mendes@mail.com', '555-0103', 'Miami', 'FL', 'USA', '2023-02-03');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (4, 'David', 'Thompson', 'david.thompson@mail.com', '555-0104', 'Denver', 'CO', 'USA', '2023-02-14');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (5, 'Elena', 'Petrova', 'elena.petrova@mail.com', '555-0105', 'Chicago', 'IL', 'USA', '2023-03-01');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (6, 'Frank', 'Ngo', 'frank.ngo@mail.com', '555-0106', 'Portland', 'OR', 'USA', '2023-03-19');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (7, 'Grace', 'Liu', 'grace.liu@mail.com', '555-0107', 'Toronto', 'ON', 'Canada', '2023-04-02');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (8, 'Henry', 'Okafor', 'henry.okafor@mail.com', '555-0108', 'Atlanta', 'GA', 'USA', '2023-04-20');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (9, 'Isabella', 'Rossi', 'isabella.rossi@mail.com', '555-0109', 'Boston', 'MA', 'USA', '2023-05-05');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (10, 'Jack', 'Wilson', 'jack.wilson@mail.com', '555-0110', 'Phoenix', 'AZ', 'USA', '2023-05-17');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (11, 'Karen', 'Novak', 'karen.novak@mail.com', '555-0111', 'Vancouver', 'BC', 'Canada', '2023-06-01');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (12, 'Liam', 'OBrien', 'liam.obrien@mail.com', '555-0112', 'Dublin', 'Leinster', 'Ireland', '2023-06-15');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (13, 'Maria', 'Garcia', 'maria.garcia@mail.com', '555-0113', 'San Diego', 'CA', 'USA', '2023-07-02');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (14, 'Noah', 'Anderson', 'noah.anderson@mail.com', '555-0114', 'Minneapolis', 'MN', 'USA', '2023-07-21');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (15, 'Olga', 'Ivanova', 'olga.ivanova@mail.com', '555-0115', 'New York', 'NY', 'USA', '2023-08-04');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (16, 'Paul', 'Dubois', 'paul.dubois@mail.com', '555-0116', 'Montreal', 'QC', 'Canada', '2023-08-19');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (17, 'Quinn', 'Baker', 'quinn.baker@mail.com', '555-0117', 'Nashville', 'TN', 'USA', '2023-09-03');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (18, 'Rosa', 'Fernandez', 'rosa.fernandez@mail.com', '555-0118', 'Houston', 'TX', 'USA', '2023-09-25');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (19, 'Samuel', 'Lee', 'samuel.lee@mail.com', '555-0119', 'San Francisco', 'CA', 'USA', '2023-10-08');
INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, signup_date) VALUES (20, 'Tina', 'Brooks', 'tina.brooks@mail.com', '555-0120', 'Raleigh', 'NC', 'USA', '2023-10-30');

-- =====================================================================
-- DATA: products
-- =====================================================================
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (1, 'Wireless Bluetooth Earbuds', 1, 59.99, 150, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (2, '4K Ultra HD Monitor 27in', 1, 289.99, 40, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (3, 'Mechanical Keyboard RGB', 1, 74.5, 90, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (4, 'Portable Power Bank 20000mAh', 1, 34.99, 200, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (5, 'Smart Fitness Watch', 1, 129.0, 75, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (6, 'Men''s Slim Fit Jeans', 2, 44.99, 120, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (7, 'Women''s Wool Sweater', 2, 52.0, 80, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (8, 'Unisex Rain Jacket', 2, 68.75, 60, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (9, 'Running Shoes - Cushion Pro', 2, 89.99, 100, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (10, 'Cotton Crew Socks (6-Pack)', 2, 14.99, 300, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (11, 'Stainless Steel Cookware Set', 3, 149.99, 35, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (12, 'Electric Kettle 1.7L', 3, 29.99, 110, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (13, '12-Cup Programmable Coffee Maker', 3, 54.99, 65, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (14, 'Memory Foam Pillow Set', 3, 39.99, 140, 1);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (15, 'Non-Stick Baking Sheet Set', 3, 24.99, 95, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (16, 'The Pragmatic Programmer', 4, 42.0, 55, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (17, 'Atomic Habits', 4, 18.5, 200, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (18, 'A Brief History of Time', 4, 16.99, 85, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (19, 'The SQL Cookbook', 4, 38.0, 45, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (20, 'Sapiens: A Brief History of Humankind', 4, 21.0, 130, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (21, 'Yoga Mat Premium', 5, 32.0, 160, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (22, 'Adjustable Dumbbell Set', 5, 199.99, 30, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (23, '2-Person Camping Tent', 5, 119.0, 40, 1);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (24, 'Insulated Water Bottle 32oz', 5, 22.99, 220, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (25, 'Road Bike Helmet', 5, 47.5, 70, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (26, 'Vitamin C Serum', 6, 19.99, 180, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (27, 'Electric Toothbrush', 6, 44.0, 95, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (28, 'Hair Dryer - Ionic Pro', 6, 36.99, 75, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (29, 'Facial Cleansing Brush', 6, 27.5, 100, 0);
INSERT INTO products (product_id, product_name, category_id, unit_price, stock_quantity, discontinued) VALUES (30, 'Organic Body Lotion 16oz', 6, 15.99, 250, 0);

-- =====================================================================
-- DATA: orders
-- =====================================================================
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (1, 4, 4, '2025-05-23', '2025-05-25', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (2, 15, 6, '2025-05-25', NULL, 'Processing', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (3, 11, 4, '2025-02-19', '2025-02-22', 'Completed', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (4, 3, 4, '2025-12-07', '2025-12-10', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (5, 12, 4, '2025-07-11', '2025-07-17', 'Completed', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (6, 8, 4, '2025-08-27', '2025-09-02', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (7, 11, 5, '2025-05-20', '2025-05-25', 'Completed', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (8, 9, 4, '2025-05-09', '2025-05-14', 'Shipped', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (9, 14, 6, '2025-02-04', '2025-02-09', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (10, 1, 6, '2025-05-17', NULL, 'Cancelled', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (11, 1, 4, '2025-07-07', NULL, 'Processing', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (12, 3, 6, '2025-03-08', '2025-03-12', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (13, 10, 5, '2025-12-12', '2025-12-16', 'Shipped', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (14, 2, 4, '2025-02-06', NULL, 'Processing', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (15, 16, 4, '2025-10-06', '2025-10-11', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (16, 15, 6, '2025-01-30', '2025-02-05', 'Shipped', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (17, 4, 4, '2025-04-11', '2025-04-15', 'Completed', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (18, 14, 5, '2025-09-06', '2025-09-10', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (19, 14, 6, '2025-10-14', '2025-10-18', 'Shipped', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (20, 11, 4, '2025-01-28', '2025-02-02', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (21, 20, 4, '2025-12-14', NULL, 'Processing', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (22, 20, 4, '2025-11-16', '2025-11-22', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (23, 3, 4, '2025-08-25', '2025-08-30', 'Shipped', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (24, 9, 4, '2025-06-30', NULL, 'Processing', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (25, 4, 4, '2025-05-18', '2025-05-19', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (26, 9, 6, '2025-09-10', '2025-09-11', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (27, 14, 6, '2025-01-07', '2025-01-13', 'Completed', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (28, 8, 6, '2025-02-24', '2025-03-01', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (29, 8, 5, '2025-03-25', '2025-03-26', 'Shipped', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (30, 7, 5, '2025-07-01', '2025-07-03', 'Completed', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (31, 11, 5, '2025-02-07', NULL, 'Cancelled', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (32, 9, 4, '2025-02-27', '2025-03-02', 'Completed', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (33, 14, 4, '2025-12-09', NULL, 'Cancelled', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (34, 13, 6, '2025-06-03', '2025-06-05', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (35, 19, 6, '2025-12-04', '2025-12-08', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (36, 17, 6, '2025-11-23', '2025-11-24', 'Shipped', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (37, 3, 5, '2025-08-03', NULL, 'Processing', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (38, 1, 4, '2025-08-08', '2025-08-14', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (39, 15, 6, '2025-09-18', '2025-09-23', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (40, 8, 6, '2025-05-24', '2025-05-29', 'Shipped', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (41, 9, 5, '2025-06-15', NULL, 'Processing', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (42, 7, 4, '2025-08-03', '2025-08-08', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (43, 10, 5, '2025-08-05', '2025-08-11', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (44, 20, 6, '2025-01-16', NULL, 'Processing', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (45, 11, 5, '2025-07-16', '2025-07-20', 'Completed', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (46, 18, 4, '2025-07-01', '2025-07-02', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (47, 1, 6, '2025-03-22', '2025-03-26', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (48, 19, 6, '2025-07-14', '2025-07-20', 'Completed', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (49, 10, 6, '2025-11-06', NULL, 'Processing', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (50, 12, 4, '2025-09-19', '2025-09-20', 'Shipped', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (51, 18, 5, '2025-08-29', '2025-09-04', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (52, 20, 6, '2025-07-16', '2025-07-20', 'Completed', 7.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (53, 9, 6, '2025-12-28', NULL, 'Processing', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (54, 8, 6, '2025-07-30', '2025-08-01', 'Completed', 9.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (55, 18, 6, '2025-06-28', '2025-07-04', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (56, 7, 5, '2025-03-05', '2025-03-11', 'Shipped', 4.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (57, 7, 5, '2025-04-29', '2025-05-02', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (58, 11, 4, '2025-01-29', '2025-02-02', 'Completed', 0.0);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (59, 19, 6, '2025-12-20', '2025-12-22', 'Completed', 12.99);
INSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost) VALUES (60, 15, 5, '2025-10-31', NULL, 'Cancelled', 7.99);

-- =====================================================================
-- DATA: order_items
-- =====================================================================
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (1, 1, 3, 1, 74.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (2, 1, 19, 2, 38.0, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (3, 1, 14, 1, 39.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (4, 1, 2, 2, 289.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (5, 1, 1, 4, 59.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (6, 2, 23, 3, 119.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (7, 2, 14, 2, 39.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (8, 3, 9, 1, 89.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (9, 3, 26, 1, 19.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (10, 3, 2, 3, 289.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (11, 3, 24, 3, 22.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (12, 3, 15, 2, 24.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (13, 4, 28, 4, 36.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (14, 4, 4, 4, 34.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (15, 5, 20, 2, 21.0, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (16, 6, 22, 1, 199.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (17, 6, 11, 1, 149.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (18, 7, 21, 4, 32.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (19, 7, 16, 4, 42.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (20, 8, 14, 2, 39.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (21, 8, 29, 4, 27.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (22, 8, 19, 1, 38.0, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (23, 8, 13, 1, 54.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (24, 8, 12, 2, 29.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (25, 9, 9, 1, 89.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (26, 9, 18, 3, 16.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (27, 9, 28, 3, 36.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (28, 9, 1, 3, 59.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (29, 9, 22, 2, 199.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (30, 10, 30, 2, 15.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (31, 10, 4, 3, 34.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (32, 10, 28, 2, 36.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (33, 10, 21, 1, 32.0, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (34, 10, 10, 3, 14.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (35, 11, 2, 1, 289.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (36, 11, 8, 4, 68.75, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (37, 12, 9, 4, 89.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (38, 12, 17, 2, 18.5, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (39, 13, 4, 1, 34.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (40, 13, 8, 2, 68.75, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (41, 13, 3, 2, 74.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (42, 13, 11, 1, 149.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (43, 14, 17, 2, 18.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (44, 15, 8, 2, 68.75, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (45, 15, 26, 1, 19.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (46, 15, 16, 4, 42.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (47, 15, 14, 4, 39.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (48, 16, 13, 3, 54.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (49, 17, 6, 1, 44.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (50, 17, 9, 1, 89.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (51, 17, 15, 1, 24.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (52, 17, 8, 2, 68.75, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (53, 18, 13, 4, 54.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (54, 18, 1, 4, 59.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (55, 19, 10, 1, 14.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (56, 19, 7, 1, 52.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (57, 20, 2, 1, 289.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (58, 20, 17, 2, 18.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (59, 21, 29, 2, 27.5, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (60, 22, 17, 3, 18.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (61, 22, 11, 3, 149.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (62, 22, 30, 2, 15.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (63, 22, 9, 3, 89.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (64, 22, 7, 3, 52.0, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (65, 23, 18, 2, 16.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (66, 24, 10, 3, 14.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (67, 24, 6, 1, 44.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (68, 24, 15, 3, 24.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (69, 25, 9, 2, 89.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (70, 25, 10, 3, 14.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (71, 26, 27, 3, 44.0, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (72, 26, 9, 2, 89.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (73, 26, 2, 3, 289.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (74, 26, 1, 4, 59.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (75, 27, 2, 2, 289.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (76, 27, 27, 2, 44.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (77, 27, 12, 3, 29.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (78, 27, 19, 1, 38.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (79, 27, 18, 2, 16.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (80, 28, 24, 2, 22.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (81, 28, 5, 2, 129.0, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (82, 28, 30, 1, 15.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (83, 28, 8, 3, 68.75, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (84, 28, 28, 4, 36.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (85, 29, 28, 4, 36.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (86, 30, 22, 2, 199.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (87, 31, 21, 3, 32.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (88, 31, 17, 1, 18.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (89, 31, 13, 2, 54.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (90, 32, 20, 2, 21.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (91, 32, 17, 1, 18.5, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (92, 32, 4, 4, 34.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (93, 32, 13, 2, 54.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (94, 33, 22, 3, 199.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (95, 33, 28, 3, 36.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (96, 33, 4, 4, 34.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (97, 34, 22, 3, 199.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (98, 34, 24, 1, 22.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (99, 34, 29, 3, 27.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (100, 34, 6, 4, 44.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (101, 35, 17, 2, 18.5, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (102, 35, 16, 1, 42.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (103, 36, 8, 2, 68.75, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (104, 36, 26, 1, 19.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (105, 36, 7, 4, 52.0, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (106, 37, 23, 4, 119.0, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (107, 37, 13, 2, 54.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (108, 38, 2, 1, 289.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (109, 38, 18, 2, 16.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (110, 38, 8, 4, 68.75, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (111, 38, 30, 3, 15.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (112, 39, 24, 4, 22.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (113, 39, 28, 3, 36.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (114, 40, 9, 1, 89.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (115, 40, 15, 3, 24.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (116, 41, 5, 4, 129.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (117, 41, 8, 2, 68.75, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (118, 42, 2, 4, 289.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (119, 42, 7, 1, 52.0, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (120, 42, 27, 4, 44.0, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (121, 42, 14, 1, 39.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (122, 43, 29, 4, 27.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (123, 43, 8, 4, 68.75, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (124, 43, 16, 4, 42.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (125, 43, 9, 2, 89.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (126, 43, 14, 4, 39.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (127, 44, 22, 2, 199.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (128, 44, 1, 4, 59.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (129, 44, 3, 1, 74.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (130, 44, 21, 4, 32.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (131, 44, 14, 2, 39.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (132, 45, 16, 1, 42.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (133, 46, 8, 2, 68.75, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (134, 47, 7, 3, 52.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (135, 47, 15, 1, 24.99, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (136, 47, 23, 2, 119.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (137, 47, 9, 1, 89.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (138, 47, 25, 1, 47.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (139, 48, 19, 2, 38.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (140, 49, 12, 4, 29.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (141, 50, 4, 4, 34.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (142, 50, 14, 2, 39.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (143, 50, 12, 2, 29.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (144, 50, 21, 3, 32.0, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (145, 51, 11, 1, 149.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (146, 51, 28, 4, 36.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (147, 51, 8, 4, 68.75, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (148, 52, 16, 3, 42.0, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (149, 52, 7, 3, 52.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (150, 53, 17, 2, 18.5, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (151, 54, 15, 3, 24.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (152, 54, 26, 4, 19.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (153, 54, 1, 2, 59.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (154, 54, 3, 3, 74.5, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (155, 55, 12, 3, 29.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (156, 55, 23, 3, 119.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (157, 55, 15, 1, 24.99, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (158, 56, 7, 4, 52.0, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (159, 56, 24, 3, 22.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (160, 57, 5, 2, 129.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (161, 57, 9, 4, 89.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (162, 57, 2, 1, 289.99, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (163, 57, 18, 3, 16.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (164, 57, 10, 4, 14.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (165, 58, 13, 4, 54.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (166, 59, 3, 4, 74.5, 0.1);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (167, 59, 8, 2, 68.75, 0.2);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (168, 59, 4, 4, 34.99, 0.05);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (169, 60, 20, 2, 21.0, 0.15);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (170, 60, 2, 2, 289.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (171, 60, 24, 1, 22.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (172, 60, 4, 2, 34.99, 0.0);
INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount) VALUES (173, 60, 25, 1, 47.5, 0.0);
