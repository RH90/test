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
function downloadCSV(csv, filename) {
	var csvFile;
	var downloadLink;

	// CSV file
	csvFile = new Blob([csv], { type: "text/csv" });

	// Download link
	downloadLink = document.createElement("a");

	// File name
	downloadLink.download = filename;

	// Create a link to the file
	downloadLink.href = window.URL.createObjectURL(csvFile);

	// Hide download link
	downloadLink.style.display = "none";

	// Add the link to DOM
	document.body.appendChild(downloadLink);

	// Click download link
	downloadLink.click();
}
function exportTableToCSV(filename) {
	var csv = [];
	var rows = document.querySelectorAll(".sortable tr");

	for (var i = 0; i < rows.length; i++) {
		var row = [],
			cols = rows[i].querySelectorAll("td, th");

		for (var j = 0; j < cols.length; j++)
			row.push('"' + cols[j].innerText + '"');

		csv.push(row.join(","));
	}

	// Download CSV file
	downloadCSV(csv.join("\n"), filename);
}

function lockerlayout() {
	fetch("/lockerlayout?dataonly=1", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	}).then((res) => {
		res.json().then((output) => {
			const rows = output.rows;
			var cells = document.querySelectorAll(".locker-cell");
			for (let i = 0; i < cells.length; i++) {
				var locker = rows.filter((rows) => {
					return rows.number == cells[i].innerText;
				})[0];
				cells[i].style.background = output.statusLocker[locker.status].color;

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
