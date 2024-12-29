# Bolt Dashboard

A modern dashboard application with user authentication and role management built with React, Python (Flask), and SQLite3.

## Features

- User authentication with JWT
- Role-based access control (Admin, Moderator, User)
- Activity logging and monitoring
- Modern UI with Tailwind CSS and Headless UI
- Secure backend with Flask

## Setup Instructions

### Backend Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the Flask server:
```bash
cd backend
python app.py
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm start
```

### Initial Admin Setup

To create the initial admin account, send a POST request to `/api/setup-admin` with:
```json
{
    "username": "admin",
    "password": "your-secure-password"
}
```

## Usage

1. Access the application at `http://localhost:3000`
2. Log in with your credentials
3. Navigate the dashboard to view recent activities

## Security Notes

- Change the SECRET_KEY in app.py before deploying
- Use environment variables for sensitive information
- Implement proper password policies
- Add rate limiting for production use
