const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// check if the user is logged in
function checkUserAccess(req, res, next) {
    if (req.session.user != '') {
        next();
    } else {
        res.redirect('/login');
    }
}

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

router.get('/article/:id', checkUserAccess, (req, res) => {
    const _articleId = req.params.id;
    const sqlArticle = 'SELECT * FROM Articles WHERE id = ?';
    const sqlComments = `SELECT Comments.*, userLoginInfo.user_name AS username FROM Comments JOIN userLoginInfo ON Comments.UserId = userLoginInfo.user_id WHERE ArticleId = ? ORDER BY createdAt DESC`;
    
    let _userId = null;
    if(req.session.user) {
        _userId = req.session.user.id;
    }
    
    const sqlLike = _userId ? `SELECT * FROM Likes WHERE ArticleId = ? AND UserId = ?` : null;

    db.get(sqlArticle, [_articleId], (err, row) => {
        if (err) {
            return console.error(err.message);
        }

        if (row) {
            row.articleCreation = `This article was created on ${new Date(row.createdAt).toLocaleDateString()}`;

            db.all(sqlComments, [_articleId], (err, comments) => {
                if (err) {
                    console.log('error9');
                    return console.error(err.message);
                }

                if(_userId && sqlLike) {
                    db.get(sqlLike, [_articleId, _userId], function(err, like) {
                        if (err) {
                            console.log('error99');
                            return console.error(err.message);
                        }
                        res.render('readerarticle', { 
                            article: row, 
                            comments, 
                            userHasLiked: like != null 
                        });
                    });
                } else {
                    res.render('readerarticle', { 
                        article: row, 
                        comments, 
                        userHasLiked: false 
                    });
                }
            });
        } else {
            res.redirect('/reader');
        }
    });
});

router.post('/article/:id/like', checkUserAccess, (req, res) => {
    const _userId = req.session.user.id;
    if (_userId) {
        const sqlExists = `SELECT * FROM Likes WHERE ArticleId = ? AND UserId = ?`;
        const sqlInsert = `INSERT INTO Likes (ArticleId, UserId) VALUES (?, ?)`;
        const sqlDelete = `DELETE FROM Likes WHERE ArticleId = ? AND UserId = ?`;

        db.get(sqlExists, [req.params.id, _userId], (err, row) => {
            if (err) {
                console.log('error7');
                return console.error(err.message);
            }

            if (row) {
                db.run(sqlDelete, [req.params.id, _userId], (err) => {
                    if (err) {
                        console.log('error5');
                        return console.error(err.message);
                    }

                    const sql = `UPDATE Articles SET likes = likes - 1 WHERE id = ?`;
                    db.run(sql, [req.params.id], (err) => {
                        if (err) {
                            console.log('error123121');
                            return console.error(err.message);
                        }
                        res.json({liked: false});
                    });
                });
            } else {
                db.run(sqlInsert, [req.params.id, _userId], (err) => {
                    if (err) {
                        console.log('erro222r1');
                        return console.error(err.message);
                    }

                    const sql = `UPDATE Articles SET likes = likes + 1 WHERE id = ?`;
                    db.run(sql, [req.params.id], (err) => {
                        if (err) {
                            console.log('error1');
                            return console.error(err.message);
                        }
                        res.json({liked: true});
                    });
                });
            }
        });
    } else {
        res.sendStatus(401);
    }
});

router.post('/article/:id/comment', checkUserAccess, (req, res) => {
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