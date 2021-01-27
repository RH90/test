var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database("db/database.db");
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
