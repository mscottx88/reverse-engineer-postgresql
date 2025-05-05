# Reverse Engineer PostgreSQL

This repository is designed to teach you some tricky SQL, learn some of the PostgreSQL internal catalog tables, while at the same time demonstrating how to put this knowledge to use in a practical way: ephemeral e2e testing.

# Overview

In this repo, you will find some scripts and an end-to-end test setup to exercise a simple API.

The premise is that you have an API and a database the API manipulates. To run an end-to-end test, you will clone the input schema into an ephemeral schema, which is then used for the API to use as its database for the test.

This schema cloning process allows

- End-to-end tests to run in parallel with other tests;
- Generation of a pristine database for end-to-end testing purposes.

At the end of the test, the ephemeral schema is dropped, cleaning up the database.

# Getting Started

## Node.js

As with any Node.js application, you will need to install its dependencies:

```sh
npm i
```

## Database

Next, you will need a Postgres server. You can install Postgres free on your local computer for this purpose. Once that's done, you'll need to create a role that allows for login but also allows for schema creation with the CREATEDB option:

```sql
CREATE ROLE test_user WITH
  LOGIN
  NOSUPERUSER
  INHERIT
  CREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;
```

> **Note** This is necessary because the end-to-end test will in fact create a schema and drop it later.

## Setup the environment

You need to populate the user name and password in the `.env`, or use the dummy values provided there.

Next, you will want initialize the database for the API. This will create the source schema and create some objects in there. This simulates a test/production environment with a schema and some tables for the API to use.

```sh
npm run init
```

# Scripts

There are two scripts that you can execute directly and observe their output:

Use this script to convert the programmatically generated queries into static queries and store them in a file for viewing. After running this command a new file named `./src/queries.sql` will appear, containing the generated content.

```sh
npm run generate-queries
```

Use this script to execute the end-to-end tests. As part of the test, the queries used to recreate the source schema objects are stored in a file for viewing. After running this command a new file named `./src/output.sql` will appear, containing the DDL to reverse-engineer the source database.

```sh
npm run test
```

# Tests

There is an end-to-end test setup that will do a couple operations against the API: create (POST) and read (GET).

Before the test is executed, the test computes the next ephemeral schema name (simple incrementing scheme, implemented by a sequence object). That name is assigned to the newly created schema.

Next, the input schema where the application objects actually reside (e.g. dev/uat) are recreated in the previously generated schema.

To do this, a number of queries are executed against the source Postgres server. These queries interrogate the system catalog objects such as pg_class, pg_indexes, and so on. Those queries in turn produce dynamic Data Definition Language (DDL) commands, which are finally executed against the target Postgres server, resulting in creating all the source objects in the new schema.

# Running Interactively

You can run the scripts interactively using the VS Code debugger. To do so, visit the Debug perspective and choose the `Launch File w/ ts-node` launch configuration. Finally, ensure the script you want to run has the current focus in VS Code and press F5 to run that script.

You can set breakpoints and observe the application in real-time.
