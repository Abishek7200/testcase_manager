# Testcase Manager v1.1

A web-based application to efficiently manage and track software test cases. This tool provides a clean, modern interface for creating, organizing, and reporting on your entire test suite.

## ✨ Features

* **User Authentication**: Secure login and registration system for users.
* **Hierarchical Folder System**: Organize test cases into modules and sub-modules with a collapsible tree view.
* **Full Test Case CRUD**: Create, read, update, and delete test cases.
* **Rich Text Editing**: Use a WYSIWYG editor for fields like *Steps*, *Pre-conditions*, and *Expected Results*.
* **Powerful Import/Export**:
    * Bulk import test cases by copy-pasting from Excel, including multi-line data.
    * Export the current view of test cases to an Excel file.
* **Advanced Search & Filtering**:
    * Live search by ID, Title, Ticket ID, or Tags.
    * Filter test cases by status, creator, and folder.
* **Bulk Actions**: Select multiple test cases to copy their data or delete them in a single action.
* **Customizable View**: Toggle the visibility of table columns to create a personalized view.
* **Dashboard Metrics**: At-a-glance view of the total, passed, failed, blocked, and not-run tests.
* **Modern UI**: A clean, responsive, and user-friendly interface with modern design elements.

***

## 🚀 Built With

This project is built with the following technologies:
* **Backend**: Node.js, Express.js
* **Database**: MySQL
* **Frontend**: HTML, CSS, Vanilla JavaScript

***

## ⚙️ Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (which includes npm)
* A running [MySQL](https://www.mysql.com/) server

### Installation

1.  **Clone the repository**
    ```sh
    git clone [https://github.com/your_username/testcase_manager.git](https://github.com/your_username/testcase_manager.git)
    ```
2.  **Install NPM packages**
    Navigate to the project directory and run:
    ```sh
    npm install
    ```
3.  **Set up the Database**
    * Connect to your MySQL server.
    * Create a new database (e.g., `testmgmt`).
    * Import the database schema and tables by running the queries in the `sql_query.sql` file.
4.  **Configure Environment Variables**
    * In the project's root directory, create a `.env` file.
    * Add your database connection details to it. You can use your `db.js` or `server.js` file as a reference for the required variables (e.g., DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE).
5.  **Run the Server**
    ```sh
    node server.js
    ```
    The application should now be running at `http://localhost:3001/login`.

***

## Usage

Once the server is running, navigate to the application in your browser.
1.  Go to `http://localhost:3001/register` to create a new user account.
2.  Log in with your new credentials.
3.  On the main page, you can start by creating a **New Module** (folder) in the sidebar.
4.  Select a module and click **"Add Test Case"** or **"Import Test Cases"** to begin populating your test suite.
5.  Use the search and filter options to manage and view your tests.

***

## 👨‍💻 Developer

* **Abishekkumar**