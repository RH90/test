var sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const readline = require("readline");
const saltRounds = 10;
const fs = require("fs");
var string =
	"TOKEN_SECRET=" + require("crypto").randomBytes(64).toString("hex");
var db = new sqlite3.Database("db/database.db");

function askQuestion(query) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) =>
		rl.question(query, (ans) => {
			rl.close();
			resolve(ans);
		})
	);
}

async function changePassword() {
	console.log("Changepass");
	var user = await askQuestion("Username: ");
	var pass = await askQuestion("New Password: ");
	user = user.trim();
	pass = pass.trim();
	if (user && pass && user.length > 4 && pass.length > 4) {
		db.get("select * from users where username=?", [user], function (err, row) {
			if (!err && row) {
				bcrypt.hash(pass, saltRounds, function (err, hash) {
					db.run(
						"UPDATE users SET password=? where username=?",
						[hash, user],
						function (err) {
							if (err) console.log(err);
							else console.log(`Done!\nUser:${user}\nPass:${pass}`);
						}
					);
				});
			} else {
				console.log("User does not exist!");
			}
		});
	} else {
		console.log("Error input!");
	}
}

function createDatabase() {
	console.log("Create Database");
	var query = `
		CREATE TABLE IF NOT EXISTS "history" (
			"id"	INTEGER,
			"owner_table"	INTEGER DEFAULT -1,
			"owner_id"	INTEGER DEFAULT -1,
			"type"	TEXT,
			"comment"	TEXT,
			"date"	INTEGER DEFAULT 0,
			PRIMARY KEY("id" AUTOINCREMENT)
		);
		
		CREATE TABLE IF NOT EXISTS "inventory" (
			"id"	INTEGER UNIQUE,
			"serial"	TEXT UNIQUE,
			"type"	TEXT DEFAULT '',
			"model"	TEXT DEFAULT '',
			"status"	INTEGER DEFAULT 0,
			"comment"	TEXT DEFAULT '',
			"owner_table"	INTEGER,
			"owner_id"	INTEGER,
			"smarwater"	TEXT DEFAULT '',
			"brand"	TEXT DEFAULT '',
			PRIMARY KEY("id")
		);
		
		CREATE TABLE IF NOT EXISTS "locker" (
			"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
			"keys"	Integer DEFAULT 0,
			"number"	INTEGER UNIQUE,
			"floor"	TEXT,
			"status"	INTEGER DEFAULT 6,
			"owner_id"	INTEGER UNIQUE,
			"comment"	TEXT DEFAULT ""
		);
		
		CREATE TABLE IF NOT EXISTS "place" (
			"id"	INTEGER UNIQUE,
			"name"	TEXT UNIQUE,
			"comment"	TEXT,
			"accesspoint"	TEXT DEFAULT '',
			"type"	TEXT DEFAULT '',
			"casting"	TEXT DEFAULT '',
			"lamptime"	TEXT DEFAULT '',
			"projektor"	TEXT DEFAULT '',
			"projektorContact"	TEXT DEFAULT '',
			"SpeakerKontakt"	TEXT DEFAULT '',
			"projektorComment"	TEXT DEFAULT '',
			"cabelChannel"	TEXT DEFAULT '',
			"ownerClass"	TEXT DEFAULT '',
			"planning"	TEXT DEFAULT '',
			PRIMARY KEY("id" AUTOINCREMENT)
		);
		
		CREATE TABLE IF NOT EXISTS "pupil" (
			"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
			"grade"	TEXT DEFAULT "",
			"classP"	TEXT DEFAULT "",
			"year"	TEXT DEFAULT "",
			"firstname"	TEXT DEFAULT "",
			"lastname"	TEXT DEFAULT "",
			"comment"	TEXT DEFAULT "",
			"inschool"	INTEGER DEFAULT 1
		);
		
		CREATE TABLE IF NOT EXISTS "type" (
			"id"	INTEGER UNIQUE,
			"name"	TEXT NOT NULL UNIQUE,
			PRIMARY KEY("id" AUTOINCREMENT)
		);
		
		CREATE TABLE IF NOT EXISTS users(username TEXT primary key, password TEXT not null);
		`;

	db.run(query);
}

function createDotEnv() {
	console.log("generate .env file");
	fs.writeFile(".env", string, function (err) {
		if (err) throw err;
		console.log("File is created successfully.");
	});
}

async function createUser() {
	console.log("Create User");
	var user = await askQuestion("Username: ");
	var pass = await askQuestion("Password: ");
	user = user.trim();
	pass = pass.trim();
	if (user && pass && user.length > 4 && pass.length > 4) {
		bcrypt.hash(pass, saltRounds, function (err, hash) {
			console.log(hash);
			db.run(
				"create table IF NOT EXISTS users(username TEXT primary key, password TEXT not null);"
			);
			db.run(
				"insert into users(username,password) values(?,?)",
				[user, hash],
				function (err) {
					if (err) console.log(err);
					else console.log(`Done!\nUser:${user}\nPass:${pass}`);
				}
			);
		});
	} else {
		console.log("Error input!");
	}
}

async function removeUser() {
	console.log("Remove user");
	var user = await askQuestion("Username: ");
	user = user.trim();
	var db = new sqlite3.Database("db/database.db");
	db.run("Delete from users where username=?", [user], function (err) {
		if (err) console.log(err);
		else console.log(`Done!\nUser:${user} Removed!`);
	});
}
module.exports.removeuser = function () {
	removeUser();
};

module.exports.createuser = function () {
	createUser();
};

module.exports.createdotenv = function () {
	createDotEnv();
};

module.exports.changepass = function () {
	changePassword();
};

module.exports.createdb = function () {
	createDatabase();
};
