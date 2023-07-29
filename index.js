const express = require("express");
const app = express();
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const session = require("express-session");

// Initialize the database connection
global.db = new sqlite3.Database("./database.db", function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    console.log("Database connected");
    global.db.run("PRAGMA foreign_keys=ON");
  }
});

//  =========================================================
//  ================ App Config / Middleware ================
//  =========================================================

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

const generateSecretKey = () => {
  const timestamp = Date.now().toString(36); // Convert current timestamp to base36
  const randomString = Math.random().toString(36).slice(2); // Generate a random base36 string
  const secret = timestamp + randomString; // Combine the timestamp and random string
  return secret;
};

const secretKey = generateSecretKey();

app.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use((req, res, next) => {
  res.locals.userEmail = req.session.user ? req.session.user.email : "";
  res.locals.userName = req.session.user ? req.session.user.name : "";
  next();
});

function isEmailRegistered(email) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT user_id FROM userLoginInfo WHERE LOWER(user_email) = ?",
      [email.toLowerCase()],
      (err, row) => {
        if (err) {
          return reject("Internal server error");
        }
        const emailExists = !!row;
        resolve(emailExists);
      }
    );
  });
}

//  =========================================================
//  ===================== Reader and Author =================
//  =========================================================

const readerRouter = require("./routes/reader");
const authorRouter = require("./routes/author");

app.use("/reader", readerRouter);
app.use("/author", authorRouter);

//  =========================================================
//  ======================== LOGIN ==========================
//  =========================================================

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM userLoginInfo WHERE user_email = ?",
    [email],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      if (!row) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      bcrypt.compare(password, row.user_password, (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        if (!result) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        req.session.user = {
          id: row.user_id,
          email: row.user_email,
          name: row.user_name,
        };

        return res.status(200).json({ message: "Login successful" });
      });
    }
  );
});

//  =========================================================
//  ====================== REGISTER =========================
//  =========================================================

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { name, email, confirmemail, password, confirmpassword } = req.body;

  if (email !== confirmemail) {
    return res.status(400).json({ error: "Emails do not match" });
  } else if (password !== confirmpassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  try {
    const emailExists = await isEmailRegistered(email);
    if (emailExists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash the password using bcrypt
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      db.run(
        "INSERT INTO userLoginInfo (user_name, user_email, user_password) VALUES (?, ?, ?)",
        [name, email, hashedPassword],
        (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal Server Error" });
          }
          return res
            .status(201)
            .json({ message: "User registered successfully" });
        }
      );
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

//  =========================================================
//  ======================== LOGOUT =========================Íßß
//  =========================================================

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/");
  });
});

//  =========================================================
//  ======================== INDEX ==========================
//  =========================================================

app.get("/", (req, res) => {
  if (req.session.user) {
    if (req.session.user.email === "author@onlyblog.com") {
      return res.redirect("/author");
    } else {
      return res.redirect("/reader");
    }
  }
  res.render("index");
});

//  =========================================================
//  ================= Redirect nonexistent ==================
//  =========================================================

app.get("*", (req, res) => {
  res.status(404).render("404");
});

//  =========================================================
//  ==================== Export Module ======================
//  =========================================================

const port = 3000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
