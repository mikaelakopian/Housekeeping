# Housekeeping Management System

This application helps manage housekeeping tasks and assignments for hotel rooms. It provides a web interface for managing employees, tasks, and automatically assigns work to available employees.

## Project Structure

The project is organized into two main components:

- `server/`: FastAPI backend that handles data and business logic
- `client/`: Next.js frontend with HeroUI components

## Features

- Manage employees and their working status
- Add, edit, and delete housekeeping tasks
- Automatically assign tasks to available employees
- Track trolley requirements and availability
- Beautiful and intuitive user interface using HeroUI components

## Installation

### Server Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Start the server:
   ```
   python start_server.py
   ```

The API will be available at http://localhost:8000.

### Client Setup

1. Navigate to the client directory:
   ```
   cd client
   ```

2. Install Node.js dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The web interface will be available at http://localhost:3000.

## Usage

### Dashboard

The dashboard provides an overview of:
- Number of working employees
- Number of tasks for the day
- Option to generate assignments
- View assignment results

### Employees Management

- View all employees and their working status
- Toggle whether an employee is working today
- Add new employees
- Remove employees

### Tasks Management

- View all tasks with room numbers and details
- Add new tasks
- Delete tasks

### Assignments

- View detailed assignments for each employee
- Generate new assignments based on current employees and tasks

## API Endpoints

### Tasks API
- `GET /api/tasks`: Get all tasks
- `POST /api/tasks`: Update all tasks
- `POST /api/tasks/add`: Add a new task
- `DELETE /api/tasks/{room}`: Delete a task by room number

### Employees API
- `GET /api/employees`: Get all employees
- `GET /api/employees/working`: Get working employees
- `POST /api/employees`: Update all employees
- `POST /api/employees/add`: Add a new employee
- `PUT /api/employees/{name}/toggle`: Toggle employee working status
- `DELETE /api/employees/{name}`: Delete an employee

### Housekeeping API
- `GET /api/housekeeping/corridors`: Get corridor configurations
- `POST /api/housekeeping/assign`: Assign tasks to employees

## Data Files

The application uses two main JSON files to store data:
- `tasks.json`: Stores the housekeeping tasks
- `employees.json`: Stores employee information

## License

This project is licensed under the MIT License - see the LICENSE file for details. 