var sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const readline = require("readline");
const saltRounds = 10;

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

async function createUser() {
	console.log("Create User");
	var user = await askQuestion("Username: ");
	var pass = await askQuestion("Password: ");
	user = user.trim();
	pass = pass.trim();
	if (user && pass && user.length > 4 && pass.length > 4) {
		var db = new sqlite3.Database("db/database.db");
		bcrypt.hash(pass, saltRounds, function (err, hash) {
			console.log(hash);
			db.run(
				"create table IF NOT EXISTS users(username TEXT primary key, password TEXT not null);"
			);
			db.run("insert into users(username,password) values(?,?)", [user, hash]);
			console.log(`Done!\nUser:${user}\nPass:${pass}`);
		});
	} else {
		console.log("Error input!");
	}
}

createUser();
