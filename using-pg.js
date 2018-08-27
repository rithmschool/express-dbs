const express = require('express')
const app = new express()

// load our templating system -- we'll use Mozilla's nunjucks
const nunjucks = require('nunjucks')
nunjucks.configure('templates', {express: app})

// connect to DB: use default Postgres server/database/user
const { Client } = require('pg')
const client = new Client()

client.connect()

app.get('/', async function (req, res) {
    // show list of all students
    const students = (await client.query(
            "SELECT id, fname, lname FROM students")).rows
    res.render('index.html', {students})
})

app.get('/student/:id', async function (req, res) {
    // show info about student & their assignments
    const id = req.params.id
    const student = (await client.query(
            "SELECT fname, lname FROM students WHERE id=$1", 
            [id])).rows[0]
    const assignments = (await client.query(
            "SELECT title, grade FROM assignments WHERE student_id=$1",
            [id])).rows
    res.render('student.html', {student, assignments})
})

app.listen(3010, function() {
    console.log("using-pg listening on 3010")
})