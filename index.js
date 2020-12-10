const express = require("express");
var sqlite3 = require("sqlite3").verbose();
const app = express();
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const { type } = require("os");

const saltRounds = 10;

dotenv.config();

const port = 3333;

var db = new sqlite3.Database("skåp.db");

// bcrypt.hash("admin", saltRounds, function (err, hash) {
//   console.log(hash);
//   db.run(
//     "create table IF NOT EXISTS users(username TEXT primary key, password TEXT not null);"
//   );
//   db.run("insert into users(username,password) values(?,?)", ["admin", hash]);
// });
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.set("view engine", "pug");

var middleware = function (req, res, next) {
  console.log("Time:", Date.now());
  //console.log(req.route);

  console.log(req.originalUrl);
  console.log(req.method);
  console.log("token:" + req.cookies.token);
  if (req.cookies) {
    try {
      console.log("chech cookie");
      const decoded = jwt.verify(req.cookies.token, process.env.TOKEN_SECRET);
      console.log("decoded" + decoded);
      const token = jwt.sign(
        { username: decoded.username },
        process.env.TOKEN_SECRET,
        {
          expiresIn: "24h",
        }
      );
      console.log("token: " + token);
      console.log(decoded);
      res.cookie("token", token);
      console.log();
      next();
    } catch {
      console.log("error decode");
      res.redirect("/login?url=" + encodeURIComponent(req.originalUrl));
    }
  } else {
    res.redirect("/login");
  }
  console.log("\n");
  //next();
};

app.get("/", middleware, (req, res) => {
  res.redirect("/locker");
});

app.get("/locker/:lockerNumb/geut", middleware, (req, res) => {
  console.log(req.params.lockerNumb);
  var query =
    "select * from pupil where not EXISTS(select * from locker where owner_id=pupil.id) ORDER BY grade,classP,lastname,firstname ASC";
  db.all(query, function (err, rows) {
    //console.log(rows);
    res.render("lockerGive", {
      title: "Give locker " + req.params.lockerNumb,
      lockerNumb: req.params.lockerNumb,
      search: req.query.search,
      plan: req.query.plan,
      status: req.query.status,
      rows,
    });
  });
});

app.get("/pupil/add", middleware, (req, res) => {
  console.log("Add pupil");
  res.render("pupiladd", {
    title: "Add Pupil",
  });
});
//TODO add to general history
app.post("/pupil/add", middleware, (req, res) => {
  console.log("Addpupil");
  console.log(req.body);
  if (!req.body) {
    res.sendStatus(404);
  } else if (
    req.body.firstname &&
    req.body.lastname &&
    req.body.grade &&
    req.body.classP &&
    req.body.year
  ) {
    db.run(
      "insert into pupil(firstname,lastname,grade,classP,year) VALUES (?,?,?,?,?);",
      //"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
      [
        req.body.firstname,
        req.body.lastname,
        req.body.grade,
        req.body.classP,
        req.body.year,
      ],
      function (err) {
        if (err) {
          console.log(err.message);
        }
        sqlInsertHistory({
          owner_table: -1,
          id: -1,
          type: "added",
          comment:
            req.body.firstname +
            " " +
            req.body.lastname +
            "," +
            req.body.grade +
            req.body.classP,
        });
        console.log(this);
        res.redirect("/pupil");
      }
    );
  } else {
    res.sendStatus(404);
  }
});
app.post("/pupil/remove", middleware, (req, res) => {
  res.sendStatus(404);
  // if (req.body.id) {
  // db.get(
  //   "Select * from pupil where id=?",
  //   [req.body.id],
  //   function (err, row) {
  //     db.run("DELETE from pupil where id=?", [req.body.id], function (err) {
  //       if (err) console.log(err);
  //       res.sendStatus(200);
  //       sqlInsertHistory(
  //         -1,
  //         -1,
  //         "removed",
  //         row.firstname + " " + row.lastname + "," + row.grade + row.classP
  //       );
  //     });
  //   }
  // );
  // res.sendStatus(200);
  // } else {
  //   res.sendStatus(404);
  // }
});
//TODO lägg till hårdvara
app.post("/checkin", middleware, (req, res) => {
  console.log("checkin");
  console.log(req.body);

  if (!req.body) {
    res.sendStatus(404);
  } else if (req.body.table == "locker") {
    db.run(
      "UPDATE locker set owner_id=null,status=1 where locker.number=?",
      [req.body.idItem],
      function (err) {
        if (err) {
          console.log(err.message);
        } else {
          db.get(
            "select id from locker where number=?",
            [req.body.idItem],
            function (err, lockerId) {
              console.log("lockerid: " + lockerId.id);
              if (lockerId && lockerId.id) {
                //locker
                sqlInsertHistory({
                  owner_table: 1,
                  ird: lockerId.id,
                  type: "comment",
                  comment:
                    req.body.firstname +
                    " " +
                    req.body.lastname +
                    "," +
                    req.body.klass +
                    "->",
                });

                //pupil
                sqlInsertHistory({
                  owner_table: 0,
                  id: req.body.owner_id,
                  type: "locker",
                  comment: req.body.idItem + "->",
                });
              }
            }
          );
        }
        console.log(this);
        res.sendStatus(200);
      }
    );
  } else {
    res.sendStatus(404);
  }
});
//TODO lägg till hårdvara
app.post("/checkout", middleware, (req, res) => {
  console.log("Checkout");
  console.log(req.body);
  console.log(req.query);
  if (!req.body) {
    res.sendStatus(404);
  } else if (req.body.table == "locker") {
    db.run(
      "UPDATE locker set owner_id=?,status=0 where locker.number=? AND locker.owner_id is NULL",
      [req.body.idPupil, req.body.idItem],
      function (err) {
        if (err) {
          console.log(err.message);
        }
        console.log(this);
        db.get(
          "select id from locker where number=?",
          [req.body.idItem],
          function (err, lockerId) {
            console.log("lockerid: " + lockerId.id);
            if (lockerId && lockerId.id) {
              //locker
              sqlInsertHistory({
                owner_table: 1,
                id: lockerId.id,
                type: "comment",
                comment:
                  "->" +
                  req.body.firstname +
                  " " +
                  req.body.lastname +
                  "," +
                  req.body.klass,
              });
              //pupil
              sqlInsertHistory({
                owner_table: 0,
                id: req.body.idPupil,
                type: "locker",
                comment: "->" + req.body.idItem,
              });
            }
          }
        );
        res.redirect(
          "/locker?search=" +
            req.body.search +
            "&plan=" +
            req.body.plan +
            "&status=" +
            req.body.status
        );
      }
    );
  } else {
    res.sendStatus(404);
  }
});
app.get("/locker/:lockerNumb", middleware, (req, res) => {
  console.log(req.params.lockerNumb);
  db.get(
    "select locker.id,keys,number,floor,status,owner_id,grade,classP,year,firstname,lastname,inschool " +
      " from locker left join pupil on pupil.id=locker.owner_id where number=?",
    [req.params.lockerNumb],
    function (err, row) {
      if (err || !row) {
        console.log(err);
        res.sendStatus(404);
      } else {
        db.all(
          "select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=1 and owner_id=? ORDER by date DESC",
          [row.id],
          function (err, history) {
            //console.log(history);
            console.log(row);
            if (history) {
              console.log("history true");
            } else {
              history = {};
            }
            var statusSelected = {
              0: false,
              1: false,
              2: false,
              3: false,
              4: false,
              5: false,
              6: false,
              7: false,
              8: false,
            };
            //console.log(rows[0]);
            statusSelected[row.status] = true;
            //console.log(statusSelected);
            res.render("lockerinfo", {
              title: req.params.lockerNumb,
              lockerNumb: req.params.lockerNumb,
              row,
              statusSelected,
              history,
              historyPost: req.originalUrl,
            });
          }
        );
      }
    }
  );
});
app.get("/pupil/:pupilId", middleware, (req, res) => {
  console.log(req.params.pupilId);
  db.get(
    "select pupil.id,firstname,lastname,grade,classP,locker.number,year from pupil left join locker on pupil.id=locker.owner_id where pupil.id=?",
    [req.params.pupilId],
    function (err, row) {
      if (err || !row) {
        console.log(err);
        res.sendStatus(404);
      } else {
        db.all(
          "select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=0 and owner_id=? ORDER by date DESC",
          [row.id],
          function (err, history) {
            //console.log(history);
            console.log(row);
            if (history) {
              console.log("history true");
            } else {
              history = {};
            }
            //console.log(statusSelected);
            res.render("pupilInfo", {
              title: row.firstname + " " + row.lastname,
              row,
              history,
              historyPost: req.originalUrl,
            });
          }
        );
      }
    }
  );
});
app.post("/locker/:lockerNumb", middleware, (req, res) => {
  console.log(req.body);
  if (req.body && req.body["keys"]) {
    db.run(
      "update locker set keys=?,status=? where number=?",
      [req.body["keys"], req.body["status"], req.params.lockerNumb],
      function (err) {
        if (err) {
          console.log(err);
          res.sendStatus(404);
        } else {
          console.log("updateted");
          res.redirect("/locker/" + req.params.lockerNumb);
        }
      }
    );
  } else if (req.body && req.body["comment"]) {
    console.log(req.body["comment"]);
    db.get(
      "select id from locker where number=?",
      [req.params.lockerNumb],
      function (err, row) {
        if (err) {
          res.sendStatus(404);
          return;
        }

        sqlInsertHistory({
          owner_table: 1,
          id: row.id,
          type: "comment",
          comment: req.body["comment"],
          res: res,
          redirect: "/locker/" + req.params.lockerNumb,
        });
      }
    );
  } else {
    res.sendStatus(404);
  }
});

app.post("/pupil/:pupilId", middleware, (req, res) => {
  console.log(req.body);
  if (req.body && req.body["classP"]) {
    db.run(
      "update pupil set firstname=?,lastname=?,classP=?,grade=? where id=?",
      [
        req.body["firstname"],
        req.body["lastname"],
        req.body["classP"],
        req.body["grade"],
        req.params.pupilId,
      ],
      function (err) {
        if (err) {
          console.log(err);
          res.sendStatus(404);
        } else {
          console.log("updateted");
          res.redirect("/pupil/" + req.params.pupilId);
        }
      }
    );
  } else if (req.body && req.body["comment"]) {
    console.log(req.body["comment"]);

    sqlInsertHistory({
      owner_table: 0,
      id: req.params.pupilId,
      type: "comment",
      comment: req.body["comment"],
      res: res,
      redirect: "/pupil/" + req.params.pupilId,
    });
  } else {
    res.sendStatus(404);
  }
});

app.all("/pupil", middleware, (req, res) => {
  console.log("body");
  console.log(req.body);
  //console.log(process.env.TOKEN_SECRET);
  var search = "";
  if (req.body && req.body.search) {
    search = req.body.search.toLowerCase();
    //console.log("Search: " + search);
  }
  var query =
    "select " +
    " * " +
    " from pupil " +
    " where (instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 " +
    " OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' " +
    " OR (grade||classP)=?) " +
    " ORDER BY grade,classP,lastname,firstname ASC";
  db.all(
    query,
    [search, search, search, search, search, search],
    function (err, rows) {
      console.log(err);
      //console.log(rows[0]);

      res.render("pupil", {
        title: "Pupil",
        rows,
        search,
      });
    }
  );
});
//TODO computer->Inventory
app.get("/history", middleware, (req, res) => {
  var query =
    "select \n" +
    "\tCASE \n" +
    "\tWHEN owner_table=-1 then \n" +
    "\t\t'general' \n" +
    "\tWHEN owner_table=0 THEN\n" +
    "\t\t'pupil'\n" +
    "\tWHEN owner_table=1 THEN\n" +
    "\t\t'locker'\n" +
    "\tWHEN owner_table=2 THEN\n" +
    "\t\t'computer'\n" +
    "\tEND owner,\n" +
    "\tCASE\n" +
    "\tWHEN owner_table=0 THEN\n" +
    "\t\t(firstname||' '||lastname||','||(grade||classP))\n" +
    "\tWHEN owner_table=1 THEN\n" +
    "\t\tlocker.number\n" +
    "\tWHEN owner_table=2 THEN\n" +
    "\t\tcomputer.serial\n" +
    "\tEND res,\n" +
    "\tCASE\n" +
    "\tWHEN owner_table=0 THEN\n" +
    "\t\t'/pupil/'||pupil.id\n" +
    "\tWHEN owner_table=1 THEN\n" +
    "\t\t'/locker/'||locker.number\n" +
    "\tWHEN owner_table=2 THEN\n" +
    "\t\t'/computer/'||locker.number\n" +
    "\tEND link,\n" +
    "\ttype,history.comment,DATETIME(round(date/1000),'unixepoch','localtime') as date\n" +
    "\tfrom history\n" +
    "\tleft JOIN pupil on owner='pupil' AND history.owner_id=pupil.id\n" +
    "\tleft JOIN locker on owner='locker' AND history.owner_id=locker.id\n" +
    "\tleft JOIN computer on owner='computer' AND history.owner_id=computer.id" +
    "\tOrder by history.date DESC";
  db.all(query, function (err, rows) {
    console.log(err);
    res.render("history", {
      title: "History",
      rows,
    });
  });
});

app.all("/locker", middleware, (req, res) => {
  console.log("query");
  console.log(req.query);
  console.log(Object.keys(req.query).length);
  console.log("body");
  console.log(req.body);

  var planValue = req.body.plan;
  var statusValue = req.body.status;
  //console.log(process.env.TOKEN_SECRET);
  var search = "";
  if (req.body && req.body.search) {
    search = req.body.search.toLowerCase();
    //console.log("Search: " + search);
  }

  var plan = "";
  var status = "";
  if (Object.keys(req.query).length) {
    search = req.query.search;
    planValue = req.query.plan;
    statusValue = req.query.status;
  }

  if (planValue && planValue != "undefined" && planValue != -1) {
    plan = " and floor=" + planValue;
  } else {
    planValue = -1;
  }

  if (statusValue && statusValue != "undefined" && statusValue != -1) {
    status = " and status=" + statusValue;
  } else {
    statusValue = -1;
  }
  console.log("status: " + status + "," + statusValue);

  var query =
    "select " +
    " locker.id,locker.keys,locker.floor,locker.status,locker.number,locker.owner_id,grade,pupil.year,classP,firstname,lastname" +
    " from locker " +
    " left join pupil on pupil.id = locker.owner_id " +
    " where (instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 OR locker.number=?" +
    " OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' " +
    " OR (grade||classP)=?) " +
    plan +
    status +
    " ORDER BY grade,classP,lastname,firstname,status ASC";
  db.all(
    query,
    [search, search, search, search, search, search, search],
    function (err, rows) {
      console.log(err);
      //console.log(rows[0]);

      res.render("locker", {
        title: "Locker",
        rows,
        search,
        planValue,
        statusValue,
        statusLockerText,
        statusLockerColor,
      });
    }
  );
});
app.get("/login", (req, res) => {
  res.cookie("token", "");
  res.render("login");
  //res.sendFile(path.join(__dirname + "/login.html"));
});
app.post("/auth", (req, res) => {
  console.log(req.body);
  if (req.body) {
    db.get(
      "select * from users where username=?",
      [req.body.username],
      (err, row) => {
        if (err) {
          console.error(err.message);
          res.sendStatus(404);
        } else if (!row) {
          res.sendStatus(401);
        } else {
          console.log(row.username);
          console.log(row.password);
          bcrypt.compare(
            req.body.password,
            row.password,
            function (err, resCrypt) {
              if (resCrypt) {
                //request.session.token
                const token = jwt.sign(
                  { username: row.username },
                  process.env.TOKEN_SECRET,
                  {
                    expiresIn: "24h",
                  }
                );
                console.log(token);
                res.cookie("token", token);
                res.redirect("/locker");
              } else {
                res.sendStatus(401);
              }
              //res.end();
            }
          );
        }
      }
    );
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

const statusLockerText = {
  0: "ELEVE HAR SLÅPET",
  1: "LÅST AV SKOLAN",
  2: "ELEV MED EGET LÅS",
  3: "SKÅPET REPARERAS",
  4: "LÅST M. MULTILÅS",
  5: "ELEV MED DED. SKÅP",
  6: "ANVÄNDS EJ",
  7: "UTAN NYCKEL ELEVINNEHÅLL",
};
const statusLockerColor = {
  0: "LIMEGREEN",
  1: "PINK",
  2: "YELLOW",
  3: "ORANGE",
  4: "BLUE",
  5: "GRAY",
  6: "LIGHTGRAY",
  7: "purple",
};
function sqlInsertHistory({
  owner_table,
  id,
  type,
  comment,
  res,
  redirect,
  date = new Date(),
}) {
  console.log("commentlength: " + comment.length);
  if (comment.length < 1000) {
    db.run(
      "insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
      [owner_table, id, type, comment, date],
      function (err) {
        if (res) {
          if (err) {
            res.sendStatus(404);
          } else {
            res.redirect(redirect);
          }
        }
      }
    );
  } else if (res) {
    res.sendStatus(404);
  }
}
