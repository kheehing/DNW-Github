const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const authorEmail = "author@onlyblog.com";

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
app.set('view engine', 'ejs'); //set the app to use ejs for rendering
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true })); // Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// 
app.use(session({
    secret: secretKey, // Secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // If you are using https, you should set this to true
}));

//  =========================================================
//  ================ Functions / Middleware =================
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

function checkAuthorAccess(req, res, next) {
    const userEmail = req.session.user ? req.session.user.email : null;

    if (userEmail === authorEmail) {
        next(); // If the user is authorized, proceed to the next
    } else {
        // If the user is not authorized, throw 404 error
        res.status(404).render('404');
    }
}

app.use((req, res, next) => {
    res.locals.userEmail = req.session.user ? req.session.user.email : '';
    res.locals.userName = req.session.user ? req.session.user.name : '';
    next();
});

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
                email: row.user_email,
                name: row.user_name
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
    const { name, email, confirmemail, password, confirmpassword } = req.body;

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

            // Save the name, email, and hashed password in the "userLoginInfo" table
            db.run('INSERT INTO userLoginInfo (user_name, user_email, user_password) VALUES (?, ?, ?)', [name, email, hashedPassword], (err) => {
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
    // Check if the session contains user information (logged in)
    if (req.session.user) {
        if (req.session.user.email == authorEmail) {
            return res.redirect('/author');
        } else {
            return res.redirect('/reader');
        }
    }

    res.render('index');
});

//  =========================================================
//  ===================== Author Home =======================
//  =========================================================

app.get('/author', checkAuthorAccess, (req, res) => {
    let articleQuery = 'SELECT * FROM Articles ORDER BY title';
    let blogQuery = `
        SELECT Blog.Title AS blogTitle, Blog.Subtitle AS blogSubtitle, Blog.author AS authorName
        FROM Blog
        WHERE Blog.id = 1
    `;


    db.all(articleQuery, [], (err, articles) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Filter published articles and draft articles based on the 'isPublished' flag
        const publishedArticles = articles.filter(article => article.isPublished);
        const draftArticles = articles.filter(article => !article.isPublished);

        // Fetch blog details
        db.get(blogQuery, [], (err, blog) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // Render the page with article and blog information
            res.render('authorhome', { 
                blog: blog, 
                articles: articles, 
                publishedArticles: publishedArticles, 
                draftArticles: draftArticles 
            });
        });
    });
});

//  =========================================================
//  ==================== Author Setting =====================
//  =========================================================

app.get('/author/setting', checkAuthorAccess, (req, res) => {
    const query = `
        SELECT Blog.Title AS blogTitle, Blog.Subtitle AS blogSubtitle, Blog.author AS authorName
        FROM Blog
        WHERE Blog.id = 1
    `;

    db.get(query, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Check if blog exist, if not return empty place holders
        if (!row) {
            row = ['',''];
        }

        const { blogTitle, blogSubtitle } = row;
        res.render('authorsetting', { blogTitle, blogSubtitle });
    });
});

app.post('/author/setting/update', checkAuthorAccess, (req, res) => {
    const { blogTitle, blogSubtitle } = req.body;
    const authorName = req.session.user.name;
    // First, try to update the existing row
    let query = `
        UPDATE Blog
        SET Title = ?, Subtitle = ?, author = ?
        WHERE id = 1
    `;

    db.run(query, [blogTitle, blogSubtitle, authorName], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Check if the update affected any rows
        if (this.changes === 0) {
            // If no rows were updated, insert a new one
            query = `
                INSERT INTO Blog (id, Title, Subtitle, author)
                VALUES (?, ?, ?, ?)
            `;

            db.run(query, [1, blogTitle, blogSubtitle, authorName], function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                res.redirect('/author');
            });
        } else {
            res.redirect('/author');
        }
    });
});

//  =========================================================
//  ==================== Author Article =====================
//  =========================================================

app.get('/author/article/:articleId?', checkAuthorAccess, (req, res) => {
    const articleId = req.params.articleId;
    const loggedInAuthorName = req.session.user.name;

    // If articleId is provided, fetch the article data for editing
    if (articleId) {
        db.get('SELECT * FROM Articles WHERE id = ? AND author = ?', [articleId, loggedInAuthorName], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // Check if the article exists and belongs to the logged-in user
            if (!row) { 
                return res.status(404).send('Article not found');
            }

            // Render the authorarticle.ejs with the article information
            res.render('authorarticle', {
                articleId: row.id,
                articleTitle: row.title,
                articleSubtitle: row.subtitle,
                articleText: row.content,
                articleAuthor: row.author,
                articleCreation: row.createdAt // Added this line to include articleCreation
            });
        });
    } else { // Empty string when making a new article
        res.render('authorarticle', {
            articleId: null,
            articleTitle: '',
            articleSubtitle: '',
            articleText: '',
            articleAuthor: loggedInAuthorName,
            articleCreation: new Date(), // Added this line to include articleCreation
        });
    }
});

app.post('/author/publish', checkAuthorAccess, (req, res) => {
    const articleId = req.body.articleId;
    const author = req.session.user.name; 

    // If there's an articleId, it means it's a draft being published
    if (articleId) {
        // First, fetch the current details of the article
        const fetchSql = 'SELECT title, subtitle, content, author FROM Articles WHERE id = ?';
        db.get(fetchSql, [articleId], (err, row) => {
            if (err) {
                return console.error(err.message);
            }

            // If the article exists, publish it
            if (row) {
                const data = [
                    row.title,     // fetched from the database
                    row.subtitle,  // fetched from the database
                    row.author,    // fetched from the database
                    row.content,   // fetched from the database
                    new Date(),    // Last Modified
                    1,             // isPublished
                    0,             // Likes
                    new Date()     // Publication Date
                ];

                const updateSql = 'UPDATE Articles SET title = ?, subtitle = ?, author = ?, content = ?, lastModified = ?, isPublished = ?, likes = ?, publicationDate = ? WHERE id = ?';
                data.push(articleId); // Adding articleId to the data array for the WHERE clause in the SQL statement
                db.run(updateSql, data, function(err) {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log(`Article with id ${articleId} has been published`);
                    res.redirect('/author');
                });
            } else {
                console.error(`Article with id ${articleId} not found`);
                res.redirect('/author');
            }
        });
    } else { // Otherwise, it's a new article
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),  // CreatedAt
            new Date(),  // Last Modified
            1,           // isPublished
            0,           // Likes
            new Date()   // Publication Date
        ];

        const insertSql = 'INSERT INTO Articles (title, subtitle, author, content, createdAt, lastModified, isPublished, likes, publicationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        db.run(insertSql, data, function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`New article has been published with id ${this.lastID}`);
            res.redirect('/author');
        });
    }
});

app.post('/author/delete', checkAuthorAccess, (req, res) => {
    const data = [req.body.articleId];

    db.run('DELETE FROM Articles WHERE id = ?', data, (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error deleting article");
        } else {
            console.log(`Article with id ${data[0]} has been deleted`);
            res.redirect('/author');
        }
    });
});

app.post('/author/saveasdraft', checkAuthorAccess, (req, res) => {
    const articleId = req.body.articleId;
    const author = req.session.user.name;

    // If there's an articleId, it means we're updating a draft
    if (articleId) {
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),    // Last Modified
            0,             // isPublished
            0,             // Likes
            0,             // Publication Date
        ];

        const updateSql = 'UPDATE Articles SET title = ?, subtitle = ?, author = ?, content = ?, lastModified = ?, isPublished = ?, likes = ?, publicationDate = ? WHERE id = ?';
        data.push(articleId); // Adding articleId to the data array for the WHERE clause in the SQL statement
        db.run(updateSql, data, function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Article with id ${articleId} has been saved as draft`);
            res.redirect('/author');
        });
    } else { // Otherwise, it's a new article
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),  // CreatedAt
            new Date(),  // Last Modified
            0,           // isPublished
            0,           // Likes
            0,           // Publication Date
        ];

        const insertSql = 'INSERT INTO Articles (title, subtitle, author, content, createdAt, lastModified, isPublished, likes, publicationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        db.run(insertSql, data, function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`New article has been saved as draft with id ${this.lastID}`);
            res.redirect('/author');
        });
    }
});

//  =========================================================
//  ===================== Reader Home =======================
//  =========================================================

app.get('/reader', (req, res) => {
    let sql = 'SELECT * FROM Articles WHERE isPublished = 1 ORDER BY publicationDate DESC';
    let articles = [];

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        articles = rows;

        res.render('readerhome', { articles: articles });
    });
});

//  =========================================================
//  ==================== Reader Article =====================
//  =========================================================

app.get('/reader/article/:id', (req, res) => {
    const sql = 'SELECT * FROM Articles WHERE id = ?';
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (row) {
            row.articleCreation = `This article was created on ${new Date(row.createdAt).toLocaleDateString()}`; // Add this line
            res.render('readerarticle', { article: row });
        } else {
            res.redirect('/reader');
        }
    });
});

//  =========================================================
//  ================= Redirect nonexistent ==================
//  =========================================================

app.get('*', (req, res) => {
    res.status(404).render('404');
});



//  =========================================================
//  ==================== Export Module ======================
//  =========================================================

module.exports = app;