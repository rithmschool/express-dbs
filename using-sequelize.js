const express = require('express')
const app = new express()

// load our templating system -- we'll use Mozilla's nunjucks
const nunjucks = require('nunjucks')
nunjucks.configure('templates', {express: app})

// connect to our DB
const Sequelize = require('sequelize')
const sequelize = new Sequelize({
    dialect: 'postgres',
    operatorAliases: false,
})

// models
const Student = sequelize.define('students',
    {
        fname: { type: Sequelize.STRING },
        lname: { type: Sequelize.STRING },
    },
    {
        timestamps: false,   // don't expect createdAt/changedAt fields
        underscored: true,   // DB field names like_this, not likeThis
        getterMethods: {
            fullName() { return this.fname + " " + this.lname },
        }
    }
)

const Assignment = sequelize.define('assignments',
    {
        title: { type: Sequelize.STRING },
        grade: { type: Sequelize.INTEGER }
    },
    {
        timestamps: false, 
        underscored: true,
    }
)

// Understand one-to-many relationship between Students -> Assignments
Student.hasMany(Assignment)


app.get('/', async function (req, res) {
    // show list of all students
    const students = await Student.findAll()
    res.render('index.html', {students})
})

app.get('/student/:id', async function (req, res) {
    // show info about student & their assignments
    const id = req.params.id
    const student = (await Student.findById(id))
    console.log("Full name is", student.fullName)
    const assignments = await student.getAssignments()
    res.render('student.html', {student, assignments})
})

app.listen(3012, function() {
    console.log("using-sequelize listening on 3012")
})