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
function geUt(locker, pupil) {
	console.log("locker: " + locker + ", pupil: " + pupil);
}

function openNav() {
	document.getElementById("mySidenav").style.display = "block";
}
function closeNav() {
	document.getElementById("mySidenav").style.display = "none";
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
function removePupil(id) {
	if (confirm("Ta bort Elev?")) {
		let data = {
			id: id,
		};
		fetch("/pupil/remove", {
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
