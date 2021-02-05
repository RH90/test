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
	var query =
		'CREATE TABLE IF NOT EXISTS "history" (\n' +
		'\t"id"\tINTEGER,\n' +
		'\t"owner_table"\tINTEGER DEFAULT -1,\n' +
		'\t"owner_id"\tINTEGER DEFAULT -1,\n' +
		'\t"type"\tTEXT,\n' +
		'\t"comment"\tTEXT,\n' +
		'\t"date"\tINTEGER DEFAULT 0,\n' +
		'\tPRIMARY KEY("id" AUTOINCREMENT)\n' +
		");\n" +
		"\n" +
		'CREATE TABLE IF NOT EXISTS "inventory" (\n' +
		'\t"id"\tINTEGER UNIQUE,\n' +
		'\t"serial"\tTEXT UNIQUE,\n' +
		"\t\"type\"\tTEXT DEFAULT '',\n" +
		"\t\"model\"\tTEXT DEFAULT '',\n" +
		'\t"status"\tINTEGER DEFAULT 0,\n' +
		"\t\"comment\"\tTEXT DEFAULT '',\n" +
		'\t"owner_table"\tINTEGER,\n' +
		'\t"owner_id"\tINTEGER,\n' +
		"\t\"smarwater\"\tTEXT DEFAULT '',\n" +
		"\t\"brand\"\tTEXT DEFAULT '',\n" +
		'\tPRIMARY KEY("id")\n' +
		");\n" +
		"\n" +
		'CREATE TABLE IF NOT EXISTS "locker" (\n' +
		'\t"id"\tINTEGER PRIMARY KEY AUTOINCREMENT,\n' +
		'\t"keys"\tInteger DEFAULT 0,\n' +
		'\t"number"\tINTEGER UNIQUE,\n' +
		'\t"floor"\tTEXT,\n' +
		'\t"status"\tINTEGER DEFAULT 6,\n' +
		'\t"owner_id"\tINTEGER UNIQUE,\n' +
		'\t"comment"\tTEXT DEFAULT ""\n' +
		");\n" +
		"\n" +
		'CREATE TABLE IF NOT EXISTS "place" (\n' +
		'\t"id"\tINTEGER UNIQUE,\n' +
		'\t"name"\tTEXT UNIQUE,\n' +
		'\t"comment"\tTEXT,\n' +
		"\t\"accesspoint\"\tTEXT DEFAULT '',\n" +
		"\t\"type\"\tTEXT DEFAULT '',\n" +
		"\t\"casting\"\tTEXT DEFAULT '',\n" +
		"\t\"lamptime\"\tTEXT DEFAULT '',\n" +
		"\t\"projektor\"\tTEXT DEFAULT '',\n" +
		"\t\"projektorContact\"\tTEXT DEFAULT '',\n" +
		"\t\"SpeakerKontakt\"\tTEXT DEFAULT '',\n" +
		"\t\"projektorComment\"\tTEXT DEFAULT '',\n" +
		"\t\"cabelChannel\"\tTEXT DEFAULT '',\n" +
		"\t\"ownerClass\"\tTEXT DEFAULT '',\n" +
		"\t\"planning\"\tTEXT DEFAULT '',\n" +
		'\tPRIMARY KEY("id" AUTOINCREMENT)\n' +
		");\n" +
		"\n" +
		'CREATE TABLE IF NOT EXISTS "pupil" (\n' +
		'\t"id"\tINTEGER PRIMARY KEY AUTOINCREMENT,\n' +
		'\t"grade"\tTEXT DEFAULT "",\n' +
		'\t"classP"\tTEXT DEFAULT "",\n' +
		'\t"year"\tTEXT DEFAULT "",\n' +
		'\t"firstname"\tTEXT DEFAULT "",\n' +
		'\t"lastname"\tTEXT DEFAULT "",\n' +
		'\t"comment"\tTEXT DEFAULT "",\n' +
		'\t"inschool"\tINTEGER DEFAULT 1\n' +
		");\n" +
		"\n" +
		'CREATE TABLE IF NOT EXISTS "type" (\n' +
		'\t"id"\tINTEGER UNIQUE,\n' +
		'\t"name"\tTEXT NOT NULL UNIQUE,\n' +
		'\tPRIMARY KEY("id" AUTOINCREMENT)\n' +
		");\n" +
		"\n" +
		"CREATE TABLE IF NOT EXISTS users(username TEXT primary key, password TEXT not null);\n";

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
