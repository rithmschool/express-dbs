const express = require('express')
const app = new express()

// load our templating system -- we'll use Mozilla's nunjucks
const nunjucks = require('nunjucks')
nunjucks.configure('templates', {express: app})

// connect to our DB
const knex = require('knex')({
    client: 'pg',
    connection: {host: '127.0.0.1'},
})

app.get('/', async function (req, res) {
    // show list of all students
    const students = (
        await knex.select('id', 'fname', 'lname')
                  .from('students'))
    res.render('index.html', {students})
})

app.get('/student/:id', async function (req, res) {
    // show info about student & their assignments
    const id = req.params.id
    const student = (
        await knex.select('fname', 'lname')
                  .from('students')
                  .where('id', id))[0]
    const assignments = (
        await knex.select('title', 'grade')
                  .from('assignments')
                  .where('student_id', id))
    res.render('student.html', {student, assignments})
})

app.listen(3011, function() {
    console.log("using-knex listening on 3011")
})