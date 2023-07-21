const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const userRoutes = require('./routes/user');
const session = require('express-session');

//generating a random Key
const generateSecretKey = () => {
    const timestamp = Date.now().toString(36); // Convert current timestamp to base36
    const randomString = Math.random().toString(36).slice(2); // Generate a random base36 string
    const secret = timestamp + randomString; // Combine the timestamp and random string
    return secret;
};
const secretKey = generateSecretKey();

// Initialize the database connection
global.db = new sqlite3.Database('./database.db',function(err){
    if(err){
      console.error(err);
      process.exit(1); //Bail out we can't connect to the DB
    }else{
      console.log("Database connected");
      global.db.run("PRAGMA foreign_keys=ON"); //This tells SQLite to pay attention to foreign key constraints
    }
  });

// app configuration
app.use(express.static(__dirname + '/public'));
app.use('/user', userRoutes); //this adds all the userRoutes to the app under the path /user
app.set('view engine', 'ejs'); //set the app to use ejs for rendering
app.use(express.urlencoded({ extended: true })); // Middleware to parse form data
app.use(session({
    secret: secretKey, // Secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // If you are using https, you should set this to true
}));
app.use((req, res, next) => {
    res.locals.userEmail = req.session.user ? req.session.user.email : '';
    next();
});
//  =========================================================
//  ====================== Functions ========================
//  =========================================================

function isEmailRegistered(email) {
    return new Promise((resolve, reject) => {
        db.get('SELECT user_id FROM userLoginInfo WHERE LOWER(user_email) = ?', [email.toLowerCase()], (err, row) => {
            if (err) {
                return reject('Internal server error'); // Reject the promise if there is an error
            }
            const emailExists = !!row;
            resolve(emailExists);
        });
    });
}

//  =========================================================
//  ======================== LOGIN ==========================
//  =========================================================

app.get('/login', (req, res) => {
    res.render('login'); // Assuming your 'index.ejs' file is directly in the 'views' folder.
  });

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check if the provided email exists in the database
    db.get('SELECT * FROM userLoginInfo WHERE user_email = ?', [email], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (!row) {
            return res.status(401).json({ error: 'Invalid credentials' }); // Email not found or Invalid credentials
        }

        // Compare the provided password with the hashed password in the database
        bcrypt.compare(password, row.user_password, (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            if (!result) {
                return res.status(401).json({ error: 'Invalid credentials' }); // Invalid credentials
            }

            // session, when password is correct
            req.session.user = {
                id: row.user_id,
                email: row.user_email
            };

            // Send a success JSON response
            return res.status(200).json({ message: 'Login successful' });
        });
    });
});

//  =========================================================
//  ======================== LOGOUT =========================
//  =========================================================

app.get('/logout', (req, res) => {
    // Clear the user session to log them out
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      // Redirect the user to the homepage after logout
      res.redirect('/');
    });
  });

//  =========================================================
//  ====================== REGISTER =========================
//  =========================================================

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { email, confirmemail, password, confirmpassword } = req.body;

    // Check if passwords match
    if (email !== confirmemail) {
        return res.status(400).json({ error: 'Emails do not match' });
    } else if (password !== confirmpassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    try {
        const emailExists = await isEmailRegistered(email);
        if (emailExists) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash the password using bcrypt
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            // Save the email and hashed password in the "userLoginInfo" table
            db.run('INSERT INTO userLoginInfo (user_email, user_password) VALUES (?, ?)', [email, hashedPassword], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }
                return res.status(201).json({ message: 'User registered successfully' });
            });
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

//  =========================================================
//  ======================== INDEX ==========================
//  =========================================================

app.get('/', (req, res) => {
    const userEmail = req.session.user ? req.session.user.email : '';
  
    // Render the 'index' view and pass the 'userEmail' variable to the view
    res.render('index', { userEmail });
  });


module.exports = app;