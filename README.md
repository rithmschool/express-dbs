# Different Approaches to Using Relational Databases with Express

JavaScript is increasingly popular for developing backend servers,
often using the Express library with Node. While many tutorials
show using Node/Express with NoSQL databases, like MongoDB,
these kind of databases are often not a good for common, relational
data requirements. Many projects would benefit from a more scalable,
transactional relational database.

However, this leads to developer design decisions: should I write
SQL queries directly in my code? Should I use an abstraction layer?
Should I use an Object-Relational Mapper? 

In this post, we'll explore a few approaches to the same problem.
We'll use a tiny application, but develop it for each approach, so you
can get an early sense of how it would be to work in these different
styles.

## Our Requirements

The sample application we'll build is very simple: it is tiny web
application that can show a list of students and a detail page about
a student, which shows the assignements they've turned in and their
grade.

It will have two routes:

- `/`: the homepage, which lists all students
- `/student/[id]`, which shows info & assignments for that student

Our data model will use two tables:

### Student

- `id`: an auto-incrementing integer
- `fname`: first name
- `lname`: last name

### Assignments

- `id`: an auto-incrementing integer
- `student_id`: the ID of the related student
- `title`: the title of the assignment
- `grade`: the numeric grade (1-100) received

## Our Tech Stack

We'll use Node and Express, along with PostgreSQL for the database.
Most of this tutorial could work equally well with another relational
database (such as SQLite or MySQL)---however PostgreSQL is our choice
here at Rithm for a scalable, fully transactional, and standards-compliant
Open Source database.

We'll use *Nunjucks* for our HTML templates. This is a easy-to-understand
templating system for JavaScript/Node. (For those who've worked with
Jinja2 in the Python world, Nunjucks uses the same syntax).

For connecting to the database, we'll show three different styles:

- **Connecting directly with the pg library**

- **Connecting using an abstraction layer, knex**

- **Connecting using an ORM, Sequelize**

## Setup

You can view/clone the demonstration for this tutorial at
https://github.com/rithmschool/express-dbs/.

First, install the required Node libraries (Nunjucks, PG, Knex, and Sequelize):

```
    $ npm install
```

Then we can create our database and put in a tiny amount of sample data.
You'll need to have PostgreSQL installed, and have a default user and
default database set up running on your development machine:

```
    $ psql < database.sql
```

The tables we've created are straightforward:

```sql
CREATE TABLE students (
    id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    fname text NOT NULL,
    lname text NOT NULL
);

INSERT INTO students (fname, lname) VALUES 
    ('Sylvia', 'Plath'),
    ('Anne', 'Sexton');

CREATE TABLE assignments (
    id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    student_id integer NOT NULL REFERENCES students,
    title text NOT NULL,
    grade integer NOT NULL
);

INSERT INTO assignments (student_id, title, grade) VALUES 
    (1, 'Essay #1', 85),
    (1, 'Poem #1', 90),
    (2, 'Short Story', 80),
    (2, 'Long Poem', 87);
```

## Our Templates

The HTML templates for this project are both in the `templates/`
directory, and are very straightforward and plain:

### index.html

```html
<!DOCTYPE html>
<html>
<head><title>Students</title></head>
<body>
  <h1>Students</h1>    
  <ul>
  {% for student in students %}
    <li>
      <a href="/student/{{ student.id }}">
        {{ student.fname }} {{ student.lname }}
      </a>
    </li>
  {% endfor %}
  </ul>
</body>
</html>
```

### student.html

```html
<!DOCTYPE html>
<html>
<head><title>{{ student.fname }} {{ student.lname }}</title></head>
<body>
  <h1>{{ student.fname }} {{ student.lname }}</h1> 
  <ul>
    {% for assignment in assignments %}
      <li>{{ assignment.title }} got an {{ assignment.grade }}</li>
    {% endfor %}
  </ul>   
</body>
</html>
````

## Connecting Directly With PG

Our first approach will be the lowest-level: to connect directly
to our database using the `pg` library. 

Look at `using-pg.js`:

```js
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
```

You can run this with `node using-pg.js` and then view the site at
*http://localhost:3010*.

A few things to note:

- Being asynchronous, all database calls (such as `client.query`) need
  to be handled asynchronously. This could be done using Promise-style
  syntax (`.then(fn)`), but we're showing a more modern paradigm of
  *async* functions which *await* results.

- Using PG directly, we write our own SQL, so can use the full range
  of PostgreSQL's sophisticated features. However, we have to know how
  to write SQL, and have to be careful not to open ourselves up to
  SQL injection attacks by trying to template our SQL directly. Instead,
  we can use *parameters*, like `WHERE id=$1` --- this will be filled in
  safely by the PG library from the `id` variable.

## Using an Abstraction Layer with Knex

The [Knex project](https://knexjs.org/) creates a thin abstraction layer
over a relational database: you still have to know about the layout of
your database tables, but no longer need to write SQL directly.

Look at `using-knex.js`:

```js
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
```

You can run this with `node using-knex.js` and then view the site at
*http://localhost:3011*.

Some things to note:

- Knex querying feels like jQuery: you chain together calls, like
  `knex.select(fields).from(table).where(requirements)`. This can feel
  like writing natural JS, but gets translated to SQL.

- While we don't demonstrate this, Knex has commands to create tables
  for us, handle far more complex queries, and even help with *migrations*:
  when your table schemas need to be updated mid-project.

## Using an ORM: Sequelize

[Sequelize](http://docs.sequelizejs.com/) is a full-blown ORM for Node.

An ORM is an "object-relational mapper": a system that bridges the diifferent
conceptual ideas of object-oriented classes with relational tables.
These allow you to create "models" that are OO classes that ultimately
use data stored in relational databases.

Take a look at the `using-sequelize.js` file:

```js
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
```

You can run this with `node using-sequelize.js` and then view the site at
*http://localhost:3012*.

Some things to notice:

- We first create *models* for our application: classes for `Student`
  and `Assignment`. Sequelize hides some of the common details from us here:
  we don't need to specify that these tables have integer `id` fields, as
  this is a default configuration.

- Those classes can specify defaults, restrictions, and relationships ---
  `Student.hasMany(Assignment)` tells Sequelize about the relationship
  between students and assignments, which will allow us to use it easily later.

- We can leverage OO concepts, like adding additional properties or methods
  onto our models. For example: we're likely to often want to refer to
  students by their full names, so we've created a simple `fullName` property
  that will let us do so conveniently, rather than having to sprinkle
  `firstName + " " + lastName` in many places throughout our code.   

- Navigating relationships in the database can be much simpler: to find the
  assignments for a student, we can just say `student.getAssignments()` ---
  Sequelize knows how to navigate that relationship. 

## Choosing An Approach

All three of these can be good approaches, depending on your style and needs.

### Using Database Directly

**Pros:**

- Lets you benefit from the SQL you already know: rather than having to learn
  new syntax or libraries to create tables or write queries, you can do so   directly.

- Since there is less code between yours and the database, this can be easier
  to debug and can sometimes perform better.

- Lets you use advanced or uncommon features of your database: abstraction
  layers and ORMs offer many features of SQL, but may not handle complex
  things like specialized field types, unusual indexes or query options,
  or other specialized features of your database.

**Cons:**

- You have to write the SQL yourself. This might be a challenge if SQL is
  new to you, or it may simply be tedious, especially when writing SQL that
  is dynamically constructed based on user choices (writing the SQL for
  searching sites can be particularly finicky in a string-splicing kind of
  way.)

- You may end up writing SQL that only works with your database. Since
  different databases use slightly different syntax, it can be trickier to
  move to a different database vendor.

- Programmers on your project will have to understand how the database
  is laid out: if you want to get the assignments for a student, you'd need
  to know how to join these tables yourself.

### Using Knex as an Abstraction Layer

**Pros:**

- Removes much of the database vendor dependence: Knex knows which database
  system you're connecting to, and will change the SQL it writes to match.

- Can be faster or more "JavaScript"-y to write than writing SQL by hand,
  particularly for more complex or dynamic queries.

- Can assist with migrations, where your schema has to change mid-project.

**Cons:**

- Programmers will still have to know about the database schema to do many
  tasks. To show all assignments for a student, you'll need to know how
  their joined, even if Knex can hide some of the actual SQL writing from you.

- While the Knex API is delightfully straightforward and matches SQL well,
  it's still a new library to learn, and, if you know SQL well, you may
  end up having to look up how to express a query that you could easily
  write yourself in SQL. (In fairness, Knex does let you write raw SQL, too,
  though this may violate the "you don't need to know SQL" or "you don't
  need to write SQL in the right flavor for your database" promises.)

### Using an ORM with Sequelize

**Pros:**

- ORMs can make hard things easier: Sequelize can let you batch up changes
  to your tables so that it can write a single `INSERT` or `UPDATE`
  statement without your having to refactor your application in the way
  you might if you did this by hand-written SQL or Knex.

- ORMs can let you make good object-oriented design choices: you can put
  logic in your model classes that open all sorts of possibilities:
  methods that combine fields or sum up fields, methods that check user
  permissions before showing data, and so on. With enough effort, you can
  make it so that other programmers on your project might not even realize
  you're using a relational datbase or have to know anything about the
  schema.

- Sequelize can create your tables for you based on the models you write
  (so you don't have to do this yourself). It can also make it much easier
  to handle migrations, much like Knex.

**Cons:**

- Sequelize is a large, complex library: when things break, there are a lot
  of abstractions between your JavaScript and your database. It can be
  harder to debug applications using an ORM like this.

- ORMs can write inefficient SQL compared to SQL you'd write yourself.
  Sequelize provides lots of options for making sure it makes great choices,
  but it might take you a while to learn these.

- It can be more challenging to use specialized features of your database
  (like geospatial extensions or full-text search) in Sequelize than if you
  were writing the SQL by hand, since it may not have all of the same friendly
  abstractions for these things.

## Closing Thoughts

Some developers are passionate about one of these approaches an use the
same approach for different projects. This may work well if you've invested
a lot of time in understanding a complex ORM, or if you often work with
the same team members who will have time to learn about it.

Others may choose different options here based on their requirements:
using an ORM for a small application with a few tables might be massive
conceptual overkill. Being closer to the database, code-wise, can also
allow you to write SQL that may leverage nifty and advanced features of
your database.

Here at Rithm, we teach different approaches: 

- We think it's important for developers to know SQL. It's the most 
  widely used query language and will probably remain so for many years.
  Understanding SQL makes it easier to understand the relational model, 
  and is a highly transferrable skill (if your next web project is in 
  Python or Go, the SQL you learned will be very useful, whereas 
  memorizing all of Knex's API probably won't be)

- We also think it's important to understand object orientation and
  abstraction well. Abstractions can make it easier to work in teams or
  on larger projects or with more complex data schemas. We also teach
  an ORM and lots of OO concepts so that students can understand this
  end of things.

Whatever you choose, enjoy the power you have from getting to choose!


