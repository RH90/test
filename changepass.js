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

async function changePassword() {
	console.log("Create User");
	var user = await askQuestion("Username: ");
	var pass = await askQuestion("New Password: ");
	user = user.trim();
	pass = pass.trim();
	if (user && pass && user.length > 4 && pass.length > 4) {
		var db = new sqlite3.Database("db/database.db");
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

changePassword();
