const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

//  =========================================================
//  ===================== Reader Home =======================
//  =========================================================

router.get('/', (req, res) => {
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

router.get('/article/:id', (req, res) => {
    const sqlArticle = 'SELECT * FROM Articles WHERE id = ?';
    const sqlComments = `SELECT Comments.*, userLoginInfo.user_name AS username FROM Comments JOIN userLoginInfo ON Comments.UserId = userLoginInfo.user_id WHERE ArticleId = ? ORDER BY createdAt DESC`;
    db.get(sqlArticle, [req.params.id], (err, row) => {
      if (err) {
        return console.error(err.message);
      }
      if (row) {
        row.articleCreation = `This article was created on ${new Date(row.createdAt).toLocaleDateString()}`; // Add this line
        db.all(sqlComments, [req.params.id], (err, comments) => { // Change commentsData to comments
          if (err) {
            return console.error(err.message);
          }
          res.render('readerarticle', { article: row, comments }); // Change commentsData to comments
        });
      } else {
        res.redirect('/reader');
      }
    });
});

router.post('/article/:id/like', (req, res) => {
    // Check if the user is logged in
    if (req.session.userId) {
        const sqlExists = `SELECT * FROM Likes WHERE ArticleId = ? AND UserId = ?`;
        const sqlInsert = `INSERT INTO Likes (ArticleId, UserId) VALUES (?, ?)`;
        const sqlDelete = `DELETE FROM Likes WHERE ArticleId = ? AND UserId = ?`;

        // Check if the like already exists
        db.get(sqlExists, [req.params.id, req.session.userId], (err, row) => {
            if (err) {
                return console.error(err.message);
            }

            if (row) {
                // The like already exists, so remove it
                db.run(sqlDelete, [req.params.id, req.session.userId], (err) => {
                    if (err) {
                        return console.error(err.message);
                    }

                    // Decrement the like count in the Articles table
                    const sql = `UPDATE Articles SET likes = likes - 1 WHERE id = ?`;
                    db.run(sql, [req.params.id], (err) => {
                        if (err) {
                            return console.error(err.message);
                        }
                        res.json({liked: false});
                    });
                });
            } else {
                // The like does not exist, so add it
                db.run(sqlInsert, [req.params.id, req.session.userId], (err) => {
                    if (err) {
                        return console.error(err.message);
                    }

                    // Increment the like count in the Articles table
                    const sql = `UPDATE Articles SET likes = likes + 1 WHERE id = ?`;
                    db.run(sql, [req.params.id], (err) => {
                        if (err) {
                            return console.error(err.message);
                        }
                        res.json({liked: true});
                    });
                });
            }
        });
    } else {
        res.sendStatus(401);  // Unauthorized
    }
});

router.post('/article/:id/comment', (req, res) => {
    const sqlUser = 'SELECT * FROM userLoginInfo WHERE user_name = ?';
    db.get(sqlUser, req.session.user.name, (err, user) => {
        if (err) {
            return console.error(err.message);
        }
        if (user) {
            const sqlComment = 'INSERT INTO Comments (comments, createdAt, lastModified, ArticleId, UserId) VALUES (?, ?, ?, ?, ?)';
            const comment = req.body.commentInput;
            const now = new Date().toISOString();
            db.run(sqlComment, [comment, now, now, req.params.id, user.user_id], (err) => {
                if (err) {
                    return console.error(err.message);
                }
                res.redirect('/reader/article/' + req.params.id);
            });
        } else {
            res.redirect('/login');
        }
    });
});

module.exports = router;