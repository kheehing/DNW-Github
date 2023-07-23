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

module.exports = router;