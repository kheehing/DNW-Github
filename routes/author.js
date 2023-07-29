const express = require('express');
const router = express.Router();
const authorEmail = "author@onlyblog.com"; // hard coded 'author' email instead of making roles as there is only 1 author.

// check if the user is an author
function checkAuthorAccess(req, res, next) {
    if (req.session.user && req.session.user.email === authorEmail) {
        next();
    } else {
        res.redirect('/login');
    }
}

//  =========================================================
//  ===================== Author Home =======================
//  =========================================================

router.get('/', checkAuthorAccess, (req, res) => {
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

        const publishedArticles = articles.filter(article => article.isPublished);
        const draftArticles = articles.filter(article => !article.isPublished);

        db.get(blogQuery, [], (err, blog) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            if (!blog){
                blog = ['','',''];
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

router.get('/setting', checkAuthorAccess, (req, res) => {
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

router.post('/setting/update', checkAuthorAccess, (req, res) => {
    const { blogTitle, blogSubtitle } = req.body;
    const authorName = req.session.user.name;
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

        if (this.changes === 0) {
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

router.get('/article/:articleId?', checkAuthorAccess, (req, res) => {
    const articleId = req.params.articleId;
    const loggedInAuthorName = req.session.user.name;

    if (articleId) {
        db.get('SELECT * FROM Articles WHERE id = ? AND author = ?', [articleId, loggedInAuthorName], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            if (!row) { 
                return res.status(404).send('Article not found');
            }

            res.render('authorarticle', {
                articleId: row.id,
                articleTitle: row.title,
                articleSubtitle: row.subtitle,
                articleText: row.content,
                articleAuthor: row.author,
                articleCreation: row.createdAt
            });
        });
    } else {
        res.render('authorarticle', {
            articleId: null,
            articleTitle: '',
            articleSubtitle: '',
            articleText: '',
            articleAuthor: loggedInAuthorName,
            articleCreation: new Date(),
        });
    }
});

router.post('/publish', checkAuthorAccess, (req, res) => {
    const articleId = req.body.articleId;
    const author = req.session.user.name; 

    if (articleId) {
        const fetchSql = 'SELECT title, subtitle, content, author FROM Articles WHERE id = ?';
        db.get(fetchSql, [articleId], (err, row) => {
            if (err) {
                return console.error(err.message);
            }

            if (row) {
                const data = [
                    row.title,
                    row.subtitle,
                    row.author,
                    row.content,
                    new Date(),
                    1,     
                    0,           
                    new Date()  
                ];

                const updateSql = 'UPDATE Articles SET title = ?, subtitle = ?, author = ?, content = ?, lastModified = ?, isPublished = ?, likes = ?, publicationDate = ? WHERE id = ?';
                data.push(articleId);
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
    } else { 
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(), 
            new Date(),  
            1,     
            0,       
            new Date()  
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

router.post('/delete', checkAuthorAccess, (req, res) => {
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

router.post('/saveasdraft', checkAuthorAccess, (req, res) => {
    const articleId = req.body.articleId;
    const author = req.session.user.name;

    if (articleId) {
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),   
            0,           
            0,          
            0,          
        ];

        const updateSql = 'UPDATE Articles SET title = ?, subtitle = ?, author = ?, content = ?, lastModified = ?, isPublished = ?, likes = ?, publicationDate = ? WHERE id = ?';
        data.push(articleId);
        db.run(updateSql, data, function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Article with id ${articleId} has been saved as draft`);
            res.redirect('/author');
        });
    } else { 
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(), 
            new Date(),
            0,          
            0,     
            0,    
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

module.exports = router;