// setTimeout(function f() {
//   alert("test");
// }, 1000);

// var username = prompt("Enter Username", "Username");
// var password = prompt("Enter Password", "Password");

// const parseCookie = (str) =>
//   str
//     .split(";")
//     .map((v) => v.split("="))
//     .reduce((acc, v) => {
//       acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
//       return acc;
//     }, {});
// console.log(parseCookie(document.cookie).token);
function lockerlayout() {
	fetch("/lockerlayout?dataonly=1", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	}).then((res) => {
		res.json().then((rows) => {
			console.log(rows);
			var cells = document.querySelectorAll(".locker-cell");
			for (let i = 0; i < cells.length; i++) {
				var locker = rows.filter((rows) => {
					return rows.number == cells[i].innerText;
				})[0];
				cells[i].style.background = statusLockerColor[locker.status];

				if (locker.keys > 2) {
					cells[i].style.color = "blue";
				} else if (locker.keys > 1) {
					cells[i].style.color = "black";
				} else {
					cells[i].style.color = "red";
				}
			}
		});
	});
}
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
function geUt(locker, pupil) {
	console.log("locker: " + locker + ", pupil: " + pupil);
}

function openNav() {
	document.getElementById("mySidenav").style.display = "block";
}
function closeNav() {
	document.getElementById("mySidenav").style.display = "none";
}
function copytable(el) {
	var urlField = document.querySelector("." + el);
	if (urlField) {
		var range = document.createRange();
		range.selectNode(urlField);
		window.getSelection().addRange(range);
		document.execCommand("copy");
	}
}
// function overlayOn(number) {
//   var container = document.getElementById("container");
//   document.getElementById("overlay").style.display = "block";
//   fetch("/skap/" + number + "/geut", {
//     method: "GET",
//   }).then((res) => {
//     res.text().then(function (data) {
//       container.innerHTML = data;
//     });
//     console.log("Request complete! response:", res);
//   });
// }

// function overlayOff() {
//   var container = document.getElementById("container");
//   container.innerHTML = "";
//   document.getElementById("overlay").style.display = "none";
// }

function clearLocker(owner_id, klass, firstname, lastname, numb, search) {
	if (
		confirm(
			"Ta bort " + firstname + " " + lastname + " från skåp " + numb + "?"
		)
	) {
		console.log("numb");
		let data = {
			firstname: firstname,
			lastname: lastname,
			klass: klass,
			owner_id: owner_id,
			idItem: numb,
			table: "locker",
		};
		fetch("/checkin", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			console.log("Request complete! response:", res);
			var input = document.getElementById("inputSearch");
			input.value = search;
			var b = document.getElementById("buttonSearch");
			b.click();
		});
	}
}
function graduate(id) {
	if (confirm("Ta bort Elev?")) {
		let data = {
			id: id,
		};
		fetch("/pupil/graduate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			window.location.href = "/pupil";
		});
	}
}
function enroll(id) {
	if (confirm("Ta med Elev?")) {
		let data = {
			id: id,
		};
		fetch("/pupil/enroll", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			window.location.href = "/pupil";
		});
	}
}

document.addEventListener("click", function (evnt) {
	// console.log(evnt.target);
	if (evnt.target.id != "sideNavButton") {
		closeNav();
	}
});
